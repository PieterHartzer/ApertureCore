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
  const columnNames = props.columns.length > 0
    ? props.columns
    : Object.keys(props.data[0] ?? {})

  return columnNames.map((columnName) => ({
    accessorKey: columnName,
    header: columnName
  }))
})
</script>

<template>
  <div
    v-if="tableColumns.length === 0"
    class="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-default px-6 py-10 text-sm text-muted"
  >
    {{ t('pages.dashboard.plugins.table.emptyColumns') }}
  </div>

  <UTable
    v-else
    :data="data"
    :columns="tableColumns"
    :empty="t('pages.dashboard.plugins.table.emptyRows')"
  />
</template>
