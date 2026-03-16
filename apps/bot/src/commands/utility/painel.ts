import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import { safe_reply_ephemeral } from '../../utils/interaction';
import type { Command } from '../index';

export const painelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Obter o link para o painel web de gerenciamento'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
      });
      return;
    }

    const webUrl = process.env.WEB_URL || 'http://localhost:5173';

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`🌐 Painel Web - Yue Bot`)
      .setDescription(
        'Acesse o painel web para gerenciar configurações do bot, visualizar logs de moderação e criar sorteios!'
      )
      .addFields([
        { 
          name: '🔗 Link', 
          value: `[Clique aqui para acessar o painel](${webUrl})`, 
          inline: false 
        },
        {
          name: '🔐 Login',
          value: 'Faça login com sua conta Discord para acessar as configurações do servidor.',
          inline: false,
        },
        {
          name: '⚙️ Funcionalidades',
          value: 
            '• Configurar moderação automática\n' +
            '• Visualizar logs de moderação\n' +
            '• Criar e gerenciar sorteios\n' +
            '• Ver estatísticas do servidor\n' +
            '• E muito mais!',
          inline: false,
        },
      ])
      .setFooter({ text: 'Yue Bot • Painel de Gerenciamento' })
      .setTimestamp();

    await safe_reply_ephemeral(interaction, { embeds: [embed] });

    logger.info(`Painel: Link solicitado por ${interaction.user.tag} em ${interaction.guild.name}`);
  },
};
