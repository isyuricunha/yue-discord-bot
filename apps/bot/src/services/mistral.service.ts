import { readFile } from "node:fs/promises";

import { Mistral } from "@mistralai/mistralai";
import { MistralError } from "@mistralai/mistralai/models/errors/mistralerror";

type mistral_sdk_client = {
	chat: {
		complete: (request: unknown) => Promise<unknown>;
	};
	agents: {
		complete: (request: unknown) => Promise<unknown>;
	};
};

type mistral_completion_response = {
	choices?: Array<{
		message?: {
			content?: unknown;
		};
	}>;
};

type mistral_key_state = {
	api_key: string;
	agent_id: string | null;
	cooldown_until_ms: number;
};

type mistral_role = "system" | "user" | "assistant";

type mistral_message = {
	role: mistral_role;
	content: string;
};

export type mistral_completion_input = {
	user_prompt: string;
	history?: Array<{
		role: "user" | "assistant";
		content: string;
	}>;
};

export type mistral_completion_result = {
	content: string;
};

export class MistralApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly body: unknown,
		public readonly retry_after_seconds: number | null
	) {
		super(message);
		this.name = "MistralApiError";
	}
}

function parse_retry_after_seconds(value: string | null): number | null {
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return null;
	return parsed;
}

function env_keys(): string[] {
	const primary = process.env.MISTRAL_API_KEY;
	const fallback_1 = process.env.MISTRAL_API_KEY_FALLBACK_1;
	const fallback_2 = process.env.MISTRAL_API_KEY_FALLBACK_2;

	const primary_trimmed = typeof primary === "string" ? primary.trim() : "";
	if (!primary_trimmed) return [];

	return [primary_trimmed, fallback_1, fallback_2].filter(
		(v): v is string => typeof v === "string" && v.trim().length > 0
	);
}

function env_agent_id_by_index(index: number): string | null {
	const raw =
		index === 0
			? process.env.MISTRAL_AGENT_ID
			: index === 1
				? process.env.MISTRAL_AGENT_ID_FALLBACK_1
				: process.env.MISTRAL_AGENT_ID_FALLBACK_2;
	const trimmed = typeof raw === "string" ? raw.trim() : "";
	return trimmed ? trimmed : null;
}

function env_model(): string {
	const value = process.env.MISTRAL_MODEL;
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: "mistral-small-latest";
}

function env_temperature(): number {
	const value = process.env.MISTRAL_TEMPERATURE;
	if (!value) return 0.2;
	const parsed = Number.parseFloat(value);
	if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) return 0.2;
	return parsed;
}

function env_max_tokens(): number {
	const value = process.env.MISTRAL_MAX_TOKENS;
	if (!value) return 512;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 4096) return 512;
	return parsed;
}

async function read_prompt_file(path: string): Promise<string> {
	const content = await readFile(path, "utf8");
	const trimmed = content.trim();
	return trimmed.length > 0 ? trimmed : default_system_prompt();
}

function default_system_prompt(): string {
	return (
		"You are Yue, a helpful Discord bot assistant.\n" +
		"Answer clearly and concisely.\n" +
		"If you are unsure, say so.\n" +
		"Avoid disallowed content and never request or reveal secrets.\n"
	);
}

export async function load_mistral_system_prompt(): Promise<string> {
	const env_path = process.env.MISTRAL_PROMPT_PATH;
	const path =
		typeof env_path === "string" && env_path.trim().length > 0
			? env_path.trim()
			: null;
	if (!path) return default_system_prompt();

	try {
		return await read_prompt_file(path);
	} catch {
		return default_system_prompt();
	}
}

type mistral_client_deps = {
	system_prompt?: () => Promise<string>;
	model?: () => string;
	temperature?: () => number;
	max_tokens?: () => number;
	now_ms?: () => number;
	clients?: mistral_sdk_client[];
};

function extract_text_content(input: unknown): string {
	if (typeof input === "string") return input;

	if (Array.isArray(input)) {
		return input
			.map((chunk) => {
				if (!chunk || typeof chunk !== "object") return "";
				const record = chunk as Record<string, unknown>;
				if (record.type === "text" && typeof record.text === "string") {
					return record.text;
				}
				return "";
			})
			.join("");
	}

	return "";
}

export class MistralClient {
	private readonly keys: mistral_key_state[];
	private readonly clients: mistral_sdk_client[];
	private readonly system_prompt: () => Promise<string>;
	private readonly model: () => string;
	private readonly temperature: () => number;
	private readonly max_tokens: () => number;
	private readonly now_ms: () => number;

	constructor(
		input: {
			keys: Array<{ api_key: string; agent_id: string | null }>;
			clients: mistral_sdk_client[];
		},
		deps: mistral_client_deps = {}
	) {
		if (input.keys.length === 0) {
			throw new Error("MISTRAL_API_KEY is required to use Mistral features");
		}
		if (input.keys.length !== input.clients.length) {
			throw new Error(
				"Mistral client mismatch: keys and clients length differ"
			);
		}

		this.keys = input.keys.map((k) => ({
			api_key: k.api_key,
			agent_id: k.agent_id,
			cooldown_until_ms: 0,
		}));
		this.clients = input.clients;
		this.system_prompt = deps.system_prompt ?? load_mistral_system_prompt;
		this.model = deps.model ?? env_model;
		this.temperature = deps.temperature ?? env_temperature;
		this.max_tokens = deps.max_tokens ?? env_max_tokens;
		this.now_ms = deps.now_ms ?? (() => Date.now());
	}

	static from_env(deps: mistral_client_deps = {}): MistralClient {
		const keys = env_keys();
		const key_defs = keys.map((api_key, index) => ({
			api_key,
			agent_id: env_agent_id_by_index(index),
		}));

		const clients = (deps.clients ?? []).length
			? deps.clients
			: key_defs.map(
					(k) =>
						new Mistral({ apiKey: k.api_key }) as unknown as mistral_sdk_client
				);

		return new MistralClient({ keys: key_defs, clients }, deps);
	}

	private pick_key_index(): number | null {
		const now = this.now_ms();

		for (let i = 0; i < this.keys.length; i += 1) {
			if (this.keys[i]!.cooldown_until_ms <= now) return i;
		}

		return null;
	}

	private earliest_cooldown_seconds(): number | null {
		const now = this.now_ms();
		const next = this.keys
			.map((k) => k.cooldown_until_ms)
			.filter((v) => v > now)
			.sort((a, b) => a - b)[0];

		if (!next) return null;
		return Math.max(1, Math.ceil((next - now) / 1000));
	}

	private mark_cooldown(index: number, seconds: number): void {
		const now = this.now_ms();
		this.keys[index]!.cooldown_until_ms = Math.max(
			this.keys[index]!.cooldown_until_ms,
			now + seconds * 1000
		);
	}

	async create_completion(
		input: mistral_completion_input
	): Promise<mistral_completion_result> {
		const history: mistral_message[] = (input.history ?? [])
			.filter(
				(msg) =>
					typeof msg?.content === "string" && msg.content.trim().length > 0
			)
			.map((msg) => ({ role: msg.role, content: msg.content.trim() }));

		const attempted = new Set<number>();
		let last_error: unknown = null;

		while (attempted.size < this.keys.length) {
			const key_index = this.pick_key_index();
			if (key_index === null) {
				const wait = this.earliest_cooldown_seconds();
				throw new MistralApiError(
					"All Mistral API keys are rate limited",
					429,
					null,
					wait
				);
			}

			if (attempted.has(key_index)) {
				this.mark_cooldown(key_index, 1);
				continue;
			}

			attempted.add(key_index);
			const client = this.clients[key_index]!;
			const agent_id = this.keys[key_index]!.agent_id;

			try {
				const messages: mistral_message[] = agent_id
					? [...history, { role: "user", content: input.user_prompt }]
					: [
							{ role: "system", content: await this.system_prompt() },
							...history,
							{ role: "user", content: input.user_prompt },
						];

				const res = (
					agent_id
						? await client.agents.complete({
								agentId: agent_id,
								messages,
								maxTokens: this.max_tokens(),
								responseFormat: { type: "text" },
							})
						: await client.chat.complete({
								model: this.model(),
								messages,
								maxTokens: this.max_tokens(),
								temperature: this.temperature(),
								responseFormat: { type: "text" },
							})
				) as mistral_completion_response;

				const content = extract_text_content(
					res.choices?.[0]?.message?.content
				);
				const trimmed = typeof content === "string" ? content.trim() : "";
				if (!trimmed) {
					throw new MistralApiError(
						"Mistral API returned empty response",
						502,
						res,
						null
					);
				}

				return { content: trimmed };
			} catch (error: unknown) {
				last_error = error;

				const status = error instanceof MistralError ? error.statusCode : null;
				const retry_after_seconds =
					error instanceof MistralError
						? parse_retry_after_seconds(
								error.headers?.get("retry-after") ?? null
							)
						: null;

				const should_fallback =
					error instanceof MistralError
						? status === 401 ||
							status === 403 ||
							status === 429 ||
							status >= 500
						: true;

				if (error instanceof MistralError && status === 429) {
					this.mark_cooldown(key_index, retry_after_seconds ?? 10);
				} else if (should_fallback) {
					this.mark_cooldown(key_index, 1);
				}

				if (!should_fallback) throw error;
			}
		}

		const wait = this.earliest_cooldown_seconds();
		if (last_error instanceof MistralApiError && last_error.status === 429) {
			throw new MistralApiError(last_error.message, 429, last_error.body, wait);
		}
		if (last_error instanceof MistralError && last_error.statusCode === 429) {
			throw new MistralApiError(
				"All Mistral API keys are rate limited",
				429,
				null,
				wait
			);
		}

		if (last_error) throw last_error;
		throw new Error("Failed to get Mistral completion");
	}
}

export function create_mistral_client_for_tests(input: {
	keys: Array<{ api_key: string; agent_id: string | null }>;
	clients: mistral_sdk_client[];
	system_prompt?: () => Promise<string>;
	model?: () => string;
	temperature?: () => number;
	max_tokens?: () => number;
	now_ms?: () => number;
}): MistralClient {
	return new MistralClient(
		{ keys: input.keys, clients: input.clients },
		{
			system_prompt: input.system_prompt,
			model: input.model,
			temperature: input.temperature,
			max_tokens: input.max_tokens,
			now_ms: input.now_ms,
		}
	);
}
