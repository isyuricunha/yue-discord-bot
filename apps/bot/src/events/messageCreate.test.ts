import assert from "node:assert/strict";
import test from "node:test";

import type { Message } from "discord.js";

import { afkService } from "../services/afk.service";
import { autoModService } from "../services/automod.service";
import { autoroleService } from "../services/autorole.service";
import { get_conversation_backend } from "../services/conversation_backend_factory";
import { customCommandService } from "../services/customCommand.service";
import { keywordTriggerService } from "../services/keywordTrigger.service";
import { create_llm_client_for_tests } from "../services/llm_client";
import {
	reset_llm_client_singleton_for_tests,
	set_llm_client_singleton_for_tests,
} from "../services/llm_client_singleton";
import { MistralApiError } from "../services/mistral.service";
import { suggestionService } from "../services/suggestion.service";
import { xpService } from "../services/xp.service";
import { handleMessageCreate } from "./messageCreate";

type mutable_record = Record<string, unknown>;

function patch_method(
	target: object,
	name: string,
	replacement: unknown
): () => void {
	const record = target as mutable_record;
	const original = record[name];
	record[name] = replacement;
	return () => {
		record[name] = original;
	};
}

function isolate_non_ai_services(): () => void {
	const restore = [
		patch_method(autoModService, "checkMessage", async () => false),
		patch_method(afkService, "getAfk", async () => null),
		patch_method(afkService, "getAfks", async () => []),
		patch_method(autoroleService, "handle_message", async () => undefined),
		patch_method(suggestionService, "handle_message", async () => false),
		patch_method(customCommandService, "handle_message", async () => false),
		patch_method(keywordTriggerService, "handle_message", async () => undefined),
		patch_method(xpService, "handle_message", async () => undefined),
	];
	return () => {
		for (const restoreMethod of restore.reverse()) restoreMethod();
	};
}

let messageSequence = 0;

function create_message(content: string) {
	messageSequence += 1;
	const guildId = `guild-${messageSequence}`;
	const channelId = `channel-${messageSequence}`;
	const userId = `user-${messageSequence}`;
	const replies: Array<{
		content?: string;
		files?: unknown[];
		allowedMentions?: unknown;
	}> = [];
	const followUps: unknown[] = [];

	const message = {
		content,
		author: { id: userId, bot: false },
		client: { user: { id: "bot-user" } },
		guild: { id: guildId },
		guildId,
		channelId,
		mentions: { users: new Map<string, unknown>() },
		reference: null,
		channel: {
			id: channelId,
			messages: { cache: new Map<string, unknown>() },
			sendTyping: async () => undefined,
			send: async (payload: unknown) => {
				followUps.push(payload);
			},
		},
		fetchReference: async () => {
			throw new Error("No reference");
		},
		reply: async (payload: {
			content?: string;
			files?: unknown[];
			allowedMentions?: unknown;
		}) => {
			replies.push(payload);
			return undefined;
		},
	} as unknown as Message;

	return {
		message,
		replies,
		followUps,
		key: `${guildId}:${channelId}:${userId}`,
	};
}

async function cleanup_message_test(
	restoreServices: () => void,
	key: string,
	previousAgentId: string | undefined,
	previousImageAgentId: string | undefined
) {
	restoreServices();
	reset_llm_client_singleton_for_tests();
	await get_conversation_backend().clear(key);
	if (previousAgentId === undefined) delete process.env.MISTRAL_AGENT_ID;
	else process.env.MISTRAL_AGENT_ID = previousAgentId;
	if (previousImageAgentId === undefined) delete process.env.MISTRAL_IMAGE_AGENT_ID;
	else process.env.MISTRAL_IMAGE_AGENT_ID = previousImageAgentId;
}

test("messageCreate keeps image tool prompts away from text-only fallback", async (t) => {
	const restoreServices = isolate_non_ai_services();
	const previousAgentId = process.env.MISTRAL_AGENT_ID;
	const previousImageAgentId = process.env.MISTRAL_IMAGE_AGENT_ID;
	process.env.MISTRAL_AGENT_ID = "agent-test";
	process.env.MISTRAL_IMAGE_AGENT_ID = "image-agent-test";

	const state = create_message("Yue gere uma imagem de uma cidade cyberpunk");
	t.after(() =>
		cleanup_message_test(
			restoreServices,
			state.key,
			previousAgentId,
			previousImageAgentId
		)
	);

	let mistralPrompt = "";
	let customInput: {
		user_prompt: string;
		capability: string;
		history?: unknown[];
	} | null = null;
	const client = create_llm_client_for_tests({
		mistral: {
			create_completion: async (input) => {
				mistralPrompt = input.user_prompt;
				throw new MistralApiError("safe", 429, null, null);
			},
		},
		customTextProvider: {
			create_text_completion: async (input) => {
				customInput = input;
				return {
					content:
						"Posso montar uma descrição e um prompt detalhado para essa imagem.",
				};
			},
		},
	});
	set_llm_client_singleton_for_tests(client);

	await handleMessageCreate(state.message);

	assert.equal(mistralPrompt.includes("Use the image_generation tool"), true);
	assert.equal(mistralPrompt.includes("cidade cyberpunk"), true);
	assert.ok(customInput);
	assert.equal(customInput.user_prompt, "gere uma imagem de uma cidade cyberpunk");
	assert.equal(customInput.capability, "image_generation");
	assert.equal(
		JSON.stringify(customInput).includes("Use the image_generation tool"),
		false
	);
	assert.equal(state.replies.length, 1);
	assert.deepEqual(state.replies[0]?.files, []);
	assert.deepEqual(state.replies[0]?.allowedMentions, {
		parse: [],
		repliedUser: false,
	});

	const history = await get_conversation_backend().get_history(state.key);
	assert.deepEqual(history, [
		{ role: "user", content: "gere uma imagem de uma cidade cyberpunk" },
		{
			role: "assistant",
			content:
				"Posso montar uma descrição e um prompt detalhado para essa imagem.",
		},
	]);
});

test("messageCreate keeps Agent web-search instructions away from fallback", async (t) => {
	const restoreServices = isolate_non_ai_services();
	const previousAgentId = process.env.MISTRAL_AGENT_ID;
	const previousImageAgentId = process.env.MISTRAL_IMAGE_AGENT_ID;
	process.env.MISTRAL_AGENT_ID = "agent-test";
	delete process.env.MISTRAL_IMAGE_AGENT_ID;

	const state = create_message("Yue pesquisa: latest TypeScript release");
	t.after(() =>
		cleanup_message_test(
			restoreServices,
			state.key,
			previousAgentId,
			previousImageAgentId
		)
	);

	let mistralPrompt = "";
	let customPrompt = "";
	let capability = "";
	const client = create_llm_client_for_tests({
		mistral: {
			create_completion: async (input) => {
				mistralPrompt = input.user_prompt;
				throw new MistralApiError("safe", 503, null, null);
			},
		},
		customTextProvider: {
			create_text_completion: async (input) => {
				customPrompt = input.user_prompt;
				capability = input.capability;
				return { content: "Não consegui consultar resultados ao vivo agora." };
			},
		},
	});
	set_llm_client_singleton_for_tests(client);

	await handleMessageCreate(state.message);

	assert.equal(mistralPrompt.includes("Use the web_search tool"), true);
	assert.equal(customPrompt, "latest TypeScript release");
	assert.equal(capability, "web_search");
	assert.equal(customPrompt.includes("Use the web_search tool"), false);
	assert.equal(
		state.replies[0]?.content,
		"Não consegui consultar resultados ao vivo agora."
	);
	assert.equal(state.replies[0]?.content?.includes("Fontes:"), false);
});

test("messageCreate keeps local-search capability while making one DDG request", async (t) => {
	const restoreServices = isolate_non_ai_services();
	const previousAgentId = process.env.MISTRAL_AGENT_ID;
	const previousImageAgentId = process.env.MISTRAL_IMAGE_AGENT_ID;
	const previousFetch = globalThis.fetch;
	delete process.env.MISTRAL_AGENT_ID;
	delete process.env.MISTRAL_IMAGE_AGENT_ID;

	let fetchCalls = 0;
	globalThis.fetch = async () => {
		fetchCalls += 1;
		return new Response(
			JSON.stringify({
				AbstractText: "A stable fact from the search adapter.",
				AbstractURL: "https://example.test/source",
				RelatedTopics: [],
			}),
			{ status: 200, headers: { "content-type": "application/json" } }
		);
	};

	const state = create_message("Yue search: stable fact");
	t.after(async () => {
		globalThis.fetch = previousFetch;
		await cleanup_message_test(
			restoreServices,
			state.key,
			previousAgentId,
			previousImageAgentId
		);
	});

	let customPrompt = "";
	let capability = "";
	const client = create_llm_client_for_tests({
		mistral: null,
		customTextProvider: {
			create_text_completion: async (input) => {
				customPrompt = input.user_prompt;
				capability = input.capability;
				return { content: "General-knowledge text response." };
			},
		},
	});
	set_llm_client_singleton_for_tests(client);

	await handleMessageCreate(state.message);

	assert.equal(fetchCalls, 1);
	assert.equal(customPrompt, "stable fact");
	assert.equal(capability, "web_search");
	assert.equal(
		state.replies[0]?.content,
		"General-knowledge text response."
	);
	assert.equal(state.replies[0]?.content?.includes("example.test"), false);
});

test("messageCreate preserves Mistral attachments and source-ready text", async (t) => {
	const restoreServices = isolate_non_ai_services();
	const previousAgentId = process.env.MISTRAL_AGENT_ID;
	const previousImageAgentId = process.env.MISTRAL_IMAGE_AGENT_ID;
	const state = create_message("Yue hello");
	t.after(() =>
		cleanup_message_test(
			restoreServices,
			state.key,
			previousAgentId,
			previousImageAgentId
		)
	);

	const client = create_llm_client_for_tests({
		mistral: {
			create_completion: async () => ({
				content: "Answer with a source: https://example.test",
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
	set_llm_client_singleton_for_tests(client);

	await handleMessageCreate(state.message);

	assert.equal(
		state.replies[0]?.content,
		"Answer with a source: https://example.test"
	);
	assert.equal(state.replies[0]?.files?.length, 1);
	assert.deepEqual(state.replies[0]?.allowedMentions, {
		parse: [],
		repliedUser: false,
	});
});
