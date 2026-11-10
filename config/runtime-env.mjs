// Plain JavaScript so the server can load it before Nitro starts, without a build step.

const DEFAULT_OIDC_SCOPES = ['openid', 'profile', 'email', 'offline_access']
const DEFAULT_APP_URL = 'http://localhost:3300'

/** @param {string | undefined} value */
const splitEnvList = (value) => (value ?? '').split(/[\s,]+/).map(item => item.trim()).filter(Boolean)

/** @param {string | undefined} url @param {string} [fallback] */
const originOf = (url, fallback) => {
  try {
    return url ? new URL(url).origin : fallback
  } catch {
    return fallback
  }
}

/** @param {string | undefined} value @param {number} fallback */
const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Turns environment variables into the app's settings. Used by nuxt.config
 * when building, and by apply-runtime-env.mjs when the built server starts.
 *
 * @param {Record<string, string | undefined>} env
 */
export const readRuntimeEnv = (env) => {
  const publicAppOrigin = originOf(env.NUXT_PUBLIC_APP_URL, DEFAULT_APP_URL) ?? DEFAULT_APP_URL
  const clientId = env.NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID || ''
  const authorizationUrl = env.NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL || ''
  const issuer = env.NUXT_OIDC_PROVIDERS_OIDC_ISSUER || originOf(authorizationUrl)
  const jwksUri = env.NUXT_OIDC_PROVIDERS_OIDC_JWKS_URI || ''
  const scopes = splitEnvList(env.APP_OIDC_SCOPE)
  const organizationClaims = {
    idClaim: env.APP_OIDC_ORGANIZATION_ID_CLAIM || '',
    nameClaim: env.APP_OIDC_ORGANIZATION_NAME_CLAIM || '',
    primaryDomainClaim: env.APP_OIDC_ORGANIZATION_PRIMARY_DOMAIN_CLAIM || ''
  }

  return {
    publicAppOrigin,
    appDatabaseUrl: env.APP_DATABASE_URL || '',
    appDatabaseEncryptionKey: env.APP_DATABASE_ENCRYPTION_KEY || '',
    queryCacheTtlSeconds: positiveInteger(env.QUERY_CACHE_TTL_SECONDS, 60),
    maxQueryRows: positiveInteger(env.MAX_QUERY_ROWS, 1000),
    queryTimeoutMs: positiveInteger(env.QUERY_TIMEOUT_MS, 10_000),
    oidcOrganizationClaims: organizationClaims,
    oidcConfigured: Boolean(clientId),
    oidcProvider: {
      clientId,
      clientSecret: env.NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET || '',
      authorizationUrl,
      tokenUrl: env.NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL || '',
      userInfoUrl: env.NUXT_OIDC_PROVIDERS_OIDC_USER_INFO_URL || '',
      logoutUrl: env.NUXT_OIDC_PROVIDERS_OIDC_LOGOUT_URL || '',
      // Return to the app after sign-out, which leads to the sign-in form and
      // then the dashboard. The provider must have this address registered.
      logoutRedirectUri: `${publicAppOrigin}/`,
      additionalLogoutParameters: { clientId },
      // Empty rather than missing, so the key exists and can be set at start-up.
      openIdConfiguration: issuer && jwksUri
        ? { issuer, jwks_uri: jwksUri }
        : env.NUXT_OIDC_PROVIDERS_OIDC_OPENID_CONFIGURATION || '',
      redirectUri: env.NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI || `${publicAppOrigin}/auth/oidc/callback`,
      scope: scopes.length > 0 ? scopes : DEFAULT_OIDC_SCOPES,
      optionalClaims: Array.from(new Set(['sub', ...Object.values(organizationClaims)].filter(Boolean)))
    }
  }
}

/** @param {string} key */
const toEnvName = (key) => key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()

/**
 * The NUXT_* variables Nitro reads when it starts, which override what was
 * built in. Objects and arrays are passed as JSON, which Nitro parses.
 *
 * @param {ReturnType<typeof readRuntimeEnv>} settings
 */
export const toNuxtEnv = (settings) => {
  /** @type {Record<string, string>} */
  const env = {
    NUXT_APP_DATABASE_URL: settings.appDatabaseUrl,
    NUXT_APP_DATABASE_ENCRYPTION_KEY: settings.appDatabaseEncryptionKey,
    NUXT_QUERY_CACHE_TTL_SECONDS: String(settings.queryCacheTtlSeconds),
    NUXT_MAX_QUERY_ROWS: String(settings.maxQueryRows),
    NUXT_QUERY_TIMEOUT_MS: String(settings.queryTimeoutMs),
    NUXT_PUBLIC_OIDC_CONFIGURED: String(settings.oidcConfigured)
  }

  for (const [key, value] of Object.entries(settings.oidcOrganizationClaims)) {
    env[`NUXT_OIDC_ORGANIZATION_CLAIMS_${toEnvName(key)}`] = value
  }

  for (const [key, value] of Object.entries(settings.oidcProvider)) {
    env[`NUXT_OIDC_PROVIDERS_OIDC_${toEnvName(key)}`] = typeof value === 'string' ? value : JSON.stringify(value)
  }

  return env
}
