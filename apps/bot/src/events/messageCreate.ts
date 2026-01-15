import {
	AttachmentBuilder,
	Client,
	Events,
	Message,
	PermissionFlagsBits,
	TextChannel,
	ThreadChannel,
} from "discord.js";
import { autoModService } from "../services/automod.service";
import { autoroleService } from "../services/autorole.service";
import { suggestionService } from "../services/suggestion.service";
import { xpService } from "../services/xp.service";
import { MistralError } from "@mistralai/mistralai/models/errors/mistralerror";
import { MistralApiError } from "../services/mistral.service";

import { get_llm_client } from "../services/llm_client_singleton";
import { get_groq_conversation_backend } from "../services/groq_conversation_backend_factory";
import {
	build_history_for_prompt,
	conversation_key_from_message,
	is_reply_to_bot,
} from "../services/groq_history";
import { GroqApiError } from "../services/groq.service";
import { is_within_continuation_window } from "../services/groq_continuation";
import {
	build_user_prompt_from_invocation,
	remove_bot_mention,
	remove_leading_yue,
} from "../services/groq_invocation";
import {
	ddg_web_search,
	format_web_search_context,
	parse_web_search_query,
} from "../services/ddg_web_search";
import { getSendableChannel } from "../utils/discord";
import { split_discord_message } from "../utils/discord_message";
import { logger } from "../utils/logger";
import { safe_error_details } from "../utils/safe_error";

function parse_int_env(value: string | undefined, fallback: number): number {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) return fallback;
	return parsed;
}

function start_typing_indicator(channel: unknown): () => void {
	const candidate = channel as { sendTyping?: unknown } | null;
	if (!candidate || typeof candidate.sendTyping !== "function") {
		return () => {
			// no-op
		};
	}

	const send_typing = candidate.sendTyping as () => Promise<unknown>;

	let stopped = false;

	const send = async () => {
		if (stopped) return;
		await send_typing().catch(() => null);
	};

	void send();
	const interval = setInterval(send, 8_000);

	return () => {
		stopped = true;
		clearInterval(interval);
	};
}

export async function handleMessageCreate(message: Message) {
	// Ignorar mensagens de bots e DMs
	if (message.author.bot || !message.guild) return;

	try {
		await autoroleService.handle_message(message);
	} catch (error) {
		logger.error(
			{ err: safe_error_details(error) },
			"Autorole failed on messageCreate"
		);
	}

	try {
		const handled_by_suggestions =
			await suggestionService.handle_message(message);
		if (handled_by_suggestions) return;
	} catch (error) {
		logger.error(
			{ err: safe_error_details(error) },
			"Suggestion service failed on messageCreate"
		);
	}

	try {
		// Verificar AutoMod
		const deleted_by_automod = await autoModService.checkMessage(message);
		if (deleted_by_automod) return;
	} catch (error) {
		logger.error(
			{ err: safe_error_details(error) },
			"AutoMod failed on messageCreate"
		);
	}

	const llm_client = get_llm_client();
	if (llm_client) {
		const bot_user_id = message.client.user?.id ?? null;
		const mentions_bot = bot_user_id
			? message.mentions.users.has(bot_user_id)
			: false;

		const key = conversation_key_from_message(message);
		const conversation_backend = get_groq_conversation_backend();
		const continuation_seconds = parse_int_env(
			process.env.GROQ_CONTEXT_CONTINUATION_SECONDS,
			120
		);
		const last_activity = await conversation_backend
			.get_last_activity_ms(key)
			.catch(() => null);
		const within_continuation_window = is_within_continuation_window({
			now_ms: Date.now(),
			last_activity_ms:
				typeof last_activity === "number" ? last_activity : null,
			continuation_seconds,
		});

		const replying_to_bot = await is_reply_to_bot(message);

		const invoked_prompt = build_user_prompt_from_invocation({
			content: message.content ?? "",
			mentions_bot,
			bot_user_id,
		});

		const should_continue = replying_to_bot || within_continuation_window;

		let prompt = invoked_prompt;
		if (!prompt && should_continue) {
			const raw = (message.content ?? "").trim();
			if (raw) {
				let cleaned = raw;
				if (mentions_bot && bot_user_id) {
					cleaned = remove_bot_mention(cleaned, bot_user_id);
				}
				cleaned = remove_leading_yue(cleaned);
				prompt = cleaned.trim() ? cleaned.trim() : null;
			}
		}

		if (prompt) {
			try {
				const stop_typing = start_typing_indicator(message.channel);

				try {
					const history = build_history_for_prompt(
						await conversation_backend.get_history(key)
					);

					const web_query = parse_web_search_query(prompt);
					const user_prompt = web_query ?? prompt;

					let web_context: string | null = null;
					if (web_query) {
						const search = await ddg_web_search(web_query);
						const formatted = format_web_search_context(search).trim();
						web_context = formatted.length > 0 ? formatted : null;
					}

					const final_user_prompt = web_context
						? `You are given web search results. Answer the question using the provided results and include source URLs when relevant.

Do not claim you lack internet access or real-time data. If the provided sources do not contain enough information to answer, say you could not find the answer in the provided sources.

${web_context}

Question: ${user_prompt}`
						: user_prompt;

					const completion = await llm_client.create_completion({
						user_prompt: final_user_prompt,
						history,
					});

					const files = (completion.attachments ?? []).map(
						(att) => new AttachmentBuilder(att.data, { name: att.filename })
					);
					const parts = split_discord_message(completion.content);
					const first = parts[0] ?? "";

					await conversation_backend.append(key, {
						role: "user",
						content: user_prompt,
					});
					await conversation_backend.append(key, {
						role: "assistant",
						content: completion.content,
					});

					await message.reply({
						content: first,
						files,
						allowedMentions: { parse: [], repliedUser: false },
					});

					if (parts.length > 1) {
						const channel = getSendableChannel(message.channel);
						if (channel) {
							for (const extra of parts.slice(1)) {
								await channel.send({
									content: extra,
									allowedMentions: { parse: [] },
								});
							}
						}
					}
				} finally {
					stop_typing();
				}
			} catch (error: unknown) {
				if (error instanceof MistralApiError) {
					logger.warn({ status: error.status }, "Mistral invocation failed");
				} else if (error instanceof MistralError) {
					logger.warn(
						{ status: error.statusCode },
						"Mistral invocation failed"
					);
				} else if (error instanceof GroqApiError) {
					logger.warn({ status: error.status }, "Groq invocation failed");
				} else {
					logger.error(
						{ err: safe_error_details(error) },
						"Groq invocation failed"
					);
				}
			}
		}
	}

	try {
		await xpService.handle_message(message);
	} catch (error) {
		logger.error(
			{ err: safe_error_details(error) },
			"XP service failed on messageCreate"
		);
	}
}
