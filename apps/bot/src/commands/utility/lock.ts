import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';
import { safe_reply_ephemeral } from '../../utils/interaction'
import { safe_error_details } from '../../utils/safe_error';

export const lockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setNameLocalizations({ 'pt-BR': 'trancar' })
    .setDescription('Trancar um canal para impedir que membros enviem mensagens')
    .setDescriptionLocalizations({ 'pt-BR': 'Trancar um canal para impedir que membros enviem mensagens' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal a ser trancado (padrão: canal atual)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('razao')
        .setDescription('Razão para trancar o canal')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
      })
      return;
    }

    const targetChannel = (interaction.options.getChannel('canal') || interaction.channel) as TextChannel;
    const reason = interaction.options.get('razao')?.value as string | undefined;

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await safe_reply_ephemeral(interaction, { content: `${EMOJIS.ERROR} Canal inválido!` })
      return;
    }

    try {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Você precisa da permissão Gerenciar Canais para usar este comando.`,
        })
        return;
      }

      const botMember =
        interaction.guild.members.me ??
        (interaction.client.user
          ? await interaction.guild.members.fetch(interaction.client.user.id).catch(() => null)
          : null);
      const botPermissions = botMember ? targetChannel.permissionsFor(botMember) : null;

      if (!botPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await safe_reply_ephemeral(interaction, {
          content: `${EMOJIS.ERROR} Eu preciso da permissão Gerenciar Canais neste canal para trancá-lo.`,
        })
        return;
      }

      // Remover permissão SEND_MESSAGES do @everyone
      await targetChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false,
      });

      const embed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle(`${EMOJIS.LOCK} Canal Trancado`)
        .setDescription(`O canal ${targetChannel} foi trancado.`)
        .addFields([
          { name: 'Moderador', value: interaction.user.tag, inline: true },
          { name: 'Razão', value: reason || 'Não especificada', inline: true },
        ])
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Enviar mensagem no canal trancado
      const lockEmbed = new EmbedBuilder()
        .setColor(COLORS.WARNING)
        .setTitle(`${EMOJIS.LOCK} Canal Trancado`)
        .setDescription(reason || 'Este canal foi temporariamente trancado.')
        .setFooter({ text: `Por: ${interaction.user.tag}` })
        .setTimestamp();

      await targetChannel.send({ embeds: [lockEmbed] }).catch((sendError) => {
        logger.warn(
          {
            err: safe_error_details(sendError),
            guildId: interaction.guild?.id,
            channelId: targetChannel.id,
          },
          'Lock: canal trancado, mas não foi possível enviar aviso no canal'
        )
      });

      logger.info(
        `Lock: ${targetChannel.name} trancado por ${interaction.user.tag} em ${interaction.guild.name}`
      );
    } catch (error) {
      logger.error(
        {
          err: safe_error_details(error),
          guildId: interaction.guild.id,
          channelId: targetChannel.id,
        },
        'Erro ao trancar canal'
      );
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Erro ao trancar o canal. Verifique se tenho permissões suficientes.`,
      })
    }
  },
};
