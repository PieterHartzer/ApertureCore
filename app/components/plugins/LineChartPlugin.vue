<script>
import component from '~/view-models/components/plugins/LineChartPlugin'

export default component
</script>

<template>
  <div
    ref="chartContainer"
    class="h-full min-h-0"
  >
    <div
      v-if="!xField || !yField"
      class="flex h-full min-h-0 items-center justify-center rounded-xl border border-dashed border-default px-6 py-10 text-sm text-muted"
    >
      {{ t('pages.dashboard.plugins.line-chart.emptyMapping') }}
    </div>

    <div
      v-else-if="chartRows.length === 0"
      class="flex h-full min-h-0 items-center justify-center rounded-xl border border-dashed border-default px-6 py-10 text-sm text-muted"
    >
      {{ t('pages.dashboard.plugins.line-chart.emptyRows') }}
    </div>

    <PluginChart
      v-else
      :option="chartOption"
      height-class="h-full min-h-0"
    />
  </div>
</template>
