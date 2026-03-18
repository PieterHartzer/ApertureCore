import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const consumeFixedWindowRateLimitMock = vi.fn()
const useStorageMock = vi.fn()

vi.mock('../../../server/utils/rate-limit', () => ({
  consumeFixedWindowRateLimit: consumeFixedWindowRateLimitMock
}))

const loadUtility = async () => {
  vi.resetModules()
  vi.stubGlobal('useStorage', useStorageMock)

  return await import('../../../server/utils/database-connection-test-rate-limit')
}

describe('consumeConnectionTestRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useStorageMock.mockReturnValue({
      getItem: vi.fn(),
      setItem: vi.fn()
    })
    consumeFixedWindowRateLimitMock.mockResolvedValue({
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

  it('keys the rate limit by authenticated username when present', async () => {
    const { consumeConnectionTestRateLimit } = await loadUtility()
    const event = {
      context: {
        auth: {
          userName: 'pieter'
        }
      }
    }

    await expect(consumeConnectionTestRateLimit(event as never)).resolves.toEqual({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: 61_000,
      retryAfterSeconds: 0
    })

    expect(useStorageMock).toHaveBeenCalledWith('cache')
    expect(consumeFixedWindowRateLimitMock).toHaveBeenCalledWith(
      expect.any(Object),
      'rate-limit:connections:test:user:pieter',
      5,
      60_000
    )
  })

  it('falls back to a generic authenticated user bucket when username is missing', async () => {
    const { consumeConnectionTestRateLimit } = await loadUtility()
    const event = {
      context: {
        auth: {
          provider: 'oidc'
        }
      }
    }

    await consumeConnectionTestRateLimit(event as never)

    expect(consumeFixedWindowRateLimitMock).toHaveBeenCalledWith(
      expect.any(Object),
      'rate-limit:connections:test:user:authenticated',
      5,
      60_000
    )
  })
})
