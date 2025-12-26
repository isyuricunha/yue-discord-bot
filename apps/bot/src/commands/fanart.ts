import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { Attachment, ChatInputCommandInteraction } from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'
import { CONFIG } from '../config'

function is_fanart_reviewer(user_id: string): boolean {
  return CONFIG.admin.fanArtReviewerUserIds.includes(user_id)
}

function get_required_attachment(interaction: ChatInputCommandInteraction): Attachment {
  const attachment = interaction.options.getAttachment('imagem', true)
  return attachment
}

export const data = new SlashCommandBuilder()
  .setName('fanart')
  .setDescription('Submeter e moderar fan arts')
  .setDescriptionLocalizations({ 'pt-BR': 'Submeter e moderar fan arts' })
  .addSubcommand((sub) =>
    sub
      .setName('submit')
      .setNameLocalizations({ 'pt-BR': 'enviar' })
      .setDescription('Enviar uma fan art para aprovação')
      .setDescriptionLocalizations({ 'pt-BR': 'Enviar uma fan art para aprovação' })
      .addAttachmentOption((opt) =>
        opt
          .setName('imagem')
          .setNameLocalizations({ 'pt-BR': 'imagem' })
          .setDescription('Imagem da fan art')
          .setDescriptionLocalizations({ 'pt-BR': 'Imagem da fan art' })
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('titulo')
          .setNameLocalizations({ 'pt-BR': 'titulo' })
          .setDescription('Título (opcional)')
          .setDescriptionLocalizations({ 'pt-BR': 'Título (opcional)' })
          .setMaxLength(128)
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('descricao')
          .setNameLocalizations({ 'pt-BR': 'descricao' })
          .setDescription('Descrição (opcional)')
          .setDescriptionLocalizations({ 'pt-BR': 'Descrição (opcional)' })
          .setMaxLength(2000)
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('tags')
          .setNameLocalizations({ 'pt-BR': 'tags' })
          .setDescription('Tags separadas por vírgula (opcional)')
          .setDescriptionLocalizations({ 'pt-BR': 'Tags separadas por vírgula (opcional)' })
          .setMaxLength(400)
          .setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('review')
      .setNameLocalizations({ 'pt-BR': 'revisar' })
      .setDescription('Aprovar/Rejeitar fan art (reviewers)')
      .setDescriptionLocalizations({ 'pt-BR': 'Aprovar/Rejeitar fan art (reviewers)' })
      .addStringOption((opt) =>
        opt
          .setName('id')
          .setDescription('ID da fan art')
          .setDescriptionLocalizations({ 'pt-BR': 'ID da fan art' })
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('Novo status')
          .setDescriptionLocalizations({ 'pt-BR': 'Novo status' })
          .addChoices(
            { name: 'approved', value: 'approved' },
            { name: 'rejected', value: 'rejected' }
          )
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('nota')
          .setNameLocalizations({ 'pt-BR': 'nota' })
          .setDescription('Nota/feedback (opcional)')
          .setDescriptionLocalizations({ 'pt-BR': 'Nota/feedback (opcional)' })
          .setMaxLength(2000)
          .setRequired(false)
      )
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand()

  if (sub === 'submit') {
    await interaction.deferReply({ ephemeral: true })

    const attachment = get_required_attachment(interaction)
    const title = interaction.options.getString('titulo')
    const description = interaction.options.getString('descricao')
    const tags_raw = interaction.options.getString('tags')

    const tags =
      tags_raw && tags_raw.trim().length > 0
        ? tags_raw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20)
        : undefined

    await prisma.user.upsert({
      where: { id: interaction.user.id },
      update: { username: interaction.user.username, avatar: interaction.user.displayAvatarURL() },
      create: { id: interaction.user.id, username: interaction.user.username, avatar: interaction.user.displayAvatarURL() },
    })

    const fan_art = await prisma.fanArt.create({
      data: {
        userId: interaction.user.id,
        status: 'pending',
        imageUrl: attachment.url,
        imageName: attachment.name ?? null,
        imageSize: typeof attachment.size === 'number' ? attachment.size : null,
        title: title ?? null,
        description: description ?? null,
        tags: tags ?? undefined,
        sourceChannelId: interaction.channelId,
        sourceMessageId: interaction.id,
      },
    })

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} Fan art enviada!`)
      .setDescription(
        `Sua fan art foi enviada para aprovação.\n\n` +
          `**ID:** \`${fan_art.id}\`\n` +
          `**Status:** \`${fan_art.status}\``
      )
      .setImage(attachment.url)
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
    return
  }

  if (sub === 'review') {
    await interaction.deferReply({ ephemeral: true })

    if (!is_fanart_reviewer(interaction.user.id)) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Você não tem permissão para revisar fan arts.` })
      return
    }

    const fan_art_id = interaction.options.getString('id', true)
    const status = interaction.options.getString('status', true) as 'approved' | 'rejected'
    const note = interaction.options.getString('nota')

    const existing = await prisma.fanArt.findUnique({ where: { id: fan_art_id } })
    if (!existing) {
      await interaction.editReply({ content: `${EMOJIS.ERROR} Fan art não encontrada: ${fan_art_id}` })
      return
    }

    const updated = await prisma.fanArt.update({
      where: { id: fan_art_id },
      data: {
        status,
        reviewedByUserId: interaction.user.id,
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    })

    const embed = new EmbedBuilder()
      .setColor(status === 'approved' ? COLORS.SUCCESS : COLORS.ERROR)
      .setTitle(`${EMOJIS.SUCCESS} Fan art revisada`)
      .setDescription(`**ID:** \`${updated.id}\`\n**Status:** \`${updated.status}\``)
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
    return
  }

  await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
}
