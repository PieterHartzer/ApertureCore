import { describe, expect, it, vi } from 'vitest'

import { consumeFixedWindowRateLimit } from '../../../server/utils/rate-limit'

describe('consumeFixedWindowRateLimit', () => {
  it('allows requests within the configured window and increments the stored count', async () => {
    const getItem = vi.fn().mockResolvedValue(null)
    const setItem = vi.fn().mockResolvedValue(undefined)

    await expect(
      consumeFixedWindowRateLimit(
        { getItem, setItem },
        'rate-limit:test-user',
        2,
        60_000,
        1_000
      )
    ).resolves.toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetAt: 61_000,
      retryAfterSeconds: 0
    })

    expect(setItem).toHaveBeenCalledWith('rate-limit:test-user', {
      count: 1,
      resetAt: 61_000
    })
  })

  it('blocks requests that exceed the configured limit inside the same window', async () => {
    const getItem = vi.fn().mockResolvedValue({
      count: 2,
      resetAt: 61_000
    })
    const setItem = vi.fn().mockResolvedValue(undefined)

    await expect(
      consumeFixedWindowRateLimit(
        { getItem, setItem },
        'rate-limit:test-user',
        2,
        60_000,
        31_000
      )
    ).resolves.toEqual({
      allowed: false,
      limit: 2,
      remaining: 0,
      resetAt: 61_000,
      retryAfterSeconds: 30
    })

    expect(setItem).not.toHaveBeenCalled()
  })

  it('starts a new window once the previous window has expired', async () => {
    const getItem = vi.fn().mockResolvedValue({
      count: 2,
      resetAt: 5_000
    })
    const setItem = vi.fn().mockResolvedValue(undefined)

    await expect(
      consumeFixedWindowRateLimit(
        { getItem, setItem },
        'rate-limit:test-user',
        2,
        60_000,
        10_000
      )
    ).resolves.toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetAt: 70_000,
      retryAfterSeconds: 0
    })

    expect(setItem).toHaveBeenCalledWith('rate-limit:test-user', {
      count: 1,
      resetAt: 70_000
    })
  })
})
