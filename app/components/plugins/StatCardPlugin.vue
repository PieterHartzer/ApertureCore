<script setup lang="ts">
import type { SavedSqlQueryResultValue } from '~/types/saved-sql-queries'

const { locale, t } = useI18n()

const props = defineProps<{
  data: Array<Record<string, SavedSqlQueryResultValue>>
  config: Record<string, unknown>
  columns?: string[]
}>()

const valueField = computed(() => {
  return typeof props.config.valueField === 'string'
    ? props.config.valueField
    : ''
})

const labelField = computed(() => {
  return typeof props.config.labelField === 'string'
    ? props.config.labelField
    : ''
})

const firstRow = computed(() => {
  return props.data[0] ?? null
})

const rawValue = computed(() => {
  if (!firstRow.value || !valueField.value) {
    return null
  }

  return firstRow.value[valueField.value] ?? null
})

const formattedValue = computed(() => {
  if (typeof rawValue.value === 'number') {
    return new Intl.NumberFormat(locale.value).format(rawValue.value)
  }

  if (typeof rawValue.value === 'boolean') {
    return rawValue.value
      ? t('pages.dashboard.plugins.stat-card.boolean.true')
      : t('pages.dashboard.plugins.stat-card.boolean.false')
  }

  return rawValue.value === null
    ? t('pages.dashboard.plugins.stat-card.emptyValue')
    : String(rawValue.value)
})

const supportingLabel = computed(() => {
  if (!firstRow.value || !labelField.value) {
    return ''
  }

  const value = firstRow.value[labelField.value]

  return value === null
    ? ''
    : String(value)
})
</script>

<template>
  <div
    v-if="!valueField"
    class="flex h-full min-h-0 items-center justify-center rounded-xl border border-dashed border-default px-6 py-10 text-sm text-muted"
  >
    {{ t('pages.dashboard.plugins.stat-card.emptyMapping') }}
  </div>

  <div
    v-else-if="!firstRow"
    class="flex h-full min-h-0 items-center justify-center rounded-xl border border-dashed border-default px-6 py-10 text-sm text-muted"
  >
    {{ t('pages.dashboard.plugins.stat-card.emptyRows') }}
  </div>

  <div
    v-else
    class="flex h-full min-h-0 flex-col rounded-2xl border border-default bg-gradient-to-br from-elevated to-muted/20 p-6"
  >
    <p class="text-sm font-medium uppercase tracking-[0.18em] text-muted">
      {{ supportingLabel || valueField }}
    </p>
    <p class="mt-4 text-4xl font-semibold text-highlighted">
      {{ formattedValue }}
    </p>
    <p class="mt-auto pt-3 text-sm text-muted">
      {{ t('pages.dashboard.plugins.stat-card.firstRowHint') }}
    </p>
  </div>
</template>
