import assert from "node:assert/strict";
import test from "node:test";

import type { ChatInputCommandInteraction } from "discord.js";

import { create_llm_client_for_tests } from "../../services/llm_client";
import { createAskCommand } from "./ask";

function create_interaction(question: string) {
	const replies: unknown[] = [];
	const followUps: unknown[] = [];
	let deferred = false;

	const interaction = {
		options: { getString: () => question },
		reply: async (payload: unknown) => {
			replies.push(payload);
		},
		deferReply: async () => {
			deferred = true;
		},
		editReply: async (payload: unknown) => {
			replies.push(payload);
		},
		followUp: async (payload: unknown) => {
			followUps.push(payload);
		},
	} as unknown as ChatInputCommandInteraction;

	return {
		interaction,
		replies,
		followUps,
		wasDeferred: () => deferred,
	};
}

test("ask command posts Custom text without files or runtime metadata", async () => {
	let capturedInput: unknown = null;
	const client = create_llm_client_for_tests({
		mistral: null,
		customTextProvider: {
			create_text_completion: async (input) => {
				capturedInput = input;
				return { content: "Paris is the capital of France." };
			},
		},
	});
	const command = createAskCommand({ getLlmClient: () => client });
	const state = create_interaction("What is the capital of France?");

	await command.execute(state.interaction);

	assert.equal(state.wasDeferred(), true);
	assert.deepEqual(capturedInput, {
		user_prompt: "What is the capital of France?",
		model: "opaque-test-model",
		reasoning_mode: "omit",
		capability: "text",
		history: undefined,
	});
	assert.equal(state.replies.length, 1);
	const payload = state.replies[0] as { content: string; files: unknown[] };
	assert.equal(payload.content, "Paris is the capital of France.");
	assert.deepEqual(payload.files, []);
	const serialized = JSON.stringify(payload).toLowerCase();
	for (const forbidden of ["mistral", "custom", "provider", "fallback", "opaque-test-model"]) {
		assert.equal(serialized.includes(forbidden), false);
	}
});

test("ask command preserves Mistral attachments and message splitting", async () => {
	const longAnswer = "a".repeat(2_100);
	const client = create_llm_client_for_tests({
		mistral: {
			create_completion: async () => ({
				content: longAnswer,
				attachments: [
					{
						filename: "generated.png",
						content_type: "image/png",
						data: Buffer.from("image"),
					},
				],
			}),
		},
	});
	const command = createAskCommand({ getLlmClient: () => client });
	const state = create_interaction("hello");

	await command.execute(state.interaction);

	const first = state.replies[0] as { content: string; files: unknown[] };
	assert.ok(first.content.length <= 2_000);
	assert.equal(first.files.length, 1);
	assert.equal(state.followUps.length, 1);
});

test("ask command returns a generic unavailable response on total failure", async () => {
	const secret = "SECRET_PROVIDER_RESPONSE";
	const client = create_llm_client_for_tests({
		mistral: null,
		customTextProvider: {
			create_text_completion: async () => {
				throw new Error(secret);
			},
		},
	});
	const command = createAskCommand({ getLlmClient: () => client });
	const state = create_interaction("question");

	await command.execute(state.interaction);

	const payload = state.replies[0] as { content: string };
	assert.equal(payload.content.includes("IA indisponível"), true);
	assert.equal(payload.content.includes(secret), false);
	const serialized = JSON.stringify(payload).toLowerCase();
	for (const forbidden of ["mistral", "custom", "provider", "fallback", "model"]) {
		assert.equal(serialized.includes(forbidden), false);
	}
});

test("ask command reports an unconfigured bot without external work", async () => {
	const command = createAskCommand({ getLlmClient: () => null });
	const state = create_interaction("question");

	await command.execute(state.interaction);

	assert.equal(state.wasDeferred(), true);
	assert.equal(
		(state.replies[0] as { content: string }).content.includes("não configurada"),
		true
	);
});
