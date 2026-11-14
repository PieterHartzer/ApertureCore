/** Which way a dashboard prints on A4 paper. */
export const DASHBOARD_PRINT_LAYOUTS = ['landscape', 'portrait'] as const

export type DashboardPrintLayout = typeof DASHBOARD_PRINT_LAYOUTS[number]

export const DEFAULT_DASHBOARD_PRINT_LAYOUT: DashboardPrintLayout = 'landscape'

export const isDashboardPrintLayout = (value: unknown): value is DashboardPrintLayout => {
  return (DASHBOARD_PRINT_LAYOUTS as readonly unknown[]).includes(value)
}

export const normalizeDashboardPrintLayout = (value: unknown): DashboardPrintLayout => {
  return isDashboardPrintLayout(value) ? value : DEFAULT_DASHBOARD_PRINT_LAYOUT
}
