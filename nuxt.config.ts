import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { readRuntimeEnv } from './config/runtime-env.mjs'

const nuxtPort = Number(process.env.NUXT_PORT ?? process.env.PORT ?? '3300')
// The built server reads them again at start-up through config/apply-runtime-env.mjs.
const settings = readRuntimeEnv(process.env)
const oidcDevProviderHostPort = process.env.OIDC_DEV_PROVIDER_HOST_PORT ?? '18080'
const oidcDevMailUiHostPort = process.env.OIDC_DEV_MAIL_UI_HOST_PORT ?? '8025'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  nitro: {
    devStorage: {
      oidc: { driver: 'fs', base: './.data/oidc-sessions' }
    },
    // Sessions survive a restart, so people stay signed in across deploys.
    storage: {
      oidc: { driver: 'fs', base: './.data/oidc-sessions' }
    },
    // Serve the self-contained runtime without Vite transforming its embedded WASM.
    publicAssets: [{
      dir: dirname(createRequire(import.meta.url).resolve('@mlc-ai/web-llm')),
      baseURL: '/vendor/web-llm'
    }]
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // An absolute path, so this still works when another app extends this one.
  css: [fileURLToPath(new URL('./app/assets/css/main.css', import.meta.url))],
  // Follow the device, like the website and the sign-in pages (Zitadel), so the theme never flips between them.
  colorMode: { preference: 'system', fallback: 'light' },
  devServer: {
    host: process.env.NUXT_HOST || undefined,
    port: nuxtPort
  },
  runtimeConfig: {
    appDatabaseUrl: settings.appDatabaseUrl,
    appDatabaseEncryptionKey: settings.appDatabaseEncryptionKey,
    queryCacheTtlSeconds: settings.queryCacheTtlSeconds,
    maxQueryRows: settings.maxQueryRows,
    queryTimeoutMs: settings.queryTimeoutMs,
    oidcOrganizationClaims: settings.oidcOrganizationClaims,
    public: {
      oidcConfigured: settings.oidcConfigured,
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
  vite: {
    optimizeDeps: {
      // Listed up front so the dev server doesn't reload when they are first used.
      include: [
        '@intlify/shared',
        'gridstack',
        'vue-echarts',
        'echarts/charts',
        'echarts/components',
        'echarts/core',
        'echarts/features',
        'echarts/renderers'
      ]
    }
  },
  i18n: {
    defaultLocale: 'en',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      cookieKey: 'autodash_locale',
      useCookie: true
    },
    langDir: 'locales',
    locales: [
      { code: 'en', name: 'English', language: 'en-US', file: 'en.json' },
      { code: 'es', name: 'Español', language: 'es', file: 'es.json' },
      { code: 'fr', name: 'Français', language: 'fr', file: 'fr.json' },
      { code: 'de', name: 'Deutsch', language: 'de', file: 'de.json' },
      { code: 'pt-BR', name: 'Português (Brasil)', language: 'pt-BR', file: 'pt-BR.json' },
      { code: 'pt-PT', name: 'Português (Portugal)', language: 'pt-PT', file: 'pt-PT.json' },
      // Stretched text for spotting untranslated strings; development only.
      ...(process.env.NODE_ENV === 'production' ? [] : [{ code: 'pseudo', name: 'Pseudo', language: 'en-XA', file: 'pseudo.json' }])
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
        ...settings.oidcProvider,
        logoutRedirectParameterName: 'post_logout_redirect_uri',
        authenticationScheme: 'none',
        grantType: 'authorization_code',
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
