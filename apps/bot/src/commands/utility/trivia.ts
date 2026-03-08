import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import type { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';
import { aniListService } from '../../services/anilist.service';
import { logger } from '../../utils/logger';

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
    .setDescriptionLocalizations({ 'pt-BR': 'Jogue um Quiz Rápido de Anime/Mangá (AniList)' }),

  async execute(interaction: ChatInputCommandInteraction) {
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
           await btnInteraction.reply({ content: 'Você não iniciou esta partida de Trivia!', ephemeral: true });
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

           await interaction.editReply({ embeds: [embed], components: [disabledRow] }).catch(() => {});
        }
      });

    } catch (e) {
      logger.error({ err: e }, 'Erro ao gerar Trivia do AniList');
      await interaction.editReply({ content: `${EMOJIS.ERROR} Ocorreu um erro ao comunicar com a base de Quizzes.` });
    }
  },
};
