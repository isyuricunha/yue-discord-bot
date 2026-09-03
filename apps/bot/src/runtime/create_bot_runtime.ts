import { Collection, Client, GatewayIntentBits, Partials } from 'discord.js'
import type { Server } from 'node:http'
import { prisma } from '@yuebot/database'

import { assert_bot_runtime_env, CONFIG } from '../config'
import { logger } from '../utils/logger'
import type { Command, ContextMenuCommand } from '../commands'
import { start_internal_api } from '../internal/api'
import { start_bot_readiness_server } from '../internal/readiness_server'
import { GiveawayScheduler } from '../services/giveawayScheduler'
import { FreeGameScheduler } from '../services/freeGameScheduler'
import { WarnExpirationService } from '../services/warnExpirationService'
import { AutoroleScheduler } from '../services/autoroleScheduler'
import { autoroleService } from '../services/autorole.service'
import { ScheduledEventScheduler } from '../services/scheduledEventScheduler'
import { InventoryExpirationScheduler } from '../services/inventoryExpirationScheduler'
import { AniListWatchlistScheduler } from '../services/anilistWatchlistScheduler'
import { PollExpirationScheduler } from '../services/pollExpirationScheduler'
import { SupportScheduler } from '../services/support/supportScheduler'
import { DiscordDeliveryScheduler } from '../services/discordDeliveryScheduler'
import { RuntimeHeartbeatService } from '../services/runtimeHeartbeat.service'
import { initModerationPersistenceService } from '../services/moderationPersistence.service'
import { initPunishmentRoleService } from '../services/punishmentRole.service'
import { get_llm_client } from '../services/llm_client_singleton'
import { get_conversation_backend } from '../services/conversation_backend_factory'
import { apply_startup_presence } from '../services/presence.service'
import { apply_startup_app_description } from '../services/app_description.service'
import { initMusicService } from '../services/music.service'
import { initDjModeService, djModeService } from '../services/dj_mode.service'
import { antiRaidService } from '../services/antiRaid.service'
import { voiceXpService } from '../services/voiceXp.service'
import { install_serialized_message_xp } from '../services/xpWriteSerialization.service'
import { RuntimeLifecycle } from './lifecycle'
import { prune_stale_guilds_from_database, sync_guilds_to_database } from './guild_sync'
import { register_discord_events } from './register_discord_events'

declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>
    contextMenuCommands: Collection<string, ContextMenuCommand>
  }
}

function create_discord_client(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      // Temporarily disabled while Discord reviews Yue's privileged intents.
      // GatewayIntentBits.MessageContent,
      // GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.GuildMember,
      Partials.User,
    ],
  })

  client.commands = new Collection<string, Command>()
  client.contextMenuCommands = new Collection<string, ContextMenuCommand>()
  return client
}

function close_server(server: Server | null): Promise<void> {
  if (!server || !server.listening) return Promise.resolve()

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

export type BotRuntime = {
  client: Client
  start: () => Promise<void>
  shutdown: (reason: string) => Promise<void>
  service_count: () => number
}

export function createBotRuntime(): BotRuntime {
  const client = create_discord_client()
  const lifecycle = new RuntimeLifecycle()
  let started = false
  let shutdown_promise: Promise<void> | null = null
  let internal_server: Server | null = null
  let readiness_server: Server | null = null

  async function start_ready_services(): Promise<void> {
    logger.info(`🤖 Bot conectado como ${client.user?.tag}`)
    logger.info(`📊 Servidores: ${client.guilds.cache.size}`)
    logger.info(`👥 Usuários: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`)

    const llm_client = get_llm_client()
    if (llm_client) {
      get_conversation_backend()
    } else {
      logger.info(
        { backend: 'disabled' },
        'LLM features disabled, skipping conversation backend initialization'
      )
    }

    await apply_startup_presence(client)
    await apply_startup_app_description(client)
    await prune_stale_guilds_from_database(client)
    await sync_guilds_to_database(client)

    try {
      await autoroleService.initialize_pending_index()
    } catch (error) {
      logger.warn(
        { error },
        'Failed to initialize autorole index; messages will fall back to the database'
      )
    }

    initModerationPersistenceService(client)
    initPunishmentRoleService(client)
    antiRaidService.setClient(client)

    internal_server = start_internal_api(client, {
      host: CONFIG.internalApi.host,
      port: CONFIG.internalApi.port,
      secret: CONFIG.internalApi.secret,
      maxBodyBytes: CONFIG.internalApi.maxBodyBytes,
    })
    lifecycle.register_started('internal bot API', () => close_server(internal_server))

    void djModeService?.restore_all_enabled().catch((error) => {
      logger.error({ error }, 'Falha ao restaurar DJ mode')
    })

    const { loadCommands, loadContextMenuCommands } = await import('../commands')
    await loadCommands(client)
    logger.info(`✅ ${client.commands.size} comandos carregados`)

    await loadContextMenuCommands(client)
    logger.info(`✅ ${client.contextMenuCommands.size} context menu comando(s) carregado(s)`)

    await lifecycle.start_service('Discord delivery scheduler', new DiscordDeliveryScheduler(client))
    await lifecycle.start_service('voice XP service', {
      start: () => voiceXpService.start(client),
      stop: () => voiceXpService.stop(),
    })
    await lifecycle.start_service('giveaway scheduler', new GiveawayScheduler(client))
    await lifecycle.start_service('AniList watchlist scheduler', new AniListWatchlistScheduler(client))
    await lifecycle.start_service('warn expiration service', new WarnExpirationService(client))
    await lifecycle.start_service('autorole scheduler', new AutoroleScheduler(client))
    await lifecycle.start_service('scheduled event scheduler', new ScheduledEventScheduler(client))
    await lifecycle.start_service('inventory expiration scheduler', new InventoryExpirationScheduler(client))
    await lifecycle.start_service('poll expiration scheduler', new PollExpirationScheduler(client))
    await lifecycle.start_service('free game scheduler', new FreeGameScheduler(client))
    await lifecycle.start_service('support scheduler', new SupportScheduler(client))
    await lifecycle.start_service('runtime heartbeat', new RuntimeHeartbeatService(client))
  }

  async function start(): Promise<void> {
    if (started) return
    started = true

    assert_bot_runtime_env()
    install_serialized_message_xp()
    register_discord_events(client)

    lifecycle.register_started('database', () => prisma.$disconnect())
    lifecycle.register_started('Discord client', () => client.destroy())

    readiness_server = start_bot_readiness_server(client, {
      host: CONFIG.readiness.host,
      port: CONFIG.readiness.port,
      secret: CONFIG.internalApi.secret,
    })
    lifecycle.register_started('bot readiness server', () => close_server(readiness_server))

    const music = initMusicService(client)
    initDjModeService(client, music.kazagumo)

    const ready = new Promise<void>((resolve, reject) => {
      client.once('clientReady', () => {
        void start_ready_services().then(resolve, reject)
      })
    })

    logger.info('🔑 Tentando login no Discord...')
    await client.login(CONFIG.discord.token)
    await ready
  }

  function shutdown(reason: string): Promise<void> {
    if (shutdown_promise) return shutdown_promise

    shutdown_promise = (async () => {
      logger.info({ reason }, '🛑 Desligando bot...')
      const errors = await lifecycle.stop_all()

      for (const failure of errors) {
        logger.error(
          { error: failure.error, service: failure.name },
          'Failed to stop bot runtime service'
        )
      }
    })()

    return shutdown_promise
  }

  return {
    client,
    start,
    shutdown,
    service_count: () => lifecycle.count(),
  }
}
