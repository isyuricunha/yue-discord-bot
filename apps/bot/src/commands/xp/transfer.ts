import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { xpService } from '../../services/xp.service';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';
import { safe_reply_ephemeral, safe_defer_ephemeral } from '../../utils/interaction';

const MIN_TRANSFER_AMOUNT = 1;
const MAX_TRANSFER_AMOUNT = 1000000;

export const transferCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('transferir')
    .setNameLocalizations({ 'pt-BR': 'transferir' })
    .setDescription('Transferir XP para outro usuário no servidor')
    .setDescriptionLocalizations({ 'pt-BR': 'Transferir XP para outro usuário no servidor' })
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setNameLocalizations({ 'pt-BR': 'usuario' })
        .setDescription('Usuário que receberá o XP')
        .setDescriptionLocalizations({ 'pt-BR': 'Usuário que receberá o XP' })
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('quantia')
        .setNameLocalizations({ 'pt-BR': 'quantia' })
        .setDescription('Quantidade de XP para transferir')
        .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de XP para transferir' })
        .setMinValue(MIN_TRANSFER_AMOUNT)
        .setMaxValue(MAX_TRANSFER_AMOUNT)
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
      });
      return;
    }

    const toUser = interaction.options.getUser('usuario', true);
    const amount = interaction.options.getInteger('quantia', true);

    // Validations
    if (toUser.bot) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Você não pode transferir XP para bots.`,
      });
      return;
    }

    if (toUser.id === interaction.user.id) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Você não pode transferir XP para si mesmo.`,
      });
      return;
    }

    if (amount < MIN_TRANSFER_AMOUNT) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} A quantia mínima de transferência é ${MIN_TRANSFER_AMOUNT} XP.`,
      });
      return;
    }

    if (amount > MAX_TRANSFER_AMOUNT) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} A quantia máxima de transferência é ${MAX_TRANSFER_AMOUNT.toLocaleString('pt-BR')} XP.`,
      });
      return;
    }

    await safe_defer_ephemeral(interaction);

    const result = await xpService.transfer_xp({
      from_user_id: interaction.user.id,
      to_user_id: toUser.id,
      guild_id: interaction.guild.id,
      amount,
    });

    if (!result.success) {
      const error = result.error;
      let errorMessage = '';
      switch (error) {
        case 'invalid_amount':
          errorMessage = 'Quantia inválida para transferência.';
          break;
        case 'insufficient_funds':
          errorMessage = 'XP insuficiente para realizar a transferência.';
          break;
        case 'same_user':
          errorMessage = 'Você não pode transferir XP para si mesmo.';
          break;
        case 'same_server':
          errorMessage = 'Ambos os usuários devem estar no mesmo servidor.';
          break;
        default:
          errorMessage = 'Ocorreu um erro ao tentar transferir XP.';
      }

      await interaction.editReply({ content: `${EMOJIS.ERROR} ${errorMessage}` });
      return;
    }

    const taxPercent = 10;
    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} Transferência concluída`)
      .setDescription(
        `Você enviou **${amount.toLocaleString('pt-BR')}** XP para <@${toUser.id}>.`
      )
      .addFields(
        {
          name: '💰 Você enviou',
          value: `${amount.toLocaleString('pt-BR')} XP`,
          inline: true,
        },
        {
          name: '📊 Taxa (10%)',
          value: `-${result.taxDeducted.toLocaleString('pt-BR')} XP`,
          inline: true,
        },
        {
          name: '🎁 Recebido',
          value: `${result.amountReceived.toLocaleString('pt-BR')} XP`,
          inline: true,
        }
      )
      .addFields(
        {
          name: '👤 Seu XP',
          value: `Antes: ${result.fromXpBefore.toLocaleString('pt-BR')} XP\nDepois: ${result.fromXpAfter.toLocaleString('pt-BR')} XP`,
          inline: true,
        },
        {
          name: `👥 XP de ${toUser.username}`,
          value: `Antes: ${result.toXpBefore.toLocaleString('pt-BR')} XP\nDepois: ${result.toXpAfter.toLocaleString('pt-BR')} XP`,
          inline: true,
        }
      )
      .setFooter({
        text: `Taxa de transferência: ${taxPercent}%`,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
