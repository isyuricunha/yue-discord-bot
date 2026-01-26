export type duration_unit = "s" | "m" | "h" | "d" | "w";

export const duration_regex = /^[1-9]\d*[smhdw]$/;

export const duration_multipliers_ms: Record<duration_unit, number> = {
	s: 1000,
	m: 60_000,
	h: 3_600_000,
	d: 86_400_000,
	w: 604_800_000,
};

export const discord_timeout_max_ms = 28 * 24 * 60 * 60 * 1000;

export type parse_duration_ms_options = {
	maxMs?: number;
	clampToMax?: boolean;
};

export function parseDurationMs(
	duration: string,
	options: parse_duration_ms_options = {}
): number | null {
	const match = duration.match(/^(\d+)([smhdw])$/);
	if (!match) return null;

	const value = Number.parseInt(match[1]!, 10);
	if (!Number.isFinite(value) || value <= 0) return null;

	const unit = match[2] as duration_unit;
	const ms = value * (duration_multipliers_ms[unit] ?? 0);
	if (!ms) return null;

	if (
		typeof options.maxMs === "number" &&
		Number.isFinite(options.maxMs) &&
		options.maxMs > 0
	) {
		if (ms > options.maxMs) {
			return options.clampToMax ? options.maxMs : null;
		}
	}

	return ms;
}
