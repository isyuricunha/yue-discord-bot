import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { EMOJIS, COLORS } from '@yuebot/shared'

import type { Command } from '../index'
import { authenticatedMessageService } from '../../services/authenticatedMessage.service'

type online_check =
  | { status: 'skipped' }
  | { status: 'not_found' }
  | { status: 'no_access' }
  | { status: 'error' }
  | {
      status: 'found'
      authorIdMatches: boolean
      createdAtMatches: boolean
      fetchedAuthorId: string
      fetchedCreatedAt: string
    }

async function check_message_online(
  interaction: ChatInputCommandInteraction,
  input: { guildId: string | null; channelId: string | null; messageId: string; authorId: string; createdAt: string }
): Promise<online_check> {
  if (!input.guildId || !input.channelId) return { status: 'skipped' }

  try {
    const guild = await interaction.client.guilds.fetch(input.guildId).catch(() => null)
    if (!guild) return { status: 'no_access' }

    const channel = await guild.channels.fetch(input.channelId).catch(() => null)
    if (!channel || !channel.isTextBased()) return { status: 'no_access' }

    const message = await channel.messages.fetch(input.messageId).catch(() => null)
    if (!message) return { status: 'not_found' }

    const fetched_author_id = message.author?.id ?? ''
    const fetched_created_at = message.createdAt?.toISOString?.() ?? ''

    const author_matches = fetched_author_id === input.authorId

    const payload_created = new Date(input.createdAt)
    const fetched_created = new Date(fetched_created_at)
    const created_matches =
      Number.isFinite(payload_created.getTime()) && Number.isFinite(fetched_created.getTime())
        ? payload_created.getTime() === fetched_created.getTime()
        : false

    return {
      status: 'found',
      authorIdMatches: author_matches,
      createdAtMatches: created_matches,
      fetchedAuthorId: fetched_author_id,
      fetchedCreatedAt: fetched_created_at,
    }
  } catch {
    return { status: 'error' }
  }
}

export const verifyMessageCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('verificarmensagem')
    .setNameLocalizations({ 'pt-BR': 'verificarmensagem' })
    .setDescription('Verificar se uma imagem de mensagem autenticada é válida')
    .setDescriptionLocalizations({ 'pt-BR': 'Verificar se uma imagem de mensagem autenticada é válida' })
    .addSubcommand((sub) =>
      sub
        .setName('url')
        .setNameLocalizations({ 'pt-BR': 'url' })
        .setDescription('Verificar usando um link')
        .setDescriptionLocalizations({ 'pt-BR': 'Verificar usando um link' })
        .addStringOption((opt) =>
          opt
            .setName('url')
            .setDescription('URL da imagem gerada')
            .setDescriptionLocalizations({ 'pt-BR': 'URL da imagem gerada' })
            .setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('json')
            .setNameLocalizations({ 'pt-BR': 'json' })
            .setDescription('Enviar também uma cópia em JSON')
            .setDescriptionLocalizations({ 'pt-BR': 'Enviar também uma cópia em JSON' })
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('arquivo')
        .setNameLocalizations({ 'pt-BR': 'arquivo' })
        .setDescription('Verificar usando um arquivo enviado')
        .setDescriptionLocalizations({ 'pt-BR': 'Verificar usando um arquivo enviado' })
        .addAttachmentOption((opt) =>
          opt
            .setName('arquivo')
            .setNameLocalizations({ 'pt-BR': 'arquivo' })
            .setDescription('Arquivo PNG gerado')
            .setDescriptionLocalizations({ 'pt-BR': 'Arquivo PNG gerado' })
            .setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('json')
            .setNameLocalizations({ 'pt-BR': 'json' })
            .setDescription('Enviar também uma cópia em JSON')
            .setDescriptionLocalizations({ 'pt-BR': 'Enviar também uma cópia em JSON' })
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand()
    const send_json = interaction.options.getBoolean('json') ?? false

    const resolved_url =
      sub === 'arquivo'
        ? interaction.options.getAttachment('arquivo', true).url
        : interaction.options.getString('url', true)

    await interaction.deferReply({ ephemeral: true })

    const result = await authenticatedMessageService.verify_signed_message_image({ url: resolved_url }).catch((err: unknown) => {
      const error = err as Error
      return { success: false as const, error: error.message || 'Falha ao verificar a imagem.' }
    })

    if (!result.success) {
      const message = 'error' in result ? result.error : 'Falha ao verificar a imagem.'
      await interaction.editReply({ content: `${EMOJIS.ERROR} ${message}` })
      return
    }

    const payload = result.payload

    const online = await check_message_online(interaction, {
      guildId: payload.guildId,
      channelId: payload.channelId,
      messageId: payload.messageId,
      authorId: payload.authorId,
      createdAt: payload.createdAt,
    })

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} Mensagem verificada`)
      .addFields([
        { name: 'Autor', value: `<@${payload.authorId}> (ID: ${payload.authorId})`, inline: false },
        { name: 'Canal', value: payload.channelId ? `<#${payload.channelId}>` : '—', inline: true },
        { name: 'Servidor', value: payload.guildId ?? '—', inline: true },
        { name: 'Mensagem', value: payload.messageId, inline: false },
        { name: 'Criada em', value: new Date(payload.createdAt).toISOString(), inline: false },
      ])

    if (payload.contentPreview) {
      embed.addFields([{ name: 'Conteúdo (preview)', value: payload.contentPreview, inline: false }])
    }

    if (online.status === 'skipped') {
      embed.addFields([{ name: 'Checagem online', value: 'Não disponível (sem guild/canal no payload).', inline: false }])
    } else if (online.status === 'no_access') {
      embed.addFields([{ name: 'Checagem online', value: 'Sem acesso ao servidor/canal (permissões ou o bot não está lá).', inline: false }])
    } else if (online.status === 'not_found') {
      embed.addFields([{ name: 'Checagem online', value: 'Mensagem não encontrada (pode ter sido apagada).', inline: false }])
    } else if (online.status === 'error') {
      embed.addFields([{ name: 'Checagem online', value: 'Falha ao consultar o Discord.', inline: false }])
    } else {
      const author_line = online.authorIdMatches ? 'ok' : `mismatch (discord=${online.fetchedAuthorId})`
      const created_line = online.createdAtMatches ? 'ok' : `mismatch (discord=${online.fetchedCreatedAt || '—'})`
      embed.addFields([
        {
          name: 'Checagem online',
          value: `Encontrada.\nAutor: ${author_line}\nCriada em: ${created_line}`,
          inline: false,
        },
      ])
    }

    const files: AttachmentBuilder[] = []
    if (send_json) {
      const json = JSON.stringify({ success: true, payload, online }, null, 2)
      files.push(new AttachmentBuilder(Buffer.from(json, 'utf8'), { name: `mensagem-${payload.messageId}.json` }))
    }

    await interaction.editReply({ embeds: [embed], files })
  },
}
