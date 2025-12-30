import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js'
import type { ChatInputCommandInteraction, Message } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'

import { waifuService } from '../../services/waifu.service'

function format_relative_time(date: Date): string {
  const unix = Math.floor(date.getTime() / 1000)
  return `<t:${unix}:R>`
}

function kind_title(kind: 'waifu' | 'husbando' | 'casar'): string {
  if (kind === 'waifu') return 'Waifu'
  if (kind === 'husbando') return 'Husbando'
  return 'Casamento'
}

async function try_disable_old_roll_message(input: {
  interaction: ChatInputCommandInteraction
  messageId: string | null
}): Promise<void> {
  if (!input.messageId) return
  const channel = input.interaction.channel
  if (!channel?.isTextBased()) return

  let message: Message | null = null
  try {
    message = await channel.messages.fetch(input.messageId)
  } catch {
    return
  }

  if (!message) return

  const embed_data = message.embeds?.[0]?.data
  const embed = new EmbedBuilder(embed_data ?? {}).setColor(COLORS.WARNING)

  const disabled_button = new ButtonBuilder()
    .setCustomId('waifu:disabled')
    .setStyle(ButtonStyle.Secondary)
    .setLabel('Roll rerolado')
    .setDisabled(true)

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disabled_button)

  try {
    await message.edit({ embeds: [embed], components: [row] })
  } catch {
    // ignore
  }
}

export const rerollCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('reroll')
    .setDescription('Rerolar seu último roll neste canal (com cooldown)')
    .setDescriptionLocalizations({ 'pt-BR': 'Rerolar seu último roll neste canal (com cooldown)' }),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
      return
    }

    await interaction.deferReply({ ephemeral: true })

    const res = await waifuService.reroll({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      userId: interaction.user.id,
    })

    if (res.success === false) {
      const suffix = res.nextRerollAt ? ` Próximo reroll: ${format_relative_time(res.nextRerollAt)}.` : ''
      await interaction.editReply({ content: `${EMOJIS.ERROR} ${res.message}${suffix}` })
      return
    }

    await try_disable_old_roll_message({ interaction, messageId: res.oldMessageId })

    const roll = res.newRoll

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} ${kind_title(res.kind)} (reroll)`)
      .setDescription(`**${roll.character.name}**${roll.character.nameNative ? ` (${roll.character.nameNative})` : ''}`)
      .setImage(roll.character.imageUrl)
      .addFields([
        { name: 'Expira', value: format_relative_time(roll.expiresAt), inline: true },
        {
          name: 'Status',
          value: roll.claimedByUserId ? `Já casado com <@${roll.claimedByUserId}>` : 'Disponível para casar',
          inline: true,
        },
      ])

    const button = new ButtonBuilder()
      .setCustomId(`waifu:claim:${roll.rollId}`)
      .setStyle(ButtonStyle.Success)
      .setLabel('❤️ Claim')
      .setDisabled(Boolean(roll.claimedByUserId))

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)

    const msg = await interaction.followUp({ embeds: [embed], components: [row] })

    await waifuService.attach_message_id({ rollId: roll.rollId, messageId: msg.id })

    await interaction.editReply({
      content: `${EMOJIS.SUCCESS} Reroll realizado. Próximo reroll: ${format_relative_time(res.nextRerollAt)}.`,
    })
  },
}
