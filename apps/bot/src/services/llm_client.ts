import { MistralError } from "@mistralai/mistralai/models/errors";

import type { AiFallbackSettings } from "./ai_fallback_settings.service";
import type {
	custom_text_completion_input,
	custom_text_completion_result,
} from "./custom_text_provider";
import {
	MistralApiError,
	type mistral_completion_input,
	type mistral_completion_result,
} from "./mistral.service";

type llm_provider = "mistral" | "custom";
export type llm_capability = "text" | "web_search" | "image_generation";

export type llm_completion_input = {
	user_prompt: string;
	mistral_prompt?: string;
	capability?: llm_capability;
	prefer_image_generation?: boolean;
	history?: Array<{
		role: "user" | "assistant";
		content: string;
	}>;
};

export type llm_completion_result = {
	content: string;
	provider: llm_provider;
	attachments?: Array<{
		filename: string;
		content_type: string;
		data: Buffer;
	}>;
};

export type discord_ai_failure_category =
	| "authentication"
	| "authorization"
	| "timeout"
	| "rate_limited"
	| "server_error"
	| "transport"
	| "not_configured"
	| "client_error"
	| "programming_error"
	| "unknown";

export type discord_ai_failure_classification = {
	eligible: boolean;
	category: discord_ai_failure_category;
	statusCode: number | null;
};

export type RuntimeEvent = {
	type:
		| "discord_ai_fallback_attempted"
		| "discord_ai_fallback_succeeded"
		| "discord_ai_fallback_failed";
	primaryProvider: "mistral";
	fallbackProvider: "custom";
	category: discord_ai_failure_category;
	statusCode: number | null;
	success: boolean;
	capability: llm_capability;
};

export type RuntimeEventSink = (event: RuntimeEvent) => void;

export class MistralNotConfiguredError extends Error {
	readonly code = "MISTRAL_NOT_CONFIGURED";

	constructor() {
		super("Mistral runtime is not configured");
		this.name = "MistralNotConfiguredError";
	}
}

export class MistralTimeoutError extends Error {
	readonly code = "MISTRAL_TIMEOUT";

	constructor() {
		super("Mistral request timed out");
		this.name = "MistralTimeoutError";
	}
}

export class DiscordAiUnavailableError extends Error {
	readonly category: discord_ai_failure_category | "settings_unavailable" | "fallback_unavailable";
	readonly statusCode: number | null;

	constructor(
		category: discord_ai_failure_category | "settings_unavailable" | "fallback_unavailable" =
			"fallback_unavailable",
		statusCode: number | null = null
	) {
		super("Discord AI is unavailable");
		this.name = "DiscordAiUnavailableError";
		this.category = category;
		this.statusCode = statusCode;
	}
}

const TRANSPORT_CODES = new Set([
	"ABORT_ERR",
	"ECONNRESET",
	"ETIMEDOUT",
	"ECONNREFUSED",
	"ENOTFOUND",
	"EAI_AGAIN",
]);

type error_with_transport_metadata = Error & {
	code?: unknown;
	cause?: unknown;
};

function transport_failure(error: Error): boolean {
	if (error.name === "AbortError") return true;

	const typed = error as error_with_transport_metadata;
	if (
		typeof typed.code === "string" &&
		TRANSPORT_CODES.has(typed.code.toUpperCase())
	) {
		return true;
	}

	return typed.cause instanceof Error ? transport_failure(typed.cause) : false;
}

function classify_status(statusCode: number): discord_ai_failure_classification {
	if (statusCode === 401) {
		return { eligible: true, category: "authentication", statusCode };
	}
	if (statusCode === 403) {
		return { eligible: true, category: "authorization", statusCode };
	}
	if (statusCode === 408) {
		return { eligible: true, category: "timeout", statusCode };
	}
	if (statusCode === 429) {
		return { eligible: true, category: "rate_limited", statusCode };
	}
	if (statusCode >= 500 && statusCode <= 599) {
		return { eligible: true, category: "server_error", statusCode };
	}
	if (statusCode >= 400 && statusCode <= 499) {
		return { eligible: false, category: "client_error", statusCode };
	}
	return { eligible: false, category: "unknown", statusCode };
}

export function classify_mistral_failure(
	error: unknown
): discord_ai_failure_classification {
	if (error instanceof MistralNotConfiguredError) {
		return { eligible: true, category: "not_configured", statusCode: null };
	}
	if (error instanceof MistralTimeoutError) {
		return { eligible: true, category: "timeout", statusCode: null };
	}
	if (error instanceof MistralError) {
		return classify_status(error.statusCode);
	}
	if (error instanceof MistralApiError) {
		return classify_status(error.status);
	}
	if (error instanceof Error && transport_failure(error)) {
		return { eligible: true, category: "transport", statusCode: null };
	}
	if (error instanceof TypeError) {
		return { eligible: false, category: "programming_error", statusCode: null };
	}
	if (error instanceof Error) {
		return { eligible: false, category: "unknown", statusCode: null };
	}
	return { eligible: false, category: "unknown", statusCode: null };
}

export function is_eligible_fallback_error(error: unknown): boolean {
	return classify_mistral_failure(error).eligible;
}

export interface LlmMistralProvider {
	create_completion(
		input: mistral_completion_input
	): Promise<mistral_completion_result>;
}

export interface LlmCustomProvider {
	create_text_completion(
		input: custom_text_completion_input
	): Promise<custom_text_completion_result>;
}

export type AiFallbackSettingsLoader = () => Promise<AiFallbackSettings>;
export type TimeoutMsProvider = () => number;

export type TimeoutHandle = {
	promise: Promise<never>;
	cancel: () => void;
};

export type TimeoutFactory = (timeoutMs: number) => TimeoutHandle;

export function create_mistral_timeout(timeoutMs: number): TimeoutHandle {
	let timer: ReturnType<typeof setTimeout> | null = null;
	const promise = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new MistralTimeoutError()), timeoutMs);
	});

	return {
		promise,
		cancel: () => {
			if (timer !== null) {
				clearTimeout(timer);
				timer = null;
			}
		},
	};
}

function emit_event(sink: RuntimeEventSink | undefined, event: RuntimeEvent): void {
	if (!sink) return;
	try {
		sink(event);
	} catch {
		// Telemetry must never alter the Discord response path.
	}
}

export class LlmClient {
	constructor(
		private readonly deps: {
			mistral?: LlmMistralProvider | null;
			customTextProvider?: LlmCustomProvider | null;
			load_settings: AiFallbackSettingsLoader;
			timeout_ms: TimeoutMsProvider;
			create_timeout?: TimeoutFactory;
			event_sink?: RuntimeEventSink;
		}
	) {}

	private async complete_with_mistral(
		input: mistral_completion_input
	): Promise<mistral_completion_result> {
		if (!this.deps.mistral) throw new MistralNotConfiguredError();

		const callPromise = this.deps.mistral.create_completion(input);
		void callPromise.catch(() => undefined);

		const timeout = (this.deps.create_timeout ?? create_mistral_timeout)(
			this.deps.timeout_ms()
		);

		try {
			return await Promise.race([callPromise, timeout.promise]);
		} finally {
			timeout.cancel();
		}
	}

	async create_completion(
		input: llm_completion_input
	): Promise<llm_completion_result> {
		const capability = input.capability ?? "text";
		const mistralInput: mistral_completion_input = {
			user_prompt: input.mistral_prompt ?? input.user_prompt,
			prefer_image_generation: input.prefer_image_generation,
			history: input.history,
		};

		let classification: discord_ai_failure_classification;

		try {
			const result = await this.complete_with_mistral(mistralInput);
			return {
				content: result.content,
				provider: "mistral",
				attachments: result.attachments,
			};
		} catch (error: unknown) {
			classification = classify_mistral_failure(error);
		}

		if (!classification.eligible) {
			throw new DiscordAiUnavailableError(
				classification.category,
				classification.statusCode
			);
		}

		let settings: AiFallbackSettings;
		try {
			settings = await this.deps.load_settings();
		} catch {
			throw new DiscordAiUnavailableError("settings_unavailable");
		}

		const model = settings.customProviderModel?.trim() || null;
		if (
			!settings.discordAiTextFallbackEnabled ||
			!model ||
			!this.deps.customTextProvider
		) {
			throw new DiscordAiUnavailableError(
				classification.category,
				classification.statusCode
			);
		}

		const eventBase = {
			primaryProvider: "mistral" as const,
			fallbackProvider: "custom" as const,
			category: classification.category,
			statusCode: classification.statusCode,
			capability,
		};

		emit_event(this.deps.event_sink, {
			...eventBase,
			type: "discord_ai_fallback_attempted",
			success: false,
		});

		try {
			const fallback = await this.deps.customTextProvider.create_text_completion({
				user_prompt: input.user_prompt,
				model,
				reasoning_mode: settings.customProviderReasoningMode,
				capability,
				history: input.history,
			});

			emit_event(this.deps.event_sink, {
				...eventBase,
				type: "discord_ai_fallback_succeeded",
				success: true,
			});

			return {
				content: fallback.content,
				provider: "custom",
			};
		} catch {
			emit_event(this.deps.event_sink, {
				...eventBase,
				type: "discord_ai_fallback_failed",
				success: false,
			});
			throw new DiscordAiUnavailableError("fallback_unavailable");
		}
	}
}

export function create_llm_client_for_tests(input: {
	mistral?: LlmMistralProvider | null;
	customTextProvider?: LlmCustomProvider | null;
	load_settings?: AiFallbackSettingsLoader;
	timeout_ms?: TimeoutMsProvider;
	create_timeout?: TimeoutFactory;
	event_sink?: RuntimeEventSink;
}): LlmClient {
	return new LlmClient({
		mistral: input.mistral ?? null,
		customTextProvider: input.customTextProvider ?? null,
		load_settings:
			input.load_settings ??
			(async () => ({
				discordAiTextFallbackEnabled: true,
				customProviderModel: "opaque-test-model",
				customProviderReasoningMode: "omit",
			})),
		timeout_ms: input.timeout_ms ?? (() => 90_000),
		create_timeout: input.create_timeout,
		event_sink: input.event_sink,
	});
}
