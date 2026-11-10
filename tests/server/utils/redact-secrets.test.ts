import { describe, expect, it } from 'vitest'

import { collectSecretValues, createSecretRedactor } from '../../../server/utils/redact-secrets'

const env = {
  NUXT_OIDC_TOKEN_KEY: 'data:;base64,FAKEkeyForTestsOnlyAAAAAAAAAAAAAAAAAAAAAAAA=',
  APP_DATABASE_URL: 'postgres://app:s3cretPassw0rd@db:5432/app',
  IDENTITY_PROVIDER_API_TOKEN: 'abcdefghijklmnop',
  NUXT_PUBLIC_APP_URL: 'http://localhost:3300',
  SHORT_SECRET: 'abc'
}

describe('redact secrets', () => {
  const redact = createSecretRedactor(collectSecretValues(env))

  it('collects only secret environment values', () => {
    const values = collectSecretValues(env)

    expect(values).toContain('FAKEkeyForTestsOnlyAAAAAAAAAAAAAAAAAAAAAAAA=')
    expect(values).toContain('s3cretPassw0rd')
    expect(values).not.toContain('http://localhost:3300')
    expect(values).not.toContain('abc')
  })

  it('removes known secret values, even without their data URI prefix', () => {
    expect(redact('key=base64,FAKEkeyForTestsOnlyAAAAAAAAAAAAAAAAAAAAAAAA= end')).not.toContain('FAKEkey')
    expect(redact('token abcdefghijklmnop used')).toBe('token [redacted] used')
  })

  it('removes the password from a database URL and from driver errors', () => {
    // The configured URL is a secret as a whole.
    expect(redact('connect postgres://app:s3cretPassw0rd@db:5432/app')).toBe('connect [redacted]')
    expect(redact('auth failed for s3cretPassw0rd')).toBe('auth failed for [redacted]')
    expect(redact('mysql://root:other-pass@10.0.0.1/db')).toBe('mysql://root:[redacted]@10.0.0.1/db')
  })

  it('removes credentials printed as fields', () => {
    expect(redact("{ user: 'sa', password: 'hunter22', host: 'x' }")).toBe("{ user: 'sa', password: '[redacted]', host: 'x' }")
    expect(redact('{"apiKey":"abc123456789"}')).toBe('{"apiKey":"[redacted]"}')
    expect(redact('Server=x;Password=hunter22;User Id=sa')).toBe('Server=x;Password=[redacted];User Id=sa')
  })

  it('removes bearer tokens, JWTs and provider keys', () => {
    expect(redact('authorization: Bearer abcdef0123456789')).not.toContain('abcdef0123456789')
    expect(redact('Bearer abcdef0123456789')).toBe('Bearer [redacted]')
    expect(redact('id eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlc2ln')).toBe('id [redacted]')
    expect(redact('key sk-ant-api03-ZYXWVUTSRQPONMLKJIHG')).toBe('key [redacted]')
  })

  it('leaves ordinary text alone', () => {
    const text = 'GET /api/dashboards 200 in 12ms, tokens used: 42'

    expect(redact(text)).toBe(text)
  })
})
