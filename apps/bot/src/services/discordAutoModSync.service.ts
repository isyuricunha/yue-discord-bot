import {
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  AutoModerationActionType,
  Client,
  Guild,
  AutoModerationRuleCreateOptions
} from 'discord.js';
import { prisma } from '@yuebot/database';
import type { GuildConfig, Prisma } from '@yuebot/database';
import { logger } from '../utils/logger';

export class DiscordAutoModSyncService {
  /**
   * Identificadores únicos usados nos metadados/nomes das regras para que o bot
   * saiba quais regras ele gerencia ao sincronizar (evitando deletar regras manuais dos admins).
   */
  private readonly WORD_RULE_NAME = '[AutoMod] Filtro de Palavras Proibidas';
  private readonly LINK_RULE_NAME = '[AutoMod] Filtro Anti-Link';

  constructor(private client: Client) {}

  /**
   * Sincroniza todas as regras de AutoMod para uma Guild específica baseado
   * na configuração atual do banco de dados (Painel Web).
   */
  async syncGuild(guildId: string): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return; // O bot não está no servidor

      // Obter configs do DB
      const config = await prisma.guildConfig.findUnique({
        where: { guildId },
      });

      if (!config) return;

      // Buscar as regras já existentes no Discord para a guild
      const existingRules = await guild.autoModerationRules.fetch().catch(() => null);
      
      // Encontrar as nossas regras gerenciadas (se existirem)
      const managedWordRule = existingRules?.find(r => r.name === this.WORD_RULE_NAME);
      const managedLinkRule = existingRules?.find(r => r.name === this.LINK_RULE_NAME);

      // Sincronizar Regra de Palavras
      if (config.wordFilterEnabled) {
        await this.syncWordRule(guild, config, managedWordRule?.id);
      } else if (managedWordRule) {
        // Se a config no painel desativou mas existia a regra no servidor, a deletamos
        await guild.autoModerationRules.delete(managedWordRule.id).catch(() => {});
      }

      // Sincronizar Regra de Links
      if (config.linkFilterEnabled) {
        await this.syncLinkRule(guild, config, managedLinkRule?.id);
      } else if (managedLinkRule) {
        // Se a config no painel desativou mas existia a regra no servidor, a deletamos
        await guild.autoModerationRules.delete(managedLinkRule.id).catch(() => {});
      }

      logger.info(`✅ AutoMod sincronizado com sucesso para Guild: ${guildId}`);
    } catch (error) {
      logger.error({ error, guildId }, 'Erro ao sincronizar AutoMod com o Discord');
    }
  }

  /**
   * Cria ou Edita a regra para Palavras Proibidas
   */
  private async syncWordRule(guild: Guild, config: GuildConfig, existingRuleId?: string) {
    // Palavras salvas vêm como JSON {"word": "...", action: "..."}
    const rawBannedWords = config.bannedWords as Array<{ word: string; action: string }>;
    if (!rawBannedWords || rawBannedWords.length === 0) {
       // Sem palavras configuradas, caso exista limite o melhor é remover
       if (existingRuleId) await guild.autoModerationRules.delete(existingRuleId).catch(() => {});
       return;
    }

    // O AutoMod Native precisa de apenas um array das keywords. O Discord lida
    // nativamente com substrings e exatas dependendo dos asteriscos, mas vamos enviar as palavras brutas.
    const keywordFilter = rawBannedWords.map(w => `*${w.word}*`);
    
    // O Discord permite no máximo 1000 palavras por regra
    const safeKeywords = keywordFilter.slice(0, 1000);

    const actionType = this.mapConfigActionToDiscordAction(rawBannedWords[0]?.action || 'delete');

    const options: AutoModerationRuleCreateOptions = {
      name: this.WORD_RULE_NAME,
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: {
        keywordFilter: safeKeywords,
      },
      actions: [
        {
          type: AutoModerationActionType.BlockMessage,
          metadata: {
            customMessage: `Sua mensagem foi bloqueada por conter informações/palavras proibidas.`,
          }
        }
      ],
      enabled: true,
      exemptRoles: this.parseWhitelist(config.wordFilterWhitelistRoles),
      exemptChannels: this.parseWhitelist(config.wordFilterWhitelistChannels)
    };

    if (existingRuleId) {
      await guild.autoModerationRules.edit(existingRuleId, options).catch((err) => {
        logger.error({ err }, "AutoMod Word Sync Edit failed.");
      });
    } else {
      await guild.autoModerationRules.create(options).catch((err) => {
        logger.error({ err }, "AutoMod Word Sync Create failed.");
      });
    }
  }

  /**
   * Cria ou Edita a regra para Blocks de DOMÍNIOS da Internet.
   * Usar Regex no native Discord permite barrar links.
   */
  private async syncLinkRule(guild: Guild, config: GuildConfig, existingRuleId?: string) {
    let regexPatterns: string[] = [];

    if (config.linkBlockAll) {
       // Block ALL links mode (using Regex to find ANY link), unless it comes from Allowed Domains
       // Como o AutoMod nativo tem "AllowList", podemos usar Regex global pra Link e pôr os allowList.
       
       // Regex genérico que identifica qualquer estrutura URL.
       regexPatterns.push(`(https?:\\/\\/)?(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)`);
       
       const allowedDomains = (config.allowedDomains as string[]) || [];
       
       const options: AutoModerationRuleCreateOptions = {
        name: this.LINK_RULE_NAME,
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.Keyword, // Regex usa o trigger de Keyword no V2 API do Discord
        triggerMetadata: {
          regexPatterns: regexPatterns.slice(0, 10), // Limite Discord: 10 padrões de Regex
          allowList: allowedDomains.map(d => `*${d}*`).slice(0, 100) // Domínios seguros goes here
        },
        actions: [
          {
            type: AutoModerationActionType.BlockMessage,
            metadata: {
              customMessage: `Links não autorizados foram bloqueados neste servidor.`,
            }
          }
        ],
        enabled: true,
        exemptRoles: this.parseWhitelist(config.linkWhitelistRoles),
        exemptChannels: this.parseWhitelist(config.linkWhitelistChannels)
      };

      await this.saveOrUpdateRule(guild, options, existingRuleId);

    } else {
       // Banned domains Only form
       const bannedDomains = (config.bannedDomains as string[]) || [];

       if (!bannedDomains || bannedDomains.length === 0) {
          if (existingRuleId) await guild.autoModerationRules.delete(existingRuleId).catch(() => {});
          return;
       }

       const keywordFilter = bannedDomains.map(w => `*${w}*`);

       const options: AutoModerationRuleCreateOptions = {
        name: this.LINK_RULE_NAME,
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: {
          keywordFilter: keywordFilter.slice(0, 1000)
        },
        actions: [
          {
            type: AutoModerationActionType.BlockMessage,
            metadata: {
              customMessage: `Esse domínio / link está proibido publicamente.`,
            }
          }
        ],
        enabled: true,
        exemptRoles: this.parseWhitelist(config.linkWhitelistRoles),
        exemptChannels: this.parseWhitelist(config.linkWhitelistChannels)
      };

      await this.saveOrUpdateRule(guild, options, existingRuleId);
    }
  }

  private async saveOrUpdateRule(guild: Guild, options: AutoModerationRuleCreateOptions, existing?: string) {
    if (existing) {
      await guild.autoModerationRules.edit(existing, options).catch((err) => {
        logger.error({ err }, "AutoMod Link Sync Edit failed.");
      });
    } else {
      await guild.autoModerationRules.create(options).catch((err) => {
        logger.error({ err }, "AutoMod Link Sync Create failed.");
      });
    }
  }

  // Helpers

  // Transforma Prisma Json Arrays em string[]
  private parseWhitelist(whitelist: Prisma.JsonValue): string[] {
    if (!whitelist) return [];
    if (Array.isArray(whitelist)) {
      return whitelist.filter(id => typeof id === 'string');
    }
    return [];
  }

  // Identifica a Engine de Punição
  private mapConfigActionToDiscordAction(action: string): AutoModerationActionType {
    // Nós sempre faremos o Discord BLOQUEAR a Message e a consequencia do Banco de Dados
    // (Warn, Mute, Ban) será capturada através do Listener no 'autoModerationActionExecution'.
    return AutoModerationActionType.BlockMessage;
  }
}
