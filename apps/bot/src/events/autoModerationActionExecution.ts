import { Events, AutoModerationActionExecution } from "discord.js";
import { prisma } from "@yuebot/database";
import type { Prisma } from "@yuebot/database";
import { logger } from "../utils/logger";
import { moderationLogService } from "../services/moderationLog.service";
import { WarnService } from "../services/warnService";
import {
    discord_timeout_max_ms,
    EMOJIS,
    find_first_banned_word_match,
    parseDurationMs,
} from "@yuebot/shared";
import { check_automod_link_message, type automod_action } from "../services/automod.links";
import { getSendableChannel } from "../utils/discord";

export async function handleAutoModerationActionExecution(
	execution: AutoModerationActionExecution
) {
	// Apenas foca nas regras gerenciadas pelo nosso Bot
	// Caso a regra seja manual do servidor, podemos logar também, mas no padrão aplicaremos as métricas.
	if (!execution.guild || !execution.user) return;

	try {
        const guild = execution.guild;
		const userId = execution.user.id;
		const ruleName = execution.autoModerationRule?.name || "Desconhecida";

        logger.info(
			`[AutoMod] Ação disparada no servidor ${guild.id} para usuário ${userId}. Rule: ${ruleName}`
		);

        // Obter configuração do painel
        const config = await prisma.guildConfig.findUnique({
			where: { guildId: guild.id },
		});
		if (!config) return;

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return;

        // 1. Identificando Regra no Cache do Discord
        const autoModRule = execution.autoModerationRule;
        let ruleContext = 'automod';
        let actionToApply: automod_action = 'delete';
        let timeoutDuration = '5m';
        let reason = 'Bloqueado por AutoMod (Regra Nativa)';

        if (autoModRule?.triggerMetadata?.keywordFilter) {
            ruleContext = autoModRule.name === '[AutoMod] Filtro Anti-Link' ? 'link' : 'word';
            
            // Tentar descobrir a ação da db na palavra filtrada.
            const matchedContent = execution.content || execution.matchedKeyword || execution.matchedContent;
            
            const bannedWords = config.bannedWords as Array<{ word: string; action: string }>;
            if (matchedContent && ruleContext === 'word') {
                 const match = find_first_banned_word_match(matchedContent, bannedWords);
                 if (match) {
                     actionToApply = normalizeAction(match.entry.action, 'warn');
                     reason = `Palavra proibida: "${match.entry.word}"`;
                 }
            } else if (ruleContext === 'link') {
                const linkCheck = check_automod_link_message({
                    content: matchedContent || '',
                    memberHasRoles: member.roles.cache.some((role) => role.id !== guild.id),
                    config,
                });
                actionToApply = linkCheck.violated
                    ? linkCheck.action
                    : normalizeAction(config.linkAction, 'delete');
                timeoutDuration = linkCheck.violated
                    ? (linkCheck.duration ?? config.linkTimeoutDuration)
                    : config.linkTimeoutDuration;
                reason = linkCheck.violated
                    ? linkCheck.reason
                    : 'Link não autorizado (Anti-Link)';
            } else {
                actionToApply = 'warn'; // Base fallback
            }
        } 
        else if (autoModRule?.triggerMetadata?.regexPatterns) {
            ruleContext = 'link';
            const linkCheck = check_automod_link_message({
                content: execution.content || execution.matchedContent || '',
                memberHasRoles: member.roles.cache.some((role) => role.id !== guild.id),
                config,
            });
            actionToApply = linkCheck.violated
                ? linkCheck.action
                : normalizeAction(config.linkAction, 'delete');
            timeoutDuration = linkCheck.violated
                ? (linkCheck.duration ?? config.linkTimeoutDuration)
                : config.linkTimeoutDuration;
            reason = linkCheck.violated
                ? linkCheck.reason
                : 'Link não autorizado (Anti-Link)';
        }

        const metadata: Prisma.InputJsonValue = {
            source: 'native_automod',
            rule: ruleContext,
            action: actionToApply,
            details: {
                content: execution.content,
                matchedKeyword: execution.matchedKeyword,
                matchedContent: execution.matchedContent
            },
            message: {
              id: execution.messageId || 'SemID',
              channelId: execution.channelId || 'SemCanal',
              excerpt: execution.content ? execution.content.substring(0, 100) : '[sem conteúdo]',
            },
            deleted: true,
        };

        // O Discord JÁ BLOQUEOU (BlockMessage) a mensagem. Nosso dever agora
        // é aplicar a penalidade que está configurada no painel internamente (Warn, Mute, Kick, Ban).

        if (ruleContext === 'link' && config.linkNotifyEnabled) {
            const channel = guild.channels.cache.get(execution.channelId)
                ?? await guild.channels.fetch(execution.channelId).catch(() => null);
            const notificationChannel = getSendableChannel(channel);
            if (notificationChannel) {
                await notificationChannel.send({
                    content: `${EMOJIS.WARNING} <@${member.id}>, sua mensagem foi removida: ${reason}`,
                    allowedMentions: { users: [member.id], parse: [] },
                }).catch((error) => {
                    logger.warn({ error, guildId: guild.id, channelId: execution.channelId }, 'Failed to send AutoMod link notice');
                });
            }
        }

        switch (actionToApply) {
            case 'warn':
              await applyWarn(member, reason, metadata, config.warnThresholds);
              break;
            case 'mute':
              await applyMute(member, timeoutDuration, reason, metadata);
              break;
            case 'kick':
              await applyKick(member, reason, metadata);
              break;
            case 'ban':
              await applyBan(member, reason, metadata);
              break;
            case 'delete':
              // Mensagem já deletada pelo Automod Nativo, nada a fazer além de registrar no modlog
              await generateLog(member, 'delete', reason, metadata);
              break;
        }

        // Emitir no canal de ModLog e punir
        if (actionToApply !== 'delete') {
            await moderationLogService.notify({
              guild: guild,
              user: execution.user,
              staff: member.client.user!,
              punishment: actionToApply,
              reason: `${reason} | ${execution.content ? execution.content.substring(0, 100) : ''}`,
              duration: actionToApply === 'mute' ? timeoutDuration : '',
            });
        }

	} catch (error) {
		logger.error({ error }, "Erro no listener de AutoModerationActionExecution");
	}
}

// Helpers para punição espelhados do antigo automodService

function normalizeAction(value: string, fallback: automod_action): automod_action {
    if (value === 'delete' || value === 'warn' || value === 'mute' || value === 'kick' || value === 'ban') {
        return value;
    }
    return fallback;
}

async function applyWarn(member: import("discord.js").GuildMember, reason: string, metadata: Prisma.InputJsonValue, warnThresholds: Prisma.JsonValue): Promise<void> {
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

    await generateLog(member, 'warn', reason, metadata);

    const warn_service = new WarnService(member.client);
    await warn_service.checkAndApplyThresholds(member.guild.id, member.id, updated.warnings);
}

async function applyMute(member: import("discord.js").GuildMember, duration: string, reason: string, metadata: Prisma.InputJsonValue): Promise<void> {
    const ms = parseDurationMs(duration, {
        maxMs: discord_timeout_max_ms,
        clampToMax: true,
    }) ?? 5 * 60 * 1000;
    await member.timeout(ms, `[AutoMod Nativo] ${reason}`);
    await generateLog(member, 'mute', reason, metadata, duration);
}

async function applyKick(member: import("discord.js").GuildMember, reason: string, metadata: Prisma.InputJsonValue): Promise<void> {
    await member.kick(`[AutoMod Nativo] ${reason}`);
    await generateLog(member, 'kick', reason, metadata);
}

async function applyBan(member: import("discord.js").GuildMember, reason: string, metadata: Prisma.InputJsonValue): Promise<void> {
    await member.ban({ reason: `[AutoMod Nativo] ${reason}` });
    await generateLog(member, 'ban', reason, metadata);
}

async function generateLog(member: import("discord.js").GuildMember, action: string, reason: string, metadata: Prisma.InputJsonValue, duration?: string) {
    await prisma.guildMember.upsert({
        where: {
          userId_guildId: {
            userId: member.id,
            guildId: member.guild.id,
          },
        },
        update: {
          username: member.user.username,
          avatar: member.user.avatar,
          joinedAt: member.joinedAt ?? new Date(),
        },
        create: {
          userId: member.id,
          guildId: member.guild.id,
          username: member.user.username,
          avatar: member.user.avatar,
          joinedAt: member.joinedAt ?? new Date(),
        },
    });

    await prisma.modLog.create({
        data: {
          guildId: member.guild.id,
          userId: member.id,
          moderatorId: member.client.user!.id,
          action,
          reason: `[AutoMod Nativo] ${reason}`,
          duration,
          metadata,
        },
    });
}
