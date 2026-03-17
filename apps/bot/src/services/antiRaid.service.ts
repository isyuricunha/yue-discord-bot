import type { Guild, GuildMember, TextChannel, Client } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { prisma } from '@yuebot/database';
import type { GuildAntiRaidConfig } from '@yuebot/database';
import { logger } from '../utils/logger';
import { discord_timeout_max_ms } from '@yuebot/shared';

interface JoinRecord {
  timestamp: number;
  memberId: string;
}

interface AntiRaidConfigInput {
  enabled?: boolean;
  joinThreshold?: number;
  joinTimeWindow?: number;
  action?: string;
  duration?: number;
  exemptRoles?: string[];
  exemptChannels?: string[];
  cooldown?: number;
  notificationChannelId?: string | null;
}

class AntiRaidService {
  private joinCache: Map<string, JoinRecord[]> = new Map();
  private readonly CACHE_CLEANUP_INTERVAL = 60 * 1000; // 1 minute
  private readonly DEFAULT_JOIN_WINDOW = 60; // seconds
  private readonly DEFAULT_JOIN_THRESHOLD = 10;
  private readonly DEFAULT_COOLDOWN = 300; // 5 minutes
  private client: Client | null = null;

  constructor() {
    // Cleanup old join records periodically
    setInterval(() => this.cleanupCache(), this.CACHE_CLEANUP_INTERVAL);
  }

  setClient(client: Client): void {
    this.client = client;
  }

  private cleanupCache(): void {
    const now = Date.now();
    const maxWindow = this.DEFAULT_JOIN_WINDOW * 1000 * 2; // 2x the max window

    for (const [guildId, records] of this.joinCache.entries()) {
      const filtered = records.filter((record) => now - record.timestamp < maxWindow);
      if (filtered.length === 0) {
        this.joinCache.delete(guildId);
      } else {
        this.joinCache.set(guildId, filtered);
      }
    }
  }

  async getConfig(guildId: string): Promise<GuildAntiRaidConfig | null> {
    return prisma.guildAntiRaidConfig.findUnique({
      where: { guildId },
    });
  }

  async getOrCreateConfig(guildId: string): Promise<GuildAntiRaidConfig> {
    let config = await this.getConfig(guildId);

    if (!config) {
      config = await prisma.guildAntiRaidConfig.create({
        data: {
          guildId,
          enabled: false,
          joinThreshold: this.DEFAULT_JOIN_THRESHOLD,
          joinTimeWindow: this.DEFAULT_JOIN_WINDOW,
          action: 'mute',
          duration: 10,
          exemptRoles: [],
          exemptChannels: [],
          cooldown: this.DEFAULT_COOLDOWN,
          raidActive: false,
          locked: false,
        },
      });
    }

    return config;
  }

  async updateConfig(guildId: string, data: AntiRaidConfigInput): Promise<GuildAntiRaidConfig> {
    const config = await this.getOrCreateConfig(guildId);

    return prisma.guildAntiRaidConfig.update({
      where: { guildId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  isMemberExempt(member: GuildMember, config: GuildAntiRaidConfig): boolean {
    const exemptRoles = (config.exemptRoles as string[]) || [];
    const memberRoleIds = member.roles.cache.map((r) => r.id);

    return memberRoleIds.some((roleId) => exemptRoles.includes(roleId));
  }

  async trackJoin(guildId: string, member: GuildMember): Promise<boolean> {
    const config = await this.getConfig(guildId);

    if (!config || !config.enabled) {
      return false;
    }

    // Check if member is exempt
    if (this.isMemberExempt(member, config)) {
      logger.debug(
        { guildId, memberId: member.id },
        'AntiRaid: member is exempt from raid detection',
      );
      return false;
    }

    // Check if cooldown is active
    if (config.raidActive && config.lastRaidAt) {
      const cooldownMs = (config.cooldown || this.DEFAULT_COOLDOWN) * 1000;
      const timeSinceLastRaid = Date.now() - config.lastRaidAt.getTime();

      if (timeSinceLastRaid < cooldownMs) {
        logger.debug(
          { guildId, memberId: member.id, timeSinceLastRaid },
          'AntiRaid: cooldown active, skipping',
        );
        return false;
      }
    }

    // Add join to cache
    const now = Date.now();
    const timeWindowMs = (config.joinTimeWindow || this.DEFAULT_JOIN_WINDOW) * 1000;

    const records = this.joinCache.get(guildId) || [];
    records.push({ timestamp: now, memberId: member.id });

    // Filter out old records
    const filteredRecords = records.filter(
      (record) => now - record.timestamp < timeWindowMs,
    );
    this.joinCache.set(guildId, filteredRecords);

    // Check if threshold exceeded
    const threshold = config.joinThreshold || this.DEFAULT_JOIN_THRESHOLD;
    if (filteredRecords.length >= threshold) {
      logger.info(
        { guildId, joinCount: filteredRecords.length, threshold },
        'AntiRaid: raid threshold exceeded',
      );

      await this.triggerRaid(guildId, member.client);
      return true;
    }

    return false;
  }

  async checkRaid(guildId: string): Promise<boolean> {
    const config = await this.getConfig(guildId);

    if (!config || !config.enabled || config.raidActive) {
      return false;
    }

    const records = this.joinCache.get(guildId) || [];
    const threshold = config.joinThreshold || this.DEFAULT_JOIN_THRESHOLD;

    return records.length >= threshold;
  }

  async triggerRaid(guildId: string, client: Client): Promise<void> {
    const config = await this.getConfig(guildId);

    if (!config) {
      return;
    }

    // Update database to mark raid as active
    await prisma.guildAntiRaidConfig.update({
      where: { guildId },
      data: {
        raidActive: true,
        lastRaidAt: new Date(),
      },
    });

    const discordGuild = client.guilds.cache.get(guildId);
    if (!discordGuild) {
      logger.warn({ guildId }, 'AntiRaid: guild not found in cache');
      return;
    }

    // Get recent members who joined
    try {
      const recentMembers = await discordGuild.members.fetch();
      const now = Date.now();
      const timeWindowMs = (config.joinTimeWindow || this.DEFAULT_JOIN_WINDOW) * 1000 * 2;

      const recentJoins = recentMembers.filter(
        (member) => member.joinedAt && now - member.joinedAt.getTime() < timeWindowMs,
      );

      const action = config.action || 'mute';
      const duration = config.duration || 10;
      const durationMs = Math.min(duration * 60 * 1000, discord_timeout_max_ms);

      let actionCount = 0;

      for (const member of recentJoins.values()) {
        if (this.isMemberExempt(member, config)) {
          continue;
        }

        try {
          switch (action) {
            case 'mute':
              await member.timeout(durationMs, '[AntiRaid] Detecção de raide');
              break;
            case 'kick':
              await member.kick('[AntiRaid] Detecção de raide');
              break;
            case 'ban':
              await member.ban({ reason: '[AntiRaid] Detecção de raide' });
              break;
          }
          actionCount++;
        } catch (error) {
          logger.error(
            { error, guildId, memberId: member.id, action },
            'AntiRaid: failed to apply action',
          );
        }
      }

      // Send notification
      if (config.notificationChannelId) {
        try {
          const channel = (await discordGuild.channels.fetch(
            config.notificationChannelId,
          )) as TextChannel | null;

          if (channel && channel.isTextBased()) {
            const actionText: Record<string, string> = {
              mute: 'silenciados',
              kick: 'expulsos',
              ban: 'banidos',
            };

            await channel.send({
              content: `⚠️ **RAIDE DETECTADO!**\n${actionCount} membros foram ${actionText[action] || 'acionados'} devido a uma onda de entradas suspeitas.\nProteção contra raide ativada!`,
            });
          }
        } catch (error) {
          logger.error(
            { error, guildId },
            'AntiRaid: failed to send notification',
          );
        }
      }

      logger.info(
        { guildId, action, actionCount },
        'AntiRaid: raid protection triggered',
      );

      // Schedule raid end
      setTimeout(async () => {
        await this.endRaid(guildId, client);
      }, (config.cooldown || this.DEFAULT_COOLDOWN) * 1000);
    } catch (error) {
      logger.error({ error, guildId }, 'AntiRaid: error during raid detection');
    }
  }

  async endRaid(guildId: string, client: Client): Promise<void> {
    const config = await this.getConfig(guildId);

    if (!config) {
      return;
    }

    await prisma.guildAntiRaidConfig.update({
      where: { guildId },
      data: {
        raidActive: false,
      },
    });

    // Clear join cache for this guild
    this.joinCache.delete(guildId);

    const discordGuild = client.guilds.cache.get(guildId);
    if (discordGuild && config.notificationChannelId) {
      try {
        const channel = (await discordGuild.channels.fetch(
          config.notificationChannelId,
        )) as TextChannel | null;

        if (channel && channel.isTextBased()) {
          await channel.send({
            content: '✅ **Proteção contra raide encerrada!**\nO servidor voltou ao normal.',
          });
        }
      } catch (error) {
        logger.error(
          { error, guildId },
          'AntiRaid: failed to send end notification',
        );
      }
    }

    logger.info({ guildId }, 'AntiRaid: raid ended');
  }

  async lockServer(guildId: string, client: Client): Promise<boolean> {
    const config = await this.getConfig(guildId);

    if (!config) {
      return false;
    }

    const discordGuild = client.guilds.cache.get(guildId);
    if (!discordGuild) {
      return false;
    }

    try {
      // Remove permission to send messages from @everyone
      await discordGuild.roles.everyone.setPermissions(
        discordGuild.roles.everyone.permissions.remove(PermissionFlagsBits.SendMessages),
      );

      await prisma.guildAntiRaidConfig.update({
        where: { guildId },
        data: { locked: true },
      });

      logger.info({ guildId }, 'AntiRaid: server locked');
      return true;
    } catch (error) {
      logger.error({ error, guildId }, 'AntiRaid: failed to lock server');
      return false;
    }
  }

  async unlockServer(guildId: string, client: Client): Promise<boolean> {
    const config = await this.getConfig(guildId);

    if (!config) {
      return false;
    }

    const discordGuild = client.guilds.cache.get(guildId);
    if (!discordGuild) {
      return false;
    }

    try {
      // Restore permission to send messages for @everyone
      await discordGuild.roles.everyone.setPermissions(
        discordGuild.roles.everyone.permissions.add(PermissionFlagsBits.SendMessages),
      );

      await prisma.guildAntiRaidConfig.update({
        where: { guildId },
        data: { locked: false },
      });

      logger.info({ guildId }, 'AntiRaid: server unlocked');
      return true;
    } catch (error) {
      logger.error({ error, guildId }, 'AntiRaid: failed to unlock server');
      return false;
    }
  }

  getJoinCount(guildId: string): number {
    const records = this.joinCache.get(guildId) || [];
    return records.length;
  }

  clearCache(guildId: string): void {
    this.joinCache.delete(guildId);
  }
}

export const antiRaidService = new AntiRaidService();
