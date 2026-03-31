<script>
import component from '~/view-models/components/plugins/TablePlugin'

export default component
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
