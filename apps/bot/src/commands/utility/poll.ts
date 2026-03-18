import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';
import type { ChatInputCommandInteraction, GuildTextBasedChannel } from 'discord.js';
import type { Command } from '../index';

import { parseDurationMs } from '@yuebot/shared';

import { pollService } from '../../services/poll.service';
import { safe_defer_ephemeral, safe_reply_ephemeral } from '../../utils/interaction';
import { logger } from '../../utils/logger';
import { safe_error_details } from '../../utils/safe_error';

const POLL_NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export const pollCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('enquete')
    .setDescription('Cria uma enquete')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('pergunta')
        .setDescription('A pergunta da enquete')
        .setRequired(true)
        .setMaxLength(256)
    )
    .addStringOption((option) =>
      option
        .setName('opcoes')
        .setDescription('Opções separadas por vírgula (mínimo 2, máximo 10)')
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addBooleanOption((option) =>
      option
        .setName('multiplo')
        .setDescription('Permitir múltiplas escolhas')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('duracao')
        .setDescription('Duração (ex: 1h, 24h, 7d)')
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName('canal')
        .setDescription('Canal onde a enquete será enviada')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildNews)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await safe_defer_ephemeral(interaction);

    const pergunta = interaction.options.getString('pergunta', true);
    const opcoesRaw = interaction.options.getString('opcoes', true);
    const multiplo = interaction.options.getBoolean('multiplo') ?? false;
    const duracao = interaction.options.getString('duracao');
    const canalOption = interaction.options.getChannel('canal');

    let canal: GuildTextBasedChannel | null = null;
    
    if (canalOption) {
      const guild = interaction.guild;
      if (guild) {
        const fetchedChannel = await guild.channels.fetch(canalOption.id).catch(() => null);
        if (fetchedChannel && fetchedChannel.isTextBased() && !fetchedChannel.isDMBased()) {
          canal = fetchedChannel as GuildTextBasedChannel;
        }
      }
    } else if (interaction.channel) {
      canal = interaction.channel as GuildTextBasedChannel;
    }

    if (!canal) {
      await safe_reply_ephemeral(interaction, { content: '❌ Canal inválido.' });
      return;
    }

    const opcoes = opcoesRaw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    if (opcoes.length < 2) {
      await safe_reply_ephemeral(interaction, { content: '❌ Você precisa de pelo menos 2 opções.' });
      return;
    }

    if (opcoes.length > 10) {
      await safe_reply_ephemeral(interaction, { content: '❌ Máximo de 10 opções permitidas.' });
      return;
    }

    let endsAt: Date;
    if (duracao) {
      const durationMs = parseDurationMs(duracao);
      if (!durationMs) {
        await safe_reply_ephemeral(interaction, { content: '❌ Formato de duração inválido. Use: 1h, 30m, 7d, etc.' });
        return;
      }
      endsAt = new Date(Date.now() + durationMs);
    } else {
      endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const pollOptions = opcoes.map((text, index) => ({
      id: index,
      text,
      votes: 0,
    }));

    const optionsText = pollOptions
      .map((opt, i) => `${POLL_NUMBER_EMOJIS[i]} **${opt.text}**`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('📊 ' + pergunta)
      .setDescription(optionsText)
      .setColor(Colors.Blue)
      .setFooter({
        text: `Votação ${multiplo ? '(múltipla)' : '(única)'} • Ends: ${endsAt.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}`,
      })
      .setTimestamp();

    try {
      const message = await (canal as GuildTextBasedChannel).send({
        embeds: [embed],
      });

      for (let i = 0; i < pollOptions.length; i++) {
        await message.react(POLL_NUMBER_EMOJIS[i]);
      }

      await pollService.createPoll({
        guildId: interaction.guildId!,
        channelId: canal.id,
        messageId: message.id,
        question: pergunta,
        options: pollOptions,
        multiVote: multiplo,
        endsAt,
        createdBy: interaction.user.id,
      });

      await safe_reply_ephemeral(interaction, { content: `✅ Enquete criada com sucesso! \n📊 Mensagem: ${message.url}` });
    } catch (error) {
      logger.error({ err: safe_error_details(error) }, 'Failed to create poll');
      await safe_reply_ephemeral(interaction, { content: '❌ Erro ao criar a enquete.' });
    }
  },
};
