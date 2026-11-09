import { computed, defineComponent, type PropType } from 'vue'
import type { EChartsOption } from 'echarts'

import PluginChart from '~/components/plugins/PluginChart.vue'
import { useObservedElementSize } from '~/composables/useObservedElementSize'
import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'
import { buildChartOption, CHART_CATALOG } from '~/utils/charts/chart-catalog'
import { applyDashboardChartColors, getChartColors } from '~/utils/charts/chart-colors'
import { useDashboardChartStyle } from '~/composables/useDashboardChartStyle'
import { applyColorSettings, createValueFormatter } from '~/utils/charts/chart-settings'

export default defineComponent({
  components: {
    PluginChart
  },
  props: {
    chartId: {
      type: String,
      required: true
    },
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
    const colorMode = useColorMode()
    const dashboardStyle = useDashboardChartStyle()
    const { element: chartContainer, height, width } = useObservedElementSize<HTMLElement>()

    const option = computed<EChartsOption | null>(() => {
      const chart = CHART_CATALOG.find(item => item.id === props.chartId)

      if (!chart) return null

      const built = buildChartOption(chart, {
        rows: props.data,
        config: props.config,
        colors: applyColorSettings(applyDashboardChartColors(getChartColors(colorMode.value === 'dark'), dashboardStyle.value), props.config),
        compact: width.value < 420 || height.value < 260,
        dense: width.value < 260 || height.value < 160,
        format: createValueFormatter(props.config, locale.value === 'pseudo' ? 'en' : locale.value),
        labels: {
          other: t('pages.dashboard.plugins.catalog.other'),
          total: t('pages.dashboard.plugins.catalog.total'),
          increase: t('pages.dashboard.plugins.catalog.increase'),
          decrease: t('pages.dashboard.plugins.catalog.decrease'),
          low: t('pages.dashboard.plugins.catalog.low'),
          high: t('pages.dashboard.plugins.catalog.high')
        }
      })
      const fontFamily = dashboardStyle.value.fontFamily

      return built && fontFamily ? { ...built, textStyle: { fontFamily } } : built
    })

    return {
      chartContainer,
      option,
      t
    }
  }
})
