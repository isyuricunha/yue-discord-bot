import { Kazagumo, Plugins } from 'kazagumo';
import { Connectors } from 'shoukaku';
import { Client } from 'discord.js';

import { logger } from '../utils/logger';

export class MusicService {
  public kazagumo: Kazagumo;

  constructor(client: Client) {
    let rawNodes: any[] = [];
    try {
      if (process.env.LAVALINK_NODES) {
        rawNodes = JSON.parse(process.env.LAVALINK_NODES);
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to parse LAVALINK_NODES env variable. Ensure it is valid JSON.');
    }

    const nodes = rawNodes.map((node) => ({
      name: node.name,
      url: node.url,
      auth: node.auth,
      secure: node.secure ?? false,
    }));

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
      logger.error({ node: name, err: error }, `Lavalink Node [${name}] encountered an error.`);
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

    this.kazagumo.on('playerStart', (player, track) => {
      logger.info({ guild_id: player.guildId, track: track.title }, 'Começou a tocar uma música.');
    });

    this.kazagumo.on('playerEnd', (player) => {
      logger.info({ guild_id: player.guildId }, 'A fila de músicas acabou.');
    });

    this.kazagumo.on('playerEmpty', (player) => {
      logger.info({ guild_id: player.guildId }, 'Player inativo, destruindo reprodução...');
      player.destroy();
    });

    // @ts-expect-error – kazagumo playerError event type is not typed correctly
    this.kazagumo.on('playerError', (player, type, error) => {
      logger.error({ guild_id: player.guildId, err: error, type }, 'Erro ocorreu no Player de Música.');
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
