import { prisma } from "@yuebot/database";
import {
	normalize_custom_provider_reasoning_mode,
	type custom_provider_reasoning_mode,
} from "@yuebot/shared";

export type AiFallbackSettings = {
	discordAiTextFallbackEnabled: boolean;
	customProviderModel: string | null;
	customProviderReasoningMode: custom_provider_reasoning_mode;
};

export type AiFallbackSettingsRow = {
	discordAiTextFallbackEnabled: boolean;
	customProviderModel: string | null;
	customProviderReasoningMode: string;
};

export const AI_FALLBACK_SETTINGS_QUERY = {
	where: { id: "global" },
	select: {
		discordAiTextFallbackEnabled: true,
		customProviderModel: true,
		customProviderReasoningMode: true,
	},
} as const;

export type AiFallbackSettingsReader = (
	query: typeof AI_FALLBACK_SETTINGS_QUERY
) => Promise<AiFallbackSettingsRow | null>;

const default_reader: AiFallbackSettingsReader = (query) =>
	prisma.botSettings.findUnique(query);

function disabled_settings(): AiFallbackSettings {
	return {
		discordAiTextFallbackEnabled: false,
		customProviderModel: null,
		customProviderReasoningMode: "omit",
	};
}

export async function load_ai_fallback_settings(
	readSettings: AiFallbackSettingsReader = default_reader
): Promise<AiFallbackSettings> {
	try {
		const row = await readSettings(AI_FALLBACK_SETTINGS_QUERY);
		if (!row) return disabled_settings();

		const model = row.customProviderModel?.trim() || null;
		return {
			discordAiTextFallbackEnabled:
				row.discordAiTextFallbackEnabled === true,
			customProviderModel: model,
			customProviderReasoningMode:
				normalize_custom_provider_reasoning_mode(
					row.customProviderReasoningMode
				),
		};
	} catch {
		return disabled_settings();
	}
}
