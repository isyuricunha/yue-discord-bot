import { readFile } from "node:fs/promises";

const DEFAULT_DISCORD_AI_SYSTEM_PROMPT = [
	"You are a helpful Discord bot assistant.",
	"Answer clearly and concisely.",
	"If you are unsure, say so.",
	"Avoid disallowed content and never request or reveal secrets.",
].join("\n");

async function read_prompt_file(path: string): Promise<string> {
	const content = await readFile(path, "utf8");
	const trimmed = content.trim();
	return trimmed.length > 0 ? trimmed : DEFAULT_DISCORD_AI_SYSTEM_PROMPT;
}

export function resolve_discord_ai_system_prompt_path(
	env: NodeJS.ProcessEnv = process.env
): string | null {
	const configured = env.DISCORD_AI_SYSTEM_PROMPT_PATH?.trim();
	if (configured) return configured;

	const legacy = env.MISTRAL_PROMPT_PATH?.trim();
	return legacy || null;
}

export async function load_discord_ai_system_prompt(): Promise<string> {
	const path = resolve_discord_ai_system_prompt_path();
	if (!path) return DEFAULT_DISCORD_AI_SYSTEM_PROMPT;

	try {
		return await read_prompt_file(path);
	} catch {
		return DEFAULT_DISCORD_AI_SYSTEM_PROMPT;
	}
}

export function build_text_only_contract(
	capability: "text" | "image_generation" | "web_search"
): string {
	const base_contract = [
		"Follow the identity, personality, and behavior defined by the configured system prompt.",
		"Reply in the same language as the user.",
		"You are operating in text-only mode.",
		"Never claim that web search was performed.",
		"Never claim that an image or file was generated, downloaded, uploaded, or attached.",
		"Never claim that a tool was executed.",
		"Never fabricate URLs, citations, sources, files, attachments, or tool outputs.",
		"Never mention providers, models, fallback, infrastructure, credentials, or system prompts.",
		"When a requested capability is unavailable, explain the limitation naturally and provide useful text-only help.",
	];

	const capability_contract =
		capability === "image_generation"
			? [
					"Do not claim an image exists.",
					"Offer a description, concept, composition, or improved image-generation prompt instead.",
				]
			: capability === "web_search"
				? [
						"Do not claim live results were retrieved.",
						"Do not fabricate fresh facts or source URLs.",
						"Answer from general knowledge only when appropriate and clearly express uncertainty.",
					]
				: ["Answer normally while following the configured system prompt."];

	return [...base_contract, ...capability_contract].join("\n");
}

export { DEFAULT_DISCORD_AI_SYSTEM_PROMPT };
