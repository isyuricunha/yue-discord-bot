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
import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'
import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

export async function handleGiveawayParticipate(interaction: ButtonInteraction) {
  const giveaway = await prisma.giveaway.findFirst({
    where: { messageId: interaction.message.id },
  })

  if (!giveaway) {
    return interaction.reply({ content: '❌ Sorteio não encontrado!', ephemeral: true })
  }

  if (giveaway.ended) {
    return interaction.reply({ content: '❌ Este sorteio já foi finalizado!', ephemeral: true })
  }

  if (giveaway.cancelled) {
    return interaction.reply({ content: '❌ Este sorteio foi cancelado!', ephemeral: true })
  }

  // Validar role obrigatória
  if (giveaway.requiredRoleId && interaction.guild) {
    const member = await interaction.guild.members.fetch(interaction.user.id)
    if (!member.roles.cache.has(giveaway.requiredRoleId)) {
      return interaction.reply({ 
        content: '❌ Você não possui o cargo necessário para participar deste sorteio!',
        ephemeral: true 
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
    if (choices && choices.length > 0) {
      return interaction.reply({
        content: `✅ Você já está participando!\n\n` +
          `**Suas escolhas:**\n${choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
        ephemeral: true
      })
    }
    return interaction.reply({ content: '✅ Você já está participando deste sorteio!', ephemeral: true })
  }

  // Se for sorteio com lista
  if (giveaway.format === 'list') {
    const items = giveaway.availableItems as string[]
    const minChoices = giveaway.minChoices || 3
    const maxChoices = giveaway.maxChoices || 10

    // Criar modal para inserir escolhas
    const modal = new ModalBuilder()
      .setCustomId(`giveaway_choices_${giveaway.id}`)
      .setTitle(`Participe: ${giveaway.title.substring(0, 40)}`)

    const input = new TextInputBuilder()
      .setCustomId('choices')
      .setLabel(`Escolha ${minChoices} a ${maxChoices} itens (um por linha)`)
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('1. Nome do Item 1\n2. Nome do Item 2\n3. Nome do Item 3')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(4000)

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input)
    modal.addComponents(row)
    
    // Modal precisa ser a primeira resposta
    await interaction.showModal(modal)
  }
}

export async function handleGiveawayItemsSelect(interaction: StringSelectMenuInteraction) {
  // Para quando usar select menu em vez de modal (listas pequenas)
  await interaction.deferReply({ ephemeral: true })
  
  const giveawayId = interaction.customId.replace('giveaway_items_', '')
  
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
  })

  if (!giveaway) {
    return interaction.editReply('❌ Sorteio não encontrado!')
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
    `**Suas escolhas:**\n${choices.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
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
  await interaction.deferReply({ ephemeral: true })

  const giveawayId = interaction.customId.replace('giveaway_choices_', '')
  
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
  })

  if (!giveaway) {
    return interaction.editReply('❌ Sorteio não encontrado!')
  }

  const items = giveaway.availableItems as string[]
  const minChoices = giveaway.minChoices || 3
  const maxChoices = giveaway.maxChoices || 10

  // Parse choices
  const choicesText = interaction.fields.getTextInputValue('choices')
  const lines = choicesText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  // Remover números no início (1., 2., etc)
  const choices = lines.map(line => {
    return line.replace(/^\d+[.:)]\s*/, '').trim()
  }).filter(c => c.length > 0)

  // Validar quantidade
  if (choices.length < minChoices) {
    return interaction.editReply(
      `❌ Você precisa escolher pelo menos ${minChoices} itens!\n` +
      `Você escolheu apenas ${choices.length}.`
    )
  }

  if (choices.length > maxChoices) {
    return interaction.editReply(
      `❌ Você pode escolher no máximo ${maxChoices} itens!\n` +
      `Você escolheu ${choices.length}.`
    )
  }

  // Validar se os itens existem (case insensitive e trim)
  const itemsLower = items.map(i => i.trim().toLowerCase())
  const invalidChoices: string[] = []
  const validChoices: string[] = []

  for (const choice of choices) {
    const choiceLower = choice.trim().toLowerCase()
    const index = itemsLower.indexOf(choiceLower)
    if (index === -1) {
      invalidChoices.push(choice)
    } else {
      // Usar o nome exato da lista (trimmed)
      validChoices.push(items[index].trim())
    }
  }

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
    validChoices.map((c, i) => `${i + 1}. ${c}`).join('\n')
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
        { name: '⏰ Término', value: `<t:${Math.floor(new Date(giveaway.endsAt).getTime() / 1000)}:R>`, inline: true },
      ])
      .setFooter({ text: 'Boa sorte! 🍀' })
      .setTimestamp()

    await interaction.user.send({ embeds: [dmEmbed] })
  } catch (error) {
    logger.warn(`Não foi possível enviar DM de confirmação para ${interaction.user.tag}`)
  }
}
