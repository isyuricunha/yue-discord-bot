import test from "node:test";
import assert from "node:assert/strict";

import { MistralError } from "@mistralai/mistralai/models/errors/mistralerror";

import {
	create_mistral_client_for_tests,
	MistralApiError,
} from "./mistral.service";

function create_mistral_429_error(input: {
	retry_after: number;
}): MistralError {
	const res = new Response(
		JSON.stringify({ error: { message: "rate limit" } }),
		{
			status: 429,
			headers: {
				"content-type": "application/json",
				"retry-after": String(input.retry_after),
			},
		}
	);
	const req = new Request("https://api.mistral.ai/v1/chat/completions", {
		method: "POST",
	});
	return new MistralError("rate limit", {
		response: res,
		request: req,
		body: "rate limit",
	});
}

test("mistral: falls back to next key on 429", async () => {
	const calls: string[] = [];

	const clients = [
		{
			chat: {
				complete: async () => {
					calls.push("key-1");
					throw create_mistral_429_error({ retry_after: 5 });
				},
			},
			agents: {
				complete: async () => {
					throw new Error("unexpected");
				},
			},
		},
		{
			chat: {
				complete: async () => {
					calls.push("key-2");
					return {
						choices: [{ message: { content: "hello from key-2" } }],
					} as any;
				},
			},
			agents: {
				complete: async () => {
					throw new Error("unexpected");
				},
			},
		},
	];

	const client = create_mistral_client_for_tests({
		keys: [
			{ api_key: "key-1", agent_id: null },
			{ api_key: "key-2", agent_id: null },
		],
		clients,
		now_ms: () => 0,
		system_prompt: async () => "system",
	});

	const result = await client.create_completion({ user_prompt: "hi" });
	assert.equal(result.content, "hello from key-2");

	assert.deepEqual(calls, ["key-1", "key-2"]);
});

test("mistral: uses agent when configured for the chosen key, otherwise chat with system prompt", async () => {
	const agent_calls: Array<{ key: string; messages: unknown }> = [];
	const chat_calls: Array<{ key: string; messages: unknown }> = [];

	const clients = [
		{
			chat: {
				complete: async (_req: any) => {
					throw new Error("should not be called");
				},
			},
			agents: {
				complete: async (req: any) => {
					agent_calls.push({ key: "key-1", messages: req.messages });
					throw create_mistral_429_error({ retry_after: 1 });
				},
			},
		},
		{
			chat: {
				complete: async (req: any) => {
					chat_calls.push({ key: "key-2", messages: req.messages });
					return {
						choices: [{ message: { content: "hello from key-2" } }],
					} as any;
				},
			},
			agents: {
				complete: async () => {
					throw new Error("should not be called");
				},
			},
		},
	];

	const client = create_mistral_client_for_tests({
		keys: [
			{ api_key: "key-1", agent_id: "agent-1" },
			{ api_key: "key-2", agent_id: null },
		],
		clients,
		now_ms: () => 0,
		system_prompt: async () => "SYSTEM_PROMPT",
	});

	const result = await client.create_completion({
		user_prompt: "hi",
		history: [{ role: "user", content: "previous" }],
	});

	assert.equal(result.content, "hello from key-2");
	assert.equal(agent_calls.length, 1);
	assert.equal(chat_calls.length, 1);

	const chat_messages = chat_calls[0]!.messages as Array<{
		role: string;
		content?: string;
	}>;
	assert.equal(chat_messages[0]?.role, "system");
	assert.equal(chat_messages[0]?.content, "SYSTEM_PROMPT");
});

test("mistral: throws aggregated 429 when all keys are cooling down", async () => {
	const now = { value: 0 };

	const clients = [
		{
			chat: {
				complete: async () => {
					throw create_mistral_429_error({ retry_after: 10 });
				},
			},
			agents: {
				complete: async () => {
					throw new Error("unexpected");
				},
			},
		},
		{
			chat: {
				complete: async () => {
					throw create_mistral_429_error({ retry_after: 10 });
				},
			},
			agents: {
				complete: async () => {
					throw new Error("unexpected");
				},
			},
		},
	];

	const client = create_mistral_client_for_tests({
		keys: [
			{ api_key: "key-1", agent_id: null },
			{ api_key: "key-2", agent_id: null },
		],
		clients,
		now_ms: () => now.value,
		system_prompt: async () => "system",
	});

	await assert.rejects(
		async () => {
			await client.create_completion({ user_prompt: "hi" });
		},
		(err: unknown) => {
			assert.ok(err instanceof MistralApiError);
			assert.equal(err.status, 429);
			assert.ok(typeof err.retry_after_seconds === "number");
			return true;
		}
	);
});
