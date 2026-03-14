export default defineNuxtRouteMiddleware((to, from) => {
  const { loggedIn } = useOidcAuth()
  const { public: publicConfig } = useRuntimeConfig()

  // Let nuxt-oidc-auth own its internal login/logout/callback routes.
  if (to.path.startsWith('/auth/')) return

  // Public routes
  if (to.meta.public) return

  // Private routes
  if (!loggedIn.value) {
    if (publicConfig.oidcConfigured) {
      return navigateTo(
        {
          path: '/auth/oidc/login',
          query: {
            callbackRedirectUrl: to.fullPath
          }
        },
        {
          external: true,
          replace: true
        }
      )
    }

    return navigateTo('/login')
  }
})
