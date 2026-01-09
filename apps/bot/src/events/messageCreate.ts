import type { Message } from 'discord.js';
import { autoModService } from '../services/automod.service';
import { autoroleService } from '../services/autorole.service';
import { suggestionService } from '../services/suggestion.service';
import { xpService } from '../services/xp.service';
import { get_groq_client } from '../services/groq_client_singleton'
import { get_groq_conversation_backend } from '../services/groq_conversation_backend_factory'
import { build_history_for_prompt, conversation_key_from_message, is_reply_to_bot } from '../services/groq_history'
import { GroqApiError } from '../services/groq.service'
import { is_within_continuation_window } from '../services/groq_continuation'
import { build_user_prompt_from_invocation, remove_bot_mention, remove_leading_yue } from '../services/groq_invocation'
import { logger } from '../utils/logger';
import { safe_error_details } from '../utils/safe_error'

function parse_int_env(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function clamp_discord_message(input: string, max = 1900): string {
  const trimmed = input.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export async function handleMessageCreate(message: Message) {
  // Ignorar mensagens de bots e DMs
  if (message.author.bot || !message.guild) return;

  try {
    await autoroleService.handle_message(message)
  } catch (error) {
    logger.error({ err: safe_error_details(error) }, 'Autorole failed on messageCreate')
  }

  try {
    const handled_by_suggestions = await suggestionService.handle_message(message)
    if (handled_by_suggestions) return
  } catch (error) {
    logger.error({ err: safe_error_details(error) }, 'Suggestion service failed on messageCreate')
  }

  try {
    // Verificar AutoMod
    const deleted_by_automod = await autoModService.checkMessage(message)
    if (deleted_by_automod) return
  } catch (error) {
    logger.error({ err: safe_error_details(error) }, 'AutoMod failed on messageCreate')
  }

  const groq_client = get_groq_client()
  if (groq_client) {
    const bot_user_id = message.client.user?.id ?? null
    const mentions_bot = bot_user_id ? message.mentions.users.has(bot_user_id) : false

    const key = conversation_key_from_message(message)
    const conversation_backend = get_groq_conversation_backend()
    const continuation_seconds = parse_int_env(process.env.GROQ_CONTEXT_CONTINUATION_SECONDS, 120)
    const last_activity = await conversation_backend.get_last_activity_ms(key).catch(() => null)
    const within_continuation_window = is_within_continuation_window({
      now_ms: Date.now(),
      last_activity_ms: typeof last_activity === 'number' ? last_activity : null,
      continuation_seconds,
    })

    const replying_to_bot = await is_reply_to_bot(message)

    const invoked_prompt = build_user_prompt_from_invocation({
      content: message.content ?? '',
      mentions_bot,
      bot_user_id,
    })

    const should_continue = replying_to_bot || within_continuation_window

    let prompt = invoked_prompt
    if (!prompt && should_continue) {
      const raw = (message.content ?? '').trim()
      if (raw) {
        let cleaned = raw
        if (mentions_bot && bot_user_id) {
          cleaned = remove_bot_mention(cleaned, bot_user_id)
        }
        cleaned = remove_leading_yue(cleaned)
        prompt = cleaned.trim() ? cleaned.trim() : null
      }
    }

    if (prompt) {
      try {
        const history = build_history_for_prompt(await conversation_backend.get_history(key))
        const completion = await groq_client.create_completion({ user_prompt: prompt, history })
        const content = clamp_discord_message(completion.content)

        await conversation_backend.append(key, { role: 'user', content: prompt })
        await conversation_backend.append(key, { role: 'assistant', content: completion.content })

        await message.reply({
          content,
          allowedMentions: { parse: [], repliedUser: false },
        })
      } catch (error: unknown) {
        if (error instanceof GroqApiError) {
          logger.warn({ status: error.status }, 'Groq invocation failed')
        } else {
          logger.error({ err: safe_error_details(error) }, 'Groq invocation failed')
        }
      }
    }
  }

  try {
    await xpService.handle_message(message)
  } catch (error) {
    logger.error({ err: safe_error_details(error) }, 'XP service failed on messageCreate')
  }
}
