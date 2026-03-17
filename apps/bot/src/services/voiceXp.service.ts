import { VoiceState, EmbedBuilder } from 'discord.js'
import { prisma } from '@yuebot/database'
import { logger } from '../utils/logger'
import { getSendableChannel } from '../utils/discord'

class VoiceXpService {
  // O dicionário local fará cache de timestamps de entrada para evitar query intensa no banco em conexões curtas
  private voiceSessions = new Map<string, number>()

  /**
   * Identifica unicamente uma sessão no mapa
   */
  private getSessionKey(guildId: string, userId: string) {
    return `${guildId}:${userId}`
  }

  async handle_voice_state_update(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member || oldState.member
    if (!member) return

    const guildId = member.guild.id
    const userId = member.id
    const sessionKey = this.getSessionKey(guildId, userId)

    // Se ele está num canal e não mutado, e não estávamos trackeando:
    const isNowActive = newState.channelId !== null && !newState.mute && !newState.deaf
    const wasActive = oldState.channelId !== null && !oldState.mute && !oldState.deaf

    // State 1: Member joined a valid voice session
    if (isNowActive && !wasActive) {
      if (!this.voiceSessions.has(sessionKey)) {
         this.voiceSessions.set(sessionKey, Date.now())
      }
      // Send notification when user joins voice channel and voice XP is enabled
      await this.sendVoiceXpNotification(newState)
    }
    // State 2: Member left or muted/deafened themselves
    else if (!isNowActive && wasActive) {
      const startTime = this.voiceSessions.get(sessionKey)
      if (startTime) {
        this.voiceSessions.delete(sessionKey)
        const durationMs = Date.now() - startTime
        await this.grantVoiceXp(guildId, userId, member.user.username, durationMs, newState)
      }
    }
  }

  /**
   * Send a temporary notification when user joins voice channel
   * Shows current XP, level progress, and that they're earning XP
   */
  private async sendVoiceXpNotification(newState: VoiceState) {
    const member = newState.member
    if (!member) return

    const guildId = member.guild.id
    const userId = member.id

    try {
      // Check if voice XP is enabled
      const config = await prisma.guildXpConfig.findUnique({ where: { guildId } })
      if (!config || !config.enabled || !config.voiceXpEnabled) return

      // Get user's current XP data
      const memberXp = await prisma.guildXpMember.findUnique({
        where: { userId_guildId: { userId, guildId } }
      })

      const currentXp = memberXp?.xp ?? 0
      const currentLevel = memberXp?.level ?? Math.floor(currentXp / 1000)
      const xpForNextLevel = (currentLevel + 1) * 1000
      const xpProgress = currentXp % 1000
      const progressPercent = Math.floor((xpProgress / 1000) * 100)

      // Create the notification embed
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎤 XP de Voz Ativado!')
        .setDescription(`Você estáganhando XP enquanto fica em call!`)
        .addFields(
          { name: 'Nível Atual', value: `**${currentLevel}**`, inline: true },
          { name: 'XP Total', value: `**${currentXp.toLocaleString('pt-BR')}**`, inline: true },
          { name: 'Próximo Nível', value: `${xpProgress}/${xpForNextLevel} XP (${progressPercent}%)`, inline: false }
        )
        .setFooter({ text: 'Fique em call por pelo menos 1 minuto para ganhar XP!' })
        .setTimestamp()

      // Try to send DM to user (most reliable for ephemeral notification)
      try {
        const dmChannel = await member.user.createDM()
        const message = await dmChannel.send({ embeds: [embed] })
        
        // Delete the message after 10 seconds
        setTimeout(async () => {
          try {
            await message.delete()
          } catch {
            // Ignore errors when deleting
          }
        }, 10000)
      } catch {
        // If DM fails, try to send in the voice channel as a temporary message
        if (newState.channelId) {
          const channel = await newState.guild.channels.fetch(newState.channelId)
          if (channel && channel.isVoiceBased()) {
            // For voice channels, we can't send messages directly
            // So we'll skip this fallback as it's not ideal
          }
        }
      }
    } catch (error) {
      logger.error({ error, guildId, userId }, 'Error sending voice XP notification')
    }
  }

  private async grantVoiceXp(guildId: string, userId: string, username: string, durationMs: number, newState: VoiceState) {
    // Evitar conexões muito curtas (min: 1 minuto)
    if (durationMs < 60_000) return

    try {
      const config = await prisma.guildXpConfig.findUnique({ where: { guildId } })
      if (!config || !config.enabled || !config.voiceXpEnabled) return
      
      // Calculate amount of 10-minute chunks
      const tenMinuteChunks = Math.floor(durationMs / 600_000) 
      const spareMinutes = Math.floor((durationMs % 600_000) / 60_000)

      let gainedXp = 0
      
      if (tenMinuteChunks > 0) {
        // Full Reward per chunk
         gainedXp += tenMinuteChunks * config.voiceXpRate
      }
      
      // Bonus: pro-rata spare minutes based on voice xp rate
      // Assuming 10m = full voiceXpRate, so each minute = 10%
      if (spareMinutes > 0) {
          gainedXp += Math.floor((spareMinutes / 10) * config.voiceXpRate)
      }

      if (gainedXp <= 0) return

      const existingRecord = await prisma.guildXpMember.findUnique({
         where: { userId_guildId: { userId, guildId } }
      })

      const currentXp = existingRecord?.xp ?? 0
      const newXp = currentXp + gainedXp

      // Use the standard 1000 threshold level-up logic
      const compute_level_from_xp = (xp: number) => {
         return Math.floor(xp / 1000);
      }
      
      const currentLevel = existingRecord?.level ?? compute_level_from_xp(currentXp)
      const newLevel = compute_level_from_xp(newXp)

      const updatedMember = await prisma.guildXpMember.upsert({
        where: { userId_guildId: { userId, guildId } },
        create: {
          userId,
          guildId,
          xp: newXp,
          level: newLevel,
          prestige: 0,
          lastVoiceXpAt: new Date()
        },
        update: {
          xp: newXp,
          level: newLevel,
          lastVoiceXpAt: new Date()
        }
      })

      // Level up Check using identical system logic
      if (newLevel > currentLevel) {
        const { xpService } = await import('./xp.service');
        
        // Emulate a message internally to fire handle_level_up
        // Since handle_level_up expects a Message and Member, we inject minimal context.
        if (newState.member) {
          const fakeMessage = {
             author: newState.member.user,
             member: newState.member,
             guild: newState.guild,
          } as any;
          await xpService['handle_level_up'](fakeMessage, newLevel);
        }
      }
    } catch (error) {
      logger.error({ error, guildId, userId }, 'Error processing Voice XP')
    }
  }
}

export const voiceXpService = new VoiceXpService()
