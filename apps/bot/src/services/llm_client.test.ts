import assert from "node:assert/strict";
import test from "node:test";

import { MistralError } from "@mistralai/mistralai/models/errors";

import type { custom_text_completion_input } from "./custom_text_provider";
import {
	classify_mistral_failure,
	create_llm_client_for_tests,
	DiscordAiUnavailableError,
	is_eligible_fallback_error,
	MistralNotConfiguredError,
	MistralTimeoutError,
	type RuntimeEvent,
	type TimeoutFactory,
} from "./llm_client";
import { MistralApiError } from "./mistral.service";

function create_fake_mistral_sdk_error(
	statusCode: number,
	message = "Mistral HTTP error"
): MistralError {
	const response = new Response("{}", {
		status: statusCode,
		headers: { "content-type": "application/json" },
	});
	const request = new Request("https://api.mistral.ai/v1/conversations");
	return new MistralError(message, { response, request, body: "{}" });
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

const never_timeout: TimeoutFactory = () => ({
	promise: new Promise<never>(() => undefined),
	cancel: () => undefined,
});

test("classify_mistral_failure uses strict typed eligibility", () => {
	for (const status of [401, 403, 408, 429, 500, 503, 599]) {
		assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(status)), true);
		assert.equal(
			is_eligible_fallback_error(new MistralApiError("safe", status, null, null)),
			true
		);
	}

	for (const status of [400, 404, 409, 418, 422, 499]) {
		assert.equal(is_eligible_fallback_error(create_fake_mistral_sdk_error(status)), false);
		assert.equal(
			is_eligible_fallback_error(new MistralApiError("safe", status, null, null)),
			false
		);
	}

	assert.deepEqual(classify_mistral_failure(new MistralNotConfiguredError()), {
		eligible: true,
		category: "not_configured",
		statusCode: null,
	});
	assert.deepEqual(classify_mistral_failure(new MistralTimeoutError()), {
		eligible: true,
		category: "timeout",
		statusCode: null,
	});

	const reset = Object.assign(new Error("reset"), { code: "ECONNRESET" });
	assert.deepEqual(classify_mistral_failure(reset), {
		eligible: true,
		category: "transport",
		statusCode: null,
	});

	const transportCause = Object.assign(new Error("socket"), { code: "ETIMEDOUT" });
	const fetchFailure = new TypeError("fetch failed", { cause: transportCause });
	assert.equal(is_eligible_fallback_error(fetchFailure), true);

	const abort = new Error("aborted");
	abort.name = "AbortError";
	assert.equal(is_eligible_fallback_error(abort), true);

	class MistralErrorSpoof extends Error {
		readonly statusCode = 503;
	}
	Object.defineProperty(MistralErrorSpoof, "name", { value: "MistralError" });

	for (const error of [
		null,
		undefined,
		new Error("plain"),
		new TypeError("ordinary type error"),
		{ statusCode: 503 },
		{ status: 429 },
		new MistralErrorSpoof("spoof"),
	]) {
		assert.equal(is_eligible_fallback_error(error), false);
	}
});

test("Mistral success avoids settings and Custom while preserving attachments", async () => {
	let settingsCalls = 0;
	let customCalls = 0;
	let capturedPrompt = "";
	const attachment = {
		filename: "image.png",
		content_type: "image/png",
		data: Buffer.from("image"),
	};

	const client = create_llm_client_for_tests({
		mistral: {
			create_completion: async (input) => {
				capturedPrompt = input.user_prompt;
				return { content: "Mistral answer", attachments: [attachment] };
			},
		},
		customTextProvider: {
			create_text_completion: async () => {
				customCalls += 1;
				return { content: "Custom answer" };
			},
		},
		load_settings: async () => {
			settingsCalls += 1;
			return {
				discordAiTextFallbackEnabled: true,
				customProviderModel: "opaque/model",
				customProviderReasoningMode: "high",
			};
		},
		create_timeout: never_timeout,
	});

	const result = await client.create_completion({
		user_prompt: "natural prompt",
		mistral_prompt: "Mistral-specific prompt",
	});

	assert.equal(result.provider, "mistral");
	assert.equal(result.content, "Mistral answer");
	assert.deepEqual(result.attachments, [attachment]);
	assert.equal(capturedPrompt, "Mistral-specific prompt");
	assert.equal(settingsCalls, 0);
	assert.equal(customCalls, 0);
});

test("eligible Mistral failures call Custom once with natural prompt and history", async () => {
	const eligible = [
		create_fake_mistral_sdk_error(401),
		create_fake_mistral_sdk_error(403),
		create_fake_mistral_sdk_error(408),
		create_fake_mistral_sdk_error(429),
		create_fake_mistral_sdk_error(500),
		new MistralApiError("safe", 503, null, null),
		Object.assign(new Error("reset"), { code: "ECONNRESET" }),
	];

	for (const primaryError of eligible) {
		let mistralCalls = 0;
		let customCalls = 0;
		let settingsCalls = 0;
		let customInput: custom_text_completion_input | null = null;
		const events: RuntimeEvent[] = [];
		const history = [
			{ role: "user" as const, content: "previous question" },
			{ role: "assistant" as const, content: "previous answer" },
		];

		const client = create_llm_client_for_tests({
			mistral: {
				create_completion: async () => {
					mistralCalls += 1;
					throw primaryError;
				},
			},
			customTextProvider: {
				create_text_completion: async (input) => {
					customCalls += 1;
					customInput = input;
					return { content: "Custom answer" };
				},
			},
			load_settings: async () => {
				settingsCalls += 1;
				return {
					discordAiTextFallbackEnabled: true,
					customProviderModel: " opaque/model ",
					customProviderReasoningMode: "high",
				};
			},
			create_timeout: never_timeout,
			event_sink: (event) => events.push(event),
		});

		const result = await client.create_completion({
			user_prompt: "natural request",
			mistral_prompt: "Use the web_search tool for the natural request",
			capability: "web_search",
			history,
		});

		assert.equal(result.provider, "custom");
		assert.equal(result.content, "Custom answer");
		assert.equal(result.attachments, undefined);
		assert.equal(mistralCalls, 1);
		assert.equal(customCalls, 1);
		assert.equal(settingsCalls, 1);
		assert.deepEqual(customInput, {
			user_prompt: "natural request",
			model: "opaque/model",
			reasoning_mode: "high",
			capability: "web_search",
			history,
		});
		assert.equal(
			JSON.stringify(customInput).includes("Use the web_search tool"),
			false
		);
		assert.deepEqual(
			events.map((event) => event.type),
			["discord_ai_fallback_attempted", "discord_ai_fallback_succeeded"]
		);
		assert.equal(events[0]?.success, false);
		assert.equal(events[1]?.success, true);
		assert.equal(events[0]?.capability, "web_search");
	}
});

test("non-eligible failures never load settings or invoke Custom", async () => {
	const failures: unknown[] = [
		create_fake_mistral_sdk_error(400),
		create_fake_mistral_sdk_error(404),
		create_fake_mistral_sdk_error(409),
		create_fake_mistral_sdk_error(422),
		create_fake_mistral_sdk_error(451),
		new Error("programming failure"),
		new TypeError("ordinary type error"),
		{ statusCode: 503 },
	];

	for (const primaryError of failures) {
		let settingsCalls = 0;
		let customCalls = 0;
		const events: RuntimeEvent[] = [];
		const client = create_llm_client_for_tests({
			mistral: {
				create_completion: async () => {
					throw primaryError;
				},
			},
			customTextProvider: {
				create_text_completion: async () => {
					customCalls += 1;
					return { content: "unexpected" };
				},
			},
			load_settings: async () => {
				settingsCalls += 1;
				return {
					discordAiTextFallbackEnabled: true,
					customProviderModel: "opaque/model",
					customProviderReasoningMode: "omit",
				};
			},
			create_timeout: never_timeout,
			event_sink: (event) => events.push(event),
		});

		await assert.rejects(
			() => client.create_completion({ user_prompt: "question" }),
			(error: unknown) => {
				assert.ok(error instanceof DiscordAiUnavailableError);
				assert.equal(error.message, "Discord AI is unavailable");
				assert.equal("cause" in error, false);
				return true;
			}
		);
		assert.equal(settingsCalls, 0);
		assert.equal(customCalls, 0);
		assert.deepEqual(events, []);
	}
});

test("disabled or incomplete fallback settings never emit invocation events", async () => {
	const settingsCases = [
		{
			discordAiTextFallbackEnabled: false,
			customProviderModel: "opaque/model",
			customProviderReasoningMode: "omit" as const,
		},
		{
			discordAiTextFallbackEnabled: true,
			customProviderModel: null,
			customProviderReasoningMode: "omit" as const,
		},
		{
			discordAiTextFallbackEnabled: true,
			customProviderModel: "   ",
			customProviderReasoningMode: "omit" as const,
		},
	];

	for (const settings of settingsCases) {
		let customCalls = 0;
		const events: RuntimeEvent[] = [];
		const client = create_llm_client_for_tests({
			mistral: {
				create_completion: async () => {
					throw create_fake_mistral_sdk_error(429);
				},
			},
			customTextProvider: {
				create_text_completion: async () => {
					customCalls += 1;
					return { content: "unexpected" };
				},
			},
			load_settings: async () => settings,
			create_timeout: never_timeout,
			event_sink: (event) => events.push(event),
		});

		await assert.rejects(
			() => client.create_completion({ user_prompt: "question" }),
			DiscordAiUnavailableError
		);
		assert.equal(customCalls, 0);
		assert.deepEqual(events, []);
	}

	const noCustomEvents: RuntimeEvent[] = [];
	const noCustom = create_llm_client_for_tests({
		mistral: {
			create_completion: async () => {
				throw create_fake_mistral_sdk_error(429);
			},
		},
		customTextProvider: null,
		create_timeout: never_timeout,
		event_sink: (event) => noCustomEvents.push(event),
	});
	await assert.rejects(
		() => noCustom.create_completion({ user_prompt: "question" }),
		DiscordAiUnavailableError
	);
	assert.deepEqual(noCustomEvents, []);
});

test("settings-loader failure is normalized without leaking database details", async () => {
	const secret = "SECRET_DATABASE_CONNECTION_STRING";
	const events: RuntimeEvent[] = [];
	const client = create_llm_client_for_tests({
		mistral: {
			create_completion: async () => {
				throw create_fake_mistral_sdk_error(429);
			},
		},
		customTextProvider: {
			create_text_completion: async () => ({ content: "unexpected" }),
		},
		load_settings: async () => {
			throw new Error(secret);
		},
		create_timeout: never_timeout,
		event_sink: (event) => events.push(event),
	});

	await assert.rejects(
		() => client.create_completion({ user_prompt: "question" }),
		(error: unknown) => {
			assert.ok(error instanceof DiscordAiUnavailableError);
			assert.equal(error.category, "settings_unavailable");
			assert.equal(JSON.stringify(error).includes(secret), false);
			return true;
		}
	);
	assert.deepEqual(events, []);
});

test("Custom-only mode works when Mistral is not configured", async () => {
	let settingsCalls = 0;
	let customCalls = 0;
	const events: RuntimeEvent[] = [];
	const client = create_llm_client_for_tests({
		mistral: null,
		customTextProvider: {
			create_text_completion: async (input) => {
				customCalls += 1;
				assert.equal(input.user_prompt, "natural request");
				assert.equal(input.capability, "image_generation");
				return { content: "I can help with a detailed image prompt." };
			},
		},
		load_settings: async () => {
			settingsCalls += 1;
			return {
				discordAiTextFallbackEnabled: true,
				customProviderModel: "opaque/model",
				customProviderReasoningMode: "low",
			};
		},
		event_sink: (event) => events.push(event),
	});

	const result = await client.create_completion({
		user_prompt: "natural request",
		mistral_prompt: "Use the image_generation tool",
		capability: "image_generation",
	});
	assert.equal(result.provider, "custom");
	assert.equal(result.attachments, undefined);
	assert.equal(settingsCalls, 1);
	assert.equal(customCalls, 1);
	assert.equal(events[0]?.category, "not_configured");
});

test("Custom failure is single-pass and discards raw provider details", async () => {
	const secret = "SECRET_CUSTOM_PROVIDER_RESPONSE";
	let mistralCalls = 0;
	let customCalls = 0;
	const events: RuntimeEvent[] = [];
	const client = create_llm_client_for_tests({
		mistral: {
			create_completion: async () => {
				mistralCalls += 1;
				throw create_fake_mistral_sdk_error(429, "SECRET_MISTRAL_BODY");
			},
		},
		customTextProvider: {
			create_text_completion: async () => {
				customCalls += 1;
				throw new Error(secret);
			},
		},
		create_timeout: never_timeout,
		event_sink: (event) => events.push(event),
	});

	await assert.rejects(
		() => client.create_completion({ user_prompt: "question" }),
		(error: unknown) => {
			assert.ok(error instanceof DiscordAiUnavailableError);
			assert.equal(error.category, "fallback_unavailable");
			const serialized = JSON.stringify(error);
			assert.equal(serialized.includes(secret), false);
			assert.equal(serialized.includes("SECRET_MISTRAL_BODY"), false);
			assert.equal("cause" in error, false);
			return true;
		}
	);
	assert.equal(mistralCalls, 1);
	assert.equal(customCalls, 1);
	assert.deepEqual(
		events.map((event) => event.type),
		["discord_ai_fallback_attempted", "discord_ai_fallback_failed"]
	);
	assert.equal(JSON.stringify(events).includes(secret), false);
});

test("deterministic timeout consumes late resolution and clears resources", async () => {
	const primary = deferred<{ content: string }>();
	const timeout = deferred<never>();
	let cancelCalls = 0;
	let customCalls = 0;
	const events: RuntimeEvent[] = [];

	const client = create_llm_client_for_tests({
		mistral: { create_completion: () => primary.promise },
		customTextProvider: {
			create_text_completion: async () => {
				customCalls += 1;
				return { content: "Custom wins" };
			},
		},
		create_timeout: () => ({
			promise: timeout.promise,
			cancel: () => {
				cancelCalls += 1;
			},
		}),
		event_sink: (event) => events.push(event),
	});

	const completion = client.create_completion({ user_prompt: "question" });
	timeout.reject(new MistralTimeoutError());
	const result = await completion;
	assert.equal(result.content, "Custom wins");
	assert.equal(customCalls, 1);
	assert.equal(cancelCalls, 1);

	primary.resolve({ content: "Late Mistral answer" });
	await new Promise<void>((resolve) => setImmediate(resolve));
	assert.equal(result.content, "Custom wins");
	assert.deepEqual(
		events.map((event) => event.type),
		["discord_ai_fallback_attempted", "discord_ai_fallback_succeeded"]
	);
});

test("deterministic timeout consumes late rejection without unhandledRejection", async () => {
	const primary = deferred<{ content: string }>();
	const timeout = deferred<never>();
	const unhandled: unknown[] = [];
	const onUnhandled = (reason: unknown) => unhandled.push(reason);
	process.on("unhandledRejection", onUnhandled);

	try {
		let cancelCalls = 0;
		let customCalls = 0;
		const events: RuntimeEvent[] = [];
		const client = create_llm_client_for_tests({
			mistral: { create_completion: () => primary.promise },
			customTextProvider: {
				create_text_completion: async () => {
					customCalls += 1;
					return { content: "Custom wins" };
				},
			},
			create_timeout: () => ({
				promise: timeout.promise,
				cancel: () => {
					cancelCalls += 1;
				},
			}),
			event_sink: (event) => events.push(event),
		});

		const completion = client.create_completion({ user_prompt: "question" });
		timeout.reject(new MistralTimeoutError());
		const result = await completion;
		primary.reject(create_fake_mistral_sdk_error(503, "LATE_SECRET"));
		await new Promise<void>((resolve) => setImmediate(resolve));

		assert.equal(result.content, "Custom wins");
		assert.equal(customCalls, 1);
		assert.equal(cancelCalls, 1);
		assert.deepEqual(unhandled, []);
		assert.deepEqual(
			events.map((event) => event.type),
			["discord_ai_fallback_attempted", "discord_ai_fallback_succeeded"]
		);
	} finally {
		process.off("unhandledRejection", onUnhandled);
	}
});

test("event-sink failures never change fallback behavior", async () => {
	const client = create_llm_client_for_tests({
		mistral: {
			create_completion: async () => {
				throw create_fake_mistral_sdk_error(429);
			},
		},
		customTextProvider: {
			create_text_completion: async () => ({ content: "Fallback answer" }),
		},
		create_timeout: never_timeout,
		event_sink: () => {
			throw new Error("telemetry failed");
		},
	});

	const result = await client.create_completion({ user_prompt: "question" });
	assert.equal(result.provider, "custom");
	assert.equal(result.content, "Fallback answer");
});
