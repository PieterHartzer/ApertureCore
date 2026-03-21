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

  it('serializes updates for the same key so concurrent requests cannot overrun the limit', async () => {
    let state: { count: number, resetAt: number } | null = null

    const storage = {
      getItem: vi.fn(async () => {
        await Promise.resolve()
        return state
      }),
      setItem: vi.fn(async (_key: string, value: { count: number, resetAt: number }) => {
        await Promise.resolve()
        state = value
      })
    }

    const firstRequest = consumeFixedWindowRateLimit(
      storage,
      'rate-limit:test-user',
      1,
      60_000,
      1_000
    )
    const secondRequest = consumeFixedWindowRateLimit(
      storage,
      'rate-limit:test-user',
      1,
      60_000,
      1_000
    )

    await expect(firstRequest).resolves.toEqual({
      allowed: true,
      limit: 1,
      remaining: 0,
      resetAt: 61_000,
      retryAfterSeconds: 0
    })
    await expect(secondRequest).resolves.toEqual({
      allowed: false,
      limit: 1,
      remaining: 0,
      resetAt: 61_000,
      retryAfterSeconds: 60
    })
  })
})
