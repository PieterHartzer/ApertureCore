import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const consumeAuthenticatedFixedWindowRateLimitMock = vi.fn()

vi.mock('../../../server/utils/authenticated-rate-limit', () => ({
  consumeAuthenticatedFixedWindowRateLimit: consumeAuthenticatedFixedWindowRateLimitMock
}))

const loadUtility = async () => {
  vi.resetModules()

  return await import('../../../server/utils/saved-sql-query-test-rate-limit')
}

describe('consumeSavedSqlQueryTestRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consumeAuthenticatedFixedWindowRateLimitMock.mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: 61_000,
      retryAfterSeconds: 0
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies the shared authenticated-user limiter with the query test policy', async () => {
    const { consumeSavedSqlQueryTestRateLimit } = await loadUtility()
    const event = {
      context: {
        auth: {
          claims: {
            sub: 'user-123'
          }
        }
      }
    }

    await expect(consumeSavedSqlQueryTestRateLimit(event as never)).resolves.toEqual({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: 61_000,
      retryAfterSeconds: 0
    })

    expect(consumeAuthenticatedFixedWindowRateLimitMock).toHaveBeenCalledWith(
      event,
      {
        keyPrefix: 'rate-limit:queries:test',
        limit: 5,
        windowMs: 60_000
      }
    )
  })
})
