// Wait out Supabase's function-to-function rate limit instead of giving up.
//
// check_schedule calls send_message once per row over HTTP. Supabase rate
// limits calls from one Edge Function to another per request chain, and in
// practice this project gets about 30 calls before fetch() throws
// `RateLimitError` with a `retryAfterMs` (~30 s). Every row after that failed,
// waited for the next 15-minute tick, and failed again after another ~30: at
// the Zerin study's 73-row peaks, 43 participants got their link 15 or 30
// minutes late (found 2026-10-01; 34 rejections per peak on 09-26, 59 on
// 10-01, growing with enrollment).
//
// So: when a call is rate limited, sleep for the time the platform asks and
// try again -- but only while the run's time budget allows. Edge Functions have
// a hard wall-clock limit, and a run killed mid-loop is worse than a row left
// for the next tick, which is exactly what happened before this existed.
// Running out of budget therefore rethrows the RateLimitError: the caller's
// existing error path leaves the row unsent and the next tick picks it up.

export interface RetryOptions {
  /** Epoch ms after which no more waiting is allowed. */
  deadline: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

/** Fallback when the error carries no retryAfterMs. */
const DEFAULT_WAIT_MS = 30_000
/** Margin past the platform's hint, so the retry lands after the window resets. */
const WAIT_MARGIN_MS = 500

export function isRateLimitError(e: unknown): e is { retryAfterMs?: number } {
  return !!e && typeof e === 'object' && (e as { name?: string }).name === 'RateLimitError'
}

export async function withRateLimitRetry<T>(call: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const now = opts.now ?? Date.now
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  for (;;) {
    try {
      return await call()
    } catch (e) {
      if (!isRateLimitError(e)) throw e
      const hint = typeof e.retryAfterMs === 'number' && e.retryAfterMs > 0 ? e.retryAfterMs : DEFAULT_WAIT_MS
      const wait = hint + WAIT_MARGIN_MS
      if (now() + wait > opts.deadline) throw e
      await sleep(wait)
    }
  }
}
