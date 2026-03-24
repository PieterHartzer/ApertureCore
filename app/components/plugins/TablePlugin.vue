<script setup lang="ts">
import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  data: SavedSqlQueryResultRow[]
  config: Record<string, unknown>
  columns?: string[]
}>(), {
  columns: () => []
})

const tableColumns = computed(() => {
  const availableColumns = props.columns.length > 0
    ? props.columns
    : Object.keys(props.data[0] ?? {})
  const selectedColumns = Array.isArray(props.config.visibleColumns)
    ? props.config.visibleColumns.filter((value): value is string => {
        return typeof value === 'string' && value.trim().length > 0
      })
    : []
  const selectedColumnSet = new Set(selectedColumns)
  const columnNames = selectedColumnSet.size > 0
    ? availableColumns.filter((columnName) => selectedColumnSet.has(columnName))
    : availableColumns

  return columnNames.map((columnName) => ({
    accessorKey: columnName,
    header: columnName
  }))
})
</script>

<template>
  <div
    v-if="tableColumns.length === 0"
    class="flex h-full min-h-0 items-center justify-center rounded-xl border border-dashed border-default px-6 py-10 text-sm text-muted"
  >
    {{ t('pages.dashboard.plugins.table.emptyColumns') }}
  </div>

  <div
    v-else
    class="h-full min-h-0 overflow-auto"
  >
    <UTable
      :data="data"
      :columns="tableColumns"
      :empty="t('pages.dashboard.plugins.table.emptyRows')"
    />
  </div>
</template>
