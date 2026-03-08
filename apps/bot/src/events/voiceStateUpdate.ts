import { VoiceState } from 'discord.js'
import { voiceXpService } from '../services/voiceXp.service'

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
  // Ignorar bots
  if (oldState.member?.user.bot || newState.member?.user.bot) return

  // Logica baseada nas transicoes de estado de canal de voz
  // - Entrou num canal de voz
  // - Saiu de um canal de voz
  // - Mutou/Desmutou (pode pausar o XP)
  
  await voiceXpService.handle_voice_state_update(oldState, newState)
}
