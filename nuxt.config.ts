const nuxtPort = Number(process.env.NUXT_PORT ?? process.env.PORT ?? '3001')
const oidcAuthorizationUrl = process.env.NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL || ''
const oidcTokenUrl = process.env.NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL || ''
const oidcUserInfoUrl = process.env.NUXT_OIDC_PROVIDERS_OIDC_USER_INFO_URL || ''
const oidcLogoutUrl = process.env.NUXT_OIDC_PROVIDERS_OIDC_LOGOUT_URL || ''
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

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: {
    host: process.env.NUXT_HOST || undefined,
    port: nuxtPort
  },
  runtimeConfig: {
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

  modules: ['@nuxtjs/tailwindcss', 'nuxt-oidc-auth'],
  tailwindcss: {
    exposeConfig: true,
    viewer: true,
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
          `http://localhost:${nuxtPort}/auth/oidc/callback`,
        authenticationScheme: 'none',
        grantType: 'authorization_code',
        scope: ['openid', 'profile', 'email', 'offline_access'],
        scopeInTokenRequest: true,
        tokenRequestType: 'form-urlencoded',
        pkce: true,
        state: true,
        nonce: true,
        userNameClaim: 'preferred_username',
        skipAccessTokenParsing: true,
        validateAccessToken: false,
        validateIdToken: true,
        excludeOfflineScopeFromTokenRequest: true,
        callbackRedirectUrl: '/'
      }
    }
  }
})
