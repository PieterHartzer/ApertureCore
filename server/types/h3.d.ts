import type { UserSession } from '#oidc-auth'

declare module 'h3' {
  interface H3EventContext {
    auth?: UserSession
  }
}

export {}
