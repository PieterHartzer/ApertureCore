<script>
import component from '~/view-models/pages/login'

definePageMeta({
  public: true
})

export default component
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center px-6">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <h1 class="text-2xl font-semibold text-highlighted">
              {{ t('login.title') }}
            </h1>
            <p class="text-sm leading-6 text-muted">
              {{ t('login.description') }}
            </p>
          </div>

          <AppLocaleSelect />
        </div>
      </template>

      <p
        v-if="oidcConfigured"
        class="text-sm leading-6 text-muted"
      >
        {{ t('login.refreshHint') }}
      </p>

      <AppAlert
        v-else
        kind="warning"
        :title="t('login.oidcNotConfigured.title')"
      >
        {{ t('login.oidcNotConfigured.description') }}
      </AppAlert>
    </UCard>
  </main>
</template>
