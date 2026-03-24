import {
  getUIPluginInputSource,
  getUIPluginInputSelectionMode,
  type UIPluginDefinition
} from './uiPlugin'

export type DashboardWidgetPluginConfigPrimitive =
  | string
  | number
  | boolean
  | null

export type DashboardWidgetPluginConfigValue =
  | DashboardWidgetPluginConfigPrimitive
  | Array<Exclude<DashboardWidgetPluginConfigPrimitive, null>>

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

const normalizePluginConfigPrimitive = (
  value: unknown
): DashboardWidgetPluginConfigPrimitive => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return null
}

const normalizePluginConfigArray = (
  value: unknown
): Array<Exclude<DashboardWidgetPluginConfigPrimitive, null>> => {
  const candidateValues = Array.isArray(value)
    ? value
    : value === null || value === undefined
      ? []
      : [value]

  return candidateValues.flatMap((candidateValue) => {
    const normalizedValue = normalizePluginConfigPrimitive(candidateValue)

    if (normalizedValue === null) {
      return []
    }

    if (typeof normalizedValue === 'string' && normalizedValue.length === 0) {
      return []
    }

    return [normalizedValue]
  })
}

const dedupePluginConfigArray = (
  values: Array<Exclude<DashboardWidgetPluginConfigPrimitive, null>>
) => {
  const normalizedValues: Array<Exclude<DashboardWidgetPluginConfigPrimitive, null>> = []
  const seenValues = new Set<Exclude<DashboardWidgetPluginConfigPrimitive, null>>()

  for (const value of values) {
    if (seenValues.has(value)) {
      continue
    }

    seenValues.add(value)
    normalizedValues.push(value)
  }

  return normalizedValues
}

const cloneDashboardWidgetPluginConfig = (
  pluginConfig: DashboardWidgetPluginConfig
): DashboardWidgetPluginConfig => {
  return Object.fromEntries(
    Object.entries(pluginConfig).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? [...value]
        : value
    ])
  )
}

export const normalizeDashboardWidgetPluginConfig = (
  plugin: Pick<UIPluginDefinition, 'inputSchema'> | null | undefined,
  pluginConfig: DashboardWidgetPluginConfig
): DashboardWidgetPluginConfig => {
  if (!plugin) {
    return {}
  }

  return plugin.inputSchema.reduce<DashboardWidgetPluginConfig>((config, input) => {
    const value = pluginConfig[input.key]
    const optionValues = new Set((input.options ?? []).map((option) => option.value))
    const isOptionInput = getUIPluginInputSource(input) === 'option'

    if (getUIPluginInputSelectionMode(input) === 'multiple') {
      const normalizedValues = dedupePluginConfigArray(
        normalizePluginConfigArray(value)
      )

      config[input.key] = isOptionInput
        ? normalizedValues.filter((normalizedValue) => optionValues.has(normalizedValue))
        : normalizedValues
      return config
    }

    const normalizedValue = normalizePluginConfigPrimitive(value)

    config[input.key] = (
      isOptionInput &&
      normalizedValue !== null &&
      !optionValues.has(normalizedValue)
    )
      ? null
      : normalizedValue

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

    if (Array.isArray(value)) {
      return value.length > 0
    }

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
  pluginConfig: cloneDashboardWidgetPluginConfig(draft.pluginConfig),
  refreshIntervalSeconds: draft.refreshIntervalSeconds
})
