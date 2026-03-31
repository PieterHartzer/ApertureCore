import { computed, defineComponent, type PropType } from 'vue'
import type { EChartsOption } from 'echarts'

import PluginChart from '~/components/plugins/PluginChart.vue'
import { useObservedElementSize } from '~/composables/useObservedElementSize'
import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'

export default defineComponent({
  components: {
    PluginChart
  },
  props: {
    data: {
      type: Array as PropType<SavedSqlQueryResultRow[]>,
      required: true
    },
    config: {
      type: Object as PropType<Record<string, unknown>>,
      required: true
    },
    columns: {
      type: Array as PropType<string[]>,
      default: () => []
    }
  },
  setup(props) {
    const { t } = useI18n()
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
          show: !isDenseChart.value,
          interval: 0,
          rotate: isCompactChart.value && chartRows.value.length > 4 ? 24 : 0,
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
        type: 'bar',
        barMaxWidth: isCompactChart.value ? 28 : 48,
        data: chartRows.value.map((row) => row.value)
      }]
    }))

    return {
      chartContainer,
      chartOption,
      chartRows,
      t,
      xField,
      yField
    }
  }
})
