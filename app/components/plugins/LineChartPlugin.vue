<script setup lang="ts">
import type { EChartsOption } from 'echarts'

import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'

import PluginChart from '~/components/plugins/PluginChart.vue'
import { useObservedElementSize } from '~/composables/useObservedElementSize'

const { t } = useI18n()

const props = defineProps<{
  data: SavedSqlQueryResultRow[]
  config: Record<string, unknown>
  columns?: string[]
}>()

const { element: chartContainer, height: chartHeight, width: chartWidth } = useObservedElementSize<HTMLElement>()

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

const isCompactChart = computed(() => {
  return chartWidth.value < 420 || chartHeight.value < 260
})

const isDenseChart = computed(() => {
  return chartWidth.value < 320 || chartHeight.value < 200
})

const chartOption = computed<EChartsOption>(() => ({
  animationDuration: 250,
  grid: {
    containLabel: true,
    top: isDenseChart.value ? 8 : 20,
    right: isCompactChart.value ? 8 : 20,
    bottom: isDenseChart.value ? 8 : 16,
    left: isDenseChart.value ? 8 : 16
  },
  tooltip: {
    trigger: 'axis'
  },
  xAxis: {
    type: 'category',
    data: chartRows.value.map((row) => row.label),
    axisLabel: {
      hideOverlap: true,
      show: !isDenseChart.value,
      fontSize: isCompactChart.value ? 10 : 12
    }
  },
  yAxis: {
    type: 'value',
    splitNumber: isCompactChart.value ? 3 : 5,
    axisLabel: {
      show: !isDenseChart.value,
      fontSize: isCompactChart.value ? 10 : 12
    }
  },
  series: [{
    type: 'line',
    smooth: true,
    showSymbol: !isCompactChart.value,
    symbolSize: isCompactChart.value ? 4 : 6,
    lineStyle: {
      width: isCompactChart.value ? 2 : 3
    },
    areaStyle: {
      opacity: 0.12
    },
    data: chartRows.value.map((row) => row.value)
  }]
}))
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
