import axios from 'axios';
import { safe_error_details } from '../utils/safe_error';
import { logger } from '../utils/logger';

/**
 * All category keys returned by omni-moderation-latest.
 * Reference: https://platform.openai.com/docs/api-reference/moderations
 */
type OpenAiModerationCategory =
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
const DEFAULT_THRESHOLD = 0.75;

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

type openai_moderation_error_summary = {
  kind: 'timeout' | 'bad_request' | 'rate_limited' | 'auth' | 'network' | 'unknown'
  status?: number
  code?: string
  message: string
}

export function normalize_openai_moderation_image_url(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  const cleaned = trimmed.replace(/[&?]+$/g, '')
  if (!cleaned) return null
  if (cleaned.length > 2048) return null

  try {
    const parsed = new URL(cleaned)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function normalize_openai_moderation_image_urls(urls: string[]): { ok: string[]; dropped: number } {
  const ok: string[] = []
  const seen = new Set<string>()
  let dropped = 0

  for (const raw of urls) {
    const normalized = normalize_openai_moderation_image_url(raw)
    if (!normalized) {
      dropped += 1
      continue
    }

    if (seen.has(normalized)) continue
    seen.add(normalized)
    ok.push(normalized)

    if (ok.length >= 10) break
  }

  return { ok, dropped }
}

function summarize_openai_moderation_error(error: unknown): openai_moderation_error_summary {
  const details = safe_error_details(error)
  const code = typeof details.code === 'string' ? details.code : undefined
  const status = typeof details.status === 'number'
    ? details.status
    : typeof details.statusCode === 'number'
      ? details.statusCode
      : undefined

  if (code === 'ECONNABORTED') {
    return { kind: 'timeout', code, status, message: details.message }
  }

  if (status === 400) {
    return { kind: 'bad_request', code, status, message: details.message }
  }

  if (status === 401 || status === 403) {
    return { kind: 'auth', code, status, message: details.message }
  }

  if (status === 429) {
    return { kind: 'rate_limited', code, status, message: details.message }
  }

  if (typeof status === 'number') {
    return { kind: 'unknown', code, status, message: details.message }
  }

  if (axios.isAxiosError(error)) {
    return { kind: 'network', code, status, message: details.message }
  }

  return { kind: 'unknown', code, status, message: details.message }
}

class OpenAiModerationService {
  private readonly model = 'omni-moderation-latest';
  private readonly endpoint = 'https://api.openai.com/v1/moderations';

  private async request_moderation(api_key: string, input: ModerationInputItem[]): Promise<OpenAiModerationApiResult | null> {
    const response = await axios.post<OpenAiModerationApiResponse>(
      this.endpoint,
      { model: this.model, input },
      {
        headers: {
          Authorization: `Bearer ${api_key}`,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      }
    )

    return response.data.results[0] ?? null
  }

  /**
   * Check text content and/or image URLs against OpenAI's moderation endpoint.
   *
   * @param text - The message text to moderate (may be empty for image-only messages).
   * @param imageUrls - CDN URLs of image attachments to moderate.
   * @param categoryThresholds - Per-category threshold map (0.0–1.0). Defaults to 0.75.
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

    const normalized_text = text.trim().length > 0 ? text.substring(0, 10_000) : ''
    const normalized_images_result = normalize_openai_moderation_image_urls(imageUrls)
    const normalized_images = normalized_images_result.ok

    const input: ModerationInputItem[] = [];

    // Always include text if non-empty
    if (normalized_text) {
      input.push({ type: 'text', text: normalized_text });
    }

    // Include each image URL (max 10 images per request — API limit)
    for (const url of normalized_images) {
      input.push({ type: 'image_url', image_url: { url } });
    }

    logger.debug(
      {
        text_present: Boolean(normalized_text),
        image_urls_collected: imageUrls.length,
        image_urls_sent: normalized_images.length,
        image_urls_dropped: normalized_images_result.dropped,
      },
      '[automod.ai] openai moderation input prepared',
    )

    // Nothing to check
    if (input.length === 0) {
      return { flagged: false, triggeredCategories: [], scores: {} };
    }

    const run_scoring = (result: OpenAiModerationApiResult): ModerationResult => {
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
    }

    const summarize_scores = (scores: Record<string, number>) => {
      const entries = Object.entries(scores)
        .filter(([, score]) => typeof score === 'number' && Number.isFinite(score))
        .sort((a, b) => b[1] - a[1])

      const max = entries[0]
      return {
        max_category: max ? max[0] : null,
        max_score: max ? max[1] : null,
        top_categories: entries.slice(0, 3).map(([category, score]) => ({ category, score })),
      }
    }

    const log_failure = (error: unknown, meta: { attempt: string; input_items: number; has_images: boolean }) => {
      const summary = summarize_openai_moderation_error(error)
      logger.warn(
        {
          err: safe_error_details(error),
          openai: {
            ...summary,
            ...meta,
          },
        },
        '[OpenAI Moderation] API call failed, skipping check'
      )
    }

    try {
      const result = await this.request_moderation(apiKey, input)
      if (!result) return { flagged: false, triggeredCategories: [], scores: {} };
      logger.debug(
        {
          input_items: input.length,
          has_images: normalized_images.length > 0,
          ...summarize_scores(result.category_scores),
        },
        '[automod.ai] openai moderation response received',
      )
      return run_scoring(result)
    
    } catch (error) {
      const summary = summarize_openai_moderation_error(error)

      if (summary.kind === 'bad_request' && normalized_images.length > 0) {
        const text_only_input: ModerationInputItem[] = normalized_text ? [{ type: 'text', text: normalized_text }] : []
        if (text_only_input.length > 0) {
          try {
            const result = await this.request_moderation(apiKey, text_only_input)
            if (!result) return { flagged: false, triggeredCategories: [], scores: {} };
            return run_scoring(result)
          } catch (fallback_error) {
            log_failure(fallback_error, { attempt: 'fallback_text_only', input_items: text_only_input.length, has_images: false })
            return { flagged: false, triggeredCategories: [], scores: {} };
          }
        }
      }

      if (summary.kind === 'timeout') {
        await new Promise((r) => setTimeout(r, 750))
        try {
          const result = await this.request_moderation(apiKey, input)
          if (!result) return { flagged: false, triggeredCategories: [], scores: {} };
          return run_scoring(result)
        } catch (retry_error) {
          log_failure(retry_error, { attempt: 'retry_timeout', input_items: input.length, has_images: normalized_images.length > 0 })
          return { flagged: false, triggeredCategories: [], scores: {} };
        }
      }

      log_failure(error, { attempt: 'primary', input_items: input.length, has_images: normalized_images.length > 0 })
      return { flagged: false, triggeredCategories: [], scores: {} };
    }
  }
}

export const openAiModerationService = new OpenAiModerationService();
