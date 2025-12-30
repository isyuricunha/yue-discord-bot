import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'

import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'

import { waifuService } from '../../services/waifu.service'

function format_relative_time(date: Date): string {
  const unix = Math.floor(date.getTime() / 1000)
  return `<t:${unix}:R>`
}

export const waifuCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('waifu')
    .setDescription('Rolar uma waifu aleatória. Clique no ❤️ para casar.')
    .setDescriptionLocalizations({ 'pt-BR': 'Rolar uma waifu aleatória. Clique no ❤️ para casar.' }),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use este comando em um servidor.`, ephemeral: true })
      return
    }

    await interaction.deferReply()

    await waifuService.ensure_user(interaction.user.id, {
      username: interaction.user.username,
      avatar: interaction.user.avatar,
    })

    const roll = await waifuService.roll({
      kind: 'waifu',
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      rolledByUserId: interaction.user.id,
    })

    const watchers = await waifuService.wishlist_watchers({
      guildId: interaction.guildId,
      characterId: roll.character.id,
    })

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`${EMOJIS.INFO} Waifu`)
      .setDescription(`**${roll.character.name}**${roll.character.nameNative ? ` (${roll.character.nameNative})` : ''}`)
      .setImage(roll.character.imageUrl)
      .addFields([
        { name: 'Expira', value: format_relative_time(roll.expiresAt), inline: true },
        {
          name: 'Status',
          value: roll.claimedByUserId ? `Já casada com <@${roll.claimedByUserId}>` : 'Disponível para casar',
          inline: true,
        },
      ])

    if (watchers.userIds.length > 0) {
      const preview = watchers.userIds.slice(0, 10).map((id) => `<@${id}>`).join(' ')
      const suffix = watchers.userIds.length > 10 ? ` (+${watchers.userIds.length - 10})` : ''
      embed.addFields([{ name: 'Na wishlist de', value: `${preview}${suffix}`, inline: false }])
    }

    const button = new ButtonBuilder()
      .setCustomId(`waifu:claim:${roll.rollId}`)
      .setStyle(ButtonStyle.Success)
      .setLabel('❤️ Claim')
      .setDisabled(Boolean(roll.claimedByUserId))

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)

    const reply = await interaction.editReply({ embeds: [embed], components: [row] })

    await waifuService.attach_message_id({ rollId: roll.rollId, messageId: reply.id })
  },
}
