// In-memory metrics aggregator for the panel AI (improvement #6).
//
// Scope is intentionally modest: process-local counters that give the owner a
// live view of usage, latency and Mistral->custom fallback behavior. Counts
// reset on process restart; persistence belongs to a later iteration if the
// owner needs historical series.

export type panel_ai_runtime_event_metrics_input = {
  type: 'fallback_attempted' | 'fallback_succeeded' | 'fallback_failed'
}

export type panel_ai_turn_metrics_input = {
  latencyMs: number
  ok: boolean
}

export type panel_ai_metrics_snapshot = {
  since: string
  turns: {
    total: number
    ok: number
    failed: number
    avgLatencyMs: number | null
    maxLatencyMs: number | null
  }
  fallback: {
    attempted: number
    succeeded: number
    failed: number
  }
}

const MAX_LATENCY_SAMPLES = 500

export class PanelAiMetrics {
  private readonly latencies: number[] = []
  private turnsTotal = 0
  private turnsOk = 0
  private turnsFailed = 0
  private fallbackAttempted = 0
  private fallbackSucceeded = 0
  private fallbackFailed = 0
  private readonly since = new Date()

  recordTurn(input: panel_ai_turn_metrics_input): void {
    this.turnsTotal += 1
    if (input.ok) this.turnsOk += 1
    else this.turnsFailed += 1

    this.latencies.push(Math.max(0, Math.round(input.latencyMs)))
    if (this.latencies.length > MAX_LATENCY_SAMPLES) this.latencies.shift()
  }

  recordRuntimeEvent(event: panel_ai_runtime_event_metrics_input): void {
    if (event.type === 'fallback_attempted') this.fallbackAttempted += 1
    else if (event.type === 'fallback_succeeded') this.fallbackSucceeded += 1
    else if (event.type === 'fallback_failed') this.fallbackFailed += 1
  }

  snapshot(): panel_ai_metrics_snapshot {
    const latencies = this.latencies
    const avg = latencies.length
      ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length)
      : null

    return {
      since: this.since.toISOString(),
      turns: {
        total: this.turnsTotal,
        ok: this.turnsOk,
        failed: this.turnsFailed,
        avgLatencyMs: avg,
        maxLatencyMs: latencies.length ? Math.max(...latencies) : null,
      },
      fallback: {
        attempted: this.fallbackAttempted,
        succeeded: this.fallbackSucceeded,
        failed: this.fallbackFailed,
      },
    }
  }
}

export const panel_ai_metrics = new PanelAiMetrics()
