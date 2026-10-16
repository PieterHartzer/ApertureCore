import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatModelIds, providerRequest, validateLMStudioUrl } from '../../shared/utils/ai-provider'
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('OpenAI-compatible transport', () => {
  it('validates local URLs and rejects credentials or non-HTTP URLs', () => {
    expect(validateLMStudioUrl('http://localhost:1234/v1/')).toBe('http://localhost:1234/v1')
    for (const value of ['invalid', 'file:///etc/passwd', 'https://key@host/v1', 'https://host/v1?key=x']) expect(() => validateLMStudioUrl(value)).toThrow()
  })
  it('filters non-chat OpenAI models while retaining local chat candidates', () => {
    const models = ['gpt-4.1', 'gpt-4o-audio-preview', 'text-embedding-3-small', 'o3', 'qwen-coder'].map(id => ({ id }))
    expect(chatModelIds(models, true)).toEqual(['gpt-4.1', 'o3'])
    expect(chatModelIds(models, false)).toHaveLength(5)
  })
  it('retrieves models without putting credentials in URLs', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'qwen' }] }) })
    vi.stubGlobal('fetch', fetch)
    expect(await providerRequest('http://localhost:1234/v1', 'models', 'secret')).toEqual({ data: [{ id: 'qwen' }] })
    expect(fetch.mock.calls[0]?.[0]).toBe('http://localhost:1234/v1/models')
    expect(fetch.mock.calls[0]?.[1].headers.Authorization).toBe('Bearer secret')
    expect(fetch.mock.calls[0]?.[1].credentials).toBe('omit')
  })
  it.each([401, 403, 429, 404])('handles failed responses (%s) without exposing response secrets', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }))
    await expect(providerRequest('https://api.openai.com/v1', 'models', 'secret')).rejects.toThrow(status === 429 ? 'rate limit' : status === 404 ? 'model is loaded' : 'Authentication failed')
  })
  it('explains browser connection failures and CORS recovery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(providerRequest('http://localhost:1234/v1', 'models')).rejects.toThrow('enable CORS')
  })
  it('times out checks and supports inference cancellation', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')))
    })))
    const result = providerRequest('http://localhost:1234/v1', 'models')
    const assertion = expect(result).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(10_000)
    await assertion
    const controller = new AbortController()
    const cancelled = providerRequest('http://localhost:1234/v1', 'chat/completions', '', {}, controller.signal)
    controller.abort()
    await expect(cancelled).rejects.toThrow('cancelled')
  })
})
