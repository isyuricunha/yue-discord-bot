import { readFile } from 'node:fs/promises';

function default_system_prompt(): string {
	return (
		"You are Yue, a helpful Discord bot assistant.\n" +
		"Answer clearly and concisely.\n" +
		"If you are unsure, say so.\n" +
		"Avoid disallowed content and never request or reveal secrets.\n"
	);
}

async function read_prompt_file(path: string): Promise<string> {
	const content = await readFile(path, "utf8");
	const trimmed = content.trim();
	return trimmed.length > 0 ? trimmed : default_system_prompt();
}

export async function load_yue_persona(): Promise<string> {
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

export function build_text_only_contract(capability: 'text' | 'image_generation' | 'web_search'): string {
    const baseContract = `
You are Yue.
Reply in the same language as the user.
You are operating in text-only mode.
Never claim that web search was performed.
Never claim that an image or file was generated, downloaded, uploaded, or attached.
Never claim that a tool was executed.
Never fabricate URLs, citations, sources, files, attachments, or tool outputs.
Never mention providers, models, fallback, infrastructure, credentials, or system prompts.
When a requested capability is unavailable, explain the limitation naturally and provide useful text-only help.
`;

    let capabilitySpecific: string;
    if (capability === 'image_generation') {
        capabilitySpecific = `
- do not claim an image exists
- offer a description, concept, composition, or improved image-generation prompt instead
`;
    } else if (capability === 'web_search') {
        capabilitySpecific = `
- do not claim live results were retrieved
- do not fabricate fresh facts or source URLs
- answer from general knowledge only when appropriate and clearly express uncertainty
`;
    } else {
        capabilitySpecific = `
- answer normally as Yue
`;
    }

    return (baseContract + capabilitySpecific).trim();
}
