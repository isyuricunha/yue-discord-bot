import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'
import { keywordTriggerService } from '../../services/keywordTrigger.service'
import { safe_defer_ephemeral, safe_reply_ephemeral } from '../../utils/interaction'

const ITEMS_PER_PAGE = 10

export const gatilhoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('gatilho')
    .setDescription('Gerenciar gatilhos de auto-resposta com GIF/imagem')
    .addSubcommand((sub) =>
      sub
        .setName('adicionar')
        .setDescription('Adicionar um gatilho de palavra-chave com mídia')
        .addStringOption((opt) =>
          opt
            .setName('palavra')
            .setDescription('Palavra ou frase que ativará o gatilho')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName('url')
            .setDescription('URL direta do GIF ou imagem (tenor, giphy, imgur, discord...)')
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Restringir a um canal específico (opcional — padrão: todos)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remover')
        .setDescription('Remover um gatilho de palavra-chave')
        .addStringOption((opt) =>
          opt
            .setName('palavra')
            .setDescription('Palavra-chave do gatilho a remover')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('lista')
        .setDescription('Listar todos os gatilhos deste servidor')
        .addIntegerOption((opt) =>
          opt.setName('pagina').setDescription('Número da página').setMinValue(1).setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Use este comando em um servidor.`,
      })
      return
    }

    const sub = interaction.options.getSubcommand()

    // ── /gatilho adicionar ──────────────────────────────────────────────────
    if (sub === 'adicionar') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Você precisa da permissão **Gerenciar Servidor** para usar este comando.`,
        })
        return
      }

      const keyword = interaction.options.getString('palavra', true).trim()
      const raw_url = interaction.options.getString('url', true).trim()
      const channel = interaction.options.getChannel('canal')

      if (!keywordTriggerService.validate_media_url(raw_url)) {
        await safe_reply_ephemeral(interaction, {
          content:
            `${EMOJIS.ERROR} URL inválida. Aceito apenas URLs \`https://\` de domínios confiáveis ` +
            `(tenor.com, giphy.com, imgur.com, i.imgur.com, cdn.discordapp.com, media.discordapp.net) ` +
            `ou URLs com extensão de mídia conhecida no final do caminho (.gif, .png, .jpg, .jpeg, .webp, .mp4).`,
        })
        return
      }

      await safe_defer_ephemeral(interaction)

      try {
        await keywordTriggerService.add_trigger(
          interaction.guild.id,
          keyword,
          raw_url,
          channel?.id ?? null,
          interaction.user.id
        )
      } catch (error: any) {
        // Unique constraint violation — keyword already exists
        if (error?.code === 'P2002') {
          await interaction.editReply({
            content: `${EMOJIS.ERROR} Já existe um gatilho com a palavra **${keyword}** neste servidor.`,
          })
          return
        }
        throw error
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Gatilho adicionado`)
        .addFields(
          { name: 'Palavra-chave', value: `\`${keyword}\``, inline: true },
          { name: 'Canal', value: channel ? `<#${channel.id}>` : 'Todos os canais', inline: true }
        )
        .setImage(raw_url)

      await interaction.editReply({ embeds: [embed] })
      return
    }

    // ── /gatilho remover ────────────────────────────────────────────────────
    if (sub === 'remover') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Você precisa da permissão **Gerenciar Servidor** para usar este comando.`,
        })
        return
      }

      const keyword = interaction.options.getString('palavra', true).trim()

      await safe_defer_ephemeral(interaction)

      const result = await keywordTriggerService.remove_trigger(interaction.guild.id, keyword)

      if (result.count === 0) {
        await interaction.editReply({
          content: `${EMOJIS.WARNING} Nenhum gatilho encontrado com a palavra **${keyword}**.`,
        })
        return
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Gatilho removido`)
        .setDescription(`A palavra-chave **${keyword}** foi removida com sucesso.`)

      await interaction.editReply({ embeds: [embed] })
      return
    }

    // ── /gatilho lista ──────────────────────────────────────────────────────
    if (sub === 'lista') {
      await safe_defer_ephemeral(interaction)

      const triggers = await keywordTriggerService.get_triggers(interaction.guild.id)
      const page_number = Math.max(1, interaction.options.getInteger('pagina') ?? 1)
      const total_pages = Math.max(1, Math.ceil(triggers.length / ITEMS_PER_PAGE))
      const page = Math.min(page_number, total_pages)
      const start = (page - 1) * ITEMS_PER_PAGE
      const page_items = triggers.slice(start, start + ITEMS_PER_PAGE)

      if (triggers.length === 0) {
        await interaction.editReply({
          content: `${EMOJIS.INFO ?? 'ℹ️'} Nenhum gatilho configurado neste servidor.`,
        })
        return
      }

      const lines = page_items.map((t) => {
        const channel_text = t.channelId ? `<#${t.channelId}>` : 'Todos'
        const url_short = t.mediaUrl.length > 60 ? `${t.mediaUrl.slice(0, 57)}…` : t.mediaUrl
        return `• \`${t.keyword}\` — ${channel_text}\n  <${url_short}>`
      })

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('🎯 Gatilhos de auto-resposta')
        .setDescription(lines.join('\n\n'))
        .setFooter({ text: `Página ${page}/${total_pages} • ${triggers.length} gatilho(s) no total` })

      await interaction.editReply({ embeds: [embed] })
    }
  },
}
