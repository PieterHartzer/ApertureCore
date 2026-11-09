<script>
import component from '~/view-models/components/plugins/BarChartPlugin'

export default component
</script>

<template>
  <div
    ref="chartContainer"
    class="h-full min-h-0"
  >
    <div
      v-if="!xField || !yField"
      class="plugin-no-data"
    >
      <span class="plugin-no-data-label">{{ t('pages.dashboard.plugins.bar-chart.emptyMapping') }}</span>
    </div>

    <div
      v-else-if="chartRows.length === 0"
      class="plugin-no-data"
    >
      <span class="plugin-no-data-label">{{ t('pages.dashboard.plugins.bar-chart.emptyRows') }}</span>
    </div>

    <PluginChart
      v-else
      :option="chartOption"
      height-class="h-full min-h-0"
    />
  </div>
</template>
