import type { APIButtonComponent, ButtonInteraction, Guild, Message, TextChannel, User } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@yuebot/database';
import type { GuildHoneyPotConfig as PrismaGuildHoneyPotConfig } from '@yuebot/database';
import { COLORS, EMOJIS } from '@yuebot/shared';
import { logger } from '../utils/logger';
import { safe_error_details } from '../utils/safe_error';
import { GuildResourceCache } from '../utils/guild_resource_cache';
import {
  HONEYPOT_DELETE_MESSAGE_SECONDS,
  HONEYPOT_UNBAN_BUTTON_PREFIX,
  honeypot_unban_target,
  should_catch_honeypot_message,
} from './honeypot.rules';

const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

type ConfigRow = PrismaGuildHoneyPotConfig | null;

function has_staff_permission(permissions: { has(flag: bigint): boolean } | null | undefined): boolean {
  if (!permissions) return false;
  return (
    permissions.has(PermissionFlagsBits.BanMembers) ||
    permissions.has(PermissionFlagsBits.ModerateMembers) ||
    permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

class HoneyPotService {
  private readonly configCache = new GuildResourceCache<ConfigRow>(
    (guildId) => prisma.guildHoneyPotConfig.findUnique({ where: { guildId } }),
    { cache_ttl_ms: CONFIG_CACHE_TTL_MS, max_entries: 2000 },
  );

  async get_config(guildId: string): Promise<ConfigRow> {
    return this.configCache.get(guildId);
  }

  async set_channel(guildId: string, channelId: string | null): Promise<PrismaGuildHoneyPotConfig> {
    const config = await prisma.guildHoneyPotConfig.upsert({
      where: { guildId },
      update: { channelId },
      create: { guildId, channelId },
    });
    this.configCache.invalidate(guildId);
    return config;
  }

  async handle_message(message: Message): Promise<boolean> {
    if (!message.guild) return false;
    if (message.webhookId) return false;

    const author = message.author;
    if (!author) return false;

    const config = await this.configCache.get(message.guild.id);
    const should_catch = should_catch_honeypot_message({
      config_channel_id: config?.channelId ?? null,
      channel_id: message.channelId,
      author_id: author.id,
      client_user_id: message.client.user?.id ?? null,
      is_webhook: false,
      has_staff_permission: has_staff_permission(message.member?.permissions),
    });
    if (!should_catch) return false;

    await this.punish(message, config as PrismaGuildHoneyPotConfig);
    return true;
  }

  private async punish(message: Message, config: PrismaGuildHoneyPotConfig): Promise<void> {
    const guild = message.guild as Guild;
    const author = message.author;
    const reason = '[HoneyPot] Message posted in the trap channel';

    try {
      await guild.members.ban(author.id, {
        deleteMessageSeconds: HONEYPOT_DELETE_MESSAGE_SECONDS,
        reason,
      });
      logger.info(
        { guildId: guild.id, userId: author.id, channelId: message.channelId },
        'HoneyPot: banned member for posting in the trap channel',
      );
    } catch (error) {
      logger.error(
        { err: safe_error_details(error), guildId: guild.id, userId: author.id },
        'HoneyPot: failed to ban member',
      );
      // The ban already deletes recent messages server-wide; when it fails,
      // remove at least the trap message itself so the payload does not stay up.
      await message.delete().catch((delete_error) => {
        logger.warn(
          { err: safe_error_details(delete_error), guildId: guild.id },
          'HoneyPot: failed to delete trap message after failed ban',
        );
      });
    }

    try {
      await prisma.guildMember.upsert({
        where: { userId_guildId: { userId: author.id, guildId: guild.id } },
        update: {},
        create: {
          userId: author.id,
          guildId: guild.id,
          username: author.username,
          avatar: author.displayAvatarURL(),
          joinedAt: new Date(),
        },
      });
      await prisma.modLog.create({
        data: {
          guildId: guild.id,
          userId: author.id,
          moderatorId: message.client.user?.id ?? 'honeypot',
          action: 'honeypot_ban',
          reason,
          metadata: {
            channelId: message.channelId,
            deleteMessageSeconds: HONEYPOT_DELETE_MESSAGE_SECONDS,
          },
        },
      });
    } catch (error) {
      logger.error(
        { err: safe_error_details(error), guildId: guild.id, userId: author.id },
        'HoneyPot: failed to persist mod log',
      );
    }

    await this.send_log_entry(guild, author, message);
  }

  private async send_log_entry(guild: Guild, user: User, message: Message): Promise<void> {
    try {
      const guild_config = await prisma.guildConfig.findUnique({
        where: { guildId: guild.id },
        select: { modLogChannelId: true },
      });
      if (!guild_config?.modLogChannelId) return;

      const channel = (await guild.channels.fetch(guild_config.modLogChannelId).catch(() => null)) as TextChannel | null;
      if (!channel || !channel.isTextBased()) return;

      const account_age_days = Math.max(0, Math.floor((Date.now() - user.createdTimestamp) / 86_400_000));
      const content_preview = (message.content ?? '').slice(0, 500) || '(no text content)';

      const embed = new EmbedBuilder()
        .setColor(COLORS.BAN)
        .setTitle(`${EMOJIS.BAN} Armadilha: conta banida automaticamente`)
        .setDescription(
          `**${user.tag}** postou no canal armadilha <#${message.channelId}> e foi banido automaticamente. As mensagens dos últimos 10 minutos foram apagadas no servidor inteiro.`,
        )
        .addFields([
          { name: 'Usuário', value: `\`${user.id}\``, inline: true },
          { name: 'Idade da conta', value: `${account_age_days} dia(s)`, inline: true },
          { name: 'Mensagem', value: content_preview, inline: false },
        ])
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().setComponents(
        new ButtonBuilder()
          .setCustomId(`${HONEYPOT_UNBAN_BUTTON_PREFIX}${user.id}`)
          .setLabel('Desbanir')
          .setStyle(ButtonStyle.Danger),
      );

      await channel.send({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error(
        { err: safe_error_details(error), guildId: guild.id },
        'HoneyPot: failed to send log entry',
      );
    }
  }

  async handle_unban_button(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guild) return;

    const member_permissions = interaction.member?.permissions;
    if (!has_staff_permission(member_permissions as { has(flag: bigint): boolean } | null)) {
      await interaction
        .reply({ content: `${EMOJIS.ERROR} Você não tem permissão para desbanir usuários.`, flags: MessageFlags.Ephemeral })
        .catch(() => null);
      return;
    }

    const user_id = honeypot_unban_target(interaction.customId);
    if (!user_id) return;

    try {
      await interaction.guild.members.unban(
        user_id,
        `[HoneyPot] Unbanned by ${interaction.user.tag}`,
      );
      await prisma.modLog.create({
        data: {
          guildId: interaction.guild.id,
          userId: user_id,
          moderatorId: interaction.user.id,
          action: 'honeypot_unban',
          reason: '[HoneyPot] Manual unban from log entry',
        },
      });
    } catch (error) {
      logger.warn(
        { err: safe_error_details(error), guildId: interaction.guild.id, userId: user_id },
        'HoneyPot: failed to unban user from log button',
      );
      await interaction
        .reply({
          content: `${EMOJIS.ERROR} Não consegui desbanir este usuário (talvez o ban já tenha sido removido).`,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => null);
      return;
    }

    await this.disable_unban_buttons(interaction);
    await interaction
      .followUp({ content: `${EMOJIS.SUCCESS} Usuário desbanido.`, flags: MessageFlags.Ephemeral })
      .catch(() => null);
  }

  private async disable_unban_buttons(interaction: ButtonInteraction): Promise<void> {
    try {
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (const row of interaction.message.components) {
        if (row.type !== ComponentType.ActionRow) continue;
        const api_row = row as unknown as { components: unknown[] };
        const builder = new ActionRowBuilder<ButtonBuilder>();
        builder.setComponents(
          api_row.components.map((component) =>
            ButtonBuilder.from(component as unknown as APIButtonComponent).setDisabled(true),
          ),
        );
        rows.push(builder);
      }
      await interaction.update({ components: rows });
    } catch (error) {
      logger.warn(
        { err: safe_error_details(error), guildId: interaction.guild?.id },
        'HoneyPot: failed to disable unban buttons',
      );
    }
  }

  clear_cache(guildId: string): void {
    this.configCache.invalidate(guildId);
  }
}

export const honeypotService = new HoneyPotService();
