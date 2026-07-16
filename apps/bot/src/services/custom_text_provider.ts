import {
	build_custom_provider_payload,
	custom_provider_endpoint,
	extract_custom_provider_text,
	type custom_provider_message,
	type custom_provider_reasoning_mode,
} from "@yuebot/shared";

import { build_text_only_contract } from "./discord_ai_system_prompt";

export const DEFAULT_DISCORD_AI_CHAT_TIMEOUT_MS = 90_000;
export const MIN_DISCORD_AI_CHAT_TIMEOUT_MS = 1_000;
export const MAX_DISCORD_AI_CHAT_TIMEOUT_MS = 300_000;

export function normalize_discord_ai_chat_timeout_ms(value: unknown): number {
	if (typeof value !== "string") return DEFAULT_DISCORD_AI_CHAT_TIMEOUT_MS;
	const trimmed = value.trim();
	if (!/^\d+$/.test(trimmed)) return DEFAULT_DISCORD_AI_CHAT_TIMEOUT_MS;

	const parsed = Number.parseInt(trimmed, 10);
	if (
		!Number.isSafeInteger(parsed) ||
		parsed < MIN_DISCORD_AI_CHAT_TIMEOUT_MS ||
		parsed > MAX_DISCORD_AI_CHAT_TIMEOUT_MS
	) {
		return DEFAULT_DISCORD_AI_CHAT_TIMEOUT_MS;
	}
	return parsed;
}

export function get_discord_ai_chat_timeout_ms(): number {
	return normalize_discord_ai_chat_timeout_ms(
		process.env.DISCORD_AI_CHAT_TIMEOUT_MS
	);
}

export type custom_text_completion_input = {
	user_prompt: string;
	model: string;
	reasoning_mode: custom_provider_reasoning_mode;
	capability: "text" | "image_generation" | "web_search";
	history?: Array<{
		role: "user" | "assistant";
		content: string;
	}>;
};

export type custom_text_completion_result = {
	content: string;
};

export class CustomTextProviderError extends Error {
	constructor() {
		super("Discord AI text runtime is unavailable");
		this.name = "CustomTextProviderError";
	}
}

export type CustomTextRequestJson = (
	url: string,
	init: RequestInit,
	timeoutMs: number
) => Promise<unknown>;

export const request_json: CustomTextRequestJson = async (
	url,
	init,
	timeoutMs
) => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, { ...init, signal: controller.signal });
		const body = (await response.json().catch(() => null)) as unknown;
		if (!response.ok) throw new CustomTextProviderError();
		return body;
	} catch {
		throw new CustomTextProviderError();
	} finally {
		clearTimeout(timeout);
	}
};

export class CustomTextProvider {
	constructor(
		private readonly deps: {
			base_url: string;
			api_key: string;
			fetch_json: CustomTextRequestJson;
			timeout_ms: number;
			system_prompt: () => Promise<string>;
		}
	) {}

	async create_text_completion(
		input: custom_text_completion_input
	): Promise<custom_text_completion_result> {
		const userPrompt = input.user_prompt.trim();
		const model = input.model.trim();
		if (!userPrompt || !model) throw new CustomTextProviderError();

		let endpoint: string | null;
		try {
			endpoint = custom_provider_endpoint(
				this.deps.base_url,
				"/chat/completions"
			);
		} catch {
			throw new CustomTextProviderError();
		}
		if (!endpoint) throw new CustomTextProviderError();

		let systemPrompt: string;
		try {
			systemPrompt = (await this.deps.system_prompt()).trim();
		} catch {
			throw new CustomTextProviderError();
		}
		if (!systemPrompt) throw new CustomTextProviderError();

		const messages: custom_provider_message[] = [
			{ role: "system", content: systemPrompt },
			{
				role: "system",
				content: build_text_only_contract(input.capability),
			},
			...(input.history ?? []).map((message) => ({
				role: message.role,
				content: message.content,
			})),
			{ role: "user", content: userPrompt },
		];

		const payload = build_custom_provider_payload({
			model,
			messages,
			reasoningMode: input.reasoning_mode,
		});

		const apiKey = this.deps.api_key.trim();
		const headers: Record<string, string> = {
			accept: "application/json",
			"content-type": "application/json",
		};
		if (apiKey) headers.authorization = `Bearer ${apiKey}`;

		let response: unknown;
		try {
			response = await this.deps.fetch_json(
				endpoint,
				{
					method: "POST",
					headers,
					body: JSON.stringify(payload),
				},
				this.deps.timeout_ms
			);
		} catch {
			throw new CustomTextProviderError();
		}

		try {
			return { content: extract_custom_provider_text(response) };
		} catch {
			throw new CustomTextProviderError();
		}
	}
}
