<script>
import component from '~/view-models/components/plugins/TablePlugin'

export default component
</script>

<template>
  <div
    v-if="tableColumns.length === 0"
    class="plugin-no-data"
  >
    <span class="plugin-no-data-label">{{ t('pages.dashboard.plugins.table.emptyColumns') }}</span>
  </div>

  <div
    v-else
    class="widget-table h-full min-h-0 overflow-auto"
    :style="tableTextStyle"
  >
    <UTable
      :data="data"
      :columns="tableColumns"
      :empty="t('pages.dashboard.plugins.table.emptyRows')"
    />
  </div>
</template>

<style scoped>
.widget-table :deep(th),
.widget-table :deep(td) {
  font-size: var(--widget-table-size, inherit);
}

/* Number columns line up; a layer may give them a monospaced font with --table-number-font. */
.widget-table :deep(td.widget-table-number) {
  font-family: var(--table-number-font, inherit);
}

.widget-table[style*='--widget-table-align'] :deep(th),
.widget-table[style*='--widget-table-align'] :deep(td) {
  text-align: var(--widget-table-align);
}
</style>
