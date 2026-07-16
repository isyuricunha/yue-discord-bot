import assert from "node:assert/strict";
import test from "node:test";

import {
	AI_FALLBACK_SETTINGS_QUERY,
	load_ai_fallback_settings,
	type AiFallbackSettingsReader,
} from "./ai_fallback_settings.service";

test("load_ai_fallback_settings uses the global row and narrow select", async () => {
	let captured: typeof AI_FALLBACK_SETTINGS_QUERY | null = null;
	const reader: AiFallbackSettingsReader = async (query) => {
		captured = query;
		return {
			discordAiTextFallbackEnabled: true,
			customProviderModel: "  opaque/model-id  ",
			customProviderReasoningMode: "high",
		};
	};

	const settings = await load_ai_fallback_settings(reader);
	assert.deepEqual(captured, {
		where: { id: "global" },
		select: {
			discordAiTextFallbackEnabled: true,
			customProviderModel: true,
			customProviderReasoningMode: true,
		},
	});
	assert.deepEqual(settings, {
		discordAiTextFallbackEnabled: true,
		customProviderModel: "opaque/model-id",
		customProviderReasoningMode: "high",
	});
});

test("load_ai_fallback_settings returns disabled defaults for a missing row", async () => {
	const settings = await load_ai_fallback_settings(async () => null);
	assert.deepEqual(settings, {
		discordAiTextFallbackEnabled: false,
		customProviderModel: null,
		customProviderReasoningMode: "omit",
	});
});

test("load_ai_fallback_settings trims models and normalizes every reasoning mode", async () => {
	for (const mode of ["omit", "none", "minimal", "low", "medium", "high"]) {
		const settings = await load_ai_fallback_settings(async () => ({
			discordAiTextFallbackEnabled: true,
			customProviderModel: " model ",
			customProviderReasoningMode: mode,
		}));
		assert.equal(settings.customProviderModel, "model");
		assert.equal(settings.customProviderReasoningMode, mode);
	}
});

test("load_ai_fallback_settings normalizes blank model and unknown reasoning", async () => {
	const settings = await load_ai_fallback_settings(async () => ({
		discordAiTextFallbackEnabled: true,
		customProviderModel: "   ",
		customProviderReasoningMode: "unsupported",
	}));
	assert.deepEqual(settings, {
		discordAiTextFallbackEnabled: true,
		customProviderModel: null,
		customProviderReasoningMode: "omit",
	});
});

test("load_ai_fallback_settings contains database failures and raw details", async () => {
	const secret = "SECRET_DATABASE_PASSWORD";
	const settings = await load_ai_fallback_settings(async () => {
		throw new Error(secret);
	});
	assert.deepEqual(settings, {
		discordAiTextFallbackEnabled: false,
		customProviderModel: null,
		customProviderReasoningMode: "omit",
	});
	assert.equal(JSON.stringify(settings).includes(secret), false);
});
