import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";
import type { ChatInputCommandInteraction } from "discord.js";

import { EMOJIS } from "@yuebot/shared";

import { DiscordAiUnavailableError } from "../../services/llm_client";
import { get_llm_client } from "../../services/llm_client_singleton";
import { logger } from "../../utils/logger";
import { safe_error_details } from "../../utils/safe_error";
import { split_discord_message } from "../../utils/discord_message";
import type { Command } from "../index";

export type AskCommandDependencies = {
	getLlmClient: typeof get_llm_client;
};

export function createAskCommand(
	dependencies: Partial<AskCommandDependencies> = {}
): Command {
	const getLlmClient = dependencies.getLlmClient ?? get_llm_client;

	return {
		data: new SlashCommandBuilder()
			.setName("ask")
			.setNameLocalizations({ "pt-BR": "perguntar" })
			.setDescription("Ask the bot a question")
			.setDescriptionLocalizations({
				"pt-BR": "Faça uma pergunta para o bot",
			})
			.addStringOption((option) =>
				option
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
				const client = getLlmClient();
				if (!client) {
					await interaction.editReply({
						content: `${EMOJIS.ERROR} IA não configurada neste bot.`,
					});
					return;
				}

				const completion = await client.create_completion({
					user_prompt: question,
					capability: "text",
				});
				const files = (completion.attachments ?? []).map(
					(attachment) =>
						new AttachmentBuilder(attachment.data, {
							name: attachment.filename,
						})
				);
				const parts = split_discord_message(completion.content);
				const first = parts[0] ?? "";

				await interaction.editReply({ content: first, files });
				for (const extra of parts.slice(1)) {
					await interaction.followUp({ content: extra });
				}
			} catch (error: unknown) {
				if (error instanceof DiscordAiUnavailableError) {
					await interaction.editReply({
						content: `${EMOJIS.ERROR} IA indisponível no momento. Tente novamente em instantes.`,
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
}

export const askCommand = createAskCommand();
