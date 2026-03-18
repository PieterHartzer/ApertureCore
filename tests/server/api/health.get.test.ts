import { afterEach, describe, expect, it, vi } from 'vitest'

const loadHandler = async () => {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

  return (await import('../../../../server/api/health.get')).default as () => { ok: true }
}

describe('GET /api/health', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns an ok health payload', async () => {
    const handler = await loadHandler()

    expect(handler()).toEqual({ ok: true })
  })
})
