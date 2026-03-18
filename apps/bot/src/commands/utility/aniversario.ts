import { SlashCommandBuilder, EmbedBuilder, SlashCommandSubcommandBuilder, GuildMember } from 'discord.js';
import type { ChatInputCommandInteraction, User } from 'discord.js';

import { COLORS, EMOJIS } from '@yuebot/shared';

import type { Command } from '../index';
import {
  setBirthday,
  getBirthday,
  getUpcomingBirthdays,
  isValidBirthday,
  formatBirthdayDayMonth,
  calculateAge,
} from '../../services/birthday.service';
import { safe_reply_ephemeral } from '../../utils/interaction';

// Subcommand: configurar - Set birthday
const configurarSubcommand = new SlashCommandSubcommandBuilder()
  .setName('configurar')
  .setNameLocalizations({ 'pt-BR': 'configurar' })
  .setDescription('Set your birthday')
  .setDescriptionLocalizations({ 'pt-BR': 'Defina seu aniversário' })
  .addIntegerOption((option) =>
    option
      .setName('dia')
      .setNameLocalizations({ 'pt-BR': 'dia' })
      .setDescription('Day (1-31)')
      .setDescriptionLocalizations({ 'pt-BR': 'Dia (1-31)' })
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(31)
  )
  .addIntegerOption((option) =>
    option
      .setName('mes')
      .setNameLocalizations({ 'pt-BR': 'mes' })
      .setDescription('Month (1-12)')
      .setDescriptionLocalizations({ 'pt-BR': 'Mês (1-12)' })
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(12)
  )
  .addIntegerOption((option) =>
    option
      .setName('ano')
      .setNameLocalizations({ 'pt-BR': 'ano' })
      .setDescription('Year (optional)')
      .setDescriptionLocalizations({ 'pt-BR': 'Ano (opcional)' })
      .setRequired(false)
      .setMinValue(1900)
      .setMaxValue(new Date().getFullYear())
  );

// Subcommand: ver - View someone's birthday
const verSubcommand = new SlashCommandSubcommandBuilder()
  .setName('ver')
  .setNameLocalizations({ 'pt-BR': 'ver' })
  .setDescription("View someone's birthday")
  .setDescriptionLocalizations({ 'pt-BR': 'Ver aniversário de alguém' })
  .addUserOption((option) =>
    option
      .setName('usuario')
      .setNameLocalizations({ 'pt-BR': 'usuario' })
      .setDescription('User to view birthday')
      .setDescriptionLocalizations({ 'pt-BR': 'Usuário para ver o aniversário' })
      .setRequired(false)
  );

// Subcommand: proximos - Show upcoming birthdays
const proximosSubcommand = new SlashCommandSubcommandBuilder()
  .setName('proximos')
  .setNameLocalizations({ 'pt-BR': 'proximos' })
  .setDescription('Show upcoming birthdays in the server')
  .setDescriptionLocalizations({ 'pt-BR': 'Mostrar próximos aniversário do servidor' })
  .addIntegerOption((option) =>
    option
      .setName('dias')
      .setNameLocalizations({ 'pt-BR': 'dias' })
      .setDescription('Number of days to look ahead (default: 30)')
      .setDescriptionLocalizations({ 'pt-BR': 'Quantidade de dias para buscar (padrão: 30)' })
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(90)
  );

// Main command
export const aniversarioCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('aniversario')
    .setNameLocalizations({ 'pt-BR': 'aniversario' })
    .setDescription('Birthday system')
    .setDescriptionLocalizations({ 'pt-BR': 'Sistema de aniversário' })
    .addSubcommand(configurarSubcommand)
    .addSubcommand(verSubcommand)
    .addSubcommand(proximosSubcommand),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'configurar':
        return executeConfigurar(interaction);
      case 'ver':
        return executeVer(interaction);
      case 'proximos':
        return executeProximos(interaction);
      default:
        return interaction.reply({ content: 'Subcomando inválido.', ephemeral: true });
    }
  },
};

// Handler for configurar subcommand
async function executeConfigurar(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  const day = interaction.options.getInteger('dia', true);
  const month = interaction.options.getInteger('mes', true);
  const year = interaction.options.getInteger('ano') || undefined;

  // Validate birthday
  if (!isValidBirthday(day, month, year)) {
    await safe_reply_ephemeral(interaction, {
      content: `${EMOJIS.ERROR} Data de aniversário inválida. Por favor, verifique o dia e mês informados.`,
    });
    return;
  }

  try {
    await setBirthday(userId, day, month, year);

    const age = calculateAge(year || null);
    const birthdayText = formatBirthdayDayMonth(day, month);
    const yearText = year ? ` (${year})` : '';

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} Aniversário configurado!`)
      .setDescription(`Seu aniversário foi definido para **${birthdayText}**${yearText}`)
      .addFields(
        {
          name: 'Privacidade',
          value: year
            ? 'Sua idade não será mostrada aos outros, apenas o dia e mês.'
            : 'Como você não forneceu o ano, apenas dia e mês serão visíveis.',
          inline: false,
        }
      )
      .setTimestamp(new Date());

    if (age !== null) {
      embed.addFields([
        {
          name: 'Idade',
          value: `Você completou ${age} anos!`,
          inline: true,
        },
      ]);
    }

    await safe_reply_ephemeral(interaction, { embeds: [embed] });
  } catch (error) {
    console.error('Error setting birthday:', error);
    await safe_reply_ephemeral(interaction, {
      content: `${EMOJIS.ERROR} Ocorreu um erro ao salvar seu aniversário. Tente novamente.`,
    });
  }
}

// Handler for ver subcommand
async function executeVer(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await safe_reply_ephemeral(interaction, {
      content: `${EMOJIS.ERROR} Use este comando em um servidor.`,
    });
    return;
  }

  const targetUser = interaction.options.getUser('usuario') || interaction.user;
  const targetMember = interaction.options.getMember('usuario') as GuildMember | null;

  try {
    const birthday = await getBirthday(targetUser.id);

    if (!birthday) {
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Aniversário não configurado`)
        .setDescription(
          targetUser.id === interaction.user.id
            ? 'Você ainda não configurou seu aniversário. Use `/aniversario configurar` para adicionar!'
            : `${targetUser.username} ainda não configurou o aniversário.`
        )
        .setTimestamp(new Date());

      await safe_reply_ephemeral(interaction, { embeds: [embed] });
      return;
    }

    const birthdayText = formatBirthdayDayMonth(birthday.day, birthday.month);
    const displayName = targetMember?.displayName || targetUser.username;

    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`${EMOJIS.SUCCESS} Aniversário de ${displayName}`)
      .setDescription(`🎂 **${birthdayText}**`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setTimestamp(new Date());

    // If viewing own birthday, show age
    if (targetUser.id === interaction.user.id && birthday.year) {
      const age = calculateAge(birthday.year);
      if (age !== null) {
        embed.addFields([
          {
            name: 'Idade',
            value: `${age} anos`,
            inline: true,
          },
        ]);
      }
    }

    await safe_reply_ephemeral(interaction, { embeds: [embed] });
  } catch (error) {
    console.error('Error getting birthday:', error);
    await safe_reply_ephemeral(interaction, {
      content: `${EMOJIS.ERROR} Ocorreu um erro ao buscar o aniversário. Tente novamente.`,
    });
  }
}

// Handler for proximos subcommand
async function executeProximos(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId;
  if (!guildId) {
    await safe_reply_ephemeral(interaction, {
      content: `${EMOJIS.ERROR} Use este comando em um servidor.`,
    });
    return;
  }

  const daysAhead = interaction.options.getInteger('dias') || 30;

  try {
    const upcomingBirthdays = await getUpcomingBirthdays(guildId, daysAhead);

    if (upcomingBirthdays.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`${EMOJIS.INFO} Nenhum aniversário próximo`)
        .setDescription(
          `Não há aniversários próximos nos próximos ${daysAhead} dias neste servidor.`
        )
        .setTimestamp(new Date());

      await safe_reply_ephemeral(interaction, { embeds: [embed] });
      return;
    }

    // Group birthdays by days until
    const embed = new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`🎂 Próximos Aniversários`)
      .setDescription(
        `Aniversários nos próximos ${daysAhead} dias neste servidor:`
      )
      .setTimestamp(new Date());

    // Add fields for each birthday
    const now = new Date();
    const currentYear = now.getFullYear();

    for (const item of upcomingBirthdays.slice(0, 10)) {
      const birthdayText = formatBirthdayDayMonth(item.birthday.day, item.birthday.month);
      const daysUntil = getDaysUntil(currentYear, item.birthday.month, item.birthday.day);

      let dayText: string;
      if (daysUntil === 0) {
        dayText = '**HOJE!** 🎉';
      } else if (daysUntil === 1) {
        dayText = 'Amanhã!';
      } else {
        dayText = `Em ${daysUntil} dias`;
      }

      embed.addFields([
        {
          name: `${item.username}`,
          value: `${birthdayText} - ${dayText}`,
          inline: true,
        },
      ]);
    }

    if (upcomingBirthdays.length > 10) {
      embed.setFooter({ text: `E mais ${upcomingBirthdays.length - 10} aniversário(s)...` });
    }

    await safe_reply_ephemeral(interaction, { embeds: [embed] });
  } catch (error) {
    console.error('Error getting upcoming birthdays:', error);
    await safe_reply_ephemeral(interaction, {
      content: `${EMOJIS.ERROR} Ocorreu um erro ao buscar os próximos aniversários. Tente novamente.`,
    });
  }
}

// Helper function
function getDaysUntil(year: number, month: number, day: number): number {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth() + 1;

  if (month < currentMonth || (month === currentMonth && day < currentDay)) {
    // Birthday passed this year
    const nextBirthday = new Date(year + 1, month - 1, day);
    return Math.ceil((nextBirthday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    const birthdayDate = new Date(year, month - 1, day);
    return Math.ceil((birthdayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
}
