import { createHash } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const consumeFixedWindowRateLimitMock = vi.fn()
const useStorageMock = vi.fn()

vi.mock('../../../server/utils/rate-limit', () => ({
  consumeFixedWindowRateLimit: consumeFixedWindowRateLimitMock
}))

const loadUtility = async () => {
  vi.resetModules()
  vi.stubGlobal('useStorage', useStorageMock)

  return await import('../../../server/utils/authenticated-rate-limit')
}

describe('consumeAuthenticatedFixedWindowRateLimit', () => {
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

  it('keys the rate limit by the authenticated subject when present', async () => {
    const { consumeAuthenticatedFixedWindowRateLimit } = await loadUtility()
    const event = {
      context: {
        auth: {
          claims: {
            sub: 'user-123'
          },
          userName: 'pieter'
        }
      }
    }

    await expect(consumeAuthenticatedFixedWindowRateLimit(
      event as never,
      {
        keyPrefix: 'rate-limit:test',
        limit: 5,
        windowMs: 60_000
      }
    )).resolves.toEqual({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: 61_000,
      retryAfterSeconds: 0
    })

    expect(useStorageMock).toHaveBeenCalledWith('cache')
    expect(consumeFixedWindowRateLimitMock).toHaveBeenCalledWith(
      expect.any(Object),
      'rate-limit:test:user:user-123',
      5,
      60_000
    )
  })

  it('falls back to the username when the subject is missing', async () => {
    const { consumeAuthenticatedFixedWindowRateLimit } = await loadUtility()
    const event = {
      context: {
        auth: {
          userName: 'pieter'
        }
      }
    }

    await consumeAuthenticatedFixedWindowRateLimit(
      event as never,
      {
        keyPrefix: 'rate-limit:test',
        limit: 5,
        windowMs: 60_000
      }
    )

    expect(consumeFixedWindowRateLimitMock).toHaveBeenCalledWith(
      expect.any(Object),
      'rate-limit:test:user-name:pieter',
      5,
      60_000
    )
  })

  it('falls back to a preferred identity claim before using network data', async () => {
    const { consumeAuthenticatedFixedWindowRateLimit } = await loadUtility()
    const event = {
      context: {
        auth: {
          claims: {
            email: 'pieter@example.com'
          }
        }
      }
    }

    await consumeAuthenticatedFixedWindowRateLimit(
      event as never,
      {
        keyPrefix: 'rate-limit:test',
        limit: 5,
        windowMs: 60_000
      }
    )

    expect(consumeFixedWindowRateLimitMock).toHaveBeenCalledWith(
      expect.any(Object),
      'rate-limit:test:user-identity:pieter@example.com',
      5,
      60_000
    )
  })

  it('falls back to a hashed network fingerprint when no stable identity is available', async () => {
    const { consumeAuthenticatedFixedWindowRateLimit } = await loadUtility()
    const expectedFingerprint = createHash('sha256')
      .update('203.0.113.10|ApertureCore Test Agent')
      .digest('hex')
      .slice(0, 16)
    const event = {
      context: {
        auth: {
          provider: 'oidc'
        }
      },
      node: {
        req: {
          headers: {
            'x-forwarded-for': '203.0.113.10, 198.51.100.5',
            'user-agent': 'ApertureCore Test Agent'
          },
          socket: {}
        }
      }
    }

    await consumeAuthenticatedFixedWindowRateLimit(
      event as never,
      {
        keyPrefix: 'rate-limit:test',
        limit: 5,
        windowMs: 60_000
      }
    )

    expect(consumeFixedWindowRateLimitMock).toHaveBeenCalledWith(
      expect.any(Object),
      `rate-limit:test:user-fingerprint:${expectedFingerprint}`,
      5,
      60_000
    )
  })

  it('falls back to a generic authenticated user bucket only when no identity or request fingerprint is available', async () => {
    const { consumeAuthenticatedFixedWindowRateLimit } = await loadUtility()
    const event = {
      context: {
        auth: {
          provider: 'oidc'
        }
      },
      node: {
        req: {
          headers: {},
          socket: {}
        }
      }
    }

    await consumeAuthenticatedFixedWindowRateLimit(
      event as never,
      {
        keyPrefix: 'rate-limit:test',
        limit: 5,
        windowMs: 60_000
      }
    )

    expect(consumeFixedWindowRateLimitMock).toHaveBeenCalledWith(
      expect.any(Object),
      'rate-limit:test:user:authenticated',
      5,
      60_000
    )
  })
})
