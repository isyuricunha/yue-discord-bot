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
            .setName('palavras')
            .setDescription('Palavras ou frases que ativará o gatilho (uma por linha)')
            .setRequired(true)
            .setMaxLength(500)
        )
        .addStringOption((opt) =>
          opt
            .setName('url')
            .setDescription('URL de imagem, GIF, vídeo ou link (YouTube, Spotify...)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('texto')
            .setDescription('Mensagem de texto que o bot enviará')
            .setRequired(false)
            .setMaxLength(2000)
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Restringir a um canal específico (opcional — padrão: todos)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('responder')
            .setDescription('Se o bot deve responder à mensagem (padrão: sim)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('editar')
        .setDescription('Editar um gatilho existente')
        .addStringOption((opt) =>
          opt
            .setName('palavra')
            .setDescription('Palavra-chave existente do gatilho que deseja editar')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('novas-palavras')
            .setDescription('Novas palavras para este gatilho (uma por linha)')
            .setRequired(false)
            .setMaxLength(500)
        )
        .addStringOption((opt) =>
          opt
            .setName('url')
            .setDescription('Nova URL de mídia')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('texto')
            .setDescription('Nova mensagem de texto')
            .setRequired(false)
            .setMaxLength(2000)
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Novo canal restrito')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('responder')
            .setDescription('Se deve responder à mensagem')
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
            .setAutocomplete(true)
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

    // Helper to parse multiple keywords
    const parse_keywords = (input: string): string[] => {
      return input
        .split('\n')
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0 && k.length <= 100)
    }

    // ── /gatilho adicionar ──────────────────────────────────────────────────
    if (sub === 'adicionar') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Você precisa da permissão **Gerenciar Servidor** para usar este comando.`,
        })
        return
      }

      const keywords_input = interaction.options.getString('palavras', true)
      const keywords = parse_keywords(keywords_input)
      const raw_url = interaction.options.getString('url')?.trim() || null
      const content = interaction.options.getString('texto')?.trim() || null
      const channel = interaction.options.getChannel('canal')
      const responder = interaction.options.getBoolean('responder') ?? true

      if (keywords.length === 0) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Você precisa informar pelo menos uma palavra válida.`,
        })
        return
      }

      if (!raw_url && !content) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Você precisa informar pelo menos uma **URL** ou um **Texto** para o gatilho.`,
        })
        return
      }

      if (raw_url && !keywordTriggerService.validate_media_url(raw_url)) {
        await safe_reply_ephemeral(interaction, {
          content:
            `${EMOJIS.ERROR} URL de mídia inválida ou domínio não suportado para Embed direto. ` +
            `Links de YouTube/Spotify são aceitos, mas URLs de imagem/GIF devem ser de domínios confiáveis.`,
        })
      }

      await safe_defer_ephemeral(interaction)

      try {
        await keywordTriggerService.add_trigger(
          interaction.guild.id,
          keywords,
          raw_url,
          content,
          channel?.id ?? null,
          interaction.user.id,
          responder
        )
      } catch (error: any) {
        if (error?.code === 'P2002') {
          await interaction.editReply({
            content: `${EMOJIS.ERROR} Uma das palavras já está em uso por outro gatilho neste servidor.`,
          })
          return
        }
        throw error
      }

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Gatilho adicionado`)
        .addFields(
          { name: 'Palavras-chave', value: `${keywords.length} palavra(s)`, inline: true },
          { name: 'Canal', value: channel ? `<#${channel.id}>` : 'Todos os canais', inline: true }
        )
        .setImage(raw_url)

      await interaction.editReply({ embeds: [embed] })
      return
    }

    // ── /gatilho editar ─────────────────────────────────────────────────────
    if (sub === 'editar') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Você precisa da permissão **Gerenciar Servidor** para usar este comando.`,
        })
        return
      }

      const existing_keyword = interaction.options.getString('palavra', true).trim().toLowerCase()
      const new_keywords_input = interaction.options.getString('novas-palavras')
      const raw_url = interaction.options.getString('url')?.trim()
      const content = interaction.options.getString('texto')?.trim()
      const channel = interaction.options.getChannel('canal')
      const responder = interaction.options.getBoolean('responder')

      await safe_defer_ephemeral(interaction)

      try {
        const updated = await keywordTriggerService.update_trigger(
          interaction.guild.id,
          existing_keyword,
          new_keywords_input ? parse_keywords(new_keywords_input) : undefined,
          raw_url !== undefined ? raw_url || null : undefined,
          content !== undefined ? content || null : undefined,
          channel?.id ?? null,
          responder
        )

        if (!updated) {
          await interaction.editReply({
            content: `${EMOJIS.WARNING} Nenhum gatilho encontrado com a palavra **${existing_keyword}**.`,
          })
          return
        }

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Gatilho atualizado`)
          .setImage(raw_url || updated.mediaUrl)

        await interaction.editReply({ embeds: [embed] })
      } catch (error: any) {
        if (error?.code === 'P2002') {
          await interaction.editReply({
            content: `${EMOJIS.ERROR} Uma das novas palavras já está em uso por outro gatilho.`,
          })
          return
        }
        throw error
      }
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
        .setDescription(`O gatilho foi removido com sucesso.`)

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
        const keyword_count = t.keywords?.length || (t.keyword ? 1 : 0)
        const url_short = t.mediaUrl && t.mediaUrl.length > 60 ? `${t.mediaUrl.slice(0, 57)}…` : t.mediaUrl
        
        const keywords_list = t.keywords && t.keywords.length > 0 
          ? t.keywords.slice(0, 3).map(k => `\`${k}\``).join(', ') + (t.keywords.length > 3 ? ` +${t.keywords.length - 3}` : '')
          : `\`${t.keyword}\``

        return `• ${keywords_list} (${keyword_count} palavra(s)) — ${channel_text}\n  ${url_short ? `<${url_short}>` : 'Apenas texto'}`
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
