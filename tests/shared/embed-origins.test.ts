import { describe, expect, it } from 'vitest'

import { frameAncestorsFor, normalizeEmbedOrigin, normalizeEmbedOrigins, readStoredEmbedOrigins } from '../../shared/utils/embed-origins'

describe('embed origins', () => {
  it('turns what people type into an origin', () => {
    expect(normalizeEmbedOrigin('example.com')).toBe('https://example.com')
    expect(normalizeEmbedOrigin(' HTTPS://Portal.Example.com/ ')).toBe('https://portal.example.com')
    expect(normalizeEmbedOrigin('https://example.com:8443')).toBe('https://example.com:8443')
    expect(normalizeEmbedOrigin('*.example.com')).toBe('https://*.example.com')
    expect(normalizeEmbedOrigin('http://localhost:3000')).toBe('http://localhost:3000')
  })

  it('refuses paths, plain http, bare wildcards and other schemes', () => {
    for (const value of ['https://example.com/page', 'http://example.com', '*', 'https://*', 'com', 'javascript:alert(1)', 'ftp://example.com', '', 42, 'https://exa mple.com']) {
      expect(normalizeEmbedOrigin(value), String(value)).toBeNull()
    }
  })

  it('accepts at most ten, drops repeats, and rejects the list if one entry is wrong', () => {
    expect(normalizeEmbedOrigins(['example.com', 'https://example.com'])).toEqual(['https://example.com'])
    expect(normalizeEmbedOrigins(['example.com', 'not a site'])).toBeNull()
    expect(normalizeEmbedOrigins(Array.from({ length: 11 }, (_, index) => `site${index}.com`))).toBeNull()
    expect(normalizeEmbedOrigins('example.com')).toBeNull()
  })

  it('reads stored values safely and builds frame-ancestors', () => {
    expect(readStoredEmbedOrigins(['https://a.com', 'bad value', 7])).toEqual(['https://a.com'])
    expect(readStoredEmbedOrigins(null)).toEqual([])
    expect(frameAncestorsFor([])).toBe('*')
    expect(frameAncestorsFor(['https://a.com', 'https://*.b.com'])).toBe('https://a.com https://*.b.com')
  })
})
