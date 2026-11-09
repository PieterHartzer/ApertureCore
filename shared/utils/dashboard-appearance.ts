export const DASHBOARD_APPEARANCES = [
  'default',
  'aurora',
  'ocean',
  'sunset',
  'forest',
  'plain'
] as const

export type DashboardAppearance = typeof DASHBOARD_APPEARANCES[number]

export const DEFAULT_DASHBOARD_APPEARANCE: DashboardAppearance = 'default'

export const isDashboardAppearance = (
  value: unknown
): value is DashboardAppearance => {
  return (DASHBOARD_APPEARANCES as readonly unknown[]).includes(value)
}

export const normalizeDashboardAppearance = (
  value: unknown
): DashboardAppearance => {
  return isDashboardAppearance(value) ? value : DEFAULT_DASHBOARD_APPEARANCE
}
