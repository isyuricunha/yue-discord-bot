import { prisma } from '@yuebot/database';
import type { custom_provider_reasoning_mode } from '@yuebot/shared';

export type AiFallbackSettings = {
  discordAiTextFallbackEnabled: boolean;
  customProviderModel: string | null;
  customProviderReasoningMode: custom_provider_reasoning_mode;
};

const VALID_REASONING_MODES = new Set([
  'omit',
  'none',
  'minimal',
  'low',
  'medium',
  'high',
]);

export async function load_ai_fallback_settings(): Promise<AiFallbackSettings> {
  try {
    const row = await prisma.botSettings.findUnique({
      where: { id: 'global' },
      select: {
        discordAiTextFallbackEnabled: true,
        customProviderModel: true,
        customProviderReasoningMode: true,
      },
    });

    if (!row) {
      return {
        discordAiTextFallbackEnabled: false,
        customProviderModel: null,
        customProviderReasoningMode: 'omit',
      };
    }

    const model = typeof row.customProviderModel === 'string' ? row.customProviderModel.trim() : null;
    let reasoning = row.customProviderReasoningMode;
    if (!VALID_REASONING_MODES.has(reasoning)) {
      reasoning = 'omit';
    }

    return {
      discordAiTextFallbackEnabled: row.discordAiTextFallbackEnabled === true,
      customProviderModel: model ? model : null,
      customProviderReasoningMode: reasoning as custom_provider_reasoning_mode,
    };
  } catch {
    return {
      discordAiTextFallbackEnabled: false,
      customProviderModel: null,
      customProviderReasoningMode: 'omit',
    };
  }
}
