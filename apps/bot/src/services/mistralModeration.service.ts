import axios from 'axios';
import { safe_error_details } from '../utils/safe_error';
import { summarize_moderation_error } from '../utils/moderation_error';
import { logger } from '../utils/logger';
import {
  mistral_to_openai_categories,
  type mistral_category,
  type openai_category,
} from './automod.ai_categories';

/**
 * Text-only moderation via Mistral Moderation (mistral-moderation-latest).
 * Mistral has no image moderation, so image checks always stay on OpenAI.
 *
 * Results are reported in the OpenAI taxonomy so panel thresholds and logs stay
 * uniform across providers; Mistral categories without an OpenAI equivalent
 * (health, financial, law, pii) are ignored.
 */
class MistralModerationService {
  private readonly model = 'mistral-moderation-latest';
  private readonly endpoint = 'https://api.mistral.ai/v1/moderations';

  private async request_moderation(
    api_key: string,
    text: string
  ): Promise<{ categories: Record<string, boolean>; category_scores: Record<string, number> } | null> {
    const response = await axios.post<{
      id: string;
      model: string;
      results: Array<{ categories: Record<string, boolean>; category_scores: Record<string, number> }>;
    }>(
      this.endpoint,
      { model: this.model, input: text },
      {
        headers: {
          Authorization: `Bearer ${api_key}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      }
    );

    return response.data.results[0] ?? null;
  }

  /**
   * Check text content against Mistral's moderation endpoint.
   *
   * @param text - The message text to moderate (may be empty to skip).
   * @param categoryThresholds - Threshold map in the OpenAI taxonomy (0.0-1.0). Defaults to 0.75.
   * @returns the same result shape as the OpenAI service, or `{ ok: false }` on any error.
   */
  async checkText(text: string, categoryThresholds: Record<string, number> = {}) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return { ok: false as const, flagged: false, triggeredCategories: [] as openai_category[], scores: {} };
    }

    const normalized_text = text.trim().length > 0 ? text.substring(0, 10_000) : '';
    if (!normalized_text) {
      return { ok: true as const, flagged: false, triggeredCategories: [] as openai_category[], scores: {} };
    }

    try {
      const result = await this.request_moderation(apiKey, normalized_text);
      if (!result) {
        return { ok: true as const, flagged: false, triggeredCategories: [] as openai_category[], scores: {} };
      }

      // Map Mistral scores onto the OpenAI taxonomy (one Mistral category may
      // feed several OpenAI categories).
      const scores: Record<string, number> = {};
      for (const [category, score] of Object.entries(result.category_scores)) {
        if (typeof score !== 'number' || !Number.isFinite(score)) continue;
        const mapped = mistral_to_openai_categories[category as mistral_category];
        if (!mapped) continue;
        for (const openai_key of mapped) {
          scores[openai_key] = Math.max(scores[openai_key] ?? 0, score);
        }
      }

      const triggeredCategories: openai_category[] = [];
      for (const [category, score] of Object.entries(scores)) {
        const threshold = categoryThresholds[category] ?? 0.75;
        if (score >= threshold) {
          triggeredCategories.push(category as openai_category);
        }
      }

      return { ok: true as const, flagged: triggeredCategories.length > 0, triggeredCategories, scores };
    } catch (error) {
      const summary = summarize_moderation_error(error);
      logger.warn(
        {
          err: safe_error_details(error),
          mistral: summary,
        },
        '[Mistral Moderation] API call failed, skipping check'
      );
      return { ok: false as const, flagged: false, triggeredCategories: [] as openai_category[], scores: {} };
    }
  }
}

export const mistralModerationService = new MistralModerationService();
