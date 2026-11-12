import { describe, expect, it } from 'vitest'

import { isCrossOriginWrite } from '../../../server/utils/request-origin'

const write = (input: Partial<Parameters<typeof isCrossOriginWrite>[0]>) => isCrossOriginWrite({
  method: 'POST',
  path: '/api/dashboards',
  host: 'app.example.com',
  origin: undefined,
  secFetchSite: undefined,
  ...input
})

describe('isCrossOriginWrite', () => {
  it('allows the app writing to itself', () => {
    expect(write({ secFetchSite: 'same-origin', origin: 'https://app.example.com' })).toBe(false)
    expect(write({ origin: 'https://app.example.com' })).toBe(false)
  })

  it('refuses writes from other sites and from our own subdomains', () => {
    expect(write({ secFetchSite: 'cross-site', origin: 'https://evil.test' })).toBe(true)
    expect(write({ secFetchSite: 'same-site', origin: 'https://customer.example.com' })).toBe(true)
    expect(write({ origin: 'https://customer.example.com' })).toBe(true)
    expect(write({ origin: 'null' })).toBe(true)
  })

  it('leaves reads, embeds, pages and tools alone', () => {
    expect(write({ method: 'GET', secFetchSite: 'cross-site' })).toBe(false)
    expect(write({ path: '/api/embed/dashboards/x/widgets/y/run', secFetchSite: 'cross-site' })).toBe(false)
    expect(write({ path: '/auth/oidc/callback', secFetchSite: 'cross-site' })).toBe(false)
    expect(write({})).toBe(false)
  })
})
