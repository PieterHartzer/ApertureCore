import { computed, defineComponent, type PropType } from 'vue'
import type { EChartsOption } from 'echarts'

import PluginChart from '~/components/plugins/PluginChart.vue'
import { useChartTheme } from '~/composables/useChartTheme'
import { useObservedElementSize } from '~/composables/useObservedElementSize'
import { applySeriesStyle, getChartColors } from '~/utils/charts/chart-colors'
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

    const valueFormat = computed(() => numberFormatterFor(props.config, String(locale.value) === 'pseudo' ? 'en' : locale.value, typeof props.config.yField === 'string' ? props.config.yField : undefined))
    const seriesColor = computed(() => colorSetting(props.config, 'color') ?? chartTheme.value.line)

    const baseOption = computed<EChartsOption>(() => ({
      animationDuration: 250,
      grid: {
        containLabel: true,
        top: isDenseChart.value ? 8 : 20,
        right: isCompactChart.value ? 8 : 20,
        bottom: isDenseChart.value ? 8 : 16,
        left: isDenseChart.value ? 8 : 16
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: chartTheme.value.label, width: 1 } },
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
          hideOverlap: true,
          show: !isDenseChart.value,
          fontSize: isCompactChart.value ? 10 : 12
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
        type: 'line',
        smooth: false,
        showSymbol: false,
        color: seriesColor.value,
        lineStyle: {
          width: 2
        },
        areaStyle: {
          opacity: 0.08
        },
        data: chartRows.value.map((row) => row.value)
      }]
    }))

    const chartOption = computed(() => {
      const colors = getChartColors(useColorModeIsDark())
      const option = applyAdvancedOptions(applyLabelOverridesToOption(applyCartesianSettings(applySeriesStyle(baseOption.value, colors), props.config, valueFormat.value, colors), props.config), props.config)
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
