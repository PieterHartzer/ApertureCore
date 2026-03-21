export interface FixedWindowRateLimitState {
  count: number
  resetAt: number
}

export interface FixedWindowRateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterSeconds: number
}

interface RateLimitStorage {
  getItem<T>(key: string): Promise<T | null>
  setItem<T>(key: string, value: T): Promise<void>
}

const rateLimitLocks = new Map<string, Promise<void>>()

/**
 * Serializes updates for a single rate-limit key so concurrent requests do not
 * overwrite each other's counters.
 */
const withRateLimitLock = async <T>(
  key: string,
  action: () => Promise<T>
): Promise<T> => {
  const previousLock = rateLimitLocks.get(key) ?? Promise.resolve()

  let releaseLock!: () => void
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve
  })
  const queuedLock = previousLock.then(() => currentLock)

  rateLimitLocks.set(key, queuedLock)

  await previousLock

  try {
    return await action()
  } finally {
    releaseLock()

    if (rateLimitLocks.get(key) === queuedLock) {
      rateLimitLocks.delete(key)
    }
  }
}

/**
 * Consumes one request from a fixed-window rate limit and returns the updated
 * allowance state for the caller.
 */
export const consumeFixedWindowRateLimit = async (
  storage: RateLimitStorage,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): Promise<FixedWindowRateLimitResult> => {
  return withRateLimitLock(key, async () => {
    const currentState = await storage.getItem<FixedWindowRateLimitState>(key)
    const state =
      currentState && currentState.resetAt > now
        ? currentState
        : {
            count: 0,
            resetAt: now + windowMs
          }

    const nextCount = state.count + 1

    if (nextCount > limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt: state.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1000))
      }
    }

    const nextState: FixedWindowRateLimitState = {
      count: nextCount,
      resetAt: state.resetAt
    }

    await storage.setItem(key, nextState)

    return {
      allowed: true,
      limit,
      remaining: Math.max(limit - nextCount, 0),
      resetAt: state.resetAt,
      retryAfterSeconds: 0
    }
  })
}
