import type { Message, GuildMember } from 'discord.js';
import { prisma } from '@yuebot/database';
import type { GuildConfig } from '@yuebot/database';
import type { Prisma } from '@yuebot/database';
import { logger } from '../utils/logger';
import { discord_timeout_max_ms, EMOJIS, find_first_banned_word_match, parseDurationMs } from '@yuebot/shared';
import { isShortUrl, expandUrl } from '../utils/urlExpander';
import { getSendableChannel } from '../utils/discord';
import { moderationLogService } from './moderationLog.service';
import { WarnService } from './warnService'

interface AutoModResult {
  violated: boolean;
  reason?: string;
  action?: string;
  rule?: 'word' | 'caps' | 'link';
  details?: Prisma.InputJsonValue;
}

class AutoModService {
  private configCache: Map<string, { config: GuildConfig | null; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  async checkMessage(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false;

    const config = await this.getGuildConfig(message.guild.id);
    if (!config) return false;

    const member = message.member;
    if (!member) return false;

    // Verificar whitelists (roles e canais)
    if (this.isWhitelisted(member, message.channel.id, config)) {
      return false;
    }

    // Verificar filtro de palavras
    if (config.wordFilterEnabled) {
      const wordCheck = this.checkBannedWords(message.content, config);
      if (wordCheck.violated) {
        await this.handleViolation(message, member, wordCheck);
        return true;
      }
    }

    // Verificar CAPS
    if (config.capsEnabled) {
      const capsCheck = this.checkCaps(message.content, config);
      if (capsCheck.violated) {
        await this.handleViolation(message, member, capsCheck);
        return true;
      }
    }

    // Verificar links
    if (config.linkFilterEnabled) {
      const linkCheck = await this.checkLinks(message.content, config);
      if (linkCheck.violated) {
        await this.handleViolation(message, member, linkCheck);
        return true;
      }
    }

    return false;
  }

  private async getGuildConfig(guildId: string): Promise<GuildConfig | null> {
    const cached = this.configCache.get(guildId);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.config;
    }

    try {
      const config = await prisma.guildConfig.findUnique({
        where: { guildId },
      });

      this.configCache.set(guildId, { config, timestamp: now });
      return config;
    } catch (error) {
      logger.error({ error }, 'Erro ao buscar config do guild');
      return null;
    }
  }

  private isWhitelisted(member: GuildMember, channelId: string, config: GuildConfig): boolean {
    // Verificar se o canal está na whitelist
    const wordWhitelistChannels = config.wordFilterWhitelistChannels as string[];
    const capsWhitelistChannels = config.capsWhitelistChannels as string[];
    const linkWhitelistChannels = config.linkWhitelistChannels as string[];

    const channelWhitelisted =
      wordWhitelistChannels.includes(channelId) ||
      capsWhitelistChannels.includes(channelId) ||
      linkWhitelistChannels.includes(channelId);

    if (channelWhitelisted) return true;

    // Verificar se o membro tem role na whitelist
    const memberRoles = member.roles.cache.map(r => r.id);
    
    const wordWhitelistRoles = config.wordFilterWhitelistRoles as string[];
    const capsWhitelistRoles = config.capsWhitelistRoles as string[];
    const linkWhitelistRoles = config.linkWhitelistRoles as string[];

    const roleWhitelisted = memberRoles.some(
      roleId =>
        wordWhitelistRoles.includes(roleId) ||
        capsWhitelistRoles.includes(roleId) ||
        linkWhitelistRoles.includes(roleId)
    );

    return roleWhitelisted;
  }

  private checkBannedWords(content: string, config: GuildConfig): AutoModResult {
    const bannedWords = config.bannedWords as Array<{ word: string; action: string }>;

    const match = find_first_banned_word_match(content, bannedWords)
    if (match) {
      return {
        violated: true,
        reason: `Palavra proibida detectada: "${match.entry.word}"`,
        action: match.entry.action,
        rule: 'word',
        details: {
          word: match.entry.word,
          matchKind: match.match_kind,
        } satisfies Prisma.InputJsonObject,
      }
    }

    return { violated: false };
  }

  private checkCaps(content: string, config: GuildConfig): AutoModResult {
    // Remover URLs e menções da contagem
    const cleanContent = content
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/<@[!&]?\d+>/g, '')
      .replace(/<#\d+>/g, '')
      .trim();

    if (cleanContent.length < config.capsMinLength) {
      return { violated: false };
    }

    // Contar letras maiúsculas
    const letters = cleanContent.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return { violated: false };

    const upperCount = cleanContent.replace(/[^A-Z]/g, '').length;
    const capsPercentage = (upperCount / letters.length) * 100;

    if (capsPercentage >= config.capsThreshold) {
      return {
        violated: true,
        reason: `Excesso de maiúsculas (${Math.round(capsPercentage)}%)`,
        action: config.capsAction,
        rule: 'caps',
        details: {
          capsPercentage: Math.round(capsPercentage),
          capsThreshold: config.capsThreshold,
          upperCount,
          lettersCount: letters.length,
          cleanLength: cleanContent.length,
        } satisfies Prisma.InputJsonObject,
      };
    }

    return { violated: false };
  }

  private async checkLinks(content: string, config: GuildConfig): Promise<AutoModResult> {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = content.match(urlRegex);

    if (!urls || urls.length === 0) {
      return { violated: false };
    }

    // Se bloquear todos os links
    if (config.linkBlockAll) {
      const allowedDomains = config.allowedDomains as string[];
      
      // Verificar se algum link está na whitelist
      for (const url of urls) {
        try {
          const domain = new URL(url).hostname;
          if (!allowedDomains.some(allowed => domain.includes(allowed))) {
            return {
              violated: true,
              reason: 'Link não permitido',
              action: config.linkAction,
              rule: 'link',
              details: {
                url,
                domain,
                mode: 'blockAll',
              } satisfies Prisma.InputJsonObject,
            };
          }
        } catch (error) {
          // URL inválida, bloquear
          return {
            violated: true,
            reason: 'Link malformado',
            action: config.linkAction,
            rule: 'link',
            details: {
              url,
              mode: 'blockAll',
            } satisfies Prisma.InputJsonObject,
          };
        }
      }
    } else {
      // Verificar domínios banidos
      const bannedDomains = config.bannedDomains as string[];
      
      for (const url of urls) {
        try {
          let urlToCheck = url;
          
          // Se for link encurtado, expandir
          if (isShortUrl(url)) {
            try {
              urlToCheck = await expandUrl(url);
              logger.info(`Link encurtado expandido: ${url} -> ${urlToCheck}`);
            } catch (error) {
              logger.warn(`Erro ao expandir link: ${url}`);
            }
          }
          
          const domain = new URL(urlToCheck).hostname;
          if (bannedDomains.some(banned => domain.includes(banned))) {
            return {
              violated: true,
              reason: `Domínio bloqueado: ${domain}`,
              action: config.linkAction,
              rule: 'link',
              details: {
                url,
                expandedUrl: urlToCheck,
                domain,
                mode: 'bannedDomains',
              } satisfies Prisma.InputJsonObject,
            };
          }
        } catch (error) {
          // Ignorar URLs inválidas
        }
      }
    }

    return { violated: false };
  }

  private async handleViolation(
    message: Message,
    member: GuildMember,
    result: AutoModResult
  ): Promise<void> {
    try {
      const message_excerpt = message.content.substring(0, 200) || '[sem conteúdo]';

      // Deletar mensagem
      await message.delete();

      // Aplicar ação
      const action = result.action || 'delete';

      const metadata: Prisma.InputJsonValue = {
        source: 'automod',
        rule: result.rule,
        action,
        details: result.details ?? null,
        message: {
          id: message.id,
          channelId: message.channel.id,
          excerpt: message_excerpt,
          length: message.content.length,
        },
        deleted: true,
      };

      switch (action) {
        case 'warn':
          await this.applyWarn(member, result.reason!, metadata);
          break;
        case 'mute':
          await this.applyMute(member, '5m', result.reason!, metadata);
          break;
        case 'kick':
          await this.applyKick(member, result.reason!, metadata);
          break;
        case 'ban':
          await this.applyBan(member, result.reason!, metadata);
          break;
        case 'delete':
          // Apenas deletar, já foi feito acima
          break;
      }

      // Enviar notificação no canal (opcional)
      if (action !== 'delete') {
        const notificationChannel = getSendableChannel(message.channel);
        if (notificationChannel) {
          await notificationChannel
            .send({
              content: `${EMOJIS.WARNING} ${member.user.tag}, sua mensagem foi removida: ${result.reason}`,
            })
            .then((msg) => {
              setTimeout(() => msg.delete().catch(() => {}), 5000);
            });
        }
      }

      // Enviar para canal de logs se configurado
      if (message.guild) {
        await moderationLogService.notify({
          guild: message.guild,
          user: member.user,
          staff: member.client.user!,
          punishment: action,
          reason: `${result.reason ?? ''}${message_excerpt ? ` | ${message_excerpt}` : ''}`,
          duration: action === 'mute' ? '5m' : '',
        })
      }

      logger.info(
        `AutoMod: ${member.user.tag} - ${result.reason} - Ação: ${action}`
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao processar violação do AutoMod');
    }
  }

  private async applyWarn(member: GuildMember, reason: string, metadata: Prisma.InputJsonValue): Promise<void> {
    const updated = await prisma.guildMember.upsert({
      where: {
        userId_guildId: {
          userId: member.id,
          guildId: member.guild.id,
        },
      },
      update: {
        warnings: { increment: 1 },
        username: member.user.username,
        avatar: member.user.avatar,
      },
      create: {
        userId: member.id,
        guildId: member.guild.id,
        username: member.user.username,
        avatar: member.user.avatar,
        joinedAt: member.joinedAt || new Date(),
        warnings: 1,
      },
    });

    await prisma.modLog.create({
      data: {
        guildId: member.guild.id,
        userId: member.id,
        moderatorId: member.client.user!.id,
        action: 'warn',
        reason: `[AutoMod] ${reason}`,
        metadata,
      },
    });

    const warn_service = new WarnService(member.client)
    await warn_service.checkAndApplyThresholds(member.guild.id, member.id, updated.warnings)
  }

  private async applyMute(member: GuildMember, duration: string, reason: string, metadata: Prisma.InputJsonValue): Promise<void> {
    const durationMs = parseDurationMs(duration, { maxMs: discord_timeout_max_ms, clampToMax: true }) ?? 5 * 60 * 1000;
    await member.timeout(durationMs, `[AutoMod] ${reason}`);

    await prisma.modLog.create({
      data: {
        guildId: member.guild.id,
        userId: member.id,
        moderatorId: member.client.user!.id,
        action: 'mute',
        reason: `[AutoMod] ${reason}`,
        duration,
        metadata,
      },
    });
  }

  private async applyKick(member: GuildMember, reason: string, metadata: Prisma.InputJsonValue): Promise<void> {
    await member.kick(`[AutoMod] ${reason}`);

    await prisma.modLog.create({
      data: {
        guildId: member.guild.id,
        userId: member.id,
        moderatorId: member.client.user!.id,
        action: 'kick',
        reason: `[AutoMod] ${reason}`,
        metadata,
      },
    });
  }

  private async applyBan(member: GuildMember, reason: string, metadata: Prisma.InputJsonValue): Promise<void> {
    await member.ban({ reason: `[AutoMod] ${reason}` });

    await prisma.modLog.create({
      data: {
        guildId: member.guild.id,
        userId: member.id,
        moderatorId: member.client.user!.id,
        action: 'ban',
        reason: `[AutoMod] ${reason}`,
        metadata,
      },
    });
  }

  // Método para limpar cache (útil quando config é atualizada)
  clearCache(guildId: string): void {
    this.configCache.delete(guildId);
  }
}

export const autoModService = new AutoModService();
