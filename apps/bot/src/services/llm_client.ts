import {
	ConnectionError,
	HTTPClientError,
	RequestAbortedError,
	RequestTimeoutError,
	UnexpectedClientError,
} from "@mistralai/mistralai/models/errors";
import { MistralError } from "@mistralai/mistralai/models/errors/mistralerror";

import {
	GroqApiError,
	type groq_completion_input,
	type groq_completion_result,
	GroqClient,
} from "./groq.service";
import {
	MistralClient,
	MistralApiError,
	type mistral_completion_input,
	type mistral_completion_result,
} from "./mistral.service";

import { logger } from "../utils/logger";

export type llm_provider = "mistral" | "groq";

export type llm_completion_input = groq_completion_input &
	mistral_completion_input;

export type llm_completion_result = {
	content: string;
	provider: llm_provider;
	attachments?: Array<{
		filename: string;
		content_type: string;
		data: Buffer;
	}>;
};

function is_retryable_mistral_error(error: unknown): boolean {
	if (error instanceof MistralApiError) {
		const status = error.status;
		if (status === 401 || status === 403) return false;
		return status === 429 || status >= 500;
	}

	if (error instanceof MistralError) {
		const status = error.statusCode;
		if (status === 401 || status === 403) return false;
		return status === 429 || status >= 500;
	}

	if (error instanceof ConnectionError) return true;
	if (error instanceof RequestTimeoutError) return true;
	if (error instanceof RequestAbortedError) return true;
	if (error instanceof UnexpectedClientError) return true;

	if (error instanceof HTTPClientError) return true;

	return true;
}

function is_retryable_groq_error(error: unknown): boolean {
	if (error instanceof GroqApiError) {
		return (
			error.status === 401 ||
			error.status === 403 ||
			error.status === 429 ||
			error.status >= 500
		);
	}

	return true;
}

export class LlmClient {
	private did_log_first_success_provider = false;

	constructor(
		private readonly mistral: MistralClient | null,
		private readonly groq: GroqClient | null
	) {
		if (!mistral && !groq) {
			throw new Error("At least one LLM provider must be configured");
		}
	}

	async create_completion(
		input: llm_completion_input
	): Promise<llm_completion_result> {
		let last_error: unknown = null;

		if (this.mistral) {
			try {
				const result: mistral_completion_result =
					await this.mistral.create_completion(input);

				if (!this.did_log_first_success_provider) {
					this.did_log_first_success_provider = true;
					logger.info({ provider: "mistral" }, "LLM provider in use");
				}

				return {
					content: result.content,
					provider: "mistral",
					attachments: result.attachments,
				};
			} catch (error: unknown) {
				last_error = error;
				const can_fallback =
					this.groq !== null && is_retryable_mistral_error(error);

				if (can_fallback) {
					const status =
						error instanceof MistralApiError
							? error.status
							: error instanceof MistralError
								? error.statusCode
								: null;
					logger.warn(
						{ fallback: { from: "mistral", to: "groq", status } },
						"LLM fallback triggered"
					);
				}

				if (!can_fallback) throw error;
			}
		}

		if (this.groq) {
			try {
				const result: groq_completion_result =
					await this.groq.create_completion(input);

				if (!this.did_log_first_success_provider) {
					this.did_log_first_success_provider = true;
					logger.info({ provider: "groq" }, "LLM provider in use");
				}

				return { content: result.content, provider: "groq" };
			} catch (error: unknown) {
				last_error = error;
				const can_fallback = is_retryable_groq_error(error);
				if (!can_fallback) throw error;
			}
		}

		if (last_error) throw last_error;
		throw new Error("Failed to get LLM completion");
	}
}

export function create_llm_client_for_tests(input: {
	mistral: Pick<MistralClient, "create_completion"> | null;
	groq: Pick<GroqClient, "create_completion"> | null;
}): LlmClient {
	return new LlmClient(
		input.mistral as MistralClient | null,
		input.groq as GroqClient | null
	);
}
