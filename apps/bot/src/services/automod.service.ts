import type { Message, GuildMember } from 'discord.js';
import { prisma } from '@yuebot/database';
import type { GuildConfig } from '@yuebot/database';
import type { Prisma } from '@yuebot/database';
import { logger } from '../utils/logger';
import { discord_timeout_max_ms, EMOJIS, find_first_banned_word_match, parseDurationMs } from '@yuebot/shared';
import { isShortUrl, expandUrl } from '../utils/urlExpander';
import { getSendableChannel } from '../utils/discord';
import { moderationLogService } from './moderationLog.service';
import { WarnService } from './warnService';
import { openAiModerationService } from './openaiModeration.service';
import { extract_ai_moderation_image_urls } from './automod.ai_images'

interface AutoModResult {
  violated: boolean;
  reason?: string;
  action?: string;
  rule?: 'word' | 'caps' | 'link' | 'ai';
  details?: Prisma.InputJsonValue;
}

type ai_moderation_level = 'permissivo' | 'brando' | 'medio' | 'rigoroso' | 'maximo'

const openai_categories = [
  'harassment',
  'harassment/threatening',
  'hate',
  'hate/threatening',
  'illicit',
  'illicit/violent',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'sexual',
  'sexual/minors',
  'violence',
  'violence/graphic',
] as const

function ai_threshold_for_level(level: ai_moderation_level): number {
  switch (level) {
    case 'permissivo':
      return 0.95
    case 'brando':
      return 0.85
    case 'medio':
      return 0.75
    case 'rigoroso':
      return 0.65
    case 'maximo':
      return 0.55
  }
}

function ai_thresholds_for_level(level: ai_moderation_level): Record<string, number> {
  const threshold = ai_threshold_for_level(level)
  const out: Record<string, number> = {}
  for (const c of openai_categories) out[c] = threshold
  return out
}

function translate_openai_category(category: string): string {
  const map: Record<string, string> = {
    harassment: 'assédio',
    'harassment/threatening': 'assédio (ameaças)',
    hate: 'ódio',
    'hate/threatening': 'ódio (ameaças)',
    illicit: 'ilícito',
    'illicit/violent': 'ilícito (violento)',
    'self-harm': 'autolesão',
    'self-harm/intent': 'autolesão (intenção)',
    'self-harm/instructions': 'autolesão (instruções)',
    sexual: 'sexual',
    'sexual/minors': 'sexual (menores)',
    violence: 'violência',
    'violence/graphic': 'violência (gráfica)',
  }

  return map[category] ?? category
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

    // O Discord AutoMod nativo lida com Palavras Bloqueadas e Links.
    // O bot fica responsável exclusivamente por checar a regra de CAPS, 
    // já que o Discord nativo não possui regra de % de Maiúsculas.
    
    // Verificar CAPS
    if (config.capsEnabled) {
      const capsCheck = this.checkCaps(message.content, config);
      if (capsCheck.violated) {
        await this.handleViolation(message, member, capsCheck);
        return true;
      }
    }

    // Verificar AI Moderation (OpenAI)
    if (config.aiModerationEnabled && process.env.OPENAI_API_KEY) {
      const aiCheck = await this.checkAiModeration(message, config);
      if (aiCheck.violated) {
        await this.handleViolation(message, member, aiCheck);
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

  private async checkAiModeration(message: Message, config: GuildConfig): Promise<AutoModResult> {
    // Collect text content
    const text = message.content;

    const image_urls = extract_ai_moderation_image_urls({
      attachments: Array.from(message.attachments.values()).map((att) => ({
        url: att.url ?? null,
        contentType: att.contentType ?? null,
        name: att.name ?? null,
      })),
      embeds: message.embeds.map((embed) => ({
        imageUrl: embed.image?.url ?? null,
        thumbnailUrl: embed.thumbnail?.url ?? null,
      })),
    })

    // If there's nothing to check, skip
    if (!text.trim() && image_urls.length === 0) {
      return { violated: false };
    }

    const level = (config.aiModerationLevel ?? 'medio') as ai_moderation_level
    const threshold = ai_threshold_for_level(level)
    const thresholds = ai_thresholds_for_level(level)
    const result = await openAiModerationService.checkContent(text, image_urls, thresholds);

    if (!result.flagged) {
      return { violated: false };
    }

    const categoryList = result.triggeredCategories.map((c) => translate_openai_category(c)).join(', ');

    return {
      violated: true,
      reason: `Conteúdo detectado pela IA como impróprio (${categoryList})`,
      action: config.aiModerationAction ?? 'delete',
      rule: 'ai',
      details: {
        aiModerationLevel: level,
        threshold,
        triggeredCategories: result.triggeredCategories,
        scores: result.scores,
      } satisfies Prisma.InputJsonObject,
    };
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


  private async handleViolation(
    message: Message,
    member: GuildMember,
    result: AutoModResult
  ): Promise<void> {
    try {
      const message_excerpt = message.content.substring(0, 200) || '[sem conteúdo]';

      const reason = result.reason ?? 'Conteúdo impróprio detectado.'

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
          await this.applyWarn(member, reason, metadata);
          break;
        case 'mute':
          await this.applyMute(member, '5m', reason, metadata);
          break;
        case 'kick':
          await this.applyKick(member, reason, metadata);
          break;
        case 'ban':
          await this.applyBan(member, reason, metadata);
          break;
        case 'delete':
          // Apenas deletar, já foi feito acima
          break;
      }

      const notificationChannel = getSendableChannel(message.channel);
      if (notificationChannel) {
        await notificationChannel
          .send({
            content: `${EMOJIS.WARNING} <@${member.id}>, sua mensagem foi removida: ${reason}`,
            allowedMentions: { users: [member.id], parse: [] },
          })
          .then((msg) => {
            setTimeout(() => msg.delete().catch(() => {}), 7000);
          });
      }

      // Enviar para canal de logs se configurado
      if (message.guild) {
        await moderationLogService.notify({
          guild: message.guild,
          user: member.user,
          staff: member.client.user!,
          punishment: action,
          reason: `${reason}${message_excerpt ? ` | ${message_excerpt}` : ''}`,
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
