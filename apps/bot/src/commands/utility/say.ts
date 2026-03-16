import { ChannelType, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { render_discord_message_template } from '@yuebot/shared'

import { logger } from '../../utils/logger'
import type { Command } from '../index'
import { safe_defer_ephemeral, safe_reply_ephemeral } from '../../utils/interaction'

type sendable_message = {
  content?: string
  embeds?: unknown[]
}

function add_watermark(message: sendable_message, staff_tag: string): sendable_message {
  const watermark = `\n\nMensagem enviada por @${staff_tag}`

  const content = (message.content ?? '').trim()

  const next: sendable_message = {
    ...message,
    ...(content.length > 0 ? { content: `${content}${watermark}` } : { content: watermark.trim() }),
  }

  if (Array.isArray(message.embeds) && message.embeds.length > 0) {
    const first = message.embeds[0]
    if (first && typeof first === 'object') {
      const embed = first as Record<string, unknown>
      const footer = (embed.footer ?? {}) as Record<string, unknown>
      const footer_text_raw = footer.text
      const footer_text = typeof footer_text_raw === 'string' ? footer_text_raw : ''

      const merged_footer_text = footer_text.length > 0 ? `${footer_text} • Mensagem enviada por @${staff_tag}` : `Mensagem enviada por @${staff_tag}`

      const merged_embed = {
        ...embed,
        footer: {
          ...footer,
          text: merged_footer_text,
        },
      }

      next.embeds = [merged_embed, ...message.embeds.slice(1)]
    }
  }

  return next
}

export const sayCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Enviar uma mensagem em um canal como o bot (com marca d\'água)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option.setName('mensagem').setDescription('Texto ou JSON (content + embed)').setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal onde a mensagem será enviada')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, {
        content: 'Este comando só pode ser usado em servidores!',
      })
      return
    }

    const raw_template = interaction.options.getString('mensagem', true)
    const target_channel = interaction.options.getChannel('canal') ?? interaction.channel

    const is_text_based =
      !!target_channel &&
      typeof target_channel === 'object' &&
      'isTextBased' in target_channel &&
      typeof (target_channel as { isTextBased?: unknown }).isTextBased === 'function' &&
      (target_channel as { isTextBased: () => boolean }).isTextBased()

    const can_send = !!target_channel && typeof target_channel === 'object' && 'send' in target_channel

    if (!target_channel || !is_text_based || !can_send) {
      await safe_reply_ephemeral(interaction, {
        content: 'Canal inválido (precisa ser um canal de texto).',
      })
      return
    }

    await safe_defer_ephemeral(interaction)

    try {
      const rendered = render_discord_message_template(raw_template, {
        user: {
          id: interaction.user.id,
          username: interaction.user.username,
          tag: interaction.user.tag,
          avatarUrl: interaction.user.displayAvatarURL(),
        },
        staff: {
          id: interaction.user.id,
          username: interaction.user.username,
          tag: interaction.user.tag,
          avatarUrl: interaction.user.displayAvatarURL(),
        },
        guild: {
          id: interaction.guild.id,
          name: interaction.guild.name,
          memberCount: interaction.guild.memberCount,
          iconUrl: interaction.guild.iconURL() ?? undefined,
        },
      })

      const with_watermark = add_watermark(rendered, interaction.user.tag)

      const sent = await (target_channel as { send: (input: any) => Promise<any> }).send({
        ...(with_watermark.content ? { content: with_watermark.content } : {}),
        ...(with_watermark.embeds ? { embeds: with_watermark.embeds as any } : {}),
        allowedMentions: { parse: [] },
      })

      await interaction.editReply({
        content: `Mensagem enviada com sucesso em <#${target_channel.id}>. Link: ${sent.url}`,
      })

      logger.info({ channelId: target_channel.id }, `Say: mensagem enviada por ${interaction.user.tag}`)
    } catch (error) {
      logger.error({ error }, 'Erro ao executar /say')
      await interaction.editReply({
        content: 'Erro ao enviar mensagem. Verifique se tenho permissão para falar no canal e se o JSON está válido.',
      })
    }
  },
}
