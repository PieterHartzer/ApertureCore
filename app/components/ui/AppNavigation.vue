<script setup lang="ts">
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import AppThemeMenu from '~/components/ui/AppThemeMenu.vue'
import { useAppPermissions } from '~/composables/useAppPermissions'
import { appExtensions, type NavigationGroup } from '~/extensions'

const route = useRoute()
const { t } = useI18n()
const brandName = useAppConfig().brand.name
// A layer may set brand.logo to its own icon; otherwise the default mark is shown.
// With includesName, the image already holds the name (a wordmark), so the name is not typed beside it.
const brandLogo = (useAppConfig().brand as { logo?: { light: string, dark: string, includesName?: boolean } }).logo
const { user, logout } = useOidcAuth()

const extraGroups = appExtensions.useNavigationGroups?.()
const permissions = useAppPermissions()
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

// The two main features lead; supporting pages sit under Data; settings stay at the bottom.
const groups = computed<NavigationGroup[]>(() => {
  const merged: NavigationGroup[] = []

  for (const group of [
    {
      key: 'main',
      items: [
        { to: '/', label: t('navigation.dashboard'), icon: 'i-lucide-layout-dashboard' },
        { to: '/sql-workspace', label: t('navigation.workspace'), icon: 'i-lucide-square-terminal', permission: 'editQueries' as const }
      ]
    },
    {
      key: 'data',
      label: t('navigation.data'),
      items: [
        { to: '/queries', label: t('navigation.queries'), icon: 'i-lucide-file-code-2', permission: 'editQueries' as const },
        { to: '/connections', label: t('navigation.connections'), icon: 'i-lucide-database', permission: 'viewConnections' as const }
      ]
    },
    {
      key: 'settings',
      label: t('navigation.settings'),
      placement: 'bottom' as const,
      items: [{ to: '/settings/ai-models', label: t('navigation.aiModels'), icon: 'i-lucide-sparkles', permission: 'editQueries' as const }]
    },
    ...(extraGroups?.value ?? [])
  ]) {
    const existing = merged.find(item => item.key === group.key)

    if (existing) existing.items = [...existing.items, ...group.items]
    else merged.push({ ...group, items: [...group.items] })
  }

  return merged
    .map(group => ({ ...group, items: group.items.filter(item => !item.permission || permissions.value[item.permission]) }))
    .filter(group => group.items.length > 0)
})
const topGroups = computed(() => groups.value.filter(group => group.placement !== 'bottom'))
const bottomGroups = computed(() => groups.value.filter(group => group.placement === 'bottom'))
const allItems = computed(() => groups.value.flatMap((group) => group.items))
const active = (path: string) => isNavigationSectionActive(route.path, path)

// Groups with a heading fold away. Settings starts folded; the choice is kept
// in this browser, and a group opens by itself when its page is showing.
const FOLDED_KEY = 'navigation-folded-groups'
const folded = ref<Record<string, boolean>>({})
const isFolded = (group: NavigationGroup) => folded.value[group.key] ?? group.key === 'settings'
const groupHasActive = (group: NavigationGroup) => group.items.some(item => active(item.to))
const saveFolded = () => {
  try {
    localStorage.setItem(FOLDED_KEY, JSON.stringify(folded.value))
  } catch {
    // Private windows may refuse storage; folding still works for this visit.
  }
}
const toggleGroup = (group: NavigationGroup) => {
  folded.value = { ...folded.value, [group.key]: !isFolded(group) }
  saveFolded()
}
const unfoldActive = () => {
  const group = groups.value.find(entry => entry.label && groupHasActive(entry))

  if (group && isFolded(group)) folded.value = { ...folded.value, [group.key]: false }
}

onMounted(() => {
  try {
    const stored = JSON.parse(localStorage.getItem(FOLDED_KEY) ?? '{}') as unknown

    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      folded.value = Object.fromEntries(Object.entries(stored).filter(([, value]) => typeof value === 'boolean')) as Record<string, boolean>
    }
  } catch {
    // Unreadable or blocked storage: use the defaults.
  }

  unfoldActive()
})
watch(() => route.path, unfoldActive)
const linkClass = (path: string) => active(path)
  ? 'bg-primary/15 text-highlighted shadow-[inset_2px_0_0_var(--ui-primary)]'
  : 'text-muted hover:bg-elevated/60 hover:text-highlighted'
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default bg-[var(--surface)] backdrop-blur-xl lg:hidden">
    <div class="flex items-center gap-2 px-4 py-2">
      <NuxtLink to="/" class="flex items-center gap-2 text-sm font-semibold text-highlighted">
        <template v-if="brandLogo"><img :src="brandLogo.light" :alt="brandLogo.includesName ? brandName : ''" class="h-6 w-auto dark:hidden"><img :src="brandLogo.dark" :alt="brandLogo.includesName ? brandName : ''" class="hidden h-6 w-auto dark:block"></template>
        <span v-else class="grid size-6 place-items-center rounded-md bg-linear-to-br from-blue-500 to-violet-600 text-white"><UIcon name="i-lucide-aperture" class="size-4" aria-hidden="true" /></span>
        <template v-if="!brandLogo?.includesName">{{ brandName }}</template>
      </NuxtLink>
      <div class="ml-auto flex items-center gap-1">
        <AppThemeMenu />
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
      <template v-if="brandLogo"><img :src="brandLogo.light" :alt="brandLogo.includesName ? brandName : ''" class="h-6 w-auto dark:hidden"><img :src="brandLogo.dark" :alt="brandLogo.includesName ? brandName : ''" class="hidden h-6 w-auto dark:block"></template>
        <span v-else class="grid size-6 place-items-center rounded-md bg-linear-to-br from-blue-500 to-violet-600 text-white"><UIcon name="i-lucide-aperture" class="size-4" aria-hidden="true" /></span>
      <template v-if="!brandLogo?.includesName">{{ brandName }}</template>
    </NuxtLink>

    <nav :aria-label="t('navigation.label')" class="flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-2">
      <div
        v-for="group in topGroups"
        :key="group.key"
        :data-nav-group="group.key"
      >
        <button
          v-if="group.label"
          type="button"
          class="mb-1 flex w-full items-center justify-between rounded-md px-2 py-0.5 text-xs text-dimmed transition-colors hover:text-highlighted"
          :aria-expanded="!isFolded(group)"
          :aria-controls="`nav-group-${group.key}`"
          @click="toggleGroup(group)"
        >
          {{ group.label }}
          <UIcon name="i-lucide-chevron-down" class="size-3.5 transition-transform" :class="isFolded(group) ? '-rotate-90' : ''" aria-hidden="true" />
        </button>
        <ul v-show="!group.label || !isFolded(group)" :id="`nav-group-${group.key}`" :class="group.key === 'main' ? 'space-y-1' : 'space-y-0.5'">
          <li v-for="item in group.items" :key="item.to">
            <!-- The main features get larger rows with a tinted icon. -->
            <NuxtLink
              v-if="group.key === 'main'"
              :to="item.to"
              :aria-current="active(item.to) ? 'page' : undefined"
              class="flex h-10 items-center gap-2.5 rounded-md px-2 text-sm font-semibold transition-colors"
              :class="linkClass(item.to)"
            >
              <span class="grid size-7 shrink-0 place-items-center rounded-md bg-primary/12 text-primary">
                <UIcon :name="item.icon" class="size-4" aria-hidden="true" />
              </span>
              {{ item.label }}
            </NuxtLink>
            <NuxtLink v-else :to="item.to" :aria-current="active(item.to) ? 'page' : undefined" class="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors" :class="linkClass(item.to)">
              <UIcon :name="item.icon" class="size-4 shrink-0" aria-hidden="true" />
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </div>

      <div v-if="bottomGroups.length" class="mt-auto space-y-5">
        <div
          v-for="group in bottomGroups"
          :key="group.key"
          :data-nav-group="group.key"
        >
          <button
            v-if="group.label"
            type="button"
            class="mb-1 flex w-full items-center justify-between rounded-md px-2 py-0.5 text-xs text-dimmed transition-colors hover:text-highlighted"
            :aria-expanded="!isFolded(group)"
            :aria-controls="`nav-group-${group.key}`"
            @click="toggleGroup(group)"
          >
            {{ group.label }}
            <UIcon name="i-lucide-chevron-down" class="size-3.5 transition-transform" :class="isFolded(group) ? '-rotate-90' : ''" aria-hidden="true" />
          </button>
          <ul v-show="!group.label || !isFolded(group)" :id="`nav-group-${group.key}`" class="space-y-0.5">
            <li v-for="item in group.items" :key="item.to">
              <NuxtLink :to="item.to" :aria-current="active(item.to) ? 'page' : undefined" class="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors" :class="linkClass(item.to)">
                <UIcon :name="item.icon" class="size-4 shrink-0" aria-hidden="true" />
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <div class="space-y-1 border-t border-default p-2">
      <div class="flex items-center gap-1">
        <AppLocaleSelect compact class="min-w-0 flex-1" />
        <AppThemeMenu />
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
