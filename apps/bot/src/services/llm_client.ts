import type {
	mistral_completion_input,
	mistral_completion_result,
} from "./mistral.service";
import { MistralError } from "@mistralai/mistralai/models/errors";
import { MistralApiError } from "./mistral.service";
import type { custom_text_completion_input, custom_text_completion_result } from "./custom_text_provider";
import type { AiFallbackSettings } from "./ai_fallback_settings.service";

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

export type RuntimeEventSink = (event: {
    type: string;
    primaryProvider: string;
    fallbackProvider: string;
    category: string;
    statusCode: number | null;
    success: boolean;
    capability: string;
}) => void;

function noop_sink() {}

export class MistralNotConfiguredError extends Error {
  readonly code = 'MISTRAL_NOT_CONFIGURED';
  constructor(message = 'Mistral client not configured') {
    super(message);
    this.name = 'MistralNotConfiguredError';
  }
}

export class MistralTimeoutError extends Error {
  readonly code = 'MISTRAL_TIMEOUT';
  constructor(message = 'Mistral request timed out') {
    super(message);
    this.name = 'MistralTimeoutError';
  }
}

export class DiscordAiUnavailableError extends Error {
  readonly name = 'DiscordAiUnavailableError';
  constructor(
    message = 'LLM providers unavailable',
    public readonly statusCode: number | null = null,
    public readonly category: string = 'unavailable'
  ) {
    super(message);
  }
}

export function is_eligible_fallback_error(error: unknown): boolean {
    if (!error) return false;

    if (error instanceof MistralNotConfiguredError || error instanceof MistralTimeoutError) {
        return true;
    }

    if (error instanceof MistralError) {
        const s = error.statusCode;
        return s === 401 || s === 403 || s === 408 || s === 429 || (s >= 500 && s < 600);
    }

    if (error instanceof MistralApiError) {
        const s = error.status;
        return s === 401 || s === 403 || s === 408 || s === 429 || (s >= 500 && s < 600);
    }

    if (error instanceof Error) {
        if (error instanceof TypeError) return false;
        const known_codes = ['ABORTERROR', 'ABORT_ERR', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'];
        const err = error as Error & { code?: unknown };
        const name = err.name ? err.name.toUpperCase() : '';
        const code = typeof err.code === 'string' ? err.code.toUpperCase() : '';

        if (known_codes.includes(name) || known_codes.includes(code)) {
            return true;
        }
    }

    return false;
}

export interface LlmMistralProvider {
  create_completion(input: mistral_completion_input): Promise<mistral_completion_result>;
}

export interface LlmCustomProvider {
  create_text_completion(input: custom_text_completion_input): Promise<custom_text_completion_result>;
}

export type AiFallbackSettingsLoader = () => Promise<AiFallbackSettings>;
export type TimeoutMsProvider = () => number;

export class LlmClient {
	constructor(
		private readonly deps: {
            mistral?: LlmMistralProvider | null;
            customTextProvider?: LlmCustomProvider | null;
            load_settings: AiFallbackSettingsLoader;
            timeout_ms: TimeoutMsProvider;
            event_sink?: RuntimeEventSink;
        }
	) {}

	async create_completion(
		input: llm_completion_input
	): Promise<llm_completion_result> {
		const capability = input.capability ?? 'text';
		const mistralInput: mistral_completion_input = {
			user_prompt: input.mistral_prompt ?? input.user_prompt,
			prefer_image_generation: input.prefer_image_generation,
			history: input.history,
		};

        let mistral_error: unknown = null;
        let mistral_result: mistral_completion_result | null = null;

        if (this.deps.mistral) {
            const mistralPromise = this.deps.mistral.create_completion(mistralInput);
            mistralPromise.catch(() => {});

            let timerId: ReturnType<typeof setTimeout> | undefined;
            const timeoutMs = this.deps.timeout_ms();
            const timeoutPromise = new Promise<never>((_, reject) => {
                timerId = setTimeout(() => {
                    reject(new MistralTimeoutError());
                }, timeoutMs);
            });

            try {
                mistral_result = await Promise.race([mistralPromise, timeoutPromise]);
            } catch (err: unknown) {
                mistral_error = err;
            } finally {
                if (timerId !== undefined) {
                    clearTimeout(timerId);
                }
            }
        } else {
            mistral_error = new MistralNotConfiguredError();
        }

        if (mistral_result) {
            return {
                content: mistral_result.content,
                provider: "mistral",
                attachments: mistral_result.attachments,
            };
        }

        if (is_eligible_fallback_error(mistral_error)) {
            let settings: AiFallbackSettings;
            try {
                settings = await this.deps.load_settings();
            } catch {
                throw new DiscordAiUnavailableError();
            }

            if (settings.discordAiTextFallbackEnabled && settings.customProviderModel && this.deps.customTextProvider) {
                const statusCode = mistral_error instanceof MistralError
                    ? mistral_error.statusCode
                    : mistral_error instanceof MistralApiError
                    ? mistral_error.status
                    : null;

                try {
                    this.deps.event_sink?.({
                        type: 'discord_ai_fallback_attempted',
                        primaryProvider: 'mistral',
                        fallbackProvider: 'custom',
                        category: 'availability',
                        statusCode,
                        success: false,
                        capability
                    });
                } catch {
                    // ignore logging errors
                }

                try {
                    const fallback_result = await this.deps.customTextProvider.create_text_completion({
                        user_prompt: input.user_prompt,
                        model: settings.customProviderModel,
                        reasoning_mode: settings.customProviderReasoningMode,
                        capability,
                        history: input.history,
                    });

                    try {
                        this.deps.event_sink?.({
                            type: 'discord_ai_fallback_succeeded',
                            primaryProvider: 'mistral',
                            fallbackProvider: 'custom',
                            category: 'availability',
                            statusCode,
                            success: true,
                            capability
                        });
                    } catch {
                        // ignore logging errors
                    }

                    return {
                        content: fallback_result.content,
                        provider: "custom",
                    };
                } catch {
                    try {
                        this.deps.event_sink?.({
                            type: 'discord_ai_fallback_failed',
                            primaryProvider: 'mistral',
                            fallbackProvider: 'custom',
                            category: 'availability',
                            statusCode,
                            success: false,
                            capability
                        });
                    } catch {
                        // ignore logging errors
                    }

                    throw new DiscordAiUnavailableError();
                }
            }
        }

        throw new DiscordAiUnavailableError();
	}
}

export function create_llm_client_for_tests(input: {
	mistral?: LlmMistralProvider | null;
	customTextProvider?: LlmCustomProvider | null;
    load_settings?: AiFallbackSettingsLoader;
    timeout_ms?: TimeoutMsProvider;
    event_sink?: RuntimeEventSink;
}): LlmClient {
	return new LlmClient({
        mistral: input.mistral ?? null,
        customTextProvider: input.customTextProvider ?? null,
        load_settings: input.load_settings ?? (async () => ({
            discordAiTextFallbackEnabled: true,
            customProviderModel: 'opaque-test-model',
            customProviderReasoningMode: 'omit'
        })),
        timeout_ms: input.timeout_ms ?? (() => 1000),
        event_sink: input.event_sink ?? noop_sink
    });
}
