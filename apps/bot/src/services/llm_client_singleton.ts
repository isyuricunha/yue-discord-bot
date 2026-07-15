import { LlmClient } from "./llm_client";
import { MistralClient } from "./mistral.service";

import { logger } from "../utils/logger";

import { CustomTextProvider, request_json, get_discord_ai_chat_timeout_ms } from "./custom_text_provider";
import { load_yue_persona } from "./yue_persona";
import { load_ai_fallback_settings } from "./ai_fallback_settings.service";

let cached: LlmClient | null | undefined;

function count_non_empty(values: Array<string | undefined>): number {
	return values
		.map((v) => (typeof v === "string" ? v.trim() : ""))
		.filter((v) => v.length > 0).length;
}

function summarize_llm_env_config(): {
	mistral: { enabled: boolean; keys: number; agents: number; image_agents: number };
	custom: { enabled: boolean };
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
	const custom_url = count_non_empty([
		process.env.CUSTOM_PROVIDER_BASE_URL,
	]);

	return {
		mistral: {
			enabled: mistral_keys > 0,
			keys: mistral_keys,
			agents: mistral_agents,
			image_agents: mistral_image_agents,
		},
		custom: {
			enabled: custom_url > 0,
		},
	};
}

export function init_llm_client(): void {
	if (cached !== undefined) return;
	get_llm_client();
}

export function reset_llm_client_singleton_for_tests(): void {
	cached = undefined;
}

export function get_llm_client(): LlmClient | null {
	if (cached !== undefined) return cached;

	logger.info(
		{ llm: summarize_llm_env_config() },
		"LLM config loaded (safe summary)"
	);

	let mistral: MistralClient | null;
	try {
		mistral = MistralClient.from_env();
	} catch {
		mistral = null;
	}

	let customTextProvider: CustomTextProvider | undefined;
	try {
		if (process.env.CUSTOM_PROVIDER_BASE_URL) {
			customTextProvider = new CustomTextProvider({
				base_url: process.env.CUSTOM_PROVIDER_BASE_URL,
				api_key: process.env.CUSTOM_PROVIDER_API_KEY || '',
				fetch_json: request_json,
				timeout_ms: get_discord_ai_chat_timeout_ms(),
				system_prompt: load_yue_persona,
			});
		}
	} catch {
		// Ignore provider init failure
	}

	if (!mistral && !customTextProvider) {
		cached = null;
		return null;
	}

	logger.info(
		{ providers: { mistral: !!mistral, custom: !!customTextProvider } },
		"LLM client initialized"
	);

	cached = new LlmClient({
		mistral,
		customTextProvider,
		load_settings: load_ai_fallback_settings,
		timeout_ms: get_discord_ai_chat_timeout_ms,
		event_sink: (event) => logger.warn(event, "Discord AI Fallback Event"),
	});

	return cached;
}
