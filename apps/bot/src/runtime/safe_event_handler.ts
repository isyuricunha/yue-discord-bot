import type { Interaction } from 'discord.js'
import { MessageFlags } from 'discord.js'

import { logger } from '../utils/logger'
import { safe_error_details } from '../utils/safe_error'

/**
 * Runs an event handler and guarantees a rejection never escapes as an
 * unhandledRejection: the runtime process handlers treat one as fatal and
 * terminate the whole bot (audit finding BOT-002).
 */
export async function safe_event(event_name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run()
  } catch (error) {
    logger.error(
      { error: safe_error_details(error), event: event_name },
      `❌ Erro não tratado no evento ${event_name}`
    )
  }
}

/**
 * Same guarantee for interaction events, plus a single ephemeral error reply
 * when the interaction has not been answered yet, so the user is not left
 * with a stuck "thinking" state.
 */
export async function safe_interaction_event(
  event_name: string,
  interaction: Interaction,
  run: () => Promise<void>
): Promise<void> {
  try {
    await run()
  } catch (error) {
    logger.error(
      { error: safe_error_details(error), event: event_name },
      `❌ Erro não tratado no evento ${event_name}`
    )

    try {
      if (!interaction.isRepliable() || interaction.replied || interaction.deferred) return

      await interaction.reply({
        content: 'Ocorreu um erro inesperado ao processar este comando. Tente novamente em instantes.',
        flags: MessageFlags.Ephemeral,
      })
    } catch (reply_error) {
      logger.warn(
        { error: safe_error_details(reply_error), event: event_name },
        '⚠️ Falha ao responder com erro da interação'
      )
    }
  }
}
