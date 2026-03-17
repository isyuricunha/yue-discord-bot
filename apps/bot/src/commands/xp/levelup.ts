import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js'
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js'

import { prisma } from '@yuebot/database'
import {
  COLORS,
  EMOJIS,
  pick_discord_message_template_variant,
  render_discord_message_template,
} from '@yuebot/shared'

import type { Command } from '../index'
import { xpService } from '../../services/xp.service'
import { safe_reply_ephemeral } from '../../utils/interaction'

function get_optional_text_channel_id(
  interaction: ChatInputCommandInteraction,
  name: string,
): string | null {
  const channel = interaction.options.getChannel(name)
  if (!channel) return null

  const allowed = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement])
  if (!allowed.has(channel.type)) return null

  return channel.id
}

export const levelUpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('nivel')
    .setNameLocalizations({ 'en-US': 'levelup', 'pt-BR': 'nivel' })
    .setDescription('Configure level up messages')
    .setDescriptionLocalizations({
      'en-US': 'Configure level up messages',
      'pt-BR': 'Configure as mensagens de level up',
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('ativar')
        .setNameLocalizations({ 'en-US': 'enable', 'pt-BR': 'ativar' })
        .setDescription('Enable level up messages')
        .setDescriptionLocalizations({
          'en-US': 'Enable level up messages',
          'pt-BR': 'Ativar mensagens de level up',
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('desativar')
        .setNameLocalizations({ 'en-US': 'disable', 'pt-BR': 'desativar' })
        .setDescription('Disable level up messages')
        .setDescriptionLocalizations({
          'en-US': 'Disable level up messages',
          'pt-BR': 'Desativar mensagens de level up',
        }),
    )
    .addSubcommand((sub) =>
      sub
        .setName('canal')
        .setNameLocalizations({ 'en-US': 'channel', 'pt-BR': 'canal' })
        .setDescription('Set the channel for level up messages')
        .setDescriptionLocalizations({
          'en-US': 'Set the channel for level up messages',
          'pt-BR': 'Definir o canal para mensagens de level up',
        })
        .addChannelOption((opt) =>
          opt
            .setName('canal')
            .setNameLocalizations({ 'en-US': 'channel', 'pt-BR': 'canal' })
            .setDescription('Channel for level up messages (leave empty to clear)')
            .setDescriptionLocalizations({
              'en-US': 'Channel for level up messages (leave empty to clear)',
              'pt-BR': 'Canal para mensagens de level up (deixe vazio para limpar)',
            })
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('mensagem')
        .setNameLocalizations({ 'en-US': 'message', 'pt-BR': 'mensagem' })
        .setDescription('Set custom level up message template')
        .setDescriptionLocalizations({
          'en-US': 'Set custom level up message template',
          'pt-BR': 'Definir template de mensagem de level up',
        })
        .addStringOption((opt) =>
          opt
            .setName('template')
            .setNameLocalizations({ 'en-US': 'template', 'pt-BR': 'template' })
            .setDescription('Message template (leave empty to reset to default)')
            .setDescriptionLocalizations({
              'en-US': 'Message template (leave empty to reset to default)',
              'pt-BR': 'Template de mensagem (deixe vazio para redefinir para padrão)',
            })
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('teste')
        .setNameLocalizations({ 'en-US': 'test', 'pt-BR': 'teste' })
        .setDescription('Send a test level up message')
        .setDescriptionLocalizations({
          'en-US': 'Send a test level up message',
          'pt-BR': 'Enviar uma mensagem de teste de level up',
        }),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId

    if (!guildId) {
      await safe_reply_ephemeral(interaction, {
        content: `${EMOJIS.ERROR} Use este comando em um servidor.`,
      })
      return
    }

    const sub = interaction.options.getSubcommand()

    try {
      if (sub === 'ativar') {
        await prisma.guildXpConfig.upsert({
          where: { guildId },
          update: { levelUpEnabled: true },
          create: { guildId, levelUpEnabled: true },
        })

        xpService.clear_cache(guildId)

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Mensagens de level up ativadas!`)
          .setDescription('As mensagens de level up foram ativadas.')

        await interaction.reply({ embeds: [embed] })
        return
      }

      if (sub === 'desativar') {
        await prisma.guildXpConfig.upsert({
          where: { guildId },
          update: { levelUpEnabled: false },
          create: { guildId, levelUpEnabled: false },
        })

        xpService.clear_cache(guildId)

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Mensagens de level up desativadas!`)
          .setDescription('As mensagens de level up foram desativadas.')

        await interaction.reply({ embeds: [embed] })
        return
      }

      if (sub === 'canal') {
        const channel_id = get_optional_text_channel_id(interaction, 'canal')

        await prisma.guildXpConfig.upsert({
          where: { guildId },
          update: { levelUpChannelId: channel_id },
          create: { guildId, levelUpChannelId: channel_id },
        })

        xpService.clear_cache(guildId)

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Canal de level up atualizado`)
          .setDescription(
            channel_id ? `<#${channel_id}>` : '**(limpo)**',
          )

        await interaction.reply({ embeds: [embed] })
        return
      }

      if (sub === 'mensagem') {
        const template = interaction.options.getString('template')

        await prisma.guildXpConfig.upsert({
          where: { guildId },
          update: { levelUpMessage: template },
          create: { guildId, levelUpMessage: template },
        })

        xpService.clear_cache(guildId)

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Template de level up atualizado`)
          .setDescription(
            template
              ? `Template definido: \`${template}\``
              : '**(resetado para padrão)**',
          )
          .addFields([
            {
              name: 'Variáveis disponíveis',
              value: '{user}, {user.username}, {user.id}, {level}, {prevLevel}, {xp}, {xpNeeded}, {ranking}',
              inline: false,
            },
          ])

        await interaction.reply({ embeds: [embed] })
        return
      }

      if (sub === 'teste') {
        const config = await prisma.guildXpConfig.findUnique({
          where: { guildId },
        })

        const channel_id = config?.levelUpChannelId

        if (!channel_id) {
          const embed = new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle(`${EMOJIS.ERROR} Canal não configurado`)
            .setDescription(
              'Configure um canal primeiro usando `/nivel canal <#canal>`',
            )

          await interaction.reply({ embeds: [embed] })
          return
        }

        const channel = await interaction.guild?.channels
          .fetch(channel_id)
          .catch(() => null)

        if (!channel || !channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle(`${EMOJIS.ERROR} Canal não encontrado`)
            .setDescription('O canal configurado não foi encontrado.')

          await interaction.reply({ embeds: [embed] })
          return
        }

        const member = interaction.member as GuildMember
        const user = interaction.user
        const template = config?.levelUpMessage
        const test_level = 5

        const rendered = template
          ? render_discord_message_template(
              pick_discord_message_template_variant(template),
              {
                user: {
                  id: user.id,
                  username: user.username,
                  tag: user.tag,
                  avatarUrl: user.displayAvatarURL(),
                  nickname: member?.nickname ?? undefined,
                },
                guild: {
                  id: interaction.guild!.id,
                  name: interaction.guild!.name,
                  memberCount: interaction.guild!.memberCount,
                  iconUrl: interaction.guild!.iconURL() ?? undefined,
                },
                level: test_level,
                xp: test_level * 1000,
                experience: {
                  ranking: 1,
                  nextLevel: {
                    level: test_level + 1,
                    totalXp: (test_level + 1) * 1000,
                    requiredXp: 1000,
                  },
                },
              },
            )
          : {
              content: `<@${user.id}> atingiu o nível ${test_level}!`,
            }

        await channel.send(rendered)

        const embed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle(`${EMOJIS.SUCCESS} Mensagem de teste enviada`)
          .setDescription(`Mensagem enviada para <#${channel_id}>`)

        await interaction.reply({ embeds: [embed] })
        return
      }

      await interaction.reply({ content: `${EMOJIS.ERROR} Subcomando inválido.` })
    } catch (error) {
      await interaction.reply({
        content: `${EMOJIS.ERROR} Erro ao salvar configurações.`,
      })
      throw error
    }
  },
}
