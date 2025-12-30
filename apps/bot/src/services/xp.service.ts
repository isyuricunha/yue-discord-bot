import type { Message } from 'discord.js';
import { prisma } from '@yuebot/database';
import type { GuildXpConfig } from '@yuebot/database';
import { pick_discord_message_template_variant, render_discord_message_template } from '@yuebot/shared';
import { logger } from '../utils/logger';

function normalize_content_for_repeat_check(content: string): string {
  return content.trim().replace(/\s+/g, ' ').toLowerCase();
}

function remove_repeated_characters(content: string): string {
  // Loritta-like: "sem caracteres repetidos (kkkkkkkk vira k)"
  return content.replace(/(.)\1+/g, '$1');
}

function normalize_xp_config(config: GuildXpConfig | null) {
  return {
    enabled: config?.enabled ?? true,
    minMessageLength: config?.minMessageLength ?? 5,
    minUniqueLength: config?.minUniqueLength ?? 12,
    typingCps: config?.typingCps ?? 7,
    xpDivisorMin: config?.xpDivisorMin ?? 7,
    xpDivisorMax: config?.xpDivisorMax ?? 4,
    xpCap: config?.xpCap ?? 35,
    ignoredChannelIds: (config?.ignoredChannelIds as string[] | undefined) ?? [],
    ignoredRoleIds: (config?.ignoredRoleIds as string[] | undefined) ?? [],
    roleXpMultipliers: (config?.roleXpMultipliers as Record<string, number> | undefined) ?? {},
  };
}

function compute_message_xp(unique_length: number, opts: { xpDivisorMin: number; xpDivisorMax: number; xpCap: number }) {
  const divisor_min = Math.max(1, opts.xpDivisorMin);
  const divisor_max = Math.max(1, opts.xpDivisorMax);

  const min = Math.floor(unique_length / divisor_min);
  const max = Math.floor(unique_length / divisor_max);

  if (max <= 0 && min <= 0) return 0;

  const low = Math.max(0, Math.min(min, max));
  const high = Math.max(low, max);
  const raw = low === high ? low : low + Math.floor(Math.random() * (high - low + 1));

  return Math.min(raw, Math.max(1, opts.xpCap));
}

function compute_level_from_xp(xp: number): number {
  // Loritta wiki: cada nível são 1000 XP.
  return Math.floor(xp / 1000);
}

function compute_next_level_info(input: { xp: number; level: number }) {
  const next_level = input.level + 1;
  const total_xp = next_level * 1000;
  const required_xp = Math.max(0, total_xp - input.xp);
  return {
    level: next_level,
    totalXp: total_xp,
    requiredXp: required_xp,
  };
}

export class XpService {
  private config_cache: Map<string, { config: GuildXpConfig | null; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private async get_guild_xp_config(guild_id: string): Promise<GuildXpConfig | null> {
    const cached = this.config_cache.get(guild_id);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.config;
    }

    try {
      const config = await prisma.guildXpConfig.findUnique({ where: { guildId: guild_id } });
      this.config_cache.set(guild_id, { config, timestamp: now });
      return config;
    } catch (error) {
      logger.error({ error, guildId: guild_id }, 'Erro ao buscar config de XP');
      this.config_cache.set(guild_id, { config: null, timestamp: now });
      return null;
    }
  }

  async handle_message(message: Message): Promise<void> {
    if (!message.guild) return;
    if (message.author.bot) return;

    const guild_id = message.guild.id;
    const user_id = message.author.id;

    const content = message.content ?? '';

    const config = normalize_xp_config(await this.get_guild_xp_config(guild_id));
    if (!config.enabled) return;

    if (content.length <= config.minMessageLength) return;
    if (config.ignoredChannelIds.includes(message.channel.id)) return;

    // Per-role multipliers/ignored roles (optional; require member)
    const member = message.member;
    if (member) {
      if (config.ignoredRoleIds.some((role_id) => member.roles.cache.has(role_id))) return;
    }

    const now = new Date();

    const normalized = normalize_content_for_repeat_check(content);
    const reduced = remove_repeated_characters(content);

    if (reduced.length <= config.minUniqueLength) return;

    const message_hash = normalized;

    const existing = await prisma.guildXpMember.findUnique({
      where: {
        userId_guildId: {
          userId: user_id,
          guildId: guild_id,
        },
      },
    });

    if (existing?.lastMessageHash && existing.lastMessageHash === message_hash) return;

    if (existing?.lastMessageAt) {
      const delta_seconds = (now.getTime() - existing.lastMessageAt.getTime()) / 1000;

      // "humanamente possível": chars/7 segundos mínimos
      const min_seconds = content.length / config.typingCps;
      if (delta_seconds < min_seconds) return;
    }

    const base_xp = compute_message_xp(reduced.length, {
      xpDivisorMin: config.xpDivisorMin,
      xpDivisorMax: config.xpDivisorMax,
      xpCap: config.xpCap,
    });

    let multiplier = 1;
    if (member) {
      for (const [role_id, value] of Object.entries(config.roleXpMultipliers)) {
        if (!member.roles.cache.has(role_id)) continue;
        if (!Number.isFinite(value) || value < 0) continue;
        multiplier = Math.max(multiplier, value);
      }
    }

    const xp_cap_with_multiplier = Math.max(1, Math.round(config.xpCap * multiplier));
    const xp_gain = Math.min(Math.round(base_xp * multiplier), xp_cap_with_multiplier);
    if (xp_gain <= 0) {
      await prisma.guildXpMember.upsert({
        where: {
          userId_guildId: {
            userId: user_id,
            guildId: guild_id,
          },
        },
        update: {
          lastMessageHash: message_hash,
          lastMessageAt: now,
        },
        create: {
          userId: user_id,
          guildId: guild_id,
          xp: 0,
          level: 0,
          lastMessageHash: message_hash,
          lastMessageAt: now,
        },
      });
      return;
    }

    const current_xp = existing?.xp ?? 0;
    const new_xp = current_xp + xp_gain;

    const previous_level = existing?.level ?? compute_level_from_xp(current_xp);
    const new_level = compute_level_from_xp(new_xp);

    const updated = await prisma.guildXpMember.upsert({
      where: {
        userId_guildId: {
          userId: user_id,
          guildId: guild_id,
        },
      },
      update: {
        xp: new_xp,
        level: new_level,
        lastMessageHash: message_hash,
        lastMessageAt: now,
      },
      create: {
        userId: user_id,
        guildId: guild_id,
        xp: new_xp,
        level: new_level,
        lastMessageHash: message_hash,
        lastMessageAt: now,
      },
    });

    const global_existing = await prisma.globalXpMember.findUnique({
      where: { userId: user_id },
      select: { xp: true },
    });

    const global_xp = (global_existing?.xp ?? 0) + xp_gain;
    const global_level = compute_level_from_xp(global_xp);

    await prisma.globalXpMember.upsert({
      where: { userId: user_id },
      update: {
        username: message.author.username,
        avatar: message.author.avatar,
        xp: global_xp,
        level: global_level,
      },
      create: {
        userId: user_id,
        username: message.author.username,
        avatar: message.author.avatar,
        xp: global_xp,
        level: global_level,
      },
    });

    if (new_level > previous_level) {
      await this.handle_level_up(message, updated.level);
    }
  }

  private async handle_level_up(message: Message, new_level: number): Promise<void> {
    if (!message.guild || !message.member) return;

    const guild_id = message.guild.id;

    try {
      const rewards = await prisma.guildLevelRoleReward.findMany({
        where: {
          guildId: guild_id,
          level: { lte: new_level },
        },
        orderBy: { level: 'asc' },
      });

      if (rewards.length > 0) {
        const config = await prisma.guildXpConfig.findUnique({ where: { guildId: guild_id } });
        const reward_mode = config?.rewardMode ?? 'stack';

        if (reward_mode === 'highest') {
          const highest = rewards[rewards.length - 1];
          const reward_role_ids = new Set(rewards.map((r) => r.roleId));

          // remove old reward roles
          const to_remove = message.member.roles.cache.filter((r) => reward_role_ids.has(r.id));
          if (to_remove.size > 0) {
            await message.member.roles.remove(to_remove.map((r) => r.id));
          }

          await message.member.roles.add(highest.roleId);
        } else {
          // stack
          const to_add = rewards
            .map((r) => r.roleId)
            .filter((role_id) => !message.member!.roles.cache.has(role_id));

          if (to_add.length > 0) {
            await message.member.roles.add(to_add);
          }
        }
      }

      const config = await prisma.guildXpConfig.findUnique({ where: { guildId: guild_id } });
      const channel_id = config?.levelUpChannelId;
      const template = config?.levelUpMessage;

      if (channel_id) {
        const channel = await message.guild.channels.fetch(channel_id).catch(() => null);
        if (channel && channel.isTextBased()) {
          const xp_row = await prisma.guildXpMember.findUnique({
            where: {
              userId_guildId: {
                userId: message.author.id,
                guildId: guild_id,
              },
            },
            select: {
              xp: true,
              updatedAt: true,
            },
          });

          const xp_value = xp_row?.xp ?? new_level * 1000;

          const ahead_count = await prisma.guildXpMember.count({
            where: {
              guildId: guild_id,
              OR: [
                { xp: { gt: xp_value } },
                {
                  xp: xp_value,
                  updatedAt: { lt: xp_row?.updatedAt ?? new Date(0) },
                },
              ],
            },
          });

          const ranking = ahead_count + 1;
          const next_level = compute_next_level_info({ xp: xp_value, level: new_level });

          const rendered = template
            ? render_discord_message_template(pick_discord_message_template_variant(template), {
                user: {
                  id: message.author.id,
                  username: message.author.username,
                  tag: message.author.tag,
                  avatarUrl: message.author.displayAvatarURL(),
                  nickname: message.member?.nickname ?? undefined,
                },
                guild: {
                  id: message.guild.id,
                  name: message.guild.name,
                  memberCount: message.guild.memberCount,
                  iconUrl: message.guild.iconURL() ?? undefined,
                },
                level: new_level,
                xp: xp_value,
                experience: {
                  ranking,
                  nextLevel: next_level,
                },
              })
            : {
                content: `<@${message.author.id}> subiu para o nível ${new_level}!`,
              };

          await channel.send(rendered);
        }
      }
    } catch (error) {
      logger.error({ error, guildId: guild_id }, 'Erro ao processar level up');
    }
  }
}

export const xpService = new XpService();
