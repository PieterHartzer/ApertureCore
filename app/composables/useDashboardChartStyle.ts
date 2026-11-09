import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'

import type { DashboardChartStyle } from '#shared/utils/dashboard-style'

const CHART_STYLE_KEY: InjectionKey<ComputedRef<DashboardChartStyle>> = Symbol('dashboard-chart-style')

export const provideDashboardChartStyle = (style: ComputedRef<DashboardChartStyle>) => provide(CHART_STYLE_KEY, style)

export const useDashboardChartStyle = () => inject(CHART_STYLE_KEY, computed<DashboardChartStyle>(() => ({})))
