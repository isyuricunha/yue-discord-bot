import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js'
import { prisma } from '@yuebot/database'
import { getSendableChannel } from '../utils/discord'
import { parseDurationMs } from '@yuebot/shared'

export const data = new SlashCommandBuilder()
  .setName('sorteio')
  .setDescription('Gerenciar sorteios')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(subcommand =>
    subcommand
      .setName('criar')
      .setDescription('Criar um novo sorteio')
      .addStringOption(option =>
        option
          .setName('titulo')
          .setDescription('Título do sorteio')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('descricao')
          .setDescription('Descrição do sorteio')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('vencedores')
          .setDescription('Número de vencedores')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(20)
      )
      .addStringOption(option =>
        option
          .setName('duracao')
          .setDescription('Duração (ex: 1h, 3d, 1w)')
          .setRequired(true)
      )
      .addChannelOption(option =>
        option
          .setName('canal')
          .setDescription('Canal onde o sorteio será criado')
          .setRequired(false)
      )
      .addRoleOption(option =>
        option
          .setName('cargo')
          .setDescription('Cargo necessário para participar')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('finalizar')
      .setDescription('Finalizar um sorteio manualmente')
      .addStringOption(option =>
        option
          .setName('id')
          .setDescription('ID do sorteio')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reroll')
      .setDescription('Sortear novos vencedores')
      .addStringOption(option =>
        option
          .setName('id')
          .setDescription('ID do sorteio')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('ativos')
      .setDescription('Listar sorteios ativos e seus IDs')
      .addIntegerOption(option =>
        option
          .setName('limite')
          .setDescription('Quantidade de sorteios para listar (padrão: 10)')
          .setMinValue(1)
          .setMaxValue(25)
          .setRequired(false)
      )
  )

function parseDuration(duration: string): number {
  const ms = parseDurationMs(duration)
  if (!ms) throw new Error('Formato inválido. Use: 1s, 5m, 1h, 3d, 1w')
  return ms
}

function assignPrizes(winners: any[], availableItems: string[]): any[] {
  const assignedPrizes = new Set<string>()
  const results: any[] = []

  for (const winner of winners) {
    const choices = (winner.choices as string[]) || []
    let assignedPrize: string | null = null
    let prizeIndex: number | null = null

    // Tentar atribuir a primeira escolha disponível
    for (const choice of choices) {
      if (!assignedPrizes.has(choice)) {
        assignedPrize = choice
        prizeIndex = availableItems.indexOf(choice)
        assignedPrizes.add(choice)
        break
      }
    }

    // Se não conseguiu pelas preferências, pegar qualquer item disponível
    if (!assignedPrize) {
      for (let i = 0; i < availableItems.length; i++) {
        const item = availableItems[i]
        if (!assignedPrizes.has(item)) {
          assignedPrize = item
          prizeIndex = i
          assignedPrizes.add(item)
          break
        }
      }
    }

    results.push({
      userId: winner.userId,
      username: winner.username,
      prize: assignedPrize,
      prizeIndex,
    })
  }

  return results
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand()
  
  if (subcommand === 'criar') {
    await handleCreate(interaction)
  } else if (subcommand === 'finalizar') {
    await handleEnd(interaction)
  } else if (subcommand === 'reroll') {
    await handleReroll(interaction)
  } else if (subcommand === 'ativos') {
    await handleListActive(interaction)
  }
}

async function handleListActive(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  if (!interaction.guildId) {
    return interaction.editReply('❌ Este comando só pode ser usado em servidores.')
  }

  const limit = interaction.options.getInteger('limite') ?? 10

  const giveaways = await prisma.giveaway.findMany({
    where: {
      guildId: interaction.guildId,
      ended: false,
      cancelled: false,
      suspended: false,
    },
    orderBy: [{ endsAt: 'asc' }],
    take: limit,
    select: {
      id: true,
      title: true,
      channelId: true,
      endsAt: true,
      format: true,
      maxWinners: true,
      _count: {
        select: {
          entries: { where: { disqualified: false } },
        },
      },
    },
  })

  if (giveaways.length === 0) {
    return interaction.editReply('Nenhum sorteio ativo encontrado.')
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎉 Sorteios ativos (${giveaways.length})`)
    .setColor(0x9333ea)

  for (const giveaway of giveaways) {
    const ends_at_ts = Math.floor(new Date(giveaway.endsAt).getTime() / 1000)
    embed.addFields({
      name: giveaway.title,
      value:
        `ID: \`${giveaway.id}\`\n` +
        `Canal: <#${giveaway.channelId}>\n` +
        `Termina: <t:${ends_at_ts}:R>\n` +
        `Participantes: ${giveaway._count.entries}\n` +
        `Formato: ${giveaway.format} • Vencedores: ${giveaway.maxWinners}`,
      inline: false,
    })
  }

  await interaction.editReply({ embeds: [embed] })
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })
  
  const title = interaction.options.getString('titulo', true)
  const description = interaction.options.getString('descricao', true)
  const winners = interaction.options.getInteger('vencedores', true)
  const durationStr = interaction.options.getString('duracao', true)
  const selectedChannel = interaction.options.getChannel('canal')
  const fetchedSelectedChannel =
    selectedChannel && interaction.guild
      ? await interaction.guild.channels.fetch(selectedChannel.id).catch(() => null)
      : null

  const channel = getSendableChannel(fetchedSelectedChannel || selectedChannel || interaction.channel)
  const requiredRole = interaction.options.getRole('cargo')
  
  if (!channel) {
    return interaction.editReply('❌ Canal inválido!')
  }
  
  try {
    const duration = parseDuration(durationStr)
    const endsAt = new Date(Date.now() + duration)
    
    // Criar embed do sorteio
    const embed = new EmbedBuilder()
      .setTitle(`🎉 ${title}`)
      .setDescription(description)
      .addFields(
        { name: '🏆 Vencedores', value: `${winners}`, inline: true },
        { name: '⏰ Termina', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
        { name: '📋 Participantes', value: '0', inline: true }
      )
      .setColor(0x9333EA)
      .setFooter({ text: 'Reaja com 🎉 para participar!' })
      .setTimestamp(endsAt)
    
    if (requiredRole) {
      embed.addFields({ name: '🎭 Cargo Necessário', value: requiredRole.toString(), inline: false })
    }

    const role_ping = requiredRole ? `<@&${requiredRole.id}>` : ''
    const message = await channel.send({
      content: role_ping || undefined,
      embeds: [embed],
      allowedMentions: requiredRole ? { roles: [requiredRole.id] } : undefined,
    })
    await message.react('🎉')
    
    // Salvar no banco
    const giveaway = await prisma.giveaway.create({
      data: {
        guildId: interaction.guildId!,
        title,
        description,
        channelId: channel.id,
        messageId: message.id,
        creatorId: interaction.user.id,
        requiredRoleId: requiredRole?.id,
        requiredRoleIds: requiredRole ? [requiredRole.id] : [],
        maxWinners: winners,
        endsAt,
      },
    })
    
    await interaction.editReply(`✅ Sorteio criado com sucesso!\nID: \`${giveaway.id}\``)
  } catch (error: any) {
    await interaction.editReply(`❌ Erro: ${error.message}`)
  }
}

async function handleEnd(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })
  
  const id = interaction.options.getString('id', true)
  
  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id },
      include: { entries: true },
    })
    
    if (!giveaway) {
      return interaction.editReply('❌ Sorteio não encontrado!')
    }
    
    if (giveaway.ended) {
      return interaction.editReply('❌ Este sorteio já foi finalizado!')
    }
    
    // Selecionar vencedores
    const eligibleEntries = giveaway.entries.filter(e => !e.disqualified)
    
    if (eligibleEntries.length === 0) {
      await prisma.giveaway.update({
        where: { id },
        data: { ended: true },
      })
      return interaction.editReply('❌ Nenhum participante elegível!')
    }
    
    // Sortear vencedores
    const winnerCount = Math.min(giveaway.maxWinners, eligibleEntries.length)
    const shuffled = eligibleEntries.sort(() => Math.random() - 0.5)
    const selectedWinners = shuffled.slice(0, winnerCount)

    // Distribuir prêmios se for lista
    let winnersData: any[] = []
    if (giveaway.format === 'list' && giveaway.availableItems) {
      winnersData = assignPrizes(selectedWinners, giveaway.availableItems as string[])
    } else {
      winnersData = selectedWinners.map(w => ({
        userId: w.userId,
        username: w.username,
        prize: null,
        prizeIndex: null,
      }))
    }

    // Salvar no banco
    await prisma.$transaction([
      ...winnersData.map(w => 
        prisma.giveawayWinner.create({
          data: {
            giveawayId: giveaway.id,
            userId: w.userId,
            username: w.username,
            prize: w.prize,
            prizeIndex: w.prizeIndex,
          },
        })
      ),
      prisma.giveaway.update({
        where: { id: giveaway.id },
        data: { ended: true },
      }),
    ])

    // Anunciar
    let winnerMentions = ''
    if (giveaway.format === 'list' && winnersData[0]?.prize) {
      winnerMentions = winnersData.map(w => `<@${w.userId}>: **${w.prize}**`).join('\n')
    } else {
      winnerMentions = winnersData.map(w => `<@${w.userId}>`).join(', ')
    }

    const rawChannel = await interaction.client.channels.fetch(giveaway.channelId)
    const channel = getSendableChannel(rawChannel)
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(`🎊 Sorteio Finalizado: ${giveaway.title}`)
        .setDescription(`**Vencedores:**\n${winnerMentions}`)
        .setColor(0x10B981)
        .setTimestamp()
      
      await channel.send({ embeds: [embed] })
    }
    
    await interaction.editReply(`✅ Sorteio finalizado! ${winnersData.length} vencedor(es) selecionado(s).`)
  } catch (error: any) {
    await interaction.editReply(`❌ Erro: ${error.message}`)
  }
}

async function handleReroll(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })
  
  const id = interaction.options.getString('id', true)
  
  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { id },
      include: { entries: true, winners: true },
    })
    
    if (!giveaway) {
      return interaction.editReply('❌ Sorteio não encontrado!')
    }
    
    if (!giveaway.ended) {
      return interaction.editReply('❌ Este sorteio ainda não foi finalizado!')
    }
    
    // Remover vencedores antigos
    await prisma.giveawayWinner.deleteMany({
      where: { giveawayId: id },
    })
    
    // Selecionar novos vencedores
    const eligibleEntries = giveaway.entries.filter(e => !e.disqualified)
    const winnerCount = Math.min(giveaway.maxWinners, eligibleEntries.length)
    const shuffled = eligibleEntries.sort(() => Math.random() - 0.5)
    const winners = shuffled.slice(0, winnerCount)
    
    // Salvar novos vencedores
    await prisma.$transaction(
      winners.map(w => 
        prisma.giveawayWinner.create({
          data: {
            giveawayId: id,
            userId: w.userId,
            username: w.username,
          },
        })
      )
    )
    
    // Anunciar
    const rawChannel = await interaction.client.channels.fetch(giveaway.channelId)
    const channel = getSendableChannel(rawChannel)
    if (channel) {
      const winnerMentions = winners.map(w => `<@${w.userId}>`).join(', ')
      
      const embed = new EmbedBuilder()
        .setTitle(`🔄 Novos Vencedores: ${giveaway.title}`)
        .setDescription(`**Vencedores:**\n${winnerMentions}`)
        .setColor(0x3B82F6)
        .setTimestamp()
      
      await channel.send({ embeds: [embed] })
    }
    
    await interaction.editReply(`✅ Novos vencedores selecionados!`)
  } catch (error: any) {
    await interaction.editReply(`❌ Erro: ${error.message}`)
  }
}
