import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { honeypotService } from '../../services/honeypot.service';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import { safe_reply_ephemeral } from '../../utils/interaction';
import type { Command } from '../index';

export const honeypotCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('armadilha')
    .setDescription('Configurar o canal armadilha contra spam')
    .setDescriptionLocalizations({ 'pt-BR': 'Configurar o canal armadilha contra spam' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('ativar')
        .setNameLocalizations({ 'pt-BR': 'ativar' })
        .setDescription('Define um canal como armadilha: quem postar nele é banido')
        .addChannelOption(option =>
          option
            .setName('canal')
            .setNameLocalizations({ 'pt-BR': 'canal' })
            .setDescription('Canal que vai funcionar como armadilha')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('desativar')
        .setNameLocalizations({ 'pt-BR': 'desativar' })
        .setDescription('Desativa o canal armadilha')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setNameLocalizations({ 'pt-BR': 'status' })
        .setDescription('Mostra a configuração atual do canal armadilha')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand(true);

    try {
      if (subcommand === 'ativar') {
        const channel = interaction.options.getChannel('canal', true);

        if (channel.id === interaction.channelId) {
          // Running the setup flow inside the trap channel itself would get the admin caught by their own trap.
          await safe_reply_ephemeral(interaction, {
            content: `${EMOJIS.ERROR} Você não pode ativar a armadilha no canal em que está usando o comando!`,
          });
          return;
        }

        await honeypotService.set_channel(interaction.guild.id, channel.id);

        const trapEmbed = new EmbedBuilder()
          .setColor(COLORS.WARNING)
          .setTitle(`${EMOJIS.WARNING} CANAL ARMADILHA`)
          .setDescription(
            'Este canal é uma **armadilha contra spam**.\n\n**Não poste nada aqui.** Qualquer mensagem postada neste canal resulta em **banimento automático**, e as mensagens do remetente dos últimos 10 minutos são apagadas no servidor inteiro.',
          );

        const trapChannel = await interaction.guild.channels.fetch(channel.id).catch(() => null);
        let warning_sent = false;
        if (trapChannel?.isTextBased()) {
          warning_sent = await trapChannel.send({ embeds: [trapEmbed] }).then(
            () => true,
            (error) => {
              logger.warn({ err: error, guildId: interaction.guild?.id }, 'HoneyPot: failed to post trap warning');
              return false;
            },
          );
        }

        const successEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Canal armadilha ativado`)
          .setDescription(
            `Qualquer mensagem em <#${channel.id}> agora resulta em banimento automático.\n${
              warning_sent
                ? 'Um aviso foi postado no canal.'
                : 'Não consegui postar o aviso no canal; verifique minhas permissões nele.'
            }`,
          )
          .setTimestamp();

        await interaction.reply({ embeds: [successEmbed] });
        logger.info(
          `HoneyPot: trap channel set to ${channel.id} in ${interaction.guild.name} by ${interaction.user.tag}`,
        );
        return;
      }

      if (subcommand === 'desativar') {
        await honeypotService.set_channel(interaction.guild.id, null);

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Canal armadilha desativado`)
          .setDescription('O canal armadilha foi removido. Nenhum canal está pegando spam agora.')
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        logger.info(
          `HoneyPot: trap channel disabled in ${interaction.guild.name} by ${interaction.user.tag}`,
        );
        return;
      }

      // status
      const config = await honeypotService.get_config(interaction.guild.id);
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Canal armadilha`)
        .setDescription(
          config?.channelId
            ? `Ativo em <#${config.channelId}>. Quem postar nesse canal é banido automaticamente.`
            : 'Desativado. Use `/armadilha ativar` para escolher um canal.',
        )
        .addFields([
          {
            name: 'Isenções',
            value: 'Webhooks e o próprio bot Yue são ignorados. Bots de terceiros que postarem também são banidos.',
            inline: false,
          },
        ])
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      logger.error({ err: error, userId: interaction.user.id }, 'HoneyPot: command failed');
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Erro ao configurar o canal armadilha. Verifique minhas permissões.`,
      });
    }
  },
};
