import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';

export const limparCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('limpar')
    .setDescription('Limpar mensagens do canal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option
        .setName('quantidade')
        .setDescription('Quantidade de mensagens para deletar (1-1000)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000)
    )
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Filtrar mensagens de um usuário específico')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('filtro')
        .setDescription('Filtrar tipo de mensagens')
        .setRequired(false)
        .addChoices(
          { name: 'Bots', value: 'bots' },
          { name: 'Humanos', value: 'humans' },
          { name: 'Com Links', value: 'links' },
          { name: 'Com Anexos', value: 'attachments' },
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em canais de servidores!`,
        ephemeral: true,
      });
      return;
    }

    const quantity = interaction.options.get('quantidade')?.value as number;
    const targetUser = interaction.options.getUser('usuario');
    const filter = interaction.options.get('filtro')?.value as string | undefined;

    const channel = interaction.channel as TextChannel;

    try {
      await interaction.deferReply({ ephemeral: true });

      // Buscar mensagens (máximo 100 por vez)
      const fetchLimit = Math.min(quantity, 100);
      let messages = await channel.messages.fetch({ limit: fetchLimit });

      // Aplicar filtros
      if (targetUser) {
        messages = messages.filter(msg => msg.author.id === targetUser.id);
      }

      if (filter) {
        switch (filter) {
          case 'bots':
            messages = messages.filter(msg => msg.author.bot);
            break;
          case 'humans':
            messages = messages.filter(msg => !msg.author.bot);
            break;
          case 'links':
            messages = messages.filter(msg => 
              msg.content.includes('http://') || msg.content.includes('https://')
            );
            break;
          case 'attachments':
            messages = messages.filter(msg => msg.attachments.size > 0);
            break;
        }
      }

      // Filtrar mensagens antigas (mais de 14 dias não podem ser deletadas em bulk)
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const recentMessages = messages.filter(msg => msg.createdTimestamp > twoWeeksAgo);

      if (recentMessages.size === 0) {
        await interaction.editReply({
          content: `${EMOJIS.ERROR} Nenhuma mensagem encontrada para deletar com os filtros aplicados.`,
        });
        return;
      }

      // Deletar mensagens
      const deleted = await channel.bulkDelete(recentMessages, true);

      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Mensagens Limpas`)
        .setDescription(`**${deleted.size}** mensagem(ns) deletada(s) com sucesso.`)
        .addFields([
          { name: 'Canal', value: `<#${channel.id}>`, inline: true },
          { name: 'Moderador', value: interaction.user.tag, inline: true },
        ])
        .setTimestamp();

      if (targetUser) {
        embed.addFields([{ name: 'Filtrado por', value: targetUser.tag, inline: true }]);
      }

      if (filter) {
        const filterNames: Record<string, string> = {
          bots: 'Bots',
          humans: 'Humanos',
          links: 'Com Links',
          attachments: 'Com Anexos',
        };
        embed.addFields([{ name: 'Tipo', value: filterNames[filter], inline: true }]);
      }

      await interaction.editReply({ embeds: [embed] });

      logger.info(
        `Limpar: ${deleted.size} mensagens deletadas por ${interaction.user.tag} em ${channel.name}`
      );
    } catch (error) {
      logger.error({ error }, 'Erro ao limpar mensagens');
      await interaction.editReply({
        content: `${EMOJIS.ERROR} Erro ao limpar mensagens. Verifique se tenho permissões suficientes.`,
      });
    }
  },
};
