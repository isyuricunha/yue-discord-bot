import type { Client } from 'discord.js';

import { prisma } from '@yuebot/database';
import type { Kazagumo } from 'kazagumo';
import { logger } from '../utils/logger';
import { safe_error_details } from '../utils/safe_error';

const fallback_default_playlist_url = 'https://open.spotify.com/playlist/6AgTejd48A5gixBakDxY5y?si=e19ea44d2f4f447c';

function is_http_url(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

type dj_config = {
  guildId: string;
  enabled: boolean;
  voiceChannelId: string | null;
  textChannelId: string | null;
  playlistUrl: string | null;
  defaultPlaylistUrl: string | null;
};

export class DjModeService {
  private readonly client: Client;
  private readonly kazagumo: Kazagumo;
  private readonly enabled_cache = new Map<string, boolean>();

  constructor(client: Client, kazagumo: Kazagumo) {
    this.client = client;
    this.kazagumo = kazagumo;
  }

  public is_enabled(guild_id: string): boolean {
    return this.enabled_cache.get(guild_id) === true;
  }

  private set_enabled_cache(guild_id: string, enabled: boolean) {
    this.enabled_cache.set(guild_id, enabled);
  }

  private build_effective_playlist_url(cfg: dj_config): string {
    const candidate = (cfg.playlistUrl || cfg.defaultPlaylistUrl || fallback_default_playlist_url).trim();
    return candidate;
  }

  private async read_config(guild_id: string): Promise<dj_config | null> {
    const cfg = await prisma.guildDjConfig.findUnique({
      where: { guildId: guild_id },
      select: {
        guildId: true,
        enabled: true,
        voiceChannelId: true,
        textChannelId: true,
        playlistUrl: true,
        defaultPlaylistUrl: true,
      },
    });

    return cfg
      ? {
          guildId: cfg.guildId,
          enabled: cfg.enabled,
          voiceChannelId: cfg.voiceChannelId ?? null,
          textChannelId: cfg.textChannelId ?? null,
          playlistUrl: cfg.playlistUrl ?? null,
          defaultPlaylistUrl: cfg.defaultPlaylistUrl ?? null,
        }
      : null;
  }

  public async restore_all_enabled(): Promise<void> {
    try {
      const enabled = await prisma.guildDjConfig.findMany({
        where: { enabled: true },
        select: {
          guildId: true,
          enabled: true,
          voiceChannelId: true,
          textChannelId: true,
          playlistUrl: true,
          defaultPlaylistUrl: true,
        },
      });

      for (const cfg of enabled) {
        const normalized: dj_config = {
          guildId: cfg.guildId,
          enabled: cfg.enabled,
          voiceChannelId: cfg.voiceChannelId ?? null,
          textChannelId: cfg.textChannelId ?? null,
          playlistUrl: cfg.playlistUrl ?? null,
          defaultPlaylistUrl: cfg.defaultPlaylistUrl ?? null,
        };

        this.set_enabled_cache(cfg.guildId, true);

        await this.ensure_playing(normalized).catch((error) => {
          logger.error({ err: safe_error_details(error), guild_id: cfg.guildId }, 'Falha ao restaurar DJ mode');
        });
      }
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Falha ao restaurar DJ mode');
    }
  }

  public async start(guild_id: string, input: { voiceChannelId: string; textChannelId: string; playlistUrl?: string | null }): Promise<void> {
    const playlistUrl = typeof input.playlistUrl === 'string' ? input.playlistUrl.trim() : '';

    const existing = await prisma.guildDjConfig.findUnique({
      where: { guildId: guild_id },
      select: { defaultPlaylistUrl: true },
    });

    await prisma.guildDjConfig.upsert({
      where: { guildId: guild_id },
      update: {
        enabled: true,
        voiceChannelId: input.voiceChannelId,
        textChannelId: input.textChannelId,
        playlistUrl: playlistUrl || null,
      },
      create: {
        guildId: guild_id,
        enabled: true,
        voiceChannelId: input.voiceChannelId,
        textChannelId: input.textChannelId,
        playlistUrl: playlistUrl || null,
        defaultPlaylistUrl: existing?.defaultPlaylistUrl ?? null,
      },
    });

    this.set_enabled_cache(guild_id, true);

    const cfg = await this.read_config(guild_id);
    if (!cfg) return;

    await this.ensure_playing(cfg);
  }

  public async stop(guild_id: string): Promise<void> {
    await prisma.guildDjConfig.upsert({
      where: { guildId: guild_id },
      update: { enabled: false },
      create: { guildId: guild_id, enabled: false },
    });

    this.set_enabled_cache(guild_id, false);

    const player = this.kazagumo.players.get(guild_id);
    if (player) {
      player.destroy();
    }
  }

  public async ensure_playing(cfg: dj_config): Promise<void> {
    if (!cfg.enabled) {
      this.set_enabled_cache(cfg.guildId, false);
      return;
    }

    if (!cfg.voiceChannelId || !cfg.textChannelId) {
      logger.warn({ guild_id: cfg.guildId }, 'DJ mode enabled but missing voice/text channel ids');
      return;
    }

    const playlist_url = this.build_effective_playlist_url(cfg);
    if (!is_http_url(playlist_url) || playlist_url.length > 2048) {
      logger.warn({ guild_id: cfg.guildId, playlist_url: playlist_url.slice(0, 80) }, 'DJ mode has invalid playlist url');
      return;
    }

    let player = this.kazagumo.players.get(cfg.guildId);
    if (!player) {
      player = await this.kazagumo.createPlayer({
        guildId: cfg.guildId,
        voiceId: cfg.voiceChannelId,
        textId: cfg.textChannelId,
        volume: 70,
      });
    } else {
      if (player.voiceId !== cfg.voiceChannelId) {
        player.setVoiceChannel(cfg.voiceChannelId);
      }
      if (player.textId !== cfg.textChannelId) {
        player.setTextChannel(cfg.textChannelId);
      }
    }

    player.setLoop('queue');

    const has_tracks = Boolean(player.queue.current) || player.queue.length > 0;
    const should_load = !has_tracks;

    if (should_load) {
      const result = await this.kazagumo.search(playlist_url, {
        requester: this.client.user ?? { id: 'dj' },
      } as any);

      if (!result || !Array.isArray(result.tracks) || result.tracks.length === 0) {
        throw new Error('DJ playlist returned no tracks');
      }

      player.queue.add(result.tracks as any);
    }

    if (!player.playing && !player.paused) {
      await player.play();
    }

    this.set_enabled_cache(cfg.guildId, true);
  }

  public async handle_player_empty(guild_id: string): Promise<boolean> {
    const cfg = await this.read_config(guild_id).catch(() => null);
    if (!cfg || !cfg.enabled) {
      this.set_enabled_cache(guild_id, false);
      return false;
    }

    this.set_enabled_cache(guild_id, true);

    await this.ensure_playing(cfg);
    return true;
  }
}

export let djModeService: DjModeService;

export function initDjModeService(client: Client, kazagumo: Kazagumo) {
  djModeService = new DjModeService(client, kazagumo);
  return djModeService;
}
