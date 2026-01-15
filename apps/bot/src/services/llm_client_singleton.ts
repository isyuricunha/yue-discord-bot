import { LlmClient } from "./llm_client";
import { MistralClient } from "./mistral.service";
import { GroqClient } from "./groq.service";

import { logger } from "../utils/logger";

let cached: LlmClient | null | undefined;

function count_non_empty(values: Array<string | undefined>): number {
	return values
		.map((v) => (typeof v === "string" ? v.trim() : ""))
		.filter((v) => v.length > 0).length;
}

function summarize_llm_env_config(): {
	mistral: { enabled: boolean; keys: number; agents: number };
	groq: { enabled: boolean; keys: number };
} {
	const mistral_keys = count_non_empty([
		process.env.MISTRAL_API_KEY,
		process.env.MISTRAL_API_KEY_FALLBACK_1,
		process.env.MISTRAL_API_KEY_FALLBACK_2,
	]);
	const mistral_agents = count_non_empty([
		process.env.MISTRAL_AGENT_ID,
		process.env.MISTRAL_AGENT_ID_FALLBACK_1,
		process.env.MISTRAL_AGENT_ID_FALLBACK_2,
	]);

	const groq_keys = count_non_empty([
		process.env.GROQ_API_KEY,
		process.env.GROQ_API_KEY_FALLBACK_1,
		process.env.GROQ_API_KEY_FALLBACK_2,
	]);

	return {
		mistral: {
			enabled: mistral_keys > 0,
			keys: mistral_keys,
			agents: mistral_agents,
		},
		groq: {
			enabled: groq_keys > 0,
			keys: groq_keys,
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
	let groq: GroqClient | null = null;

	try {
		mistral = MistralClient.from_env();
	} catch {
		mistral = null;
	}

	try {
		groq = GroqClient.from_env();
	} catch {
		groq = null;
	}

	if (!mistral && !groq) {
		cached = null;
		return null;
	}

	logger.info(
		{ providers: { mistral: Boolean(mistral), groq: Boolean(groq) } },
		"LLM client initialized"
	);

	cached = new LlmClient(mistral, groq);
	return cached;
}
