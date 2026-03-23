const nuxtPort = Number(process.env.NUXT_PORT ?? process.env.PORT ?? '3300')
const publicAppUrl = process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3300'
const oidcAuthorizationUrl = process.env.NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL || ''
const oidcTokenUrl = process.env.NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL || ''
const oidcUserInfoUrl = process.env.NUXT_OIDC_PROVIDERS_OIDC_USER_INFO_URL || ''
const oidcLogoutUrl = process.env.NUXT_OIDC_PROVIDERS_OIDC_LOGOUT_URL || ''
const DEFAULT_OIDC_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access'
]
const splitEnvList = (value: string | undefined): string[] => {
  return (value ?? '')
    .split(/[\s,]+/)
    .map(item => item.trim())
    .filter(Boolean)
}
const oidcOpenIdConfigurationUrl =
  process.env.NUXT_OIDC_PROVIDERS_OIDC_OPENID_CONFIGURATION || undefined
const oidcIssuer = process.env.NUXT_OIDC_PROVIDERS_OIDC_ISSUER || (() => {
  try {
    return oidcAuthorizationUrl ? new URL(oidcAuthorizationUrl).origin : undefined
  } catch {
    return undefined
  }
})()
const oidcJwksUri = process.env.NUXT_OIDC_PROVIDERS_OIDC_JWKS_URI || undefined
const oidcOpenIdConfiguration =
  oidcIssuer && oidcJwksUri
    ? {
        issuer: oidcIssuer,
        jwks_uri: oidcJwksUri,
      }
    : oidcOpenIdConfigurationUrl
const oidcDevProviderHostPort = process.env.OIDC_DEV_PROVIDER_HOST_PORT ?? '18080'
const oidcDevMailUiHostPort = process.env.OIDC_DEV_MAIL_UI_HOST_PORT ?? '8025'
const publicAppOrigin = (() => {
  try {
    return new URL(publicAppUrl).origin
  } catch {
    return 'http://localhost:3300'
  }
})()
const oidcScopes = splitEnvList(process.env.APP_OIDC_SCOPE)
const oidcOrganizationIdClaim =
  process.env.APP_OIDC_ORGANIZATION_ID_CLAIM ||
  ''
const oidcOrganizationNameClaim =
  process.env.APP_OIDC_ORGANIZATION_NAME_CLAIM ||
  ''
const oidcOrganizationPrimaryDomainClaim =
  process.env.APP_OIDC_ORGANIZATION_PRIMARY_DOMAIN_CLAIM ||
  ''
const oidcOptionalClaims = Array.from(new Set([
  'sub',
  oidcOrganizationIdClaim,
  oidcOrganizationNameClaim,
  oidcOrganizationPrimaryDomainClaim
].filter(Boolean)))

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  devServer: {
    host: process.env.NUXT_HOST || undefined,
    port: nuxtPort
  },
  runtimeConfig: {
    appDatabaseUrl: process.env.APP_DATABASE_URL || '',
    appDatabaseEncryptionKey:
      process.env.APP_DATABASE_ENCRYPTION_KEY ||
      '',
    oidcOrganizationClaims: {
      idClaim: oidcOrganizationIdClaim,
      nameClaim: oidcOrganizationNameClaim,
      primaryDomainClaim: oidcOrganizationPrimaryDomainClaim
    },
    public: {
      oidcConfigured: Boolean(process.env.NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID),
      devToolsLinks: {
        enabled: process.env.NODE_ENV !== 'production',
        mailInboxUrl:
          process.env.OIDC_DEV_MAIL_UI_URL || `http://localhost:${oidcDevMailUiHostPort}`,
        providerConsoleUrl:
          process.env.OIDC_DEV_PROVIDER_CONSOLE_URL ||
          `http://localhost:${oidcDevProviderHostPort}/ui/console`,
      },
    }
  },

  modules: ['@nuxt/ui', '@nuxtjs/i18n', 'nuxt-oidc-auth', '@nuxt/eslint'],
  i18n: {
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      cookieKey: 'autodash_locale',
      useCookie: true
    },
    langDir: 'locales',
    locales: [
      {
        code: 'en',
        name: 'English',
        language: 'en-US',
        file: 'en.json'
      },
      {
        code: 'pseudo',
        name: 'Pseudo',
        language: 'en-XA',
        file: 'pseudo.json'
      }
    ]
  },
  oidc: {
    defaultProvider: 'oidc',
    middleware: {
      // Keep routing decisions in app/middleware/auth.global.ts.
      globalMiddlewareEnabled: false
    },
    providers: {
      oidc: {
        clientId: process.env.NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID || '',
        clientSecret: process.env.NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET || '',
        authorizationUrl: oidcAuthorizationUrl,
        tokenUrl: oidcTokenUrl,
        userInfoUrl: oidcUserInfoUrl,
        logoutUrl: oidcLogoutUrl,
        openIdConfiguration: oidcOpenIdConfiguration,
        redirectUri:
          process.env.NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI ||
          `${publicAppOrigin}/auth/oidc/callback`,
        authenticationScheme: 'none',
        grantType: 'authorization_code',
        scope: [
          ...(oidcScopes.length > 0
            ? oidcScopes
            : DEFAULT_OIDC_SCOPES)
        ],
        scopeInTokenRequest: true,
        tokenRequestType: 'form-urlencoded',
        pkce: true,
        state: true,
        nonce: true,
        userNameClaim: 'preferred_username',
        optionalClaims: oidcOptionalClaims,
        skipAccessTokenParsing: true,
        validateAccessToken: false,
        validateIdToken: true,
        excludeOfflineScopeFromTokenRequest: true,
        callbackRedirectUrl: '/'
      }
    }
  }
})
