import { LlmClient } from "./llm_client";
import { MistralClient } from "./mistral.service";
import { GroqClient } from "./groq.service";

let cached: LlmClient | null | undefined;

export function get_llm_client(): LlmClient | null {
	if (cached !== undefined) return cached;

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

	cached = new LlmClient(mistral, groq);
	return cached;
}
