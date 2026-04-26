import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '@yuebot/database';
import { COLORS, EMOJIS } from '@yuebot/shared';
import type { Command } from '../index';
import { logger } from '../../utils/logger';

const GAME_EMOJI = '🎮';
const GOLD_COLOR = 0xFFD700;

interface UserStatsData {
  globalXp: {
    level: number;
    xp: number;
    xpToNextLevel: number;
    progressPercentage: number;
  } | null;
  guildXp: {
    level: number;
    xp: number;
    guildName: string;
  } | null;
  wallet: {
    balance: bigint;
    bankBalance: bigint;
    totalBalance: bigint;
  } | null;
  trivia: {
    correctAnswers: number;
    score: number;
    rank?: number;
  } | null;
  waifu: {
    count: number;
    totalAvailable: number;
  };
  pets: {
    count: number;
  };
  badges: {
    count: number;
    totalAvailable: number;
  };
  profile?: {
    bio?: string;
  };
  userCreatedAt: Date;
}

async function getUserStatsData(userId: string): Promise<UserStatsData> {
  const [
    globalXpData,
    guildXpData,
    walletData,
    triviaData,
    waifuCount,
    petCount,
    badgesCount,
    userProfile
  ] = await Promise.all([
    prisma.globalXpMember.findUnique({
      where: { userId },
      select: {
        level: true,
        xp: true
      }
    }),
    prisma.guildXpMember.findFirst({
      where: { userId },
      select: {
        level: true,
        xp: true,
        guild: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.wallet.findUnique({
      where: { userId },
      select: {
        balance: true,
        bankBalance: true
      }
    }),
    prisma.triviaStat.findUnique({
      where: { userId },
      select: {
        correctAnswers: true,
        score: true
      }
    }),
    prisma.waifuUserState.count({
      where: { userId }
    }),
    prisma.pet.count({
      where: { userId }
    }),
    prisma.userBadge.count({
      where: { userId }
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: {
        bio: true
      }
    })
  ]);

  // Calculate total waifus available
  const totalWaifus = await prisma.waifuCharacter.count();

  // Calculate total badges available
  const totalBadges = await prisma.badge.count();

  // Calculate XP to next level
  let xpToNextLevel = 0;
  let progressPercentage = 0;

  if (globalXpData) {
    const nextLevelXp = Math.floor(1000 * Math.pow(1.5, globalXpData.level));
    xpToNextLevel = nextLevelXp - globalXpData.xp;
    progressPercentage = Math.min(100, Math.floor((globalXpData.xp / nextLevelXp) * 100));
  }

  return {
    globalXp: globalXpData ? {
      level: globalXpData.level,
      xp: globalXpData.xp,
      xpToNextLevel,
      progressPercentage
    } : null,
    guildXp: guildXpData ? {
      level: guildXpData.level,
      xp: guildXpData.xp,
      guildName: guildXpData.guild.name
    } : null,
    wallet: walletData ? {
      balance: walletData.balance,
      bankBalance: walletData.bankBalance,
      totalBalance: walletData.balance + walletData.bankBalance
    } : null,
    trivia: triviaData ? {
      correctAnswers: triviaData.correctAnswers,
      score: triviaData.score
    } : null,
    waifu: {
      count: waifuCount,
      totalAvailable: totalWaifus
    },
    pets: {
      count: petCount
    },
    badges: {
      count: badgesCount,
      totalAvailable: totalBadges
    },
    profile: userProfile ? {
      bio: userProfile.bio ?? undefined
    } : undefined,
    userCreatedAt: new Date()
  };
}

function formatNumber(num: bigint | number): string {
  if (typeof num === 'bigint') {
    return num.toString();
  }
  return num.toLocaleString('pt-BR');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function createProgressBar(percentage: number, width: number = 10): string {
  const filled = Math.round(width * (percentage / 100));
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}

export const estatisticasCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('estatisticas')
    .setNameLocalizations({ 'pt-BR': 'estatísticas' })
    .setDescription('Veja suas estatísticas pessoais no Yue Bot')
    .setDescriptionLocalizations({ 'pt-BR': 'Veja suas estatísticas pessoais no Yue Bot' })
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand(subcommand =>
      subcommand
        .setName('perfil')
        .setNameLocalizations({ 'pt-BR': 'perfil' })
        .setDescription('Visão geral completa das suas estatísticas')
        .setDescriptionLocalizations({ 'pt-BR': 'Visão geral completa das suas estatísticas' })
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('xp')
        .setNameLocalizations({ 'pt-BR': 'xp' })
        .setDescription('Detalhes sobre seu progresso de XP')
        .setDescriptionLocalizations({ 'pt-BR': 'Detalhes sobre seu progresso de XP' })
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('economia')
        .setNameLocalizations({ 'pt-BR': 'economia' })
        .setDescription('Informações sobre sua economia no bot')
        .setDescriptionLocalizations({ 'pt-BR': 'Informações sobre sua economia no bot' })
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('jogos')
        .setNameLocalizations({ 'pt-BR': 'jogos' })
        .setDescription('Estatísticas dos seus jogos')
        .setDescriptionLocalizations({ 'pt-BR': 'Estatísticas dos seus jogos' })
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('conquistas')
        .setNameLocalizations({ 'pt-BR': 'conquistas' })
        .setDescription('Suas conquistas e badges')
        .setDescriptionLocalizations({ 'pt-BR': 'Suas conquistas e badges' })
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
      const statsData = await getUserStatsData(userId);

      if (subcommand === 'perfil') {
        const embed = new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setTitle(`${interaction.user.username}'s Estatísticas`)
          .setThumbnail(interaction.user.displayAvatarURL())
          .setDescription(`${EMOJIS.INFO} **Visão geral completa dos seus dados no Yue Bot**`)
          .addFields([
            {
              name: '🏆 Nível Global',
              value: statsData.globalXp ? `Level ${statsData.globalXp.level}` : 'Nenhum XP registrado',
              inline: true
            },
            {
              name: '💰 Luazinhas',
              value: statsData.wallet ? formatNumber(statsData.wallet.balance) : '0',
              inline: true
            },
            {
              name: '🏦 Banco',
              value: statsData.wallet ? formatNumber(statsData.wallet.bankBalance) : '0',
              inline: true
            },
            {
              name: '🎮 Waifus',
              value: `${statsData.waifu.count}/${statsData.waifu.totalAvailable}`,
              inline: true
            },
            {
              name: '🐕 Pets',
              value: formatNumber(statsData.pets.count),
              inline: true
            },
            {
              name: '🏅 Badges',
              value: `${statsData.badges.count}/${statsData.badges.totalAvailable}`,
              inline: true
            },
            {
              name: '📅 Membro desde',
              value: formatDate(statsData.userCreatedAt),
              inline: false
            }
          ]);

        if (statsData.profile?.bio) {
          embed.addFields({
            name: '📝 Sobre você',
            value: statsData.profile.bio.substring(0, 1024),
            inline: false
          });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      else if (subcommand === 'xp') {
        if (!statsData.globalXp) {
          await interaction.reply({
            content: `${EMOJIS.ERROR} Você ainda não tem XP registrado. Interaja mais no servidor para ganhar XP!`,
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${interaction.user.username} - Progresso de XP`)
          .setDescription(`${EMOJIS.TROPHY} **Seu progresso no sistema de XP**`)
          .addFields([
            {
              name: '📊 Nível Atual',
              value: `Level ${statsData.globalXp.level}`,
              inline: true
            },
            {
              name: '💯 XP Atual',
              value: `${formatNumber(statsData.globalXp.xp)} XP`,
              inline: true
            },
            {
              name: '🎯 Próximo Level',
              value: `${formatNumber(statsData.globalXp.xpToNextLevel)} XP restantes`,
              inline: true
            },
            {
              name: '📈 Progresso',
              value: createProgressBar(statsData.globalXp.progressPercentage),
              inline: false
            }
          ]);

        if (statsData.guildXp) {
          embed.addFields({
            name: '🏛️ XP no Servidor',
            value: `Level ${statsData.guildXp.level} em ${statsData.guildXp.guildName}`,
            inline: false
          });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      else if (subcommand === 'economia') {
        if (!statsData.wallet) {
          await interaction.reply({
            content: `${EMOJIS.ERROR} Você ainda não tem uma carteira registrada. Use comandos como /daily ou /trivia para começar a ganhar Luazinhas!`,
            ephemeral: true
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(COLORS.WARNING)
          .setTitle(`${interaction.user.username} - Economia`)
          .setDescription(`${EMOJIS.MONEY} **Seu saldo e transações financeiras**`)
          .addFields([
            {
              name: '💰 Carteira',
              value: `${formatNumber(statsData.wallet.balance)} Luazinhas`,
              inline: true
            },
            {
              name: '🏦 Banco',
              value: `${formatNumber(statsData.wallet.bankBalance)} Luazinhas`,
              inline: true
            },
            {
              name: '💵 Total',
              value: `${formatNumber(statsData.wallet.totalBalance)} Luazinhas`,
              inline: false
            }
          ]);

        // Get recent transactions
        const recentTransactions = await prisma.luazinhaTransaction.findMany({
          where: {
            OR: [
              { toUserId: userId },
              { fromUserId: userId }
            ]
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            type: true,
            amount: true,
            reason: true,
            fromUserId: true,
            toUserId: true,
            createdAt: true
          }
        });

        if (recentTransactions.length > 0) {
          const transactionTexts = recentTransactions.map(tx => {
            const amountStr = tx.amount.toString();
            const direction = tx.toUserId === userId ? '🟢 Recebido' : '🔴 Enviado';
            const reason = tx.reason ? ` - ${tx.reason}` : '';
            return `${direction} ${amountStr} Luazinhas${reason}\n${tx.createdAt.toLocaleDateString('pt-BR')}`;
          }).join('\n\n');

          embed.addFields({
            name: '📜 Transações Recentes',
            value: transactionTexts,
            inline: false
          });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      else if (subcommand === 'jogos') {
        const embed = new EmbedBuilder()
          .setColor(COLORS.INFO)
          .setTitle(`${interaction.user.username} - Jogos`)
          .setDescription(`${GAME_EMOJI} **Suas estatísticas nos jogos do bot**`);

        const fields: any[] = [];

        if (statsData.trivia) {
          fields.push({
            name: '🎯 Trivia',
            value: `✅ ${statsData.trivia.correctAnswers} acertos\n🏆 ${statsData.trivia.score} pontos`,
            inline: true
          });
        }

        fields.push(
          {
            name: '🎮 Waifu',
            value: `👥 ${statsData.waifu.count} personagens`,
            inline: true
          },
          {
            name: '🐕 Pets',
            value: `🐶 ${statsData.pets.count} pets`,
            inline: true
          }
        );

        embed.addFields(fields);

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

      else if (subcommand === 'conquistas') {
        const embed = new EmbedBuilder()
          .setColor(GOLD_COLOR)
          .setTitle(`${interaction.user.username} - Conquistas`)
          .setDescription(`${EMOJIS.TROPHY} **Suas conquistas e badges**`);

        if (statsData.badges.count === 0) {
          embed.setDescription(`${EMOJIS.INFO} Você ainda não conquistou nenhuma badge. Continue interagindo para desbloquear novas conquistas!`);
        } else {
          embed.addFields({
            name: '🏅 Badges Conquistadas',
            value: `Você tem ${statsData.badges.count} de ${statsData.badges.totalAvailable} badges disponíveis`,
            inline: false
          });

          // Get user badges with badge details
          const userBadges = await prisma.userBadge.findMany({
            where: { userId },
            include: {
              badge: {
                select: {
                  name: true,
                  description: true,
                  icon: true
                }
              }
            },
            take: 5
          });

          if (userBadges.length > 0) {
            const badgeTexts = userBadges.map(badge => {
              return `**${badge.badge.icon || '🏅'} ${badge.badge.name}**\n${badge.badge.description || 'Sem descrição'}`;
            }).join('\n\n');

            embed.addFields({
              name: '🔝 Top 5 Badges',
              value: badgeTexts,
              inline: false
            });
          }
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }

    } catch (error) {
      logger.error({ error, userId }, 'Erro ao obter estatísticas do usuário');
      await interaction.reply({
        content: `${EMOJIS.ERROR} Ocorreu um erro ao buscar suas estatísticas. Tente novamente mais tarde.`,
        ephemeral: true
      });
    }
  },
};

export default estatisticasCommand;