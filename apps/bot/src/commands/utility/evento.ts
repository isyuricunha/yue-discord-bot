import { DateTime } from 'luxon'
import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js'
import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js'

import { prisma } from '@yuebot/database'
import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from '../index'

const INPUT_MAX_TITLE = 100
const INPUT_MAX_DESC = 2000

function clamp_string(input: string, max_len: number) {
  return input.length > max_len ? input.slice(0, max_len) : input
}

function clamp_autocomplete_name(input: string): string {
  return clamp_string(input, 100)
}

async function get_guild_timezone(guild_id: string) {
  const row = await prisma.guildConfig.findUnique({
    where: { guildId: guild_id },
    select: { timezone: true },
  })

  const configured = row?.timezone || 'America/Sao_Paulo'
  const probe = DateTime.now().setZone(configured)
  if (!probe.isValid) return 'America/Sao_Paulo'
  return configured
}

function parse_local_datetime(input: string, zone: string): DateTime | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const formats = [
    "yyyy-MM-dd HH:mm",
    "yyyy-MM-dd HH:mm:ss",
    "dd/MM/yyyy HH:mm",
    "dd/MM/yyyy HH:mm:ss",
  ]

  for (const fmt of formats) {
    const dt = DateTime.fromFormat(trimmed, fmt, { zone })
    if (dt.isValid) return dt
  }

  return null
}

function compute_reminder_at(starts_at: Date, minutes_before: number) {
  return new Date(starts_at.getTime() - minutes_before * 60 * 1000)
}

function maybe_set_reminder_flags(starts_at: Date, now: Date) {
  const reminder24hAt = compute_reminder_at(starts_at, 24 * 60)
  const reminder1hAt = compute_reminder_at(starts_at, 60)
  const reminder10mAt = compute_reminder_at(starts_at, 10)

  return {
    reminder24hAt,
    reminder1hAt,
    reminder10mAt,
    reminder24hSent: reminder24hAt <= now,
    reminder1hSent: reminder1hAt <= now,
    reminder10mSent: reminder10mAt <= now,
  }
}

export const eventoCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Agenda do servidor: eventos e lembretes')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('criar')
        .setDescription('Criar um evento agendado')
        .addStringOption((opt) =>
          opt
            .setName('titulo')
            .setDescription('Título do evento')
            .setRequired(true)
            .setMaxLength(INPUT_MAX_TITLE)
        )
        .addStringOption((opt) =>
          opt
            .setName('data_hora')
            .setDescription('Data e hora no timezone do servidor (ex: 2026-01-03 20:00 ou 03/01/2026 20:00)')
            .setRequired(true)
            .setMaxLength(32)
        )
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setDescription('Canal onde os lembretes serão enviados')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('descricao')
            .setDescription('Descrição (opcional)')
            .setRequired(false)
            .setMaxLength(INPUT_MAX_DESC)
        )
    )
    .addSubcommand((sub) => sub.setName('listar').setDescription('Listar próximos eventos'))
    .addSubcommand((sub) =>
      sub
        .setName('cancelar')
        .setDescription('Cancelar um evento')
        .addStringOption((opt) =>
          opt
            .setName('event_id')
            .setDescription('ID do evento')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) {
      await interaction.respond([])
      return
    }

    const focused = interaction.options.getFocused(true)
    if (focused.name !== 'event_id') {
      await interaction.respond([])
      return
    }

    const query = typeof focused.value === 'string' ? focused.value.trim() : ''

    const where = {
      guildId: interaction.guildId,
      cancelled: false,
      ...(query
        ? {
            OR: [
              { id: { contains: query } },
              { title: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const events = await prisma.scheduledEvent.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      take: 25,
      select: { id: true, title: true, startsAt: true },
    })

    await interaction.respond(
      events.map((e) => ({
        name: clamp_autocomplete_name(`${e.title} — ${e.id}`),
        value: e.id,
      }))
    )
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: `${EMOJIS.ERROR} Use isso em um servidor.`, ephemeral: true })
      return
    }

    const sub = interaction.options.getSubcommand()

    if (sub === 'listar') {
      await interaction.deferReply({ ephemeral: true })

      const now = new Date()
      const rows = await prisma.scheduledEvent.findMany({
        where: {
          guildId: interaction.guild.id,
          cancelled: false,
          startsAt: { gt: now },
        },
        orderBy: { startsAt: 'asc' },
        take: 15,
        select: { id: true, title: true, startsAt: true, channelId: true },
      })

      const lines = rows.map((e) => {
        const ts = Math.floor(new Date(e.startsAt).getTime() / 1000)
        return `- \`${e.id}\` — **${e.title}** — <t:${ts}:F> (<t:${ts}:R>) — <#${e.channelId}>`
      })

      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('📅 Próximos eventos')
        .setDescription(lines.length > 0 ? lines.join('\n') : 'Nenhum evento agendado.')

      await interaction.editReply({ embeds: [embed] })
      return
    }

    if (sub === 'cancelar') {
      await interaction.deferReply({ ephemeral: true })

      const event_id = interaction.options.getString('event_id', true).trim()
      const existing = await prisma.scheduledEvent.findUnique({
        where: { id: event_id },
        select: { id: true, guildId: true, cancelled: true, title: true },
      })

      if (!existing || existing.guildId !== interaction.guild.id) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Evento não encontrado.` })
        return
      }

      if (existing.cancelled) {
        await interaction.editReply({ content: `${EMOJIS.INFO} Este evento já estava cancelado.` })
        return
      }

      await prisma.scheduledEvent.update({
        where: { id: existing.id },
        data: { cancelled: true },
      })

      await interaction.editReply({ content: `${EMOJIS.SUCCESS} Evento cancelado: **${existing.title}** (\`${existing.id}\`)` })
      return
    }

    if (sub === 'criar') {
      await interaction.deferReply({ ephemeral: true })

      const title_raw = interaction.options.getString('titulo', true)
      const date_time_raw = interaction.options.getString('data_hora', true)
      const description_raw = interaction.options.getString('descricao')
      const channel = interaction.options.getChannel('canal', true)

      if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Canal inválido.` })
        return
      }

      const guild_tz = await get_guild_timezone(interaction.guild.id)

      const dt = parse_local_datetime(date_time_raw, guild_tz)
      if (!dt) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Data/hora inválida. Use: 2026-01-03 20:00 ou 03/01/2026 20:00` })
        return
      }

      if (!dt.isValid) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} Data/hora inválida: ${dt.invalidReason ?? 'unknown'}` })
        return
      }

      const starts_at = dt.toUTC().toJSDate()
      const now = new Date()

      if (starts_at.getTime() <= now.getTime() + 60 * 1000) {
        await interaction.editReply({ content: `${EMOJIS.ERROR} O evento precisa ser no futuro (>= 1 minuto).` })
        return
      }

      const title = clamp_string(title_raw.trim(), INPUT_MAX_TITLE)
      const description = description_raw ? clamp_string(description_raw.trim(), INPUT_MAX_DESC) : null

      const reminders = maybe_set_reminder_flags(starts_at, now)

      const created = await prisma.scheduledEvent.create({
        data: {
          guildId: interaction.guild.id,
          channelId: channel.id,
          creatorId: interaction.user.id,
          title,
          description,
          startsAt: starts_at,
          reminder24hSent: reminders.reminder24hSent,
          reminder1hSent: reminders.reminder1hSent,
          reminder10mSent: reminders.reminder10mSent,
          reminder24hAt: reminders.reminder24hAt,
          reminder1hAt: reminders.reminder1hAt,
          reminder10mAt: reminders.reminder10mAt,
        },
        select: { id: true, startsAt: true },
      })

      const starts_ts = Math.floor(new Date(created.startsAt).getTime() / 1000)
      const embed = new EmbedBuilder()
        .setColor(COLORS.SUCCESS)
        .setTitle(`${EMOJIS.SUCCESS} Evento criado`) 
        .setDescription(
          `**${title}**\n` +
            `ID: \`${created.id}\`\n` +
            `Canal: <#${channel.id}>\n` +
            `Começa: <t:${starts_ts}:F> (<t:${starts_ts}:R>)\n` +
            `Timezone: \`${guild_tz}\``
        )

      await interaction.editReply({ embeds: [embed] })
      return
    }

    await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.`, ephemeral: true })
  },
}
