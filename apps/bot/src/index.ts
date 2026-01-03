import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { assert_bot_runtime_env, CONFIG } from './config';
import { logger } from './utils/logger';
import { prisma } from '@yuebot/database';
import { GiveawayScheduler } from './services/giveawayScheduler';
import { WarnExpirationService } from './services/warnExpirationService';
import { AutoroleScheduler } from './services/autoroleScheduler';
import { ScheduledEventScheduler } from './services/scheduledEventScheduler';
import { InventoryExpirationScheduler } from './services/inventoryExpirationScheduler';
import { AniListWatchlistScheduler } from './services/anilistWatchlistScheduler';
import { initModerationPersistenceService } from './services/moderationPersistence.service';
import { initPunishmentRoleService } from './services/punishmentRole.service';
import type { Command, ContextMenuCommand } from './commands';
import { start_internal_api } from './internal/api';

let internal_server: ReturnType<typeof start_internal_api> | null = null;

// Extend Client to include commands collection
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
    contextMenuCommands: Collection<string, ContextMenuCommand>;
  }
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
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
});

// Initialize commands collection
client.commands = new Collection<string, Command>();
client.contextMenuCommands = new Collection<string, ContextMenuCommand>();

async function prune_stale_guilds_from_database(discord_client: Client) {
  const current_ids = new Set(Array.from(discord_client.guilds.cache.keys()));

  try {
    const existing = await prisma.guild.findMany({ select: { id: true } });
    const stale_ids = existing.map((g) => g.id).filter((id) => !current_ids.has(id));

    if (stale_ids.length === 0) return;

    logger.info(`🧹 Removendo ${stale_ids.length} guild(s) stale do banco de dados...`);

    const result = await prisma.guild.deleteMany({
      where: {
        id: { in: stale_ids },
      },
    });

    logger.info(`✅ Guilds stale removidas: ${result.count}`);
  } catch (error) {
    logger.error({ error }, '❌ Erro ao remover guilds stale do banco');
  }
}

async function sync_guilds_to_database(discord_client: Client) {
  const guilds = Array.from(discord_client.guilds.cache.values());

  logger.info(`🔄 Sincronizando ${guilds.length} guild(s) no banco de dados...`);

  for (const guild of guilds) {
    try {
      await prisma.guild.upsert({
        where: { id: guild.id },
        update: {
          name: guild.name,
          icon: guild.icon,
          ownerId: guild.ownerId,
        },
        create: {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          ownerId: guild.ownerId,
        },
      });
    } catch (error) {
      logger.error({ error, guildId: guild.id }, '❌ Erro ao sincronizar guild no banco');
    }
  }

  logger.info('✅ Sincronização de guilds concluída');
}

// Event: Bot ready
client.once('ready', async () => {
  assert_bot_runtime_env();
  logger.info(`🤖 Bot conectado como ${client.user?.tag}`);
  logger.info(`📊 Servidores: ${client.guilds.cache.size}`);
  logger.info(`👥 Usuários: ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`);

  await prune_stale_guilds_from_database(client);
  await sync_guilds_to_database(client);

  initModerationPersistenceService(client)
  initPunishmentRoleService(client)

  internal_server = start_internal_api(client, {
    host: CONFIG.internalApi.host,
    port: CONFIG.internalApi.port,
    secret: CONFIG.internalApi.secret,
  });
  
  // Load commands
  const { loadCommands } = await import('./commands');
  await loadCommands(client);
  logger.info(`✅ ${client.commands.size} comandos carregados`);

  const { loadContextMenuCommands } = await import('./commands');
  await loadContextMenuCommands(client);
  logger.info(`✅ ${client.contextMenuCommands.size} context menu comando(s) carregado(s)`);
  
  // Iniciar scheduler de sorteios
  const giveawayScheduler = new GiveawayScheduler(client);
  giveawayScheduler.start();
  
  // Iniciar serviço de expiração de warns
  const warnExpirationService = new WarnExpirationService(client);
  warnExpirationService.start();

  // Iniciar scheduler de autorole
  const autoroleScheduler = new AutoroleScheduler(client);
  autoroleScheduler.start();

  // Iniciar scheduler de eventos agendados
  const scheduledEventScheduler = new ScheduledEventScheduler(client)
  scheduledEventScheduler.start()

  // Iniciar scheduler de expiração de inventário (roles/nick-color/xp boost)
  const inventoryExpirationScheduler = new InventoryExpirationScheduler(client)
  inventoryExpirationScheduler.start()

  const aniListWatchlistScheduler = new AniListWatchlistScheduler(client)
  aniListWatchlistScheduler.start()
});

// Event: Guild create (bot joins server)
client.on('guildCreate', async (guild) => {
  logger.info(`➕ Bot adicionado ao servidor: ${guild.name} (${guild.id})`);
  
  try {
    // Create guild entry in database
    await prisma.guild.upsert({
      where: { id: guild.id },
      update: {
        name: guild.name,
        icon: guild.icon,
        ownerId: guild.ownerId,
      },
      create: {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        ownerId: guild.ownerId,
      },
    });
    
    logger.info(`✅ Servidor ${guild.name} registrado no banco de dados`);
  } catch (error) {
    logger.error({ error }, `❌ Erro ao registrar servidor ${guild.name}`);
  }
});

// Event: Guild delete (bot leaves server)
client.on('guildDelete', async (guild) => {
  logger.info(`➖ Bot removido do servidor: ${guild.name} (${guild.id})`);

  try {
    await prisma.guild.deleteMany({ where: { id: guild.id } });
    logger.info(`✅ Servidor removido do banco de dados: ${guild.name} (${guild.id})`);
  } catch (error) {
    logger.error({ error, guildId: guild.id }, '❌ Erro ao remover servidor do banco de dados');
  }
});

// Event: Interaction create (slash commands)
client.on('interactionCreate', async (interaction) => {
  const { handleInteractionCreate } = await import('./events/interactionCreate');
  await handleInteractionCreate(interaction);
});

// Event: Message create (AutoMod)
client.on('messageCreate', async (message) => {
  const { handleMessageCreate } = await import('./events/messageCreate');
  await handleMessageCreate(message);
});

// Event: Guild member add (Autorole)
client.on('guildMemberAdd', async (member) => {
  const { handleGuildMemberAdd } = await import('./events/guildMemberAdd');
  await handleGuildMemberAdd(member);
});

// Event: Guild member remove (Leave message)
client.on('guildMemberRemove', async (member) => {
  const { handleGuildMemberRemove } = await import('./events/guildMemberRemove');
  await handleGuildMemberRemove(member.guild, member.user);
});

// Event: Guild member update (Sync punishment role)
client.on('guildMemberUpdate', async (old_member, new_member) => {
  const { handleGuildMemberUpdate } = await import('./events/guildMemberUpdate')
  await handleGuildMemberUpdate(old_member, new_member)
})

// Event: Guild member update (Audit)
client.on('guildMemberUpdate', async (old_member, new_member) => {
  const { handleAuditGuildMemberUpdate } = await import('./events/auditGuildMemberUpdate')
  await handleAuditGuildMemberUpdate(old_member, new_member)
})

// Event: Message delete/update (Audit)
client.on('messageDelete', async (message) => {
  const { handleMessageDelete } = await import('./events/messageDelete')
  await handleMessageDelete(message)
})

client.on('messageUpdate', async (old_message, new_message) => {
  const { handleMessageUpdate } = await import('./events/messageUpdate')
  await handleMessageUpdate(old_message, new_message)
})

// Event: Channel create/update/delete (Audit)
client.on('channelCreate', async (channel) => {
  if (!('guild' in channel)) return
  const { handleChannelCreate } = await import('./events/channelCreate')
  await handleChannelCreate(channel as any)
})

client.on('channelUpdate', async (old_channel, new_channel) => {
  if (!('guild' in new_channel)) return
  const { handleChannelUpdate } = await import('./events/channelUpdate')
  await handleChannelUpdate(old_channel as any, new_channel as any)
})

client.on('channelDelete', async (channel) => {
  if (!('guild' in channel)) return
  const { handleChannelDelete } = await import('./events/channelDelete')
  await handleChannelDelete(channel as any)
})

// Event: Message reaction add (Giveaways)
client.on('messageReactionAdd', async (reaction, user) => {
  const { execute } = await import('./events/messageReactionAdd');
  await execute(reaction, user);
});

// Event: Message reaction remove (Giveaways)
client.on('messageReactionRemove', async (reaction, user) => {
  const { execute } = await import('./events/messageReactionRemove');
  await execute(reaction, user);
});

// Error handling
client.on('error', (error) => {
  logger.error({ error }, '❌ Erro no cliente Discord');
});

process.on('unhandledRejection', (error) => {
  logger.error({ error }, '❌ Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, '❌ Uncaught exception');
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Desligando bot...');
  internal_server?.close();
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Desligando bot...');
  internal_server?.close();
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

// Login
logger.info('🔑 Tentando login no Discord...');
client.login(CONFIG.discord.token).catch((error) => {
  logger.error('❌ Falha ao fazer login no Discord');
  logger.error({ error }, 'Erro ao fazer login no Discord');
  process.exit(1);
});

export { client };
