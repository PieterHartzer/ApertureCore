<script setup lang="ts">
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
const route = useRoute()
const { t } = useI18n()
const items = computed(() => [
  { to: '/', label: t('navigation.dashboard'), icon: 'i-lucide-layout-dashboard' },
  { to: '/connections', label: t('navigation.connections'), icon: 'i-lucide-database' },
  { to: '/queries', label: t('navigation.queries'), icon: 'i-lucide-file-code-2' },
  { to: '/sql-workspace', label: t('navigation.workspace'), icon: 'i-lucide-sparkles' },
  { to: '/settings/ai-models', label: t('navigation.aiModels'), icon: 'i-lucide-settings-2' }
])
const active = (path: string) => isNavigationSectionActive(route.path, path)
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default bg-default/95 backdrop-blur-xl">
    <div class="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
      <NuxtLink to="/" class="shrink-0 rounded-md text-lg font-semibold tracking-tight text-highlighted focus-visible:outline-2 focus-visible:outline-primary">
        {{ t('app.name') }}
      </NuxtLink>
      <nav :aria-label="t('navigation.label')" class="order-3 w-full overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
        <ul class="flex min-w-max items-center gap-1">
          <li v-for="item in items" :key="item.to">
            <NuxtLink :to="item.to" :aria-current="active(item.to) ? 'page' : undefined" class="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary" :class="active(item.to) ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-elevated hover:text-highlighted'">
              <UIcon :name="item.icon" class="size-4 shrink-0" aria-hidden="true" />
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
      <div class="ml-auto shrink-0"><AppLocaleSelect /></div>
    </div>
  </header>
</template>
