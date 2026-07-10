import {
	MistralClient,
	type mistral_completion_input,
	type mistral_completion_result,
} from "./mistral.service";

import { logger } from "../utils/logger";

type llm_provider = "mistral";

export type llm_completion_input = mistral_completion_input;

export type llm_completion_result = {
	content: string;
	provider: llm_provider;
	attachments?: Array<{
		filename: string;
		content_type: string;
		data: Buffer;
	}>;
};

export class LlmClient {
	constructor(private readonly mistral: MistralClient) {
	}

	async create_completion(
		input: llm_completion_input
	): Promise<llm_completion_result> {
		const result: mistral_completion_result =
			await this.mistral.create_completion(input);

		logger.debug({ provider: "mistral" }, "LLM request completed");
		return {
			content: result.content,
			provider: "mistral",
			attachments: result.attachments,
		};
	}
}

function create_llm_client_for_tests(input: {
	mistral: Pick<MistralClient, "create_completion">;
}): LlmClient {
	return new LlmClient(input.mistral as MistralClient);
}
