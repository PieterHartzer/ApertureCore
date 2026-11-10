import { describe, expect, it } from 'vitest'

import { readRuntimeEnv, toNuxtEnv } from '../../config/runtime-env.mjs'

describe('readRuntimeEnv', () => {
  it('uses safe defaults with an empty environment', () => {
    const settings = readRuntimeEnv({})

    expect(settings.oidcConfigured).toBe(false)
    expect(settings.oidcProvider.redirectUri).toBe('http://localhost:3300/auth/oidc/callback')
    expect(settings.oidcProvider.scope).toEqual(['openid', 'profile', 'email', 'offline_access'])
    expect(settings.queryTimeoutMs).toBe(10_000)
  })

  it('derives addresses from the public app URL', () => {
    const settings = readRuntimeEnv({
      NUXT_PUBLIC_APP_URL: 'https://app.example.com/some/path',
      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID: 'client-1',
      NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL: 'https://id.example.com/oauth/v2/authorize',
      NUXT_OIDC_PROVIDERS_OIDC_JWKS_URI: 'https://id.example.com/oauth/v2/keys',
      APP_OIDC_SCOPE: 'openid, email',
      APP_OIDC_ORGANIZATION_ID_CLAIM: 'urn:zitadel:iam:user:resourceowner:id'
    })

    expect(settings.oidcConfigured).toBe(true)
    expect(settings.oidcProvider).toMatchObject({
      redirectUri: 'https://app.example.com/auth/oidc/callback',
      logoutRedirectUri: 'https://app.example.com/',
      additionalLogoutParameters: { clientId: 'client-1' },
      openIdConfiguration: { issuer: 'https://id.example.com', jwks_uri: 'https://id.example.com/oauth/v2/keys' },
      scope: ['openid', 'email'],
      optionalClaims: ['sub', 'urn:zitadel:iam:user:resourceowner:id']
    })
  })

  it('ignores invalid numbers', () => {
    expect(readRuntimeEnv({ MAX_QUERY_ROWS: 'lots' }).maxQueryRows).toBe(1000)
  })
})

describe('toNuxtEnv', () => {
  it('names each setting the way Nitro looks for it', () => {
    const env = toNuxtEnv(readRuntimeEnv({
      APP_DATABASE_URL: 'postgres://app@db/app',
      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID: 'client-1',
      APP_OIDC_ORGANIZATION_ID_CLAIM: 'org_id'
    }))

    expect(env).toMatchObject({
      NUXT_APP_DATABASE_URL: 'postgres://app@db/app',
      NUXT_PUBLIC_OIDC_CONFIGURED: 'true',
      NUXT_OIDC_ORGANIZATION_CLAIMS_ID_CLAIM: 'org_id',
      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID: 'client-1',
      NUXT_OIDC_PROVIDERS_OIDC_LOGOUT_REDIRECT_URI: 'http://localhost:3300/',
      NUXT_OIDC_PROVIDERS_OIDC_OPEN_ID_CONFIGURATION: ''
    })
    expect(JSON.parse(env.NUXT_OIDC_PROVIDERS_OIDC_OPTIONAL_CLAIMS!)).toEqual(['sub', 'org_id'])
    expect(JSON.parse(env.NUXT_OIDC_PROVIDERS_OIDC_ADDITIONAL_LOGOUT_PARAMETERS!)).toEqual({ clientId: 'client-1' })
  })
})
