import { computed, defineComponent, type PropType } from 'vue'
import type { EChartsOption } from 'echarts'

import PluginChart from '~/components/plugins/PluginChart.vue'
import { useChartTheme } from '~/composables/useChartTheme'
import { useObservedElementSize } from '~/composables/useObservedElementSize'
import { getChartColors } from '~/utils/charts/chart-colors'
import { applyAdvancedOptions, applyCartesianSettings, applyLabelOverridesToOption, colorSetting } from '~/utils/charts/chart-settings'
import { numberFormatterFor } from '~/utils/charts/column-formats'
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
    const { locale, t } = useI18n()
    const chartTheme = useChartTheme()
    const colorMode = useColorMode()
    const useColorModeIsDark = () => colorMode.value === 'dark'
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

    // Every category label is drawn, so long names need rotating once they
    // would run into their neighbours. The y axis and padding take about 80px.
    const hasCrowdedLabels = computed(() => {
      const count = chartRows.value.length

      if (count === 0 || chartWidth.value === 0) {
        return false
      }

      const longestLabel = Math.max(...chartRows.value.map((row) => row.label.length))
      const characterWidth = isCompactChart.value ? 5.5 : 6.5

      return longestLabel * characterWidth > (chartWidth.value - 80) / count - 8
    })

    const valueFormat = computed(() => numberFormatterFor(props.config, String(locale.value) === 'pseudo' ? 'en' : locale.value, typeof props.config.yField === 'string' ? props.config.yField : undefined))
    const seriesColor = computed(() => colorSetting(props.config, 'color') ?? chartTheme.value.line)

    const baseOption = computed<EChartsOption>(() => ({
      animationDuration: 250,
      grid: {
        // Fixed margins hold the right-hand value axis and the category labels,
        // with extra room when those labels are rotated.
        containLabel: false,
        top: isDenseChart.value ? 8 : 20,
        right: isDenseChart.value ? 8 : isCompactChart.value ? 40 : 48,
        bottom: isDenseChart.value
          ? 8
          : hasCrowdedLabels.value
            ? (isCompactChart.value ? 60 : 72)
            : (isCompactChart.value ? 24 : 28),
        left: isDenseChart.value ? 8 : hasCrowdedLabels.value ? 56 : 16
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'none' },
        valueFormatter: (value) => typeof value === 'number' ? valueFormat.value.full(value) : String(value),
        backgroundColor: chartTheme.value.tooltipBackground,
        borderColor: chartTheme.value.tooltipBorder,
        textStyle: { color: chartTheme.value.tooltipText, fontSize: 12 }
      },
      xAxis: {
        type: 'category',
        axisLine: { show: false },
        axisTick: { show: false },
        data: chartRows.value.map((row) => row.label),
        axisLabel: {
          color: chartTheme.value.label,
          show: !isDenseChart.value,
          interval: 0,
          fontSize: isCompactChart.value ? 10 : 12,
          // Always set: ECharts merges options, so an omitted value would keep
          // the previous rotation.
          rotate: hasCrowdedLabels.value ? 30 : 0,
          // Rotated labels are shortened to fit the bottom margin. The tooltip
          // still shows the full name.
          formatter: (value: string) => hasCrowdedLabels.value && value.length > 18
            ? `${value.slice(0, 17)}…`
            : value
        }
      },
      yAxis: {
        type: 'value',
        position: 'right',
        splitLine: { lineStyle: { color: chartTheme.value.grid } },
        splitNumber: isCompactChart.value ? 3 : 4,
        axisLabel: {
          formatter: (value: number) => valueFormat.value.short(value),
          color: chartTheme.value.label,
          show: !isDenseChart.value,
          fontSize: isCompactChart.value ? 10 : 12
        }
      },
      series: [{
        type: 'bar',
        itemStyle: { color: seriesColor.value, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: isCompactChart.value ? 24 : 40,
        data: chartRows.value.map((row) => row.value)
      }]
    }))

    const chartOption = computed(() => {
      const option = applyAdvancedOptions(applyLabelOverridesToOption(applyCartesianSettings(baseOption.value, props.config, valueFormat.value, getChartColors(useColorModeIsDark())), props.config), props.config)
      const fontFamily = chartTheme.value.fontFamily

      return fontFamily ? { ...option, textStyle: { fontFamily } } : option
    })

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
