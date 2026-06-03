import { Kazagumo, Plugins } from 'kazagumo';
import { Connectors } from 'shoukaku';
import type { NodeOption } from 'shoukaku';
import { Client, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import { logger } from '../utils/logger';
import { getSendableChannel } from '../utils/discord';
import { djModeService } from './dj_mode.service';
import { is_lavalink_player_not_found_error, safe_error_details } from '../utils/safe_error';

type raw_lavalink_node = {
  name?: unknown
  url?: unknown
  auth?: unknown
  secure?: unknown
  enabled?: unknown
}

type lavalink_node = Pick<NodeOption, 'name' | 'url' | 'auth' | 'secure'>

function parse_disabled_node_names(value: string | undefined): Set<string> {
  if (!value) return new Set()
  return new Set(
    value
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean)
  )
}

function normalize_lavalink_nodes(raw_nodes: unknown[], disabled_names: Set<string>): lavalink_node[] {
  const nodes: lavalink_node[] = []

  for (const raw of raw_nodes) {
    const node = raw as raw_lavalink_node | null
    if (!node || typeof node !== 'object') {
      logger.warn({ node: raw }, 'Ignoring invalid Lavalink node entry')
      continue
    }

    const name = typeof node.name === 'string' ? node.name.trim() : ''
    const url = typeof node.url === 'string' ? node.url.trim() : ''
    if (!name || !url) {
      logger.warn({ node: { name, hasUrl: Boolean(url) } }, 'Ignoring Lavalink node missing name or url')
      continue
    }

    if (node.enabled === false || disabled_names.has(name.toLowerCase())) {
      logger.info({ node: name }, 'Lavalink node disabled by configuration')
      continue
    }

    const auth = typeof node.auth === 'string' && node.auth.length > 0 ? node.auth : undefined
    nodes.push({
      name,
      url,
      auth: auth ?? '',
      secure: node.secure === true,
    })
  }

  return nodes
}

class MusicService {
  public kazagumo: Kazagumo;
  private readonly client: Client;

  constructor(client: Client) {
    this.client = client;
    let rawNodes: any[] = [];
    try {
      if (process.env.LAVALINK_NODES) {
        rawNodes = JSON.parse(process.env.LAVALINK_NODES);
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to parse LAVALINK_NODES env variable. Ensure it is valid JSON.');
    }

    const nodes = normalize_lavalink_nodes(
      rawNodes,
      parse_disabled_node_names(process.env.LAVALINK_DISABLED_NODES)
    );

    if (nodes.length === 0) {
      logger.warn('No Lavalink nodes configured. Music system will not be functional.');
    } else {
      logger.info(
        { nodes: nodes.map((n) => ({ name: n.name, url: n.url, secure: n.secure })) },
        `🎵 Initializing Kazagumo with ${nodes.length} node(s)...`
      );
    }

    this.kazagumo = new Kazagumo(
      {
        defaultSearchEngine: 'youtube',
        send: (guildId, payload) => {
          const guild = client.guilds.cache.get(guildId);
          if (guild) guild.shard.send(payload);
        },
        plugins: [
          new Plugins.PlayerMoved(client),
        ],
      },
      new Connectors.DiscordJS(client),
      nodes
    );

    this.setupListeners();
  }

  private setupListeners() {
    this.kazagumo.shoukaku.on('ready', (name) => {
      logger.info({ node: name }, `Lavalink Node [${name}] connected successfully.`);
    });

    this.kazagumo.shoukaku.on('error', (name, error) => {
      logger.error({ node: name, err: safe_error_details(error) }, `Lavalink Node [${name}] encountered an error.`);
    });

    this.kazagumo.shoukaku.on('close', (name, code, reason) => {
      logger.warn({ node: name, code, reason }, `Lavalink Node [${name}] closed connection.`);
    });

    this.kazagumo.shoukaku.on('disconnect', (name, count) => {
      logger.warn({ node: name, reconnectCount: count }, `Lavalink Node [${name}] disconnected.`);
    });

    this.kazagumo.shoukaku.on('reconnecting', (name, left, timeout) => {
      logger.warn({ node: name, attemptsLeft: left, timeout }, `Lavalink Node [${name}] reconnecting...`);
    });

    (this.kazagumo as any).on('debug', (info: unknown) => {
      logger.debug({ info }, 'Kazagumo debug');
    });

    this.kazagumo.on('playerStart', async (player, track) => {
      logger.info({ guild_id: player.guildId, track: track.title }, 'Começou a tocar uma música.');

      const suppress = player.data.get('suppress_next_now_playing_announce') === true;
      if (suppress) {
        player.data.delete('suppress_next_now_playing_announce');
        return;
      }

      const text_channel_id = typeof player.textId === 'string' ? player.textId : null;
      if (!text_channel_id) return;

      const title_raw = typeof track.title === 'string' ? track.title : 'Sem título';
      const title = title_raw.length > 180 ? `${title_raw.slice(0, 179)}…` : title_raw;

      const uri = typeof track.uri === 'string' ? track.uri : '';
      const has_link = /^https?:\/\//i.test(uri);
      const now_playing = has_link ? `[${title}](${uri})` : title;

      const content_raw = `🎶 **Tocando agora:** ${now_playing}`;
      const content = content_raw.length > 2000 ? content_raw.slice(0, 1999) : content_raw;

      try {
        const channel_cached = this.client.channels.cache.get(text_channel_id) ?? null;
        const channel = channel_cached
          ? channel_cached
          : await this.client.channels.fetch(text_channel_id).catch(() => null);

        const sendable = getSendableChannel(channel);
        if (!sendable) return;

        const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('music:toggle_pause')
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Pausar/Retomar'),
          new ButtonBuilder()
            .setCustomId('music:skip')
            .setStyle(ButtonStyle.Primary)
            .setLabel('Pular'),
          new ButtonBuilder()
            .setCustomId('music:stop')
            .setStyle(ButtonStyle.Danger)
            .setLabel('Parar'),
          new ButtonBuilder()
            .setCustomId('music:loop')
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Loop')
        );

        await sendable.send({
          content,
          allowedMentions: { parse: [] },
          components: [controls],
        });
      } catch (error) {
        logger.warn({ err: safe_error_details(error), guild_id: player.guildId, channel_id: text_channel_id }, 'Falha ao anunciar tocando agora');
      }
    });

    this.kazagumo.on('playerEnd', (player) => {
      logger.info({ guild_id: player.guildId }, 'A fila de músicas acabou.');
    });

    this.kazagumo.on('playerEmpty', (player) => {
      const dj_enabled = djModeService?.is_enabled(player.guildId) === true;
      if (dj_enabled) {
        logger.info({ guild_id: player.guildId }, 'Player vazio em modo DJ, recarregando playlist...');
        void djModeService.handle_player_empty(player.guildId).catch((error) => {
          logger.error({ guild_id: player.guildId, err: error }, 'Falha ao recarregar DJ mode');
        });
        return;
      }

      logger.info({ guild_id: player.guildId }, 'Player inativo, destruindo reprodução...');
      void player.destroy().catch((error: unknown) => {
        if (is_lavalink_player_not_found_error(error)) return
        logger.warn({ err: safe_error_details(error), guild_id: player.guildId }, 'Falha ao destruir player (playerEmpty)')
      })
    });

    // @ts-expect-error – kazagumo playerError event type is not typed correctly
    this.kazagumo.on('playerError', (player, type, error) => {
      logger.error({ guild_id: player.guildId, err: safe_error_details(error), type }, 'Erro ocorreu no Player de Música.');
    });

    this.kazagumo.on('playerDestroy', (player) => {
      logger.info({ guild_id: player.guildId }, 'Player de música destruído.');
    });
  }
}

export let musicService: MusicService;

export function initMusicService(client: Client) {
  musicService = new MusicService(client);
  return musicService;
}
