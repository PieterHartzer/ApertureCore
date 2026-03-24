import type { UIPluginDefinition } from '~/types/uiPlugin'

export type DashboardWidgetPluginConfigValue =
  | string
  | number
  | boolean
  | null

export type DashboardWidgetPluginConfig = Record<
  string,
  DashboardWidgetPluginConfigValue
>

export const DEFAULT_DASHBOARD_ID = 'default-dashboard'
export const DEFAULT_WIDGET_REFRESH_INTERVAL_SECONDS = 60

export interface DashboardWidget {
  id: string
  dashboardId: string
  title: string
  queryId: string
  pluginId: string
  pluginConfig: DashboardWidgetPluginConfig
  refreshIntervalSeconds: number
}

export interface DashboardWidgetDraft {
  dashboardId: string
  title: string
  queryId: string
  pluginId: string
  pluginConfig: DashboardWidgetPluginConfig
  refreshIntervalSeconds: number
}

export const createEmptyDashboardWidgetDraft = (): DashboardWidgetDraft => ({
  dashboardId: DEFAULT_DASHBOARD_ID,
  title: '',
  queryId: '',
  pluginId: '',
  pluginConfig: {},
  refreshIntervalSeconds: DEFAULT_WIDGET_REFRESH_INTERVAL_SECONDS
})

export const normalizeDashboardWidgetPluginConfig = (
  plugin: Pick<UIPluginDefinition, 'inputSchema'> | null | undefined,
  pluginConfig: DashboardWidgetPluginConfig
): DashboardWidgetPluginConfig => {
  if (!plugin) {
    return {}
  }

  return plugin.inputSchema.reduce<DashboardWidgetPluginConfig>((config, input) => {
    const value = pluginConfig[input.key]

    if (typeof value === 'string') {
      config[input.key] = value.trim()
      return config
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      config[input.key] = value
      return config
    }

    config[input.key] = null

    return config
  }, {})
}

export const isDashboardWidgetPluginConfigComplete = (
  plugin: Pick<UIPluginDefinition, 'inputSchema'> | null | undefined,
  pluginConfig: DashboardWidgetPluginConfig
): boolean => {
  if (!plugin) {
    return false
  }

  return plugin.inputSchema.every((input) => {
    if (!input.required) {
      return true
    }

    const value = pluginConfig[input.key]

    return typeof value === 'string'
      ? value.trim().length > 0
      : typeof value === 'number' || typeof value === 'boolean'
  })
}

export const createDashboardWidget = (
  draft: DashboardWidgetDraft,
  createId: () => string = () => crypto.randomUUID()
): DashboardWidget => ({
  id: createId(),
  dashboardId: draft.dashboardId.trim() || DEFAULT_DASHBOARD_ID,
  title: draft.title.trim(),
  queryId: draft.queryId.trim(),
  pluginId: draft.pluginId.trim(),
  pluginConfig: {
    ...draft.pluginConfig
  },
  refreshIntervalSeconds: draft.refreshIntervalSeconds
})
