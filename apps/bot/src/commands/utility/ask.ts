import { SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { EMOJIS } from "@yuebot/shared";

import { MistralError } from "@mistralai/mistralai/models/errors/mistralerror";

import { get_llm_client } from "../../services/llm_client_singleton";
import { GroqApiError } from "../../services/groq.service";
import { split_discord_message } from "../../utils/discord_message";
import { safe_error_details } from "../../utils/safe_error";
import { logger } from "../../utils/logger";
import type { Command } from "../index";

export const askCommand: Command = {
	data: new SlashCommandBuilder()
		.setName("ask")
		.setNameLocalizations({ "pt-BR": "perguntar" })
		.setDescription("Ask the bot a question")
		.setDescriptionLocalizations({ "pt-BR": "Faça uma pergunta para o bot" })
		.addStringOption((opt) =>
			opt
				.setName("question")
				.setNameLocalizations({ "pt-BR": "pergunta" })
				.setDescription("Your question")
				.setDescriptionLocalizations({ "pt-BR": "Sua pergunta" })
				.setRequired(true)
				.setMaxLength(1500)
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const question = interaction.options.getString("question", true).trim();
		if (!question) {
			await interaction.reply({
				content: `${EMOJIS.ERROR} Pergunta inválida.`,
			});
			return;
		}

		await interaction.deferReply();

		try {
			const client = get_llm_client();
			if (!client) {
				await interaction.editReply({
					content: `${EMOJIS.ERROR} IA não configurada neste bot.`,
				});
				return;
			}
			const completion = await client.create_completion({
				user_prompt: question,
			});

			const parts = split_discord_message(completion.content);
			const first = parts[0] ?? "";

			await interaction.editReply({ content: first });
			if (parts.length > 1) {
				for (const extra of parts.slice(1)) {
					await interaction.followUp({ content: extra });
				}
			}
		} catch (error: unknown) {
			if (error instanceof MistralError) {
				if (error.statusCode === 429) {
					await interaction.editReply({
						content: `${EMOJIS.ERROR} Rate limit da IA. Tente novamente em instantes.`,
					});
					return;
				}

				if (error.statusCode === 401 || error.statusCode === 403) {
					await interaction.editReply({
						content: `${EMOJIS.ERROR} IA não autorizada. Verifique a configuração das keys.`,
					});
					return;
				}

				await interaction.editReply({
					content: `${EMOJIS.ERROR} Erro ao consultar IA.`,
				});
				return;
			}

			if (error instanceof GroqApiError) {
				if (error.status === 429) {
					const retry = error.retry_after_seconds;
					const msg = retry
						? `Tente novamente em ~${retry}s.`
						: "Tente novamente em instantes.";
					await interaction.editReply({
						content: `${EMOJIS.ERROR} Rate limit do fallback. ${msg}`,
					});
					return;
				}

				if (error.status === 401 || error.status === 403) {
					await interaction.editReply({
						content: `${EMOJIS.ERROR} Fallback não autorizado. Verifique a configuração das keys.`,
					});
					return;
				}

				await interaction.editReply({
					content: `${EMOJIS.ERROR} Erro ao consultar fallback.`,
				});
				return;
			}

			logger.error(
				{ err: safe_error_details(error) },
				"Failed to execute /ask"
			);
			await interaction.editReply({
				content: `${EMOJIS.ERROR} Erro inesperado ao executar o comando.`,
			});
		}
	},
};
