import type { Message } from 'discord.js';
import { autoModService } from '../services/automod.service';
import { autoroleService } from '../services/autorole.service';
import { suggestionService } from '../services/suggestion.service';
import { xpService } from '../services/xp.service';
import { get_groq_client } from '../services/groq_client_singleton'
import { GroqApiError } from '../services/groq.service'
import { build_user_prompt_from_invocation } from '../services/groq_invocation'
import { logger } from '../utils/logger';

function clamp_discord_message(input: string, max = 1900): string {
  const trimmed = input.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export async function handleMessageCreate(message: Message) {
  // Ignorar mensagens de bots e DMs
  if (message.author.bot || !message.guild) return;

  try {
    await autoroleService.handle_message(message);

    const handled_by_suggestions = await suggestionService.handle_message(message)
    if (handled_by_suggestions) return

    // Verificar AutoMod
    const deleted_by_automod = await autoModService.checkMessage(message);
    if (deleted_by_automod) return;

    const groq_client = get_groq_client()
    if (groq_client) {
      const bot_user_id = message.client.user?.id ?? null
      const mentions_bot = bot_user_id ? message.mentions.users.has(bot_user_id) : false

      const prompt = build_user_prompt_from_invocation({
        content: message.content ?? '',
        mentions_bot,
        bot_user_id,
      })

      if (prompt) {
        try {
          const completion = await groq_client.create_completion({ user_prompt: prompt })
          const content = clamp_discord_message(completion.content)
          await message.reply({
            content,
            allowedMentions: { parse: [], repliedUser: false },
          })
        } catch (error: unknown) {
          if (error instanceof GroqApiError) {
            logger.warn({ status: error.status }, 'Groq invocation failed')
          } else {
            logger.error({ error }, 'Groq invocation failed')
          }
        }
      }
    }

    await xpService.handle_message(message);
  } catch (error) {
    logger.error({ error }, 'Erro ao processar mensagem');
  }
}
