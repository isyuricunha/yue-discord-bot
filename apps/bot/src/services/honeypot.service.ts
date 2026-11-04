import type { APIButtonComponent, ButtonInteraction, Guild, Message, TextChannel, User } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, DiscordAPIError, EmbedBuilder, MessageFlags } from 'discord.js';
import { prisma } from '@yuebot/database';
import type { GuildHoneyPotConfig as PrismaGuildHoneyPotConfig } from '@yuebot/database';
import { COLORS, EMOJIS } from '@yuebot/shared';
import { logger } from '../utils/logger';
import { safe_error_details } from '../utils/safe_error';
import { GuildResourceCache } from '../utils/guild_resource_cache';
import {
  HONEYPOT_DELETE_MESSAGE_SECONDS,
  HONEYPOT_RECENT_PUNISH_TTL_MS,
  HONEYPOT_UNBAN_BUTTON_PREFIX,
  has_ban_permission,
  has_staff_permission,
  honeypot_unban_target,
  should_catch_honeypot_message,
  truncate_code_points,
} from './honeypot.rules';

const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

type ConfigRow = PrismaGuildHoneyPotConfig | null;

class HoneyPotService {
  private readonly configCache = new GuildResourceCache<ConfigRow>(
    (guildId) => prisma.guildHoneyPotConfig.findUnique({ where: { guildId } }),
    { cache_ttl_ms: CONFIG_CACHE_TTL_MS, max_entries: 2000 },
  );

  // One punish attempt per (guild, user) at a time; a spam burst delivers
  // several messages in the same second and each one triggers this handler.
  private readonly pendingPunish = new Map<string, Promise<unknown>>();
  private readonly recentlyPunished = new Map<string, number>();

  private sweep_recently(now: number): void {
    for (const [key, punished_at] of this.recentlyPunished) {
      if (now - punished_at > HONEYPOT_RECENT_PUNISH_TTL_MS) this.recentlyPunished.delete(key);
    }
  }

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

  // Third-party bot accounts are intentionally caught too: modern spam runs
  // from real accounts and spam bot accounts alike. Only webhooks and this
  // client itself are exempt.
  async handle_message(message: Message): Promise<boolean> {
    if (!message.guild) return false;
    if (message.webhookId) return false;

    const author = message.author;
    if (!author) return false;

    const config = await this.configCache.get(message.guild.id);
    if (!config?.channelId) return false;

    // Threads spawned inside the trap channel belong to the trap: resolve to
    // the parent channel so thread messages cannot bypass it.
    const effective_channel_id = message.channel.isThread()
      ? message.channel.parentId
      : message.channelId;

    const should_catch = should_catch_honeypot_message({
      config_channel_id: config.channelId,
      channel_id: effective_channel_id,
      author_id: author.id,
      client_user_id: message.client.user?.id ?? null,
      is_webhook: false,
    });
    if (!should_catch) return false;

    const dedup_key = `${message.guild.id}:${author.id}`;
    this.sweep_recently(Date.now());

    // Follow-up messages from an already handled author still get deleted so
    // the payload does not stay visible in the trap channel.
    if (this.recentlyPunished.has(dedup_key)) {
      await this.delete_trap_message(message);
      return true;
    }

    const pending = this.pendingPunish.get(dedup_key);
    if (pending) {
      let pending_outcome: 'staff' | 'punished' | 'failed';
      try {
        pending_outcome = (await pending) as 'staff' | 'punished' | 'failed';
      } catch {
        pending_outcome = 'failed';
      }
      if (pending_outcome === 'staff') return false;
      await this.delete_trap_message(message);
      return true;
    }

    // Claim the punish slot before the server-side member lookup so a
    // concurrent burst performs a single fetch and a single ban attempt.
    const decision = this.resolve_and_punish(message).finally(() => {
      this.pendingPunish.delete(dedup_key);
    });
    this.pendingPunish.set(dedup_key, decision);

    try {
      const outcome = await decision;
      if (outcome === 'staff') return false;
      this.recentlyPunished.set(dedup_key, Date.now());
      return true;
    } catch (error) {
      // Transient member-resolution failure (rate limit, network, 5xx): fail
      // closed, do not ban, remove the payload and report the failure.
      logger.error(
        { err: safe_error_details(error), guildId: message.guild.id, userId: author.id },
        'HoneyPot: member resolution failed',
      );
      await this.delete_trap_message(message);
      await this.send_log_entry(message.guild, author, message, false);
      this.recentlyPunished.set(dedup_key, Date.now());
      return true;
    }
  }

  private async resolve_and_punish(message: Message): Promise<'staff' | 'punished' | 'failed'> {
    const guild = message.guild as Guild;
    const author = message.author;

    // message.member is only populated with the GuildMembers intent enabled
    // and resolves from cache alone; resolve the member server-side so the
    // staff exemption never depends on the intent configuration. Only a real
    // unknown member (account left the guild) maps to null; transient API
    // failures propagate and fail closed instead of banning blind.
    const member = await guild.members.fetch(author.id).catch((error) => {
      if (error instanceof DiscordAPIError && error.code === 10007) return null;
      throw error;
    });
    if (has_staff_permission(member?.permissions ?? null)) return 'staff';

    return this.punish(message);
  }

  private async delete_trap_message(message: Message): Promise<void> {
    await message.delete().catch((error) => {
      logger.warn(
        { err: safe_error_details(error), guildId: message.guild?.id },
        'HoneyPot: failed to delete trap message',
      );
    });
  }

  private async punish(message: Message): Promise<'punished' | 'failed'> {
    const guild = message.guild as Guild;
    const author = message.author;
    const reason = '[HoneyPot] Message posted in the trap channel';

    let banned = false;
    try {
      await guild.members.ban(author.id, {
        deleteMessageSeconds: HONEYPOT_DELETE_MESSAGE_SECONDS,
        reason,
      });
      banned = true;
      logger.info(
        { guildId: guild.id, userId: author.id, channelId: message.channelId },
        'HoneyPot: banned member for posting in the trap channel',
      );
    } catch (error) {
      logger.error(
        { err: safe_error_details(error), guildId: guild.id, userId: author.id },
        'HoneyPot: failed to ban member',
      );
    }

    if (banned) {
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
      await this.send_log_entry(guild, author, message, true);
      return 'punished';
    }

    // The ban sweep already deletes recent messages server-wide; when the
    // ban fails, remove at least the trap message itself so the payload does
    // not stay up, and skip the audit row: the table must not claim a ban
    // that never happened.
    await this.delete_trap_message(message);
    await this.send_log_entry(guild, author, message, false);
    return 'failed';
  }

  private async send_log_entry(
    guild: Guild,
    user: User,
    message: Message,
    banned: boolean,
  ): Promise<void> {
    try {
      const guild_config = await prisma.guildConfig.findUnique({
        where: { guildId: guild.id },
        select: { modLogChannelId: true },
      });
      if (!guild_config?.modLogChannelId) return;

      const channel = (await guild.channels.fetch(guild_config.modLogChannelId).catch(() => null)) as TextChannel | null;
      if (!channel || !channel.isTextBased()) return;

      if (!banned) {
        const embed = new EmbedBuilder()
          .setColor(COLORS.WARNING)
          .setTitle(`${EMOJIS.WARNING} Armadilha: falha ao banir automaticamente`)
          .setDescription(
            `**${user.tag}** postou no canal armadilha <#${message.channelId}>, mas o banimento **falhou**. Verifique as permissões do bot e a hierarquia de cargos. A mensagem da armadilha foi apagada.`,
          )
          .addFields([{ name: 'Usuário', value: `\`${user.id}\``, inline: true }])
          .setTimestamp();
        await channel.send({ embeds: [embed] });
        return;
      }

      const account_age_days = Math.max(0, Math.floor((Date.now() - user.createdTimestamp) / 86_400_000));
      const content_preview = truncate_code_points(message.content ?? '', 500) || '(no text content)';

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
    if (!has_ban_permission(member_permissions as { has(flag: bigint): boolean } | null)) {
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
