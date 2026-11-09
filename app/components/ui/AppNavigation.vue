<script setup lang="ts">
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'

const route = useRoute()
const { t } = useI18n()
const { user, logout } = useOidcAuth()

const userDetails = computed(() => {
  const info = user.value?.userInfo as Record<string, unknown> | undefined
  const claims = user.value?.claims as Record<string, unknown> | undefined
  const text = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.trim() !== '') ?? ''
  const email = text(info?.email, claims?.email)
  const name = text(user.value?.userName, info?.name, claims?.name, info?.preferred_username, claims?.preferred_username, email)

  return {
    name,
    email: email === name ? '' : email,
    initials: name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('')
  }
})

const groups = computed<Array<{ key: string, label?: string, items: Array<{ to: string, label: string, icon: string }> }>>(() => [
  {
    key: 'main',
    items: [
      { to: '/', label: t('navigation.dashboard'), icon: 'i-lucide-layout-dashboard' },
      { to: '/queries', label: t('navigation.queries'), icon: 'i-lucide-file-code-2' },
      { to: '/sql-workspace', label: t('navigation.workspace'), icon: 'i-lucide-square-terminal' }
    ]
  },
  {
    key: 'data',
    label: t('navigation.data'),
    items: [{ to: '/connections', label: t('navigation.connections'), icon: 'i-lucide-database' }]
  },
  {
    key: 'settings',
    label: t('navigation.settings'),
    items: [{ to: '/settings/ai-models', label: t('navigation.aiModels'), icon: 'i-lucide-sparkles' }]
  }
])
const allItems = computed(() => groups.value.flatMap((group) => group.items))
const active = (path: string) => isNavigationSectionActive(route.path, path)
const linkClass = (path: string) => active(path)
  ? 'bg-primary/15 text-highlighted shadow-[inset_2px_0_0_var(--ui-primary)]'
  : 'text-muted hover:bg-elevated/60 hover:text-highlighted'
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default bg-[var(--surface)] backdrop-blur-xl lg:hidden">
    <div class="flex items-center gap-2 px-4 py-2">
      <NuxtLink to="/" class="flex items-center gap-2 text-sm font-semibold text-highlighted">
        <span class="grid size-6 place-items-center rounded-md bg-linear-to-br from-blue-500 to-violet-600 text-white"><UIcon name="i-lucide-aperture" class="size-4" aria-hidden="true" /></span>
        {{ t('app.name') }}
      </NuxtLink>
      <div class="ml-auto flex items-center gap-1">
        <UColorModeButton size="sm" />
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-log-out" :aria-label="t('navigation.signOut')" @click="logout()" />
      </div>
    </div>
    <nav :aria-label="t('navigation.label')" class="overflow-x-auto px-2 pb-2">
      <ul class="flex min-w-max gap-1">
        <li v-for="item in allItems" :key="item.to">
          <NuxtLink :to="item.to" :aria-current="active(item.to) ? 'page' : undefined" class="flex min-h-11 items-center gap-2 rounded-md px-3 text-[13px] font-medium" :class="linkClass(item.to)">
            <UIcon :name="item.icon" class="size-4 shrink-0" aria-hidden="true" />
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </header>

  <aside class="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-default bg-[var(--surface)] backdrop-blur-xl lg:flex">
    <NuxtLink to="/" class="flex h-14 items-center gap-2 px-4 text-sm font-semibold text-highlighted">
      <span class="grid size-6 place-items-center rounded-md bg-linear-to-br from-blue-500 to-violet-600 text-white"><UIcon name="i-lucide-aperture" class="size-4" aria-hidden="true" /></span>
      {{ t('app.name') }}
    </NuxtLink>

    <nav :aria-label="t('navigation.label')" class="flex-1 space-y-5 overflow-y-auto px-2 py-2">
      <div v-for="group in groups" :key="group.key">
        <p v-if="group.label" class="mb-1 px-2 text-xs text-dimmed">{{ group.label }}</p>
        <ul class="space-y-0.5">
          <li v-for="item in group.items" :key="item.to">
            <NuxtLink :to="item.to" :aria-current="active(item.to) ? 'page' : undefined" class="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors" :class="linkClass(item.to)">
              <UIcon :name="item.icon" class="size-4 shrink-0" aria-hidden="true" />
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <div class="space-y-1 border-t border-default p-2">
      <div class="flex items-center gap-1">
        <AppLocaleSelect compact class="min-w-0 flex-1" />
        <UColorModeButton size="sm" />
      </div>
      <div class="flex items-center gap-2 border-t border-default px-1 pt-2">
        <span class="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-highlighted" aria-hidden="true">{{ userDetails.initials }}</span>
        <div class="min-w-0 flex-1 leading-4">
          <p class="truncate text-[13px] font-medium text-highlighted" :title="userDetails.name">{{ userDetails.name }}</p>
          <p v-if="userDetails.email" class="truncate text-xs text-dimmed" :title="userDetails.email">{{ userDetails.email }}</p>
        </div>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-log-out" :aria-label="t('navigation.signOut')" :title="t('navigation.signOut')" @click="logout()" />
      </div>
    </div>
  </aside>
</template>
