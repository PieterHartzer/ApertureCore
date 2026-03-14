<script setup lang="ts">
definePageMeta({
  public: true
})

const config = useRuntimeConfig()
const oidcConfigured = config.public.oidcConfigured
const route = useRoute()

const callbackRedirectUrl =
  typeof route.query.callbackRedirectUrl === 'string' && route.query.callbackRedirectUrl.startsWith('/')
    ? route.query.callbackRedirectUrl
    : '/'

if (oidcConfigured) {
  await navigateTo(
    {
      path: '/auth/oidc/login',
      query: {
        callbackRedirectUrl
      }
    },
    {
      external: true,
      replace: true
    }
  )
}
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center px-6">
    <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 class="text-2xl font-semibold text-slate-900">Sign in</h1>
      <p class="mt-3 text-sm leading-6 text-slate-600">
        Redirecting to your OpenID Connect provider.
      </p>

      <p
        v-if="oidcConfigured"
        class="mt-6 text-sm leading-6 text-slate-500"
      >
        If nothing happens, refresh the page.
      </p>

      <div
        v-else
        class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"
      >
        <p class="font-medium">OIDC is not configured yet.</p>
        <p class="mt-2">
          Set your provider endpoints and
          <code>NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID</code> in your local
          <code>.env.development</code>, then restart the app.
        </p>
      </div>
    </section>
  </main>
</template>
