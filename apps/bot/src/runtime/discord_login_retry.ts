const SESSION_START_LIMIT_RESET = /resets at (?<reset_at>[^\n]+)$/i;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 300_000;

export type DiscordLoginRetry = {
  delay_ms: number;
  reason: 'session_start_limit' | 'transient_failure';
};

function get_error_message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function get_discord_login_retry(
  error: unknown,
  attempt: number,
  now = Date.now()
): DiscordLoginRetry {
  const match = get_error_message(error).match(SESSION_START_LIMIT_RESET);
  const reset_at = match?.groups?.reset_at ? Date.parse(match.groups.reset_at) : Number.NaN;

  if (Number.isFinite(reset_at) && reset_at > now) {
    return {
      delay_ms: reset_at - now + 1_000,
      reason: 'session_start_limit',
    };
  }

  return {
    delay_ms: Math.min(INITIAL_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS),
    reason: 'transient_failure',
  };
}
