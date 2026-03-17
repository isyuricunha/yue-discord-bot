import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { antiRaidService } from '../../services/antiRaid.service';
import { logger } from '../../utils/logger';
import { COLORS, EMOJIS } from '@yuebot/shared';
import { safe_reply_ephemeral } from '../../utils/interaction';
import type { Command } from '../index';

export const antiraidCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('antiraide')
    .setDescription('Sistema de proteção contra raide')
    .setDescriptionLocalizations({ 'pt-BR': 'Sistema de proteção contra raide' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand
        .setName('ativar')
        .setNameLocalizations({ 'pt-BR': 'ativar' })
        .setDescription('Ativar a proteção contra raide')
        .addIntegerOption(option =>
          option
            .setName('limite')
            .setNameLocalizations({ 'pt-BR': 'limite' })
            .setDescription('Número de entradas para ativar o raide (padrão: 10)')
            .setMinValue(3)
            .setMaxValue(50)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('janela')
            .setNameLocalizations({ 'pt-BR': 'janela' })
            .setDescription('Janela de tempo em segundos (padrão: 60)')
            .setMinValue(10)
            .setMaxValue(300)
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('acao')
            .setNameLocalizations({ 'pt-BR': 'acao' })
            .setDescription('Ação a tomar quando raide for detectado')
            .setRequired(false)
            .addChoices(
              { name: 'Silenciar (mute)', value: 'mute' },
              { name: 'Expulsar (kick)', value: 'kick' },
              { name: 'Banir (ban)', value: 'ban' },
            )
        )
        .addIntegerOption(option =>
          option
            .setName('duracao')
            .setNameLocalizations({ 'pt-BR': 'duracao' })
            .setDescription('Duração do mute em minutos (padrão: 10)')
            .setMinValue(1)
            .setMaxValue(60)
            .setRequired(false)
        )
        .addChannelOption(option =>
          option
            .setName('canal')
            .setNameLocalizations({ 'pt-BR': 'canal' })
            .setDescription('Canal para notificações de raide')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('desativar')
        .setNameLocalizations({ 'pt-BR': 'desativar' })
        .setDescription('Desativar a proteção contra raide')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('configurar')
        .setNameLocalizations({ 'pt-BR': 'configurar' })
        .setDescription('Configurar as opções de proteção contra raide')
        .addIntegerOption(option =>
          option
            .setName('limite')
            .setNameLocalizations({ 'pt-BR': 'limite' })
            .setDescription('Número de entradas para ativar o raide')
            .setMinValue(3)
            .setMaxValue(50)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('janela')
            .setNameLocalizations({ 'pt-BR': 'janela' })
            .setDescription('Janela de tempo em segundos')
            .setMinValue(10)
            .setMaxValue(300)
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('acao')
            .setNameLocalizations({ 'pt-BR': 'acao' })
            .setDescription('Ação a tomar quando raide for detectado')
            .setRequired(false)
            .addChoices(
              { name: 'Silenciar (mute)', value: 'mute' },
              { name: 'Expulsar (kick)', value: 'kick' },
              { name: 'Banir (ban)', value: 'ban' },
            )
        )
        .addIntegerOption(option =>
          option
            .setName('duracao')
            .setNameLocalizations({ 'pt-BR': 'duracao' })
            .setDescription('Duração do mute em minutos')
            .setMinValue(1)
            .setMaxValue(60)
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('cooldown')
            .setNameLocalizations({ 'pt-BR': 'cooldown' })
            .setDescription('Tempo de espera após raide em segundos (padrão: 300)')
            .setMinValue(60)
            .setMaxValue(3600)
            .setRequired(false)
        )
        .addChannelOption(option =>
          option
            .setName('canal')
            .setNameLocalizations({ 'pt-BR': 'canal' })
            .setDescription('Canal para notificações de raide')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setNameLocalizations({ 'pt-BR': 'status' })
        .setDescription('Ver o status atual da proteção contra raide')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('bloquear')
        .setNameLocalizations({ 'pt-BR': 'bloquear' })
        .setDescription('Bloquear o servidor (impedir membros de enviar mensagens)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('desbloquear')
        .setNameLocalizations({ 'pt-BR': 'desbloquear' })
        .setDescription('Desbloquear o servidor (permitir membros enviarem mensagens)')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Este comando só pode ser usado em servidores!`,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'ativar':
          await handleAtivar(interaction);
          break;
        case 'desativar':
          await handleDesativar(interaction);
          break;
        case 'configurar':
          await handleConfigurar(interaction);
          break;
        case 'status':
          await handleStatus(interaction);
          break;
        case 'bloquear':
          await handleBloquear(interaction);
          break;
        case 'desbloquear':
          await handleDesbloquear(interaction);
          break;
      }
    } catch (error) {
      logger.error({ error }, 'Erro ao executar comando antiraide');
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Erro ao executar o comando.`,
      });
    }
  },
};

async function handleAtivar(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const limite = interaction.options.getInteger('limite') || 10;
  const janela = interaction.options.getInteger('janela') || 60;
  const acao = (interaction.options.getString('acao') as 'mute' | 'kick' | 'ban') || 'mute';
  const duracao = interaction.options.getInteger('duracao') || 10;
  const canal = interaction.options.getChannel('canal');

  const config = await antiRaidService.updateConfig(interaction.guild.id, {
    enabled: true,
    joinThreshold: limite,
    joinTimeWindow: janela,
    action: acao,
    duration: duracao,
    notificationChannelId: canal?.id || null,
  });

  const acaoText: Record<string, string> = {
    mute: 'silenciar (mute)',
    kick: 'expulsar (kick)',
    ban: 'banir (ban)',
  };

  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${EMOJIS.WARNING} Proteção contra Raide Ativada`)
    .setDescription('O sistema de proteção contra raide foi ativado com sucesso!')
    .addFields(
      { name: 'Limite', value: `${limite} membros`, inline: true },
      { name: 'Janela', value: `${janela} segundos`, inline: true },
      { name: 'Ação', value: acaoText[acao], inline: true },
      { name: 'Duração do Mute', value: `${duracao} minutos`, inline: true },
    )
    .setTimestamp();

  if (canal) {
    embed.addFields([{ name: 'Canal de Notificação', value: canal.toString(), inline: true }]);
  }

  await interaction.reply({ embeds: [embed] });

  logger.info(
    `AntiRaid: ativado por ${interaction.user.tag} em ${interaction.guild.name} - limite: ${limite}, janela: ${janela}s, ação: ${acao}`,
  );
}

async function handleDesativar(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  await antiRaidService.updateConfig(interaction.guild.id, {
    enabled: false,
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.WARNING} Proteção contra Raide Desativada`)
    .setDescription('O sistema de proteção contra raide foi desativado.')
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  logger.info(`AntiRaid: desativado por ${interaction.user.tag} em ${interaction.guild.name}`);
}

async function handleConfigurar(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const limite = interaction.options.getInteger('limite');
  const janela = interaction.options.getInteger('janela');
  const acao = interaction.options.getString('acao') as 'mute' | 'kick' | 'ban' | null;
  const duracao = interaction.options.getInteger('duracao');
  const cooldown = interaction.options.getInteger('cooldown');
  const canal = interaction.options.getChannel('canal');

  const updateData: Parameters<typeof antiRaidService.updateConfig>[1] = {};

  if (limite !== null) updateData.joinThreshold = limite;
  if (janela !== null) updateData.joinTimeWindow = janela;
  if (acao !== null) updateData.action = acao;
  if (duracao !== null) updateData.duration = duracao;
  if (cooldown !== null) updateData.cooldown = cooldown;
  if (canal !== null) updateData.notificationChannelId = canal.id;

  if (Object.keys(updateData).length === 0) {
    await safe_reply_ephemeral(interaction, {
      content: `${EMOJIS.ERROR} Nenhuma opção foi fornecida para configurar!`,
    });
    return;
  }

  const config = await antiRaidService.updateConfig(interaction.guild.id, updateData);

  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${EMOJIS.WARNING} Configuração Atualizada`)
    .setDescription('As configurações de proteção contra raide foram atualizadas!')
    .addFields(
      { name: 'Limite', value: `${config.joinThreshold} membros`, inline: true },
      { name: 'Janela', value: `${config.joinTimeWindow} segundos`, inline: true },
      { name: 'Ação', value: config.action, inline: true },
      { name: 'Duração do Mute', value: `${config.duration} minutos`, inline: true },
      { name: 'Cooldown', value: `${config.cooldown} segundos`, inline: true },
    )
    .setTimestamp();

  if (config.notificationChannelId) {
    const channel = interaction.guild.channels.cache.get(config.notificationChannelId);
    embed.addFields([
      { name: 'Canal de Notificação', value: channel?.toString() || config.notificationChannelId, inline: true },
    ]);
  }

  await interaction.reply({ embeds: [embed] });

  logger.info(`AntiRaid: configurado por ${interaction.user.tag} em ${interaction.guild.name}`);
}

async function handleStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const config = await antiRaidService.getConfig(interaction.guild.id);

  if (!config) {
    await safe_reply_ephemeral(interaction, {
      content: `${EMOJIS.INFO} O sistema de proteção contra raide ainda não foi configurado neste servidor.`,
    });
    return;
  }

  const acaoText: Record<string, string> = {
    mute: 'Silenciar (mute)',
    kick: 'Expulsar (kick)',
    ban: 'Banir (ban)',
  };

  const embed = new EmbedBuilder()
    .setColor(config.enabled ? COLORS.SUCCESS : COLORS.INFO)
    .setTitle(`${EMOJIS.WARNING} Status da Proteção contra Raide`)
    .addFields(
      { name: 'Status', value: config.enabled ? '✅ Ativado' : '❌ Desativado', inline: false },
      { name: 'Limite', value: `${config.joinThreshold} membros`, inline: true },
      { name: 'Janela', value: `${config.joinTimeWindow} segundos`, inline: true },
      { name: 'Ação', value: acaoText[config.action] || config.action, inline: true },
      { name: 'Duração do Mute', value: `${config.duration} minutos`, inline: true },
      { name: 'Cooldown', value: `${config.cooldown} segundos`, inline: true },
    )
    .setTimestamp();

  if (config.notificationChannelId) {
    const channel = interaction.guild.channels.cache.get(config.notificationChannelId);
    embed.addFields([
      { name: 'Canal de Notificação', value: channel?.toString() || config.notificationChannelId, inline: true },
    ]);
  }

  if (config.raidActive) {
    embed.addFields([{ name: '⚠️ Raide Ativo', value: 'Uma proteção contra raide está ativa no momento!', inline: false }]);
  }

  if (config.locked) {
    embed.addFields([{ name: '🔒 Servidor Bloqueado', value: 'O servidor está bloqueado no momento!', inline: false }]);
  }

  if (config.lastRaidAt) {
    embed.addFields([{ name: 'Último Raide', value: `<t:${Math.floor(config.lastRaidAt.getTime() / 1000)}:F>`, inline: true }]);
  }

  const joinCount = antiRaidService.getJoinCount(interaction.guild.id);
  embed.addFields([{ name: 'Entradas Recentes', value: `${joinCount} membros`, inline: true }]);

  await interaction.reply({ embeds: [embed] });
}

async function handleBloquear(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const success = await antiRaidService.lockServer(interaction.guild.id, interaction.client);

  if (!success) {
    await safe_reply_ephemeral(interaction, {
      content: `${EMOJIS.ERROR} Não foi possível bloquear o servidor. Verifique se tenho permissões suficientes.`,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.WARNING)
    .setTitle(`${EMOJIS.LOCK} Servidor Bloqueado`)
    .setDescription('O servidor foi bloqueado. Membros não podem mais enviar mensagens.')
    .addFields([{ name: 'Moderador', value: interaction.user.tag, inline: true }])
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  logger.info(`AntiRaid: servidor bloqueado por ${interaction.user.tag} em ${interaction.guild.name}`);
}

async function handleDesbloquear(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;

  const success = await antiRaidService.unlockServer(interaction.guild.id, interaction.client);

  if (!success) {
    await safe_reply_ephemeral(interaction, {
      content: `${EMOJIS.ERROR} Não foi possível desbloquear o servidor. Verifique se tenho permissões suficientes.`,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle(`${EMOJIS.UNLOCK} Servidor Desbloqueado`)
    .setDescription('O servidor foi desbloqueado. Membros podem enviar mensagens novamente.')
    .addFields([{ name: 'Moderador', value: interaction.user.tag, inline: true }])
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  logger.info(`AntiRaid: servidor desbloqueado por ${interaction.user.tag} em ${interaction.guild.name}`);
}
