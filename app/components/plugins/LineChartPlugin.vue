<script setup lang="ts">
import type { EChartsOption } from 'echarts'

import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'

import PluginChart from '~/components/plugins/PluginChart.vue'

const { t } = useI18n()

const props = defineProps<{
  data: SavedSqlQueryResultRow[]
  config: Record<string, unknown>
  columns?: string[]
}>()

const xField = computed(() => {
  return typeof props.config.xField === 'string'
    ? props.config.xField
    : ''
})

const yField = computed(() => {
  return typeof props.config.yField === 'string'
    ? props.config.yField
    : ''
})

const chartRows = computed(() => {
  if (!xField.value || !yField.value) {
    return []
  }

  return props.data
    .map((row) => {
      const xValue = row[xField.value]
      const yValue = row[yField.value]
      const numericValue = typeof yValue === 'number'
        ? yValue
        : typeof yValue === 'string'
          ? Number(yValue)
          : Number.NaN

      if (xValue === null || !Number.isFinite(numericValue)) {
        return null
      }

      return {
        label: String(xValue),
        value: numericValue
      }
    })
    .filter((row): row is {
      label: string
      value: number
    } => row !== null)
})

const chartOption = computed<EChartsOption>(() => ({
  animationDuration: 250,
  grid: {
    top: 20,
    right: 20,
    bottom: 40,
    left: 48
  },
  tooltip: {
    trigger: 'axis'
  },
  xAxis: {
    type: 'category',
    data: chartRows.value.map((row) => row.label),
    axisLabel: {
      hideOverlap: true
    }
  },
  yAxis: {
    type: 'value'
  },
  series: [{
    type: 'line',
    smooth: true,
    showSymbol: false,
    areaStyle: {
      opacity: 0.12
    },
    data: chartRows.value.map((row) => row.value)
  }]
}))
</script>

<template>
  <div
    v-if="!xField || !yField"
    class="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-default px-6 py-10 text-sm text-muted"
  >
    {{ t('pages.dashboard.plugins.line-chart.emptyMapping') }}
  </div>

  <div
    v-else-if="chartRows.length === 0"
    class="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-default px-6 py-10 text-sm text-muted"
  >
    {{ t('pages.dashboard.plugins.line-chart.emptyRows') }}
  </div>

  <PluginChart
    v-else
    :option="chartOption"
  />
</template>
