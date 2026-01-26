import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder
} from 'discord.js'
import { prisma } from '@yuebot/database'
import { parseDurationMs, parse_giveaway_items_input } from '@yuebot/shared'

export const data = new SlashCommandBuilder()
  .setName('sorteio-wizard')
  .setDescription('Criar sorteio com assistente passo a passo')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

interface WizardState {
  step: number
  title?: string
  description?: string
  winners?: number
  duration?: string
  channelId?: string
  requiredRoleId?: string
  requiredRoleIds?: string[]
  format?: 'reaction' | 'list'
  items?: string[]
  minChoices?: number
  maxChoices?: number
  roleChances?: {roleId: string, multiplier: number}[]
}

const wizardSessions = new Map<string, WizardState>()

function parseDuration(duration: string): number {
  const ms = parseDurationMs(duration)
  if (!ms) throw new Error('Formato inválido. Use: 1s, 5m, 1h, 3d, 1w')
  return ms
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id
  
  // Iniciar wizard
  wizardSessions.set(userId, { step: 0 })
  
  const embed = new EmbedBuilder()
    .setTitle('🧙‍♂️ Assistente de Criação de Sorteio')
    .setDescription(
      'Bem-vindo ao assistente de criação de sorteios!\n\n' +
      'Vou guiá-lo passo a passo para criar seu sorteio.\n' +
      'Você pode cancelar a qualquer momento clicando em "Cancelar".'
    )
    .setColor(0x9333EA)
    .addFields(
      { name: 'Passo 1', value: 'Escolha o tipo de sorteio', inline: false }
    )
  
  const row = new ActionRowBuilder<StringSelectMenuBuilder>()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`wizard_format_${userId}`)
        .setPlaceholder('Selecione o tipo de sorteio')
        .addOptions([
          {
            label: 'Sorteio por Reação',
            description: 'Membros reagem para participar. Simples e rápido.',
            value: 'reaction',
            emoji: '🎉'
          },
          {
            label: 'Sorteio com Lista',
            description: 'Membros escolhem itens em ordem de preferência.',
            value: 'list',
            emoji: '📋'
          }
        ])
    )
  
  const cancelRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`wizard_cancel_${userId}`)
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Danger)
    )
  
  await interaction.reply({ 
    embeds: [embed], 
    components: [row, cancelRow],
    ephemeral: true 
  })
  
  // Timeout de 5 minutos
  setTimeout(() => {
    if (wizardSessions.has(userId)) {
      wizardSessions.delete(userId)
    }
  }, 5 * 60 * 1000)
}

// Handler para seleção de formato
export async function handleFormatSelection(interaction: any) {
  const userId = interaction.user.id
  const state = wizardSessions.get(userId)
  
  if (!state) {
    return interaction.reply({ content: '❌ Sessão expirada. Use `/sorteio-wizard` novamente.', ephemeral: true })
  }
  
  const format = interaction.values[0] as 'reaction' | 'list'
  state.format = format
  state.step = 1
  
  // Mostrar modal para título e descrição
  const modal = new ModalBuilder()
    .setCustomId(`wizard_basic_${userId}`)
    .setTitle('Informações Básicas do Sorteio')
  
  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Título do Sorteio')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Sorteio de Nitro')
    .setRequired(true)
    .setMaxLength(100)
  
  const descInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Descrição')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Descreva o que está sendo sorteado...')
    .setRequired(true)
    .setMaxLength(500)
  
  const winnersInput = new TextInputBuilder()
    .setCustomId('winners')
    .setLabel('Número de Vencedores')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 1')
    .setRequired(true)
    .setMaxLength(2)
  
  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('Duração')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 1h, 3d, 1w')
    .setRequired(true)
    .setMaxLength(10)
  
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(winnersInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(durationInput)
  )
  
  await interaction.showModal(modal)
}

// Handler para modal de informações básicas
export async function handleBasicInfo(interaction: any) {
  const userId = interaction.user.id
  const state = wizardSessions.get(userId)
  
  if (!state) {
    return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true })
  }
  
  state.title = interaction.fields.getTextInputValue('title')
  state.description = interaction.fields.getTextInputValue('description')
  state.winners = parseInt(interaction.fields.getTextInputValue('winners'))
  state.duration = interaction.fields.getTextInputValue('duration')
  
  // Validar duração
  try {
    parseDuration(state.duration)
  } catch (error: any) {
    return interaction.reply({ 
      content: `❌ ${error.message}`, 
      ephemeral: true 
    })
  }
  
  if (state.format === 'list') {
    // Para lista, pedir itens
    const modal = new ModalBuilder()
      .setCustomId(`wizard_items_${userId}`)
      .setTitle('Lista de Itens')
    
    const itemsInput = new TextInputBuilder()
      .setCustomId('items')
      .setLabel('Itens (separados por vírgula)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Item 1, Item 2, Item 3...')
      .setRequired(true)
    
    const minInput = new TextInputBuilder()
      .setCustomId('min')
      .setLabel('Mínimo de escolhas por pessoa')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('3')
      .setValue('3')
      .setRequired(false)
    
    const maxInput = new TextInputBuilder()
      .setCustomId('max')
      .setLabel('Máximo de escolhas por pessoa')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('10')
      .setValue('10')
      .setRequired(false)
    
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(itemsInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(minInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(maxInput)
    )
    
    await interaction.showModal(modal)
  } else {
    // Para reação, pedir canal
    state.step = 3
    await showChannelSelection(interaction, state)
  }
}

// Handler para itens da lista
export async function handleItems(interaction: any) {
  const userId = interaction.user.id
  const state = wizardSessions.get(userId)
  
  if (!state) {
    return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true })
  }
  
  const itemsStr = interaction.fields.getTextInputValue('items')
  state.items = parse_giveaway_items_input(itemsStr)
  state.minChoices = parseInt(interaction.fields.getTextInputValue('min') || '3')
  state.maxChoices = parseInt(interaction.fields.getTextInputValue('max') || '10')
  
  if (state.items.length < state.minChoices) {
    return interaction.reply({ 
      content: `❌ A lista deve ter pelo menos ${state.minChoices} itens!`, 
      ephemeral: true 
    })
  }

  if (state.maxChoices > state.items.length) {
    return interaction.reply({
      content: `❌ O máximo de escolhas não pode ser maior que a quantidade de itens (${state.items.length}).`,
      ephemeral: true,
    })
  }
  
  state.step = 3
  await showChannelSelection(interaction, state)
}

async function showChannelSelection(interaction: any, state: WizardState) {
  const embed = new EmbedBuilder()
    .setTitle('🧙‍♂️ Configurações do Sorteio')
    .setDescription('Escolha o canal onde o sorteio será criado:')
    .setColor(0x9333EA)
    .addFields(
      { name: '✅ Título', value: state.title || 'N/A', inline: true },
      { name: '🏆 Vencedores', value: `${state.winners}`, inline: true },
      { name: '⏰ Duração', value: state.duration || 'N/A', inline: true }
    )
  
  const channelRow = new ActionRowBuilder<ChannelSelectMenuBuilder>()
    .addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`wizard_channel_${interaction.user.id}`)
        .setPlaceholder('Selecione o canal')
        .addChannelTypes(ChannelType.GuildText)
    )
  
  const cancelRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`wizard_cancel_${interaction.user.id}`)
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Danger)
    )
  
  await interaction.reply({ 
    embeds: [embed], 
    components: [channelRow, cancelRow],
    ephemeral: true 
  })
}

// Handler para seleção de canal
export async function handleChannelSelection(interaction: any) {
  const userId = interaction.user.id
  const state = wizardSessions.get(userId)
  
  if (!state) {
    return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true })
  }
  
  state.channelId = interaction.values[0]
  state.step = 4
  
  // Perguntar sobre cargos obrigatórios
  const embed = new EmbedBuilder()
    .setTitle('🧙‍♂️ Cargos Obrigatórios (Opcional)')
    .setDescription('Deseja exigir cargos específicos para participar?')
    .setColor(0x9333EA)
  
  const roleRow = new ActionRowBuilder<RoleSelectMenuBuilder>()
    .addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`wizard_role_${userId}`)
        .setPlaceholder('Selecione um ou mais cargos (opcional)')
        .setMaxValues(25) // Permitir múltiplos cargos
    )
  
  const buttonRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`wizard_skip_role_${userId}`)
        .setLabel('⏭️ Pular')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`wizard_cancel_${userId}`)
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Danger)
    )
  
  await interaction.update({ embeds: [embed], components: [roleRow, buttonRow] })
}

// Handler para finalizar wizard
export async function handleFinish(interaction: any, skipRole: boolean = false) {
  const userId = interaction.user.id
  const state = wizardSessions.get(userId)
  
  if (!state) {
    return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true })
  }
  
  if (!skipRole && interaction.values) {
    state.requiredRoleIds = interaction.values
  }
  
  // Se cargos foram selecionados, perguntar sobre chances por cargo
  if (state.requiredRoleIds && state.requiredRoleIds.length > 0) {
    state.step = 5
    await showRoleChancesConfiguration(interaction, state)
    return
  }
  
  await interaction.deferUpdate()
  
  try {
    const duration = parseDuration(state.duration!)
    const endsAt = new Date(Date.now() + duration)
    const channel = await interaction.guild.channels.fetch(state.channelId!)
    
    if (!channel || !channel.isTextBased()) {
      throw new Error('Canal inválido')
    }
    
    // Criar sorteio
    if (state.format === 'reaction') {
      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${state.title}`)
        .setDescription(state.description!)
        .addFields(
          { name: '🏆 Vencedores', value: `${state.winners}`, inline: true },
          { name: '⏰ Termina', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
          { name: '📋 Participantes', value: '0', inline: true }
        )
        .setColor(0x9333EA)
        .setFooter({ text: 'Reaja com 🎉 para participar!' })
        .setTimestamp(endsAt)
      
      if (state.requiredRoleId) {
        embed.addFields({ name: '🎭 Cargo Necessário', value: `<@&${state.requiredRoleId}>`, inline: false })
      }
      
      const message = await channel.send({ embeds: [embed] })
      await message.react('🎉')
      
      await prisma.giveaway.create({
        data: {
          guildId: interaction.guildId!,
          title: state.title!,
          description: state.description!,
          channelId: state.channelId!,
          messageId: message.id,
          creatorId: userId,
          requiredRoleId: state.requiredRoleId,
          maxWinners: state.winners!,
          format: 'reaction',
          endsAt,
        },
      })
    } else {
      // Sorteio com lista
      const embed = new EmbedBuilder()
        .setTitle(`🎁 ${state.title}`)
        .setDescription(
          `${state.description}\n\n` +
          `📋 **${state.items!.length} itens disponíveis**\n` +
          `✅ Escolha entre ${state.minChoices} e ${state.maxChoices} itens\n\n` +
          `Clique no botão abaixo para participar!`
        )
        .addFields(
          { name: '🏆 Vencedores', value: `${state.winners}`, inline: true },
          { name: '⏰ Termina', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
          { name: '📋 Participantes', value: '0', inline: true }
        )
        .setColor(0x9333EA)
        .setFooter({ text: 'Sorteio com lista de preferências' })
        .setTimestamp(endsAt)
      
      if (state.requiredRoleId) {
        embed.addFields({ name: '🚪 Cargo Necessário', value: `<@&${state.requiredRoleId}>`, inline: true })
      }
      
      const button = new ButtonBuilder()
        .setCustomId('giveaway_participate')
        .setLabel('✨ Participar do Sorteio')
        .setStyle(ButtonStyle.Primary)
      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)
      const message = await channel.send({ embeds: [embed], components: [row] })

      // Enviar lista de itens em mensagem separada
      const itemsList = state.items!.map((item, i) => `${i + 1}. ${item}`).join('\n')
      const chunks: string[] = []

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
          .setFooter({ text: `Total: ${state.items!.length} itens | Página ${i + 1}/${chunks.length}` })

        await channel.send({ embeds: [listEmbed] })
      }
      
      await prisma.giveaway.create({
        data: {
          guildId: interaction.guildId!,
          title: state.title!,
          description: state.description!,
          channelId: state.channelId!,
          messageId: message.id,
          creatorId: userId,
          requiredRoleId: state.requiredRoleId,
          maxWinners: state.winners!,
          format: 'list',
          availableItems: state.items,
          minChoices: state.minChoices,
          maxChoices: state.maxChoices,
          endsAt,
        },
      })
    }
    
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Sorteio Criado com Sucesso!')
      .setDescription(`O sorteio foi criado em <#${state.channelId}>`)
      .setColor(0x10B981)
    
    await interaction.editReply({ embeds: [successEmbed], components: [] })
    wizardSessions.delete(userId)
  } catch (error: any) {
    await interaction.editReply({ 
      content: `❌ Erro ao criar sorteio: ${error.message}`, 
      components: [] 
    })
    wizardSessions.delete(userId)
  }
}

async function showRoleChancesConfiguration(interaction: any, state: WizardState) {
  const embed = new EmbedBuilder()
    .setTitle('🎲 Chances por Cargo (Opcional)')
    .setDescription(
      'Configure quantas chances cada cargo tem de ganhar.\n' +
      'Exemplo: Cargo "Apoiador" com 10x chances = 10 entradas no sorteio.\n' +
      'Deixe em branco para usar 1x (chance normal).'
    )
    .setColor(0x9333EA)
  
  // Adicionar campos para cada cargo selecionado
  const fields = state.requiredRoleIds!.map(roleId => ({
    name: `<@&${roleId}>`, 
    value: `Multiplicador: 1x (padrão)`,
    inline: true
  }))
  
  embed.addFields(fields)
  
  const buttonRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`wizard_skip_chances_${interaction.user.id}`)
        .setLabel('⏭️ Pular (usar chances iguais)')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`wizard_configure_chances_${interaction.user.id}`)
        .setLabel('⚙️ Configurar Chances')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`wizard_cancel_${interaction.user.id}`)
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Danger)
    )
  
  await interaction.update({ embeds: [embed], components: [buttonRow] })
}

// Handler para configurar chances por cargo
export async function handleConfigureChances(interaction: any) {
  const userId = interaction.user.id
  const state = wizardSessions.get(userId)
  
  if (!state || !state.requiredRoleIds) {
    return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true })
  }
  
  // Criar modal para configurar chances
  const modal = new ModalBuilder()
    .setCustomId(`wizard_chances_${userId}`)
    .setTitle('Configurar Chances por Cargo')
  
  // Adicionar campo para cada cargo
  const rows: ActionRowBuilder<TextInputBuilder>[] = []
  
  for (const roleId of state.requiredRoleIds) {
    const roleInput = new TextInputBuilder()
      .setCustomId(`chance_${roleId}`)
      .setLabel(`<@&${roleId}> Multiplicador`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('1 (padrão), 2, 5, 10, etc.')
      .setRequired(false)
      .setMinLength(1)
      .setMaxLength(3)
    
    rows.push(new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput))
  }
  
  // Adicionar todos os campos ao modal
  for (const row of rows) {
    modal.addComponents(row)
  }
  
  await interaction.showModal(modal)
}

// Handler para salvar configuração de chances
export async function handleSaveChances(interaction: any) {
  const userId = interaction.user.id
  const state = wizardSessions.get(userId)
  
  if (!state || !state.requiredRoleIds) {
    return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true })
  }
  
  // Processar os valores de chances
  const roleChances: {roleId: string, multiplier: number}[] = []
  
  for (const roleId of state.requiredRoleIds) {
    const inputValue = interaction.fields.getTextInputValue(`chance_${roleId}`)
    let multiplier = 1 // Valor padrão
    
    if (inputValue) {
      const parsed = parseInt(inputValue)
      if (!isNaN(parsed) && parsed > 0) {
        multiplier = parsed
      }
    }
    
    roleChances.push({ roleId, multiplier })
  }
  
  state.roleChances = roleChances
  
  // Mostrar resumo das chances configuradas
  const embed = new EmbedBuilder()
    .setTitle('✅ Chances Configuradas')
    .setDescription('Configuração de chances por cargo:')
    .setColor(0x10B981)
  
  const fields = roleChances.map(chance => ({
    name: `<@&${chance.roleId}>`,
    value: `Multiplicador: ${chance.multiplier}x`,
    inline: true
  }))
  
  embed.addFields(fields)
  
  const buttonRow = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`wizard_continue_${userId}`)
        .setLabel('✅ Continuar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`wizard_cancel_${userId}`)
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Danger)
    )
  
  await interaction.reply({ embeds: [embed], components: [buttonRow], ephemeral: true })
}

// Handler para continuar após configurar chances
export async function handleContinueAfterChances(interaction: any) {
  const userId = interaction.user.id
  const state = wizardSessions.get(userId)
  
  if (!state) {
    return interaction.reply({ content: '❌ Sessão expirada.', ephemeral: true })
  }
  
  await interaction.deferUpdate()
  
  try {
    const duration = parseDuration(state.duration!)
    const endsAt = new Date(Date.now() + duration)
    const channel = await interaction.guild.channels.fetch(state.channelId!)
    
    if (!channel || !channel.isTextBased()) {
      throw new Error('Canal inválido')
    }
    
    // Criar sorteio
    if (state.format === 'reaction') {
      const embed = new EmbedBuilder()
        .setTitle(`🎉 ${state.title}`)
        .setDescription(state.description!)
        .addFields(
          { name: '🏆 Vencedores', value: `${state.winners}`, inline: true },
          { name: '⏰ Termina', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
          { name: '📋 Participantes', value: '0', inline: true }
        )
        .setColor(0x9333EA)
        .setFooter({ text: 'Reaja com 🎉 para participar!' })
        .setTimestamp(endsAt)
      
      if (state.requiredRoleIds && state.requiredRoleIds.length > 0) {
        embed.addFields({ name: '🎭 Cargos Necessários', value: state.requiredRoleIds.map(id => `<@&${id}>`).join(', '), inline: false })
      }
      
      const message = await channel.send({ embeds: [embed] })
      await message.react('🎉')
      
      await prisma.giveaway.create({
        data: {
          guildId: interaction.guildId!,
          title: state.title!,
          description: state.description!,
          channelId: state.channelId!,
          messageId: message.id,
          creatorId: userId,
          requiredRoleIds: state.requiredRoleIds,
          roleChances: state.roleChances,
          maxWinners: state.winners!,
          format: 'reaction',
          endsAt,
        },
      })
    } else {
      // Sorteio com lista
      const embed = new EmbedBuilder()
        .setTitle(`🎁 ${state.title}`)
        .setDescription(
          `${state.description}\n\n` +
          `📋 **${state.items!.length} itens disponíveis**\n` +
          `✅ Escolha entre ${state.minChoices} e ${state.maxChoices} itens\n\n` +
          `Clique no botão abaixo para participar!`
        )
        .addFields(
          { name: '🏆 Vencedores', value: `${state.winners}`, inline: true },
          { name: '⏰ Termina', value: `<t:${Math.floor(endsAt.getTime() / 1000)}:R>`, inline: true },
          { name: '📋 Participantes', value: '0', inline: true }
        )
        .setColor(0x9333EA)
        .setFooter({ text: 'Sorteio com lista de preferências' })
        .setTimestamp(endsAt)
      
      if (state.requiredRoleIds && state.requiredRoleIds.length > 0) {
        embed.addFields({ name: '🚪 Cargos Necessários', value: state.requiredRoleIds.map(id => `<@&${id}>`).join(', '), inline: true })
      }
      
      const button = new ButtonBuilder()
        .setCustomId('giveaway_participate')
        .setLabel('✨ Participar do Sorteio')
        .setStyle(ButtonStyle.Primary)
      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)
      const message = await channel.send({ embeds: [embed], components: [row] })

      // Enviar lista de itens em mensagem separada
      const itemsList = state.items!.map((item, i) => `${i + 1}. ${item}`).join('\n')
      const chunks: string[] = []

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
          .setFooter({ text: `Total: ${state.items!.length} itens | Página ${i + 1}/${chunks.length}` })

        await channel.send({ embeds: [listEmbed] })
      }
      
      await prisma.giveaway.create({
        data: {
          guildId: interaction.guildId!,
          title: state.title!,
          description: state.description!,
          channelId: state.channelId!,
          messageId: message.id,
          creatorId: userId,
          requiredRoleIds: state.requiredRoleIds,
          roleChances: state.roleChances,
          maxWinners: state.winners!,
          format: 'list',
          availableItems: state.items,
          minChoices: state.minChoices,
          maxChoices: state.maxChoices,
          endsAt,
        },
      })
    }
    
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Sorteio Criado com Sucesso!')
      .setDescription(`O sorteio foi criado em <#${state.channelId}>`)
      .setColor(0x10B981)
    
    await interaction.editReply({ embeds: [successEmbed], components: [] })
    wizardSessions.delete(userId)
  } catch (error: any) {
    await interaction.editReply({ 
      content: `❌ Erro ao criar sorteio: ${error.message}`, 
      components: [] 
    })
    wizardSessions.delete(userId)
  }
}

// Handler para cancelamento
export async function handleCancel(interaction: any) {
  const userId = interaction.user.id
  wizardSessions.delete(userId)
  
  const embed = new EmbedBuilder()
    .setTitle('❌ Wizard Cancelado')
    .setDescription('A criação do sorteio foi cancelada.')
    .setColor(0xEF4444)
  
  await interaction.update({ embeds: [embed], components: [] })
}
