<script>
import component from '~/view-models/components/plugins/CatalogChartPlugin'

export default component
</script>

<template>
  <div ref="chartContainer" class="h-full min-h-0 w-full">
    <div v-if="!option" class="plugin-no-data">
      <span class="plugin-no-data-label">{{ t('pages.dashboard.plugins.catalog.emptyRows') }}</span>
    </div>
    <PluginChart v-else :option="option" replace />
  </div>
</template>
