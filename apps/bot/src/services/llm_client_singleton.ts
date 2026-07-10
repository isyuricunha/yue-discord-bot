import { LlmClient } from "./llm_client";
import { MistralClient } from "./mistral.service";

import { logger } from "../utils/logger";

let cached: LlmClient | null | undefined;

function count_non_empty(values: Array<string | undefined>): number {
	return values
		.map((v) => (typeof v === "string" ? v.trim() : ""))
		.filter((v) => v.length > 0).length;
}

function summarize_llm_env_config(): {
	mistral: { enabled: boolean; keys: number; agents: number; image_agents: number };
} {
	const mistral_keys = count_non_empty([
		process.env.MISTRAL_API_KEY,
	]);
	const mistral_agents = count_non_empty([
		process.env.MISTRAL_AGENT_ID,
	]);
	const mistral_image_agents = count_non_empty([
		process.env.MISTRAL_IMAGE_AGENT_ID,
	]);

	return {
		mistral: {
				enabled: mistral_keys > 0,
				keys: mistral_keys,
				agents: mistral_agents,
				image_agents: mistral_image_agents,
			},
	};
}

export function get_llm_client(): LlmClient | null {
	if (cached !== undefined) return cached;

	logger.info(
		{ llm: summarize_llm_env_config() },
		"LLM config loaded (safe summary)"
	);

	let mistral: MistralClient | null = null;

	try {
		const mistralClient = MistralClient.from_env();
		if (mistralClient) mistral = mistralClient;
	} catch {
		mistral = null;
	}

	if (!mistral) {
		cached = null;
		return null;
	}

	logger.info(
		{ providers: { mistral: true } },
		"LLM client initialized"
	);

	cached = new LlmClient(mistral);
	return cached;
}
