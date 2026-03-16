import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../index';
import { EMOJIS } from '@yuebot/shared';
import { prisma } from '@yuebot/database';

import { djModeService } from '../../services/dj_mode.service';

const default_dj_playlist_url = 'https://open.spotify.com/playlist/6AgTejd48A5gixBakDxY5y?si=e19ea44d2f4f447c';

function can_manage_dj(interaction: { memberPermissions?: Readonly<import('discord.js').PermissionsBitField> | null }): boolean {
  const perms = interaction.memberPermissions;
  if (!perms) return false;
  return perms.has(PermissionFlagsBits.Administrator) || perms.has(PermissionFlagsBits.ManageGuild);
}

const djCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('dj')
    .setDescription('Modo DJ 24h: mantém uma playlist tocando infinitamente')
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Inicia o modo DJ no seu canal de voz')
        .addStringOption((opt) =>
          opt
            .setName('url')
            .setDescription('URL da playlist (opcional; se vazio usa a default/configurada)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('stop')
        .setDescription('Para o modo DJ e encerra o player')
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Mostra o status do modo DJ')
    )
    .addSubcommand((sub) =>
      sub
        .setName('set-default')
        .setDescription('Define a playlist default do servidor para o modo DJ')
        .addStringOption((opt) =>
          opt
            .setName('url')
            .setDescription('URL da playlist')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    if (!interaction.guildId || !interaction.guild) return;

    const sub = interaction.options.getSubcommand(true);

    if (!can_manage_dj(interaction)) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você precisa de permissão de **Administrador** ou **Gerenciar Servidor** para usar o modo DJ.`,
        ephemeral: true,
      });
      return;
    }

    if (!djModeService) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} O sistema de música não está habilitado.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'set-default') {
      const url_raw = interaction.options.getString('url', true);
      const url = url_raw.trim();
      if (!/^https?:\/\//i.test(url) || url.length > 2048) {
        await interaction.reply({
          content: `${EMOJIS.ERROR} URL inválida.`,
          ephemeral: true,
        });
        return;
      }

      await prisma.guildDjConfig.upsert({
        where: { guildId: interaction.guildId },
        update: { defaultPlaylistUrl: url },
        create: { guildId: interaction.guildId, defaultPlaylistUrl: url },
      });

      await interaction.reply({
        content: `${EMOJIS.SUCCESS} Playlist default do DJ atualizada.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'status') {
      const cfg = await prisma.guildDjConfig.findUnique({
        where: { guildId: interaction.guildId },
        select: {
          enabled: true,
          voiceChannelId: true,
          textChannelId: true,
          playlistUrl: true,
          defaultPlaylistUrl: true,
        },
      });

      const enabled = Boolean(cfg?.enabled);
      const effective_url = (cfg?.playlistUrl ?? cfg?.defaultPlaylistUrl ?? default_dj_playlist_url) ?? default_dj_playlist_url;

      await interaction.reply({
        content:
          `${enabled ? EMOJIS.SUCCESS : EMOJIS.ERROR} **DJ 24h:** ${enabled ? 'ligado' : 'desligado'}\n` +
          `**Voice:** ${cfg?.voiceChannelId ? `<#${cfg.voiceChannelId}>` : 'não configurado'}\n` +
          `**Texto:** ${cfg?.textChannelId ? `<#${cfg.textChannelId}>` : 'não configurado'}\n` +
          `**Playlist:** ${effective_url}`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'stop') {
      await djModeService.stop(interaction.guildId);

      await interaction.reply({
        content: `${EMOJIS.SUCCESS} DJ 24h desligado.`,
        ephemeral: true,
      });
      return;
    }

    // start
    const member = interaction.guild.members.cache.get(interaction.user.id) ?? null;
    const voice_channel_id = member?.voice?.channelId ?? null;
    if (!voice_channel_id) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Você precisa estar em um canal de voz para iniciar o DJ.`,
        ephemeral: true,
      });
      return;
    }

    const url_opt = interaction.options.getString('url', false);
    const url = typeof url_opt === 'string' ? url_opt.trim() : '';
    if (url && (!/^https?:\/\//i.test(url) || url.length > 2048)) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} URL inválida.`,
        ephemeral: true,
      });
      return;
    }

    const existing = await prisma.guildDjConfig.findUnique({
      where: { guildId: interaction.guildId },
      select: { defaultPlaylistUrl: true },
    });

    const effective_url = (url || existing?.defaultPlaylistUrl || default_dj_playlist_url).trim();

    await djModeService.start(interaction.guildId, {
      voiceChannelId: voice_channel_id,
      textChannelId: interaction.channelId,
      playlistUrl: url || null,
    });

    await interaction.reply({
      content: `${EMOJIS.SUCCESS} DJ 24h ligado. Vou tocar infinitamente: ${effective_url}`,
      ephemeral: true,
    });

    // DJ mode started and will keep playing infinitely.
  },
};

export default djCommand;
