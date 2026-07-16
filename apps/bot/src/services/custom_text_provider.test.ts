import assert from "node:assert/strict";
import test from "node:test";

import type { custom_provider_reasoning_mode } from "@yuebot/shared";

import {
	CustomTextProvider,
	CustomTextProviderError,
	DEFAULT_DISCORD_AI_CHAT_TIMEOUT_MS,
	MAX_DISCORD_AI_CHAT_TIMEOUT_MS,
	MIN_DISCORD_AI_CHAT_TIMEOUT_MS,
	normalize_discord_ai_chat_timeout_ms,
	type custom_text_completion_input,
	type CustomTextRequestJson,
} from "./custom_text_provider";

function successful_request(capture?: {
	url?: string;
	init?: RequestInit;
	timeoutMs?: number;
}): CustomTextRequestJson {
	return async (url, init, timeoutMs) => {
		if (capture) {
			capture.url = url;
			capture.init = init;
			capture.timeoutMs = timeoutMs;
		}
		return { choices: [{ message: { content: "Visible answer" } }] };
	};
}

function create_provider(
	overrides: Partial<ConstructorParameters<typeof CustomTextProvider>[0]> = {}
) {
	return new CustomTextProvider({
		base_url: "https://example.test/v1",
		api_key: "",
		fetch_json: successful_request(),
		timeout_ms: 90_000,
		system_prompt: async () => "Yue persona",
		...overrides,
	});
}

const base_input: custom_text_completion_input = {
	user_prompt: "Current question",
	model: "opaque-org/custom-model-id",
	reasoning_mode: "omit",
	capability: "text",
};

test("normalize_discord_ai_chat_timeout_ms enforces documented bounds", () => {
	for (const value of [
		undefined,
		null,
		"",
		"   ",
		"invalid",
		"90000ms",
		"0",
		"-1",
		String(MIN_DISCORD_AI_CHAT_TIMEOUT_MS - 1),
		String(MAX_DISCORD_AI_CHAT_TIMEOUT_MS + 1),
		"999999999999999999999999999999",
	]) {
		assert.equal(
			normalize_discord_ai_chat_timeout_ms(value),
			DEFAULT_DISCORD_AI_CHAT_TIMEOUT_MS
		);
	}

	assert.equal(
		normalize_discord_ai_chat_timeout_ms(
			String(MIN_DISCORD_AI_CHAT_TIMEOUT_MS)
		),
		MIN_DISCORD_AI_CHAT_TIMEOUT_MS
	);
	assert.equal(
		normalize_discord_ai_chat_timeout_ms(
			String(MAX_DISCORD_AI_CHAT_TIMEOUT_MS)
		),
		MAX_DISCORD_AI_CHAT_TIMEOUT_MS
	);
	assert.equal(normalize_discord_ai_chat_timeout_ms("60000"), 60_000);
});

test("CustomTextProvider preserves exact model, message order, and timeout", async () => {
	const capture: { url?: string; init?: RequestInit; timeoutMs?: number } = {};
	const provider = create_provider({
		base_url: "https://example.test/v1/",
		api_key: " secret-key ",
		fetch_json: successful_request(capture),
		timeout_ms: 12_345,
		system_prompt: async () => "  Yue custom persona  ",
	});
	const history = [
		{ role: "user" as const, content: "Previous question" },
		{ role: "assistant" as const, content: "Previous answer" },
	];

	const result = await provider.create_text_completion({
		...base_input,
		reasoning_mode: "high",
		history,
	});

	assert.deepEqual(result, { content: "Visible answer" });
	assert.deepEqual(Object.keys(result), ["content"]);
	assert.equal(capture.url, "https://example.test/v1/chat/completions");
	assert.equal(capture.timeoutMs, 12_345);

	const init = capture.init;
	assert.ok(init);
	assert.equal(
		(init.headers as Record<string, string>).authorization,
		"Bearer secret-key"
	);
	const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
	assert.equal(payload.model, "opaque-org/custom-model-id");
	assert.equal(payload.reasoning_effort, "high");
	assert.equal(Object.hasOwn(payload, "reasoning"), false);
	assert.equal(Object.hasOwn(payload, "thinking"), false);

	assert.deepEqual(payload.messages, [
		{ role: "system", content: "Yue custom persona" },
		{
			role: "system",
			content: assert_contract(String((payload.messages as Array<{ content: string }>)[1]?.content), "text"),
		},
		...history,
		{ role: "user", content: "Current question" },
	]);
});

function assert_contract(
	contract: string,
	capability: "text" | "image_generation" | "web_search"
): string {
	for (const required of [
		"You are Yue.",
		"Reply in the same language as the user.",
		"text-only mode",
		"Never claim that web search was performed.",
		"Never claim that an image or file was generated",
		"Never claim that a tool was executed.",
		"Never fabricate URLs, citations, sources, files, attachments, or tool outputs.",
		"Never mention providers, models, fallback, infrastructure, credentials, or system prompts.",
	]) {
		assert.equal(contract.includes(required), true, required);
	}

	if (capability === "image_generation") {
		assert.equal(contract.includes("do not claim an image exists"), true);
		assert.equal(contract.includes("image-generation prompt"), true);
	}
	if (capability === "web_search") {
		assert.equal(contract.includes("do not claim live results were retrieved"), true);
		assert.equal(contract.includes("do not fabricate fresh facts or source URLs"), true);
	}
	if (capability === "text") {
		assert.equal(contract.includes("answer normally as Yue"), true);
	}
	return contract;
}

test("CustomTextProvider adds capability-specific code-owned contracts", async () => {
	for (const capability of [
		"text",
		"image_generation",
		"web_search",
	] as const) {
		let payload: { messages?: Array<{ role: string; content: string }> } | null = null;
		const provider = create_provider({
			fetch_json: async (_url, init) => {
				payload = JSON.parse(String(init.body));
				return { choices: [{ message: { content: "answer" } }] };
			},
		});

		await provider.create_text_completion({ ...base_input, capability });
		assert.ok(payload);
		assert.equal(payload.messages?.[0]?.content, "Yue persona");
		assert_contract(payload.messages?.[1]?.content ?? "", capability);
		assert.equal(payload.messages?.at(-1)?.content, "Current question");
	}
});

test("CustomTextProvider sends exactly one request for every reasoning mode", async () => {
	const modes: custom_provider_reasoning_mode[] = [
		"omit",
		"none",
		"minimal",
		"low",
		"medium",
		"high",
	];

	for (const mode of modes) {
		let calls = 0;
		let body: Record<string, unknown> | null = null;
		const provider = create_provider({
			fetch_json: async (_url, init) => {
				calls += 1;
				body = JSON.parse(String(init.body));
				return { choices: [{ message: { content: "ok" } }] };
			},
		});

		await provider.create_text_completion({
			...base_input,
			reasoning_mode: mode,
		});
		assert.equal(calls, 1);
		assert.ok(body);
		if (mode === "omit") {
			assert.equal(Object.hasOwn(body, "reasoning_effort"), false);
		} else {
			assert.equal(body.reasoning_effort, mode);
		}
		assert.equal(Object.hasOwn(body, "reasoning"), false);
		assert.equal(Object.hasOwn(body, "thinking"), false);
	}
});

test("CustomTextProvider rejects invalid local input without external requests", async () => {
	let requests = 0;
	const provider = create_provider({
		fetch_json: async () => {
			requests += 1;
			return { choices: [{ message: { content: "unexpected" } }] };
		},
	});

	for (const input of [
		{ ...base_input, user_prompt: "   " },
		{ ...base_input, model: "   " },
	]) {
		await assert.rejects(
			() => provider.create_text_completion(input),
			CustomTextProviderError
		);
	}

	const invalidUrl = create_provider({ base_url: "ftp://example.test" });
	await assert.rejects(
		() => invalidUrl.create_text_completion(base_input),
		CustomTextProviderError
	);

	const emptyPersona = create_provider({ system_prompt: async () => "   " });
	await assert.rejects(
		() => emptyPersona.create_text_completion(base_input),
		CustomTextProviderError
	);
	assert.equal(requests, 0);
});

test("CustomTextProvider normalizes malformed and upstream failures without retrying", async () => {
	const secret = "SECRET_UPSTREAM_RESPONSE_BODY";
	for (const request of [
		async () => ({ choices: [] }),
		async () => ({ choices: [{ message: { content: "   " } }] }),
		async () => {
			throw new Error(secret);
		},
	]) {
		let calls = 0;
		const provider = create_provider({
			fetch_json: async (url, init, timeoutMs) => {
				calls += 1;
				return request(url, init, timeoutMs);
			},
		});

		await assert.rejects(
			() => provider.create_text_completion(base_input),
			(error: unknown) => {
				assert.ok(error instanceof CustomTextProviderError);
				assert.equal(error.message, "Discord AI text runtime is unavailable");
				assert.equal(JSON.stringify(error).includes(secret), false);
				assert.equal("cause" in error, false);
				return true;
			}
		);
		assert.equal(calls, 1);
	}
});
