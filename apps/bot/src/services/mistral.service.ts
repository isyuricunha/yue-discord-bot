import { readFile } from "node:fs/promises";

import { Mistral } from "@mistralai/mistralai";
import {
	ConnectionError,
	HTTPClientError,
	RequestAbortedError,
	RequestTimeoutError,
	UnexpectedClientError,
} from "@mistralai/mistralai/models/errors";
import { MistralError } from "@mistralai/mistralai/models/errors/mistralerror";

import { safe_error_details } from "../utils/safe_error";

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

function env_api_key(): string {
	const value = process.env.MISTRAL_API_KEY;
	const trimmed = typeof value === "string" ? value.trim() : "";
	if (!trimmed) {
		throw new Error("MISTRAL_API_KEY is required to use Mistral features");
	}
	return trimmed;
}

function env_agent_id(): string | null {
	const value = process.env.MISTRAL_AGENT_ID;
	const trimmed = typeof value === "string" ? value.trim() : "";
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
	agent_id?: () => string | null;
	model?: () => string;
	temperature?: () => number;
	max_tokens?: () => number;
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
	private readonly mistral: Mistral;
	private readonly system_prompt: () => Promise<string>;
	private readonly agent_id: () => string | null;
	private readonly model: () => string;
	private readonly temperature: () => number;
	private readonly max_tokens: () => number;

	constructor(mistral: Mistral, deps: mistral_client_deps = {}) {
		this.mistral = mistral;
		this.system_prompt = deps.system_prompt ?? load_mistral_system_prompt;
		this.agent_id = deps.agent_id ?? env_agent_id;
		this.model = deps.model ?? env_model;
		this.temperature = deps.temperature ?? env_temperature;
		this.max_tokens = deps.max_tokens ?? env_max_tokens;
	}

	static from_env(deps: mistral_client_deps = {}): MistralClient {
		const mistral = new Mistral({ apiKey: env_api_key() });
		return new MistralClient(mistral, deps);
	}

	async create_completion(
		input: mistral_completion_input
	): Promise<mistral_completion_result> {
		const system_prompt = await this.system_prompt();

		const history: mistral_message[] = (input.history ?? [])
			.filter(
				(msg) =>
					typeof msg?.content === "string" && msg.content.trim().length > 0
			)
			.map((msg) => ({ role: msg.role, content: msg.content.trim() }));

		const messages: mistral_message[] = [
			{ role: "system", content: system_prompt },
			...history,
			{ role: "user", content: input.user_prompt },
		];

		try {
			const agent_id = this.agent_id();

			const res = agent_id
				? await this.mistral.agents.complete({
						agentId: agent_id,
						messages,
						maxTokens: this.max_tokens(),
						responseFormat: { type: "text" },
					})
				: await this.mistral.chat.complete({
						model: this.model(),
						messages,
						maxTokens: this.max_tokens(),
						temperature: this.temperature(),
						responseFormat: { type: "text" },
					});

			const content = extract_text_content(res.choices?.[0]?.message?.content);
			const trimmed = typeof content === "string" ? content.trim() : "";
			if (!trimmed) {
				throw new Error("Mistral API returned empty response");
			}

			return { content: trimmed };
		} catch (error: unknown) {
			if (error instanceof MistralError) throw error;
			if (error instanceof HTTPClientError) throw error;
			if (error instanceof ConnectionError) throw error;
			if (error instanceof RequestTimeoutError) throw error;
			if (error instanceof RequestAbortedError) throw error;
			if (error instanceof UnexpectedClientError) throw error;

			const details = safe_error_details(error);
			throw new Error(`Mistral request failed: ${JSON.stringify(details)}`, {
				cause: error,
			});
		}
	}
}

export function create_mistral_client_for_tests(input: {
	mistral: Mistral;
	system_prompt?: () => Promise<string>;
	agent_id?: () => string | null;
	model?: () => string;
	temperature?: () => number;
	max_tokens?: () => number;
}): MistralClient {
	return new MistralClient(input.mistral, {
		system_prompt: input.system_prompt,
		agent_id: input.agent_id,
		model: input.model,
		temperature: input.temperature,
		max_tokens: input.max_tokens,
	});
}
