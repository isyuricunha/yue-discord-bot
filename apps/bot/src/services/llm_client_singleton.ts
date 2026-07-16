import { logger } from "../utils/logger";
import { load_ai_fallback_settings } from "./ai_fallback_settings.service";
import {
	CustomTextProvider,
	get_discord_ai_chat_timeout_ms,
	request_json,
} from "./custom_text_provider";
import { load_discord_ai_system_prompt } from "./discord_ai_system_prompt";
import { LlmClient } from "./llm_client";
import { MistralClient } from "./mistral.service";

let cached: LlmClient | null | undefined;

function count_non_empty(values: Array<string | undefined>): number {
	return values
		.map((value) => (typeof value === "string" ? value.trim() : ""))
		.filter((value) => value.length > 0).length;
}

function summarize_llm_env_config(): {
	mistral: {
		enabled: boolean;
		keys: number;
		agents: number;
		image_agents: number;
	};
	custom: { enabled: boolean };
} {
	const mistralKeys = count_non_empty([process.env.MISTRAL_API_KEY]);
	const mistralAgents = count_non_empty([process.env.MISTRAL_AGENT_ID]);
	const mistralImageAgents = count_non_empty([
		process.env.MISTRAL_IMAGE_AGENT_ID,
	]);
	const customUrls = count_non_empty([process.env.CUSTOM_PROVIDER_BASE_URL]);

	return {
		mistral: {
			enabled: mistralKeys > 0,
			keys: mistralKeys,
			agents: mistralAgents,
			image_agents: mistralImageAgents,
		},
		custom: { enabled: customUrls > 0 },
	};
}

export function init_llm_client(): void {
	if (cached !== undefined) return;
	get_llm_client();
}

export function reset_llm_client_singleton_for_tests(): void {
	cached = undefined;
}

export function set_llm_client_singleton_for_tests(
	client: LlmClient | null
): void {
	cached = client;
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

	let customTextProvider: CustomTextProvider | null = null;
	const baseUrl = process.env.CUSTOM_PROVIDER_BASE_URL?.trim() ?? "";
	if (baseUrl) {
		customTextProvider = new CustomTextProvider({
			base_url: baseUrl,
			api_key: process.env.CUSTOM_PROVIDER_API_KEY ?? "",
			fetch_json: request_json,
			timeout_ms: get_discord_ai_chat_timeout_ms(),
			system_prompt: load_discord_ai_system_prompt,
		});
	}

	if (!mistral && !customTextProvider) {
		cached = null;
		return cached;
	}

	logger.info(
		{
			providers: {
				mistral: Boolean(mistral),
				custom: Boolean(customTextProvider),
			},
		},
		"LLM client initialized"
	);

	cached = new LlmClient({
		mistral,
		customTextProvider,
		load_settings: load_ai_fallback_settings,
		timeout_ms: get_discord_ai_chat_timeout_ms,
		event_sink: (event) => logger.warn(event, "Discord AI fallback event"),
	});

	return cached;
}
