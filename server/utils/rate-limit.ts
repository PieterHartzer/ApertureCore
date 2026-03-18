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

export const consumeFixedWindowRateLimit = async (
  storage: RateLimitStorage,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now()
): Promise<FixedWindowRateLimitResult> => {
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
}
