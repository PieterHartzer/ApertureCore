import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin)
vi.mock('h3', () => ({ getRequestURL: vi.fn(), setResponseHeader: vi.fn() }))

const { addScriptNonce, buildContentSecurityPolicy, isEmbedPath } = await import('../../../server/plugins/security-headers')

describe('security headers', () => {
  it('lets only embeds be framed by other sites', () => {
    expect(isEmbedPath('/embed/dashboard/abc')).toBe(true)
    expect(isEmbedPath('/embedded')).toBe(false)
    expect(isEmbedPath('/')).toBe(false)
    expect(buildContentSecurityPolicy('n', true)).toContain('frame-ancestors *')
    expect(buildContentSecurityPolicy('n', false)).toContain("frame-ancestors 'none'")
  })

  it('allows scripts only from this site or with the nonce, and no plugins', () => {
    const policy = buildContentSecurityPolicy('abc', false)

    expect(policy).toContain("script-src 'self' 'nonce-abc' 'wasm-unsafe-eval'")
    expect(policy).not.toContain("'unsafe-inline' 'nonce")
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/)
    expect(policy).toContain("object-src 'none'")
  })

  it('keeps embeds from sending data anywhere but this site', () => {
    expect(buildContentSecurityPolicy('n', true)).toContain("connect-src 'self';")
  })

  it('adds the nonce to every script tag once', () => {
    const html = '<script>window.__NUXT__={}</script><script type="module" src="/_nuxt/a.js"></script><SCRIPT nonce="x"></SCRIPT>'

    expect(addScriptNonce(html, 'abc')).toBe('<script nonce="abc">window.__NUXT__={}</script><script nonce="abc" type="module" src="/_nuxt/a.js"></script><SCRIPT nonce="x"></SCRIPT>')
  })
})
