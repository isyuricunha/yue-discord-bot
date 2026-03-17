import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';
import { aniListService } from '../../services/anilist.service';
import { logger } from '../../utils/logger';
import { safe_reply_ephemeral } from '../../utils/interaction';

function shuffle_array<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

export const triviaCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setNameLocalizations({ 'pt-BR': 'trivia' })
    .setDescription('Jogue um Quiz Rápido de Anime/Mangá (AniList)')
    .setDescriptionLocalizations({ 'pt-BR': 'Jogue um Quiz Rápido de Anime/Mangá (AniList)' })
    .addSubcommand((subcommand) =>
      subcommand
        .setName('play')
        .setNameLocalizations({ 'pt-BR': 'jogar' })
        .setDescription('Jogue uma Trivia de Anime/Mangá')
        .setDescriptionLocalizations({ 'pt-BR': 'Jogue uma Trivia de Anime/Mangá' })
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('leaderboard')
        .setNameLocalizations({ 'pt-BR': 'ranking' })
        .setDescription('Veja o ranking dos melhores jogadores de Trivia')
        .setDescriptionLocalizations({ 'pt-BR': 'Veja o ranking dos melhores jogadores de Trivia' })
        .addIntegerOption((option) =>
          option
            .setName('limite')
            .setNameLocalizations({ 'pt-BR': 'limite' })
            .setDescription('Quantidade de usuários a mostrar (1-25)')
            .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de usuários a mostrar (1-25)' })
            .setMinValue(1)
            .setMaxValue(25)
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'leaderboard') {
      return await handleLeaderboard(interaction);
    }

    // Default: play the trivia game
    await handlePlay(interaction);
  },
};

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  const limit = interaction.options.getInteger('limite') ?? 10;

  const rows = await prisma.triviaStat.findMany({
    orderBy: [{ score: 'desc' }, { correctAnswers: 'desc' }],
    take: limit,
  });

  if (rows.length === 0) {
    await interaction.reply({
      content: `${EMOJIS.INFO} Ainda não há jogadores no ranking de Trivia. Seja o primeiro a jogar!`,
    });
    return;
  }

  // Fetch usernames for each user
  const userIds = rows.map((r) => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true },
  });

  const usernameById = new Map(users.map((u) => [u.id, u.username]));

  // Fetch missing users from Discord
  const missing = userIds.filter((id) => !usernameById.has(id));
  if (missing.length > 0) {
    const fetched = await Promise.all(
      missing.map(async (id) => {
        const user = await interaction.client.users.fetch(id).catch(() => null);
        return user ? { id: user.id, username: user.username } : null;
      })
    );

    for (const item of fetched) {
      if (item) {
        usernameById.set(item.id, item.username);
      }
    }
  }

  const lines = rows.map((row, idx) => {
    const username = usernameById.get(row.userId) || `Usuário <${row.userId}>`;
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
    return `${medal} **${username}** — ${row.correctAnswers} acertos — ${row.score.toLocaleString('pt-BR')} pontos`;
  });

  const embed = new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle(`${EMOJIS.TROPHY} Ranking de Trivia`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Mostrando top ${rows.length}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handlePlay(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;

  try {
    // 1. Fetch random trending animes for choices
    const trending = await aniListService.trending_anime({ perPage: 25 });
    if (!trending || trending.length < 4) {
      return interaction.editReply({ content: `${EMOJIS.ERROR} Erro: Não foi possível obter animes suficientes para a Trivia.` });
    }

    const shuffledTrending = shuffle_array(trending);
    const correctAnswerItem = shuffledTrending[0];
    const wrongChoices = [shuffledTrending[1], shuffledTrending[2], shuffledTrending[3]];

    const get_title = (anime: any) => anime.title?.romaji || anime.title?.english || anime.title?.native || 'Desconhecido';

    const correctChoiceName = get_title(correctAnswerItem);

    // Select an alternate property from correctAnswerItem to hint the player.
    const hintDescription = correctAnswerItem.description
      ? correctAnswerItem.description.replace(/<[^>]+>/g, '').substring(0, 180) + '...'
      : 'Adivinhe o Anime a partir da imagem principal!';

    const imageCover = correctAnswerItem.coverImage?.extraLarge || correctAnswerItem.coverImage?.large;

    const choices = shuffle_array([
      { label: correctChoiceName, correct: true, id: 'choice_1' },
      { label: get_title(wrongChoices[0]), correct: false, id: 'choice_2' },
      { label: get_title(wrongChoices[1]), correct: false, id: 'choice_3' },
      { label: get_title(wrongChoices[2]), correct: false, id: 'choice_4' },
    ]);

    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('🧩 AniList Trivia')
      .setDescription(`Qual é o nome correto desse Anime? Você tem **15 segundos**!\n\n*Dica:*\n> ${hintDescription}`)
      .setFooter({ text: 'O acerto recompensa com Luazinhas e Pontos no Rank Trivia global!' });

    if (imageCover) {
      embed.setThumbnail(imageCover);
    }

    const row = new ActionRowBuilder<ButtonBuilder>();
    choices.forEach((choice) => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(choice.id)
          .setLabel(choice.label.substring(0, 80))
          .setStyle(ButtonStyle.Secondary)
      );
    });

    const message = await interaction.editReply({ embeds: [embed], components: [row] });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 15_000,
    });

    let answered = false;

    collector.on('collect', async (btnInteraction: ButtonInteraction) => {
      if (btnInteraction.user.id !== userId) {
        await safe_reply_ephemeral(btnInteraction, { content: 'Você não iniciou esta partida de Trivia!' });
        return;
      }

      answered = true;
      collector.stop();

      const selectedChoice = choices.find(c => c.id === btnInteraction.customId);
      const isCorrect = selectedChoice?.correct;

      // Ensure user is registered on the DB
      await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, username: interaction.user.username },
        update: {}
      });

      if (isCorrect) {
        const REWARD_AMOUNT = 35; // Default Luazinhas for Trivia Win

        // Add to Wallet and TriviaStats
        await prisma.$transaction([
          prisma.wallet.upsert({
            where: { userId },
            create: { userId, balance: REWARD_AMOUNT },
            update: { balance: { increment: REWARD_AMOUNT } }
          }),
          prisma.luazinhaTransaction.create({
            data: {
              type: 'TRIVIA_WIN',
              amount: REWARD_AMOUNT,
              toUserId: userId,
              reason: 'Acertou um quiz Trivia do AniList'
            }
          }),
          prisma.triviaStat.upsert({
            where: { userId },
            create: { userId, correctAnswers: 1, score: 10 },
            update: { correctAnswers: { increment: 1 }, score: { increment: 10 } }
          })
        ]);

        embed.setColor(COLORS.SUCCESS);
        embed.setDescription(`🎉 **Correto!** O anime é **${correctChoiceName}**!\nVocê ganhou **${REWARD_AMOUNT}** Luazinhas!`);
      } else {
        await prisma.triviaStat.upsert({
          where: { userId },
          create: { userId, wrongAnswers: 1 },
          update: { wrongAnswers: { increment: 1 } }
        });

        embed.setColor(COLORS.ERROR);
        embed.setDescription(`❌ **Errado!** Era **${correctChoiceName}**, mas você respondeu *${selectedChoice?.label}*!`);
      }

      // Disable and paint buttons
      const computedRow = new ActionRowBuilder<ButtonBuilder>();
      choices.forEach((choice) => {
        let style = ButtonStyle.Secondary;
        if (choice.correct) style = ButtonStyle.Success;
        else if (choice.id === btnInteraction.customId && !choice.correct) style = ButtonStyle.Danger;

        computedRow.addComponents(
          new ButtonBuilder()
            .setCustomId(choice.id)
            .setLabel(choice.label.substring(0, 80))
            .setStyle(style)
            .setDisabled(true)
        );
      });

      await btnInteraction.update({ embeds: [embed], components: [computedRow] });
    });

    collector.on('end', async (_, reason) => {
      if (!answered && reason === 'time') {
        embed.setColor(COLORS.ERROR);
        embed.setDescription(`⏰ **Tempo Esgotado!** A alternativa correta era **${correctChoiceName}**.`);

        const disabledRow = new ActionRowBuilder<ButtonBuilder>();
        choices.forEach((choice) => {
          disabledRow.addComponents(
            new ButtonBuilder()
              .setCustomId(choice.id)
              .setLabel(choice.label.substring(0, 80))
              .setStyle(choice.correct ? ButtonStyle.Success : ButtonStyle.Secondary)
              .setDisabled(true)
          );
        });

        await interaction.editReply({ embeds: [embed], components: [disabledRow] }).catch(() => { });
      }
    });

  } catch (e) {
    logger.error({ err: e }, 'Erro ao gerar Trivia do AniList');
    await interaction.editReply({ content: `${EMOJIS.ERROR} Ocorreu um erro ao comunicar com a base de Quizzes.` });
  }
}
