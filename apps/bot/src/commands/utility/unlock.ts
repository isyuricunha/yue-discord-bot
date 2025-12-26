import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';

export const unlockCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setNameLocalizations({ 'pt-BR': 'destrancar' })
    .setDescription('Destrancar um canal previamente trancado')
    .setDescriptionLocalizations({ 'pt-BR': 'Destrancar um canal previamente trancado' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option =>
      option
        .setName('canal')
        .setDescription('Canal a ser destrancado (padrão: canal atual)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
        ephemeral: true,
      });
      return;
    }

    const targetChannel = (interaction.options.getChannel('canal') || interaction.channel) as TextChannel;

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Canal inválido!`,
        ephemeral: true,
      });
      return;
    }

    try {
      // Restaurar permissão SEND_MESSAGES do @everyone (null = usar padrão)
      await targetChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null,
      });

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.UNLOCK} Canal Destrancado`)
        .setDescription(`O canal ${targetChannel} foi destrancado.`)
        .addFields([
          { name: 'Moderador', value: interaction.user.tag, inline: true },
        ])
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Enviar mensagem no canal destrancado
      const unlockEmbed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.UNLOCK} Canal Destrancado`)
        .setDescription('Este canal foi destrancado. Vocês podem voltar a conversar!')
        .setFooter({ text: `Por: ${interaction.user.tag}` })
        .setTimestamp();

      await targetChannel.send({ embeds: [unlockEmbed] });

      logger.info(
        `Unlock: ${targetChannel.name} destrancado por ${interaction.user.tag} em ${interaction.guild.name}`
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao destrancar canal');
      await interaction.reply({
        content: `${EMOJIS.ERROR} Erro ao destrancar o canal. Verifique se tenho permissões suficientes.`,
        ephemeral: true,
      });
    }
  },
};
