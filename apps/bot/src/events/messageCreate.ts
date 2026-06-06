import {
	AttachmentBuilder,
	Client,
	EmbedBuilder,
	Events,
	Message,
	PermissionFlagsBits,
	TextChannel,
	ThreadChannel,
} from "discord.js";
import { autoModService } from "../services/automod.service";
import { autoroleService } from "../services/autorole.service";
import { suggestionService } from "../services/suggestion.service";
import { customCommandService } from "../services/customCommand.service";
import { keywordTriggerService } from "../services/keywordTrigger.service";
import { xpService } from "../services/xp.service";
import { afkService, findFirstActiveAfk } from "../services/afk.service";
import { MistralError } from "@mistralai/mistralai/models/errors";
import { MistralApiError } from "../services/mistral.service";
import { COLORS, EMOJIS } from "@yuebot/shared";

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

function has_mistral_agent_configured(): boolean {
	const candidates = [
		process.env.MISTRAL_IMAGE_AGENT_ID,
		process.env.MISTRAL_IMAGE_AGENT_ID_FALLBACK_1,
		process.env.MISTRAL_IMAGE_AGENT_ID_FALLBACK_2,
		process.env.MISTRAL_AGENT_ID,
		process.env.MISTRAL_AGENT_ID_FALLBACK_1,
		process.env.MISTRAL_AGENT_ID_FALLBACK_2,
	];
	return candidates.some((v) => typeof v === "string" && v.trim().length > 0);
}

function detect_image_generation_request(prompt: string): boolean {
	const normalized = prompt
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\s+/g, " ")
		.trim();

	if (!normalized) return false;
	if (/^\/?imagine\b/.test(normalized)) return true;

	const has_generation_action =
		/\b(gerar|gere|gera|criar|crie|cria|fazer|faca|desenhar|desenhe|generate|create|make|draw)\b/.test(
			normalized
		);
	const has_image_target =
		/\b(imagem|foto|figura|ilustracao|arte|image|picture|photo|illustration|art)\b/.test(
			normalized
		);

	return has_generation_action && has_image_target;
}

function start_typing_indicator(channel: Message["channel"]): () => void {
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

	const userId = message.author.id;
	const guildId = message.guild.id;

	// Verificar e remover AFK quando o usuário enviar uma mensagem
	try {
		const existingAfk = await afkService.getAfk(userId, guildId);
		if (existingAfk && existingAfk.isAfk) {
			const startedAtTimestamp = Math.floor(new Date(existingAfk.startedAt).getTime() / 1000);
			const durationMs = Date.now() - new Date(existingAfk.startedAt).getTime();
			const hours = Math.floor(durationMs / (1000 * 60 * 60));
			const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

			await afkService.removeAfk(userId, guildId);

			const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

			const embed = new EmbedBuilder()
				.setColor(COLORS.SUCCESS)
				.setTitle(`${EMOJIS.SUCCESS} Bem-vindo de volta!`)
				.setDescription(`Você estava AFK desde <t:${startedAtTimestamp}:f>`)
				.addFields([
					{
						name: 'Duração',
						value: durationText,
						inline: true,
					},
					{
						name: 'Motivo original',
						value: existingAfk.reason || 'Sem motivo definido',
						inline: true,
					},
				])
				.setTimestamp(new Date());

			await message.reply({ embeds: [embed] }).catch(() => null);
		}
	} catch (error) {
		logger.error(
			{ err: safe_error_details(error) },
			"AFK check/remove failed on messageCreate"
		);
	}

	// Verificar se alguém mencionou um usuário AFK
	if (message.mentions.users.size > 0) {
		try {
			const mentionedUsers = Array.from(message.mentions.users.values()).filter(
				(user) => user.id !== message.author.id && !user.bot
			);
			const mentionedUserIds = mentionedUsers.map((user) => user.id);
			const mentionedAfks = await afkService.getAfks(
				mentionedUserIds,
				guildId
			);
			const mentionedAfk = findFirstActiveAfk(
				mentionedUserIds,
				mentionedAfks
			);

			if (mentionedAfk) {
				const startedAtTimestamp = Math.floor(new Date(mentionedAfk.startedAt).getTime() / 1000);

				const embed = new EmbedBuilder()
					.setColor(COLORS.WARNING)
					.setTitle(`${EMOJIS.WARNING} Usuário AFK`)
					.setDescription(`<@${mentionedAfk.userId}> está ausente no momento.`)
					.addFields([
						{
							name: 'Está AFK desde',
							value: `<t:${startedAtTimestamp}:f>`,
							inline: true,
						},
						{
							name: 'Motivo',
							value: mentionedAfk.reason || 'Sem motivo definido',
							inline: true,
						},
					])
					.setFooter({ text: 'O usuário será notificado quando voltar.' });

				await message.reply({ embeds: [embed] }).catch(() => null);
			}
		} catch (error) {
			logger.error(
				{ err: safe_error_details(error) },
				"AFK mention check failed on messageCreate"
			);
		}
	}

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
		const handled_by_custom_command = await customCommandService.handle_message(message);
		if (handled_by_custom_command) return;
	} catch (error) {
		logger.error(
			{ err: safe_error_details(error) },
			"Custom Command service failed on messageCreate"
		);
	}

	try {
		await keywordTriggerService.handle_message(message);
	} catch (error) {
		logger.error(
			{ err: safe_error_details(error) },
			"KeywordTrigger service failed on messageCreate"
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
						const wants_image_generation =
							detect_image_generation_request(user_prompt);
						const prefer_mistral_image_generation =
							wants_image_generation && has_mistral_agent_configured();
						const prefer_agent_websearch =
							!!web_query &&
							!prefer_mistral_image_generation &&
							has_mistral_agent_configured();

					let web_context: string | null = null;
					if (web_query && !prefer_agent_websearch) {
						const search = await ddg_web_search(web_query);
						const formatted = format_web_search_context(search).trim();
						web_context = formatted.length > 0 ? formatted : null;
					}

						const final_user_prompt = prefer_mistral_image_generation
							? `Use the image_generation tool to generate the requested image. Do not only describe the image. Return the generated image file and a short caption.

Request: ${user_prompt}`
							: prefer_agent_websearch
								? `Use the web_search tool to answer the question. Provide a direct answer and include source URLs.

If the tool does not return enough information, say you could not find the answer.

Question: ${user_prompt}`
								: web_context
									? `You are given web search results. Answer the question using the provided results and include source URLs when relevant.

Do not claim you lack internet access or real-time data. If the provided sources do not contain enough information to answer, say you could not find the answer in the provided sources.

${web_context}

Question: ${user_prompt}`
									: user_prompt;

						const completion = await llm_client.create_completion({
							user_prompt: final_user_prompt,
							prefer_image_generation: prefer_mistral_image_generation,
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
