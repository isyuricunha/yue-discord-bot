import test from "node:test";
import assert from "node:assert/strict";

import {
	duration_regex,
	discord_timeout_max_ms,
	parseDurationMs,
} from "../duration";

test("duration: regex accepts s/m/h/d/w", () => {
	assert.ok(duration_regex.test("1s"));
	assert.ok(duration_regex.test("5m"));
	assert.ok(duration_regex.test("2h"));
	assert.ok(duration_regex.test("3d"));
	assert.ok(duration_regex.test("1w"));

	assert.ok(!duration_regex.test("0m"));
	assert.ok(!duration_regex.test("5"));
	assert.ok(!duration_regex.test("5mm"));
	assert.ok(!duration_regex.test("5x"));
	assert.ok(!duration_regex.test(""));
});

test("duration: parseDurationMs parses valid values", () => {
	assert.equal(parseDurationMs("1s"), 1000);
	assert.equal(parseDurationMs("5m"), 5 * 60_000);
	assert.equal(parseDurationMs("2h"), 2 * 3_600_000);
	assert.equal(parseDurationMs("3d"), 3 * 86_400_000);
	assert.equal(parseDurationMs("1w"), 7 * 86_400_000);
});

test("duration: parseDurationMs rejects invalid values", () => {
	assert.equal(parseDurationMs(""), null);
	assert.equal(parseDurationMs("0m"), null);
	assert.equal(parseDurationMs("-1m"), null);
	assert.equal(parseDurationMs("10"), null);
	assert.equal(parseDurationMs("10mm"), null);
	assert.equal(parseDurationMs("10x"), null);
});

test("duration: parseDurationMs maxMs option", () => {
	const too_long = parseDurationMs("30d", {
		maxMs: discord_timeout_max_ms,
		clampToMax: false,
	});
	assert.equal(too_long, null);

	const clamped = parseDurationMs("30d", {
		maxMs: discord_timeout_max_ms,
		clampToMax: true,
	});
	assert.equal(clamped, discord_timeout_max_ms);
});
