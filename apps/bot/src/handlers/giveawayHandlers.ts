import { 
  ButtonInteraction, 
  StringSelectMenuInteraction, 
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder
} from 'discord.js'
import { randomBytes } from 'node:crypto'
import { prisma } from '@yuebot/database'
import {
  COLORS,
  EMOJIS,
  match_giveaway_choices,
  normalize_giveaway_items_list,
  parse_giveaway_choices_input,
} from '@yuebot/shared'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'
import { safe_defer_ephemeral, safe_reply_ephemeral } from '../utils/interaction'

function truncate_modal_title(input: string) {
  const max_len = 45
  if (input.length <= max_len) return input
  if (max_len <= 1) return input.slice(0, max_len)
  return `${input.slice(0, max_len - 1).trimEnd()}…`
}

function get_web_url(): string {
  const raw = process.env.WEB_URL || 'http://localhost:5173'
  return raw.replace(/\/+$/, '')
}

async function upsert_giveaway_entry_edit_token(params: {
  giveawayId: string
  userId: string
}): Promise<{ token: string; expiresAt: Date } | null> {
  const now = new Date()

  const existing = await prisma.giveawayEntryEditToken
    .findUnique({
      where: {
        giveawayId_userId: {
          giveawayId: params.giveawayId,
          userId: params.userId,
        },
      },
      select: {
        token: true,
        expiresAt: true,
        usedAt: true,
      },
    })
    .catch(() => null)

  if (existing && !existing.usedAt && existing.expiresAt.getTime() > now.getTime()) {
    return { token: existing.token, expiresAt: existing.expiresAt }
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)

  try {
    const record = await prisma.giveawayEntryEditToken.upsert({
      where: {
        giveawayId_userId: {
          giveawayId: params.giveawayId,
          userId: params.userId,
        },
      },
      create: {
        giveawayId: params.giveawayId,
        userId: params.userId,
        token,
        expiresAt,
      },
      update: {
        token,
        expiresAt,
        usedAt: null,
      },
      select: {
        token: true,
        expiresAt: true,
      },
    })

    return record
  } catch (error) {
    logger.warn({ err: safe_error_details(error) }, 'Failed to upsert giveaway entry edit token')
    return null
  }
}

function format_relative_timestamp(date: Date): string {
  const ts = Math.floor(date.getTime() / 1000)
  return `<t:${ts}:R>`
}

function build_giveaway_entry_edit_link(token: string): string {
  return `${get_web_url()}/giveaways/entry/${token}`
}

export async function handleGiveawayParticipate(interaction: ButtonInteraction) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { messageId: interaction.message.id },
  })

  if (!giveaway) {
    return safe_reply_ephemeral(interaction, { content: '❌ Sorteio não encontrado!' })
  }

  if (giveaway.ended) {
    return safe_reply_ephemeral(interaction, { content: '❌ Este sorteio já foi finalizado!' })
  }

  if (giveaway.cancelled) {
    return safe_reply_ephemeral(interaction, { content: '❌ Este sorteio foi cancelado!' })
  }

  if (giveaway.suspended) {
    return safe_reply_ephemeral(interaction, { content: '⏸️ Este sorteio está suspenso no momento.' })
  }

  // Validar role obrigatória
  const required_role_ids =
    Array.isArray(giveaway.requiredRoleIds) && giveaway.requiredRoleIds.length > 0
      ? (giveaway.requiredRoleIds as string[])
      : giveaway.requiredRoleId
        ? [giveaway.requiredRoleId]
        : []

  if (required_role_ids.length > 0 && interaction.guild) {
    const member = await interaction.guild.members.fetch(interaction.user.id)
    const has_any_required_role = required_role_ids.some((id) => member.roles.cache.has(id))
    if (!has_any_required_role) {
      return safe_reply_ephemeral(interaction, {
        content: '❌ Você não possui o cargo necessário para participar deste sorteio!',
      })
    }
  }

  // Verificar se já está participando
  const existing = await prisma.giveawayEntry.findUnique({
    where: {
      giveawayId_userId: {
        giveawayId: giveaway.id,
        userId: interaction.user.id,
      },
    },
  })

  if (existing) {
    const choices = existing.choices as string[] | null

    const can_edit = giveaway.format === 'list'
    const edit_token = can_edit
      ? await upsert_giveaway_entry_edit_token({ giveawayId: giveaway.id, userId: interaction.user.id })
      : null

    const edit_link = edit_token ? build_giveaway_entry_edit_link(edit_token.token) : null
    const edit_suffix = edit_link
      ? `\n\n🔗 Editar/reordenar escolhas: ${edit_link}\n(Expira ${format_relative_timestamp(edit_token.expiresAt)})`
      : ''

    if (edit_link) {
      try {
        await interaction.user.send(
          `🔗 Editar/reordenar escolhas do sorteio "${giveaway.title}": ${edit_link}\n` +
            `Expira ${format_relative_timestamp(edit_token!.expiresAt)}`
        )
      } catch {
        logger.debug(`Não foi possível enviar DM com link de edição para ${interaction.user.tag}`)
      }
    }

    if (choices && choices.length > 0) {
      return safe_reply_ephemeral(interaction, {
        content:
          `✅ Você já está participando!\n\n` +
          `**Suas escolhas:**\n${choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}` +
          edit_suffix,
      })
    }

    return safe_reply_ephemeral(interaction, {
      content: '✅ Você já está participando deste sorteio!' + edit_suffix,
    })
  }

  // Se for sorteio com lista
  if (giveaway.format === 'list') {
    const minChoices = giveaway.minChoices || 3
    const maxChoices = giveaway.maxChoices || 10

    // Criar modal para inserir escolhas
    const modal_title = truncate_modal_title(`Participe: ${giveaway.title}`)
    const modal = new ModalBuilder()
      .setCustomId(`giveaway_choices_${giveaway.id}`)
      .setTitle(modal_title)

    const input = new TextInputBuilder()
      .setCustomId('choices')
      .setLabel(`Escolha ${minChoices} a ${maxChoices} itens`)
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(
        `Números: "1, 3, 7" ou nomes: "Item 1, Item 3, Item 7"`
      )
      .setRequired(true)
      .setMinLength(1) // Reduced from 10 to allow numeric-only inputs
      .setMaxLength(4000)

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input)
    modal.addComponents(row)
    
    // Modal precisa ser a primeira resposta
    await interaction.showModal(modal)
  }
}

export async function handleGiveawayItemsSelect(interaction: StringSelectMenuInteraction) {
  // Para quando usar select menu em vez de modal (listas pequenas)
  await safe_defer_ephemeral(interaction)
  
  const giveawayId = interaction.customId.replace('giveaway_items_', '')
  
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
  })

  if (!giveaway) {
    return interaction.editReply('❌ Sorteio não encontrado!')
  }

  if (giveaway.ended) {
    return interaction.editReply('❌ Este sorteio já foi finalizado!')
  }

  if (giveaway.cancelled) {
    return interaction.editReply('❌ Este sorteio foi cancelado!')
  }

  if (giveaway.suspended) {
    return interaction.editReply('⏸️ Este sorteio está suspenso no momento.')
  }

  const choices = interaction.values

  // Criar ou atualizar entrada
  await prisma.giveawayEntry.upsert({
    where: {
      giveawayId_userId: {
        giveawayId: giveaway.id,
        userId: interaction.user.id,
      },
    },
    create: {
      giveawayId: giveaway.id,
      userId: interaction.user.id,
      username: interaction.user.username,
      avatar: interaction.user.avatar,
      choices,
    },
    update: {
      choices,
    },
  })

  const can_edit = giveaway.format === 'list'
  const edit_token = can_edit
    ? await upsert_giveaway_entry_edit_token({ giveawayId: giveaway.id, userId: interaction.user.id })
    : null

  const edit_link = edit_token ? build_giveaway_entry_edit_link(edit_token.token) : null
  const edit_suffix = edit_link
    ? `\n\n🔗 Editar/reordenar escolhas: ${edit_link}\n(Expira ${format_relative_timestamp(edit_token.expiresAt)})`
    : ''

  // Atualizar contagem
  const count = await prisma.giveawayEntry.count({
    where: { giveawayId: giveaway.id, disqualified: false },
  })

  // Atualizar embed
  try {
    const message = await interaction.message.fetch()
    const embed = message.embeds[0]
    if (embed) {
      const newEmbed = {
        ...embed.data,
        fields: embed.fields.map(field => {
          if (field.name === '📋 Participantes') {
            return { ...field, value: String(count) }
          }
          return field
        }),
      }
      await message.edit({ embeds: [newEmbed] })
    }
  } catch (error) {
    logger.warn({ err: safe_error_details(error) }, 'Erro ao atualizar embed')
  }

  await interaction.editReply(
    `✅ Participação registrada!\n\n` +
    `**Suas escolhas:**\n${choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}` +
    edit_suffix
  )

  // Enviar DM de confirmação
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} Participação Confirmada!`)
      .setDescription(`Você está participando do sorteio: **${giveaway.title}**`)
      .addFields([
        { name: '🎁 Prêmio', value: giveaway.description.substring(0, 200), inline: false },
        { name: '📋 Suas Escolhas', value: choices.map((c, i) => `${i + 1}. ${c}`).join('\n'), inline: false },
        ...(edit_link
          ? [{ name: '🔗 Editar/Reordenar', value: `${edit_link}\nExpira ${format_relative_timestamp(edit_token!.expiresAt)}`, inline: false }]
          : []),
        { name: '⏰ Término', value: `<t:${Math.floor(new Date(giveaway.endsAt).getTime() / 1000)}:R>`, inline: true },
      ])
      .setFooter({ text: 'Boa sorte! 🍀' })
      .setTimestamp()

    await interaction.user.send({ embeds: [dmEmbed] })
  } catch (error) {
    logger.warn(`Não foi possível enviar DM de confirmação para ${interaction.user.tag}`)
  }
}

export async function handleGiveawayChoicesModal(interaction: ModalSubmitInteraction) {
  await safe_defer_ephemeral(interaction)

  const giveawayId = interaction.customId.replace('giveaway_choices_', '')
  
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
  })

  if (!giveaway) {
    return interaction.editReply('❌ Sorteio não encontrado!')
  }

  const raw_items = Array.isArray(giveaway.availableItems) ? (giveaway.availableItems as string[]) : []
  const items = normalize_giveaway_items_list(raw_items)
  const minChoices = giveaway.minChoices || 3
  const maxChoices = giveaway.maxChoices || 10

  if (items.length === 0) {
    return interaction.editReply('❌ Este sorteio não possui itens disponíveis.')
  }

  const choicesText = interaction.fields.getTextInputValue('choices')
  const choices = parse_giveaway_choices_input(choicesText)

  // Validar quantidade
  if (choices.length < minChoices) {
    return interaction.editReply(
      `❌ Você precisa escolher pelo menos ${minChoices} itens! Você escolheu apenas ${choices.length}.` +
      `\n💡 Dica: Use números (ex: "1, 3, 7") para selecionar mais rápido!`
    )
  }

  if (choices.length > maxChoices) {
    return interaction.editReply(
      `❌ Você pode escolher no máximo ${maxChoices} itens!\n` +
      `Você escolheu ${choices.length}.`
    )
  }

  const { invalid: invalidChoices, resolved: validChoices } = match_giveaway_choices({
    availableItems: items,
    choices,
  })

  if (invalidChoices.length > 0) {
    return interaction.editReply(
      `❌ Os seguintes itens não foram encontrados na lista:\n` +
      invalidChoices.map(c => `• ${c}`).join('\n') + '\n\n' +
      `Verifique se digitou os nomes corretamente.`
    )
  }

  // Criar ou atualizar entrada
  await prisma.giveawayEntry.upsert({
    where: {
      giveawayId_userId: {
        giveawayId: giveaway.id,
        userId: interaction.user.id,
      },
    },
    create: {
      giveawayId: giveaway.id,
      userId: interaction.user.id,
      username: interaction.user.username,
      avatar: interaction.user.avatar,
      choices: validChoices,
    },
    update: {
      choices: validChoices,
      username: interaction.user.username,
      avatar: interaction.user.avatar,
    },
  })

  const can_edit = giveaway.format === 'list'
  const edit_token = can_edit
    ? await upsert_giveaway_entry_edit_token({ giveawayId: giveaway.id, userId: interaction.user.id })
    : null

  const edit_link = edit_token ? build_giveaway_entry_edit_link(edit_token.token) : null
  const edit_suffix = edit_link
    ? `\n\n🔗 Editar/reordenar escolhas: ${edit_link}\n(Expira ${format_relative_timestamp(edit_token.expiresAt)})`
    : ''

  // Atualizar contagem
  const count = await prisma.giveawayEntry.count({
    where: { giveawayId: giveaway.id, disqualified: false },
  })

  // Atualizar embed
  try {
    const message = await interaction.message
    if (message) {
      const embed = message.embeds[0]
      if (embed) {
        const newEmbed = {
          ...embed.data,
          fields: embed.fields.map(field => {
            if (field.name === '📋 Participantes') {
              return { ...field, value: String(count) }
            }
            return field
          }),
        }
        await message.edit({ embeds: [newEmbed] })
      }
    }
  } catch (error) {
    logger.warn({ err: safe_error_details(error) }, 'Erro ao atualizar embed')
  }

  await interaction.editReply(
    `✅ Participação registrada com sucesso!\n\n` +
    `**Suas ${validChoices.length} escolhas (em ordem de preferência):**\n` +
    validChoices.map((c, i) => `${i + 1}. ${c}`).join('\n') +
    edit_suffix
  )

  // Enviar DM de confirmação
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} Participação Confirmada!`)
      .setDescription(`Você está participando do sorteio: **${giveaway.title}**`)
      .addFields([
        { name: '🎁 Prêmio', value: giveaway.description.substring(0, 200), inline: false },
        { name: '📋 Suas Escolhas', value: validChoices.map((c, i) => `${i + 1}. ${c}`).join('\n').substring(0, 1000), inline: false },
        ...(edit_link
          ? [{ name: '🔗 Editar/Reordenar', value: `${edit_link}\nExpira ${format_relative_timestamp(edit_token!.expiresAt)}`, inline: false }]
          : []),
        { name: '⏰ Término', value: `<t:${Math.floor(new Date(giveaway.endsAt).getTime() / 1000)}:R>`, inline: true },
      ])
      .setFooter({ text: 'Boa sorte! 🍀' })
      .setTimestamp()

    await interaction.user.send({ embeds: [dmEmbed] })
  } catch (error) {
    logger.warn(`Não foi possível enviar DM de confirmação para ${interaction.user.tag}`)
  }
}
