import { computed } from 'vue'

import { useDashboardChartStyle } from '~/composables/useDashboardChartStyle'
import { getChartColors } from '~/utils/charts/chart-colors'

export const useChartTheme = () => {
  const colorMode = useColorMode()
  const dashboardStyle = useDashboardChartStyle()

  return computed(() => {
    const colors = getChartColors(colorMode.value === 'dark')

    return {
      line: dashboardStyle.value.primary ?? colors.primary,
      grid: dashboardStyle.value.grid ?? colors.grid,
      label: dashboardStyle.value.text ?? colors.label,
      fontFamily: dashboardStyle.value.fontFamily,
      tooltipBackground: colors.tooltipBackground,
      tooltipBorder: colors.tooltipBorder,
      tooltipText: colors.tooltipText ?? colors.ink
    }
  })
}
