import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js'
import { prisma } from '@yuebot/database'
import { parse_giveaway_items_input } from '@yuebot/shared'
import { getSendableChannel } from '../utils/discord'

export const data = new SlashCommandBuilder()
  .setName('sorteio-lista')
  .setDescription('Criar sorteio com lista de itens e preferências')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
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
  .addStringOption(option =>
    option
      .setName('itens')
      .setDescription('Lista de itens separados por vírgula')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('vencedores')
      .setDescription('Número de vencedores')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(50)
  )
  .addStringOption(option =>
    option
      .setName('duracao')
      .setDescription('Duração (ex: 1h, 3d, 1w)')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('min-escolhas')
      .setDescription('Mínimo de itens que cada pessoa deve escolher')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(25)
  )
  .addIntegerOption(option =>
    option
      .setName('max-escolhas')
      .setDescription('Número máximo de itens para escolher (padrão: 10)')
      .setRequired(false)
  )
  .addChannelOption(option =>
    option
      .setName('canal')
      .setDescription('Canal onde o sorteio será criado')
      .setRequired(false)
  )
  .addRoleOption(option =>
    option
      .setName('cargo-obrigatorio')
      .setDescription('Cargo necessário para participar (opcional)')
      .setRequired(false)
  )

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhdw])$/)
  if (!match) throw new Error('Formato inválido. Use: 1s, 5m, 1h, 3d, 1w')
  
  const value = parseInt(match[1])
  const unit = match[2]
  
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  }
  
  return value * multipliers[unit as keyof typeof multipliers]
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })
  
  const title = interaction.options.getString('titulo', true)
  const description = interaction.options.getString('descricao', true)
  const itemsStr = interaction.options.getString('itens', true)
  const winners = interaction.options.getInteger('vencedores', true)
  const durationStr = interaction.options.getString('duracao', true)
  const minChoices = interaction.options.getInteger('min-escolhas') || 3
  const maxChoices = interaction.options.getInteger('max-escolhas') || 10
  const selectedChannel = interaction.options.getChannel('canal')
  const fetchedSelectedChannel =
    selectedChannel && interaction.guild
      ? await interaction.guild.channels.fetch(selectedChannel.id).catch(() => null)
      : null
  const channel = getSendableChannel(fetchedSelectedChannel || selectedChannel || interaction.channel)
  const requiredRole = interaction.options.getRole('cargo-obrigatorio')
  
  if (!channel) {
    return interaction.editReply('❌ Canal inválido!')
  }
  
  const items = parse_giveaway_items_input(itemsStr)
  
  if (items.length < minChoices) {
    return interaction.editReply(`❌ A lista deve ter pelo menos ${minChoices} itens!`)
  }

  if (maxChoices > items.length) {
    return interaction.editReply(
      `❌ O máximo de escolhas não pode ser maior que a quantidade de itens (${items.length}).`
    )
  }
  
  try {
    const duration = parseDuration(durationStr)
    const endsAt = new Date(Date.now() + duration)
    
    // Criar embed do sorteio
    const embed = new EmbedBuilder()
      .setTitle(`🎁 ${title}`)
      .setDescription(
        `${description}\n\n` +
        `📋 **${items.length} itens disponíveis**\n` +
        `✅ Escolha entre ${minChoices} e ${maxChoices} itens em ordem de preferência\n\n` +
        `Clique no botão abaixo para participar!`
      )
      .addFields(
        { name: '🏆 Vencedores', value: `${winners}`, inline: true },
        { name: '⏰ Termina', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
        { name: '📋 Participantes', value: '0', inline: true }
      )
      .setColor(0x9333EA)
      .setFooter({ text: 'Sorteio com lista de preferências' })
      .setTimestamp(endsAt)
    
    if (requiredRole) {
      embed.addFields({ name: '🚪 Cargo Necessário', value: `<@&${requiredRole.id}>`, inline: true })
    }
    
    const button = new ButtonBuilder()
      .setCustomId('giveaway_participate')
      .setLabel('✨ Participar do Sorteio')
      .setStyle(ButtonStyle.Primary)
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)
    
    const message = await channel.send({ embeds: [embed], components: [row] })
    
    // Enviar lista de itens em mensagem separada
    const itemsList = items.map((item, i) => `${i + 1}. ${item}`).join('\n')
    const chunks = []
    
    // Dividir em chunks de 2000 caracteres (limite do Discord)
    let currentChunk = ''
    for (const line of itemsList.split('\n')) {
      if (currentChunk.length + line.length + 1 > 1900) {
        chunks.push(currentChunk)
        currentChunk = line
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line
      }
    }
    if (currentChunk) chunks.push(currentChunk)
    
    // Enviar lista
    for (let i = 0; i < chunks.length; i++) {
      const listEmbed = new EmbedBuilder()
        .setTitle(i === 0 ? `📋 Lista de Itens Disponíveis` : `📋 Lista (continuação ${i + 1})`)
        .setDescription(chunks[i])
        .setColor(0x3B82F6)
        .setFooter({ text: `Total: ${items.length} itens | Página ${i + 1}/${chunks.length}` })
      
      await channel.send({ embeds: [listEmbed] })
    }
    
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
        maxWinners: winners,
        format: 'list',
        availableItems: items,
        minChoices,
        maxChoices,
        endsAt,
      },
    })
    
    await interaction.editReply(
      `✅ Sorteio com lista criado com sucesso!\n` +
      `ID: \`${giveaway.id}\`\n` +
      `${items.length} itens disponíveis\n` +
      `Lista enviada no canal!`
    )
  } catch (error: any) {
    await interaction.editReply(`❌ Erro: ${error.message}`)
  }
}
