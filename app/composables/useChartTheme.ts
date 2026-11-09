import { computed } from 'vue'

import { useDashboardChartStyle } from '~/composables/useDashboardChartStyle'

export const useChartTheme = () => {
  const colorMode = useColorMode()
  const dashboardStyle = useDashboardChartStyle()

  return computed(() => {
    const dark = colorMode.value === 'dark'

    return {
      line: dashboardStyle.value.primary ?? (dark ? '#3b82f6' : '#2563eb'),
      grid: dashboardStyle.value.grid ?? (dark ? '#262626' : '#e5e5e5'),
      label: dashboardStyle.value.text ?? (dark ? '#a1a1a1' : '#737373'),
      fontFamily: dashboardStyle.value.fontFamily,
      tooltipBackground: dark ? '#1a1a1a' : '#ffffff',
      tooltipBorder: dark ? '#2a2a2a' : '#e5e5e5',
      tooltipText: dark ? '#fafafa' : '#171717'
    }
  })
}
