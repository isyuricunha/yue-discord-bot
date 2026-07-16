import assert from "node:assert/strict";
import test from "node:test";

import {
	DEFAULT_DISCORD_AI_SYSTEM_PROMPT,
	build_text_only_contract,
	load_discord_ai_system_prompt,
	resolve_discord_ai_system_prompt_path,
} from "./discord_ai_system_prompt";

test("resolves the generic Discord prompt path before the legacy Mistral alias", () => {
	assert.equal(
		resolve_discord_ai_system_prompt_path({
			DISCORD_AI_SYSTEM_PROMPT_PATH: " /app/prompts/system_prompt.txt ",
			MISTRAL_PROMPT_PATH: "/legacy/prompt.txt",
		}),
		"/app/prompts/system_prompt.txt"
	);
	assert.equal(
		resolve_discord_ai_system_prompt_path({
			MISTRAL_PROMPT_PATH: " /legacy/prompt.txt ",
		}),
		"/legacy/prompt.txt"
	);
	assert.equal(resolve_discord_ai_system_prompt_path({}), null);
});

test("loads a provider-neutral default prompt when no prompt file is configured", async () => {
	const original_generic = process.env.DISCORD_AI_SYSTEM_PROMPT_PATH;
	const original_legacy = process.env.MISTRAL_PROMPT_PATH;
	delete process.env.DISCORD_AI_SYSTEM_PROMPT_PATH;
	delete process.env.MISTRAL_PROMPT_PATH;

	try {
		const prompt = await load_discord_ai_system_prompt();
		assert.equal(prompt, DEFAULT_DISCORD_AI_SYSTEM_PROMPT);
		assert.match(prompt, /helpful Discord bot assistant/);
		assert.equal(prompt.includes("Yue"), false);
		assert.equal(prompt.includes("Mistral"), false);
	} finally {
		if (original_generic === undefined) {
			delete process.env.DISCORD_AI_SYSTEM_PROMPT_PATH;
		} else {
			process.env.DISCORD_AI_SYSTEM_PROMPT_PATH = original_generic;
		}
		if (original_legacy === undefined) {
			delete process.env.MISTRAL_PROMPT_PATH;
		} else {
			process.env.MISTRAL_PROMPT_PATH = original_legacy;
		}
	}
});

test("builds a provider-neutral mandatory text-only contract", () => {
	const contract = build_text_only_contract("text");
	assert.match(contract, /configured system prompt/);
	assert.match(contract, /Reply in the same language as the user/);
	assert.match(contract, /text-only mode/);
	assert.match(contract, /Never claim that web search was performed/);
	assert.match(contract, /Never claim that an image or file was generated/);
	assert.match(contract, /Never claim that a tool was executed/);
	assert.match(contract, /Never fabricate URLs, citations, sources/);
	assert.match(contract, /Never mention providers, models, fallback/);
	assert.equal(contract.includes("Yue"), false);
	assert.equal(contract.includes("Ella"), false);
});

test("adds capability-specific text-only guidance", () => {
	const image_contract = build_text_only_contract("image_generation");
	assert.match(image_contract, /Do not claim an image exists/);
	assert.match(image_contract, /improved image-generation prompt/);

	const web_contract = build_text_only_contract("web_search");
	assert.match(web_contract, /Do not claim live results were retrieved/);
	assert.match(web_contract, /Do not fabricate fresh facts or source URLs/);

	const text_contract = build_text_only_contract("text");
	assert.match(text_contract, /following the configured system prompt/);
});
