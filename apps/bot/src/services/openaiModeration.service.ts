import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * All category keys returned by omni-moderation-latest.
 * Reference: https://platform.openai.com/docs/api-reference/moderations
 */
export type OpenAiModerationCategory =
  | 'harassment'
  | 'harassment/threatening'
  | 'hate'
  | 'hate/threatening'
  | 'illicit'
  | 'illicit/violent'
  | 'self-harm'
  | 'self-harm/intent'
  | 'self-harm/instructions'
  | 'sexual'
  | 'sexual/minors'
  | 'violence'
  | 'violence/graphic';

/** Default threshold per category when not configured by the guild. */
const DEFAULT_THRESHOLD = 0.8;

/** Input item for the moderation request — text or image. */
type ModerationInputItem =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface ModerationResult {
  flagged: boolean;
  /** The categories that exceeded the configured threshold. */
  triggeredCategories: OpenAiModerationCategory[];
  /** Raw category scores from the API. */
  scores: Record<string, number>;
}

interface OpenAiModerationApiResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
}

interface OpenAiModerationApiResponse {
  id: string;
  model: string;
  results: OpenAiModerationApiResult[];
}

class OpenAiModerationService {
  private readonly model = 'omni-moderation-latest';
  private readonly endpoint = 'https://api.openai.com/v1/moderations';

  /**
   * Check text content and/or image URLs against OpenAI's moderation endpoint.
   *
   * @param text - The message text to moderate (may be empty for image-only messages).
   * @param imageUrls - CDN URLs of image attachments to moderate.
   * @param categoryThresholds - Per-category threshold map (0.0–1.0). Defaults to 0.8.
   * @returns `{ flagged, triggeredCategories, scores }` or non-flagged result on any error.
   */
  async checkContent(
    text: string,
    imageUrls: string[],
    categoryThresholds: Record<string, number> = {}
  ): Promise<ModerationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { flagged: false, triggeredCategories: [], scores: {} };
    }

    const input: ModerationInputItem[] = [];

    // Always include text if non-empty
    if (text.trim().length > 0) {
      input.push({ type: 'text', text: text.substring(0, 10_000) });
    }

    // Include each image URL (max 10 images per request — API limit)
    for (const url of imageUrls.slice(0, 10)) {
      input.push({ type: 'image_url', image_url: { url } });
    }

    // Nothing to check
    if (input.length === 0) {
      return { flagged: false, triggeredCategories: [], scores: {} };
    }

    try {
      const response = await axios.post<OpenAiModerationApiResponse>(
        this.endpoint,
        { model: this.model, input },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10_000,
        }
      );

      const result = response.data.results[0];
      if (!result) {
        return { flagged: false, triggeredCategories: [], scores: {} };
      }

      const scores = result.category_scores;
      const triggeredCategories: OpenAiModerationCategory[] = [];

      for (const [category, score] of Object.entries(scores)) {
        const threshold = categoryThresholds[category] ?? DEFAULT_THRESHOLD;
        if (score >= threshold) {
          triggeredCategories.push(category as OpenAiModerationCategory);
        }
      }

      return {
        flagged: triggeredCategories.length > 0,
        triggeredCategories,
        scores,
      };
    } catch (error) {
      // Log the error but never crash the bot — graceful skip on API failures
      logger.warn({ err: error }, '[OpenAI Moderation] API call failed, skipping check');
      return { flagged: false, triggeredCategories: [], scores: {} };
    }
  }
}

export const openAiModerationService = new OpenAiModerationService();
