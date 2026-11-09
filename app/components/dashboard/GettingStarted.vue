<script setup lang="ts">
import { useSavedDatabaseConnections } from '~/composables/database/useSavedDatabaseConnections'
import { useSavedSqlQueries } from '~/composables/database/useSavedSqlQueries'

defineEmits<{ create: [] }>()

const { t } = useI18n()
const { listConnections } = useSavedDatabaseConnections()
const { listQueries } = useSavedSqlQueries()
const connectionCount = ref(0)
const queryCount = ref(0)

onMounted(async () => {
  const [connections, queries] = await Promise.all([listConnections(), listQueries()])

  connectionCount.value = connections.connections?.length ?? 0
  queryCount.value = queries.queries?.length ?? 0
})

const steps = computed(() => [
  { key: 'connect', done: connectionCount.value > 0, to: '/connections/new' },
  { key: 'query', done: queryCount.value > 0, to: '/sql-workspace' },
  { key: 'dashboard', done: false, to: undefined }
])
const currentKey = computed(() => steps.value.find((step) => !step.done)?.key)
</script>

<template>
  <section class="mx-auto max-w-2xl py-8">
    <h2 class="text-base font-semibold text-highlighted">{{ t('pages.dashboard.gettingStarted.title') }}</h2>
    <p class="mt-1 text-sm text-muted">{{ t('pages.dashboard.gettingStarted.description') }}</p>

    <ol class="mt-6 divide-y divide-default rounded-lg border border-default bg-elevated">
      <li v-for="(step, index) in steps" :key="step.key" class="flex items-center gap-3 p-4">
        <span
          class="grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium"
          :class="step.done ? 'bg-success/15 text-success' : step.key === currentKey ? 'bg-blue-600 text-white' : 'bg-accented text-muted'"
        >
          <UIcon v-if="step.done" name="i-lucide-check" class="size-3.5" :aria-label="t('pages.dashboard.gettingStarted.done')" />
          <template v-else>{{ index + 1 }}</template>
        </span>

        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium" :class="step.done ? 'text-muted' : 'text-highlighted'">
            {{ t(`pages.dashboard.gettingStarted.steps.${step.key}.title`) }}
          </p>
          <p class="text-[13px] text-muted">{{ t(`pages.dashboard.gettingStarted.steps.${step.key}.description`) }}</p>
        </div>

        <UButton
          v-if="!step.done"
          size="sm"
          :to="step.to"
          :color="step.key === currentKey ? 'primary' : 'neutral'"
          :variant="step.key === currentKey ? 'solid' : 'outline'"
          :label="t(`pages.dashboard.gettingStarted.steps.${step.key}.action`)"
          @click="step.to ? undefined : $emit('create')"
        />
      </li>
    </ol>
  </section>
</template>
