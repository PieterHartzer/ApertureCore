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
export const DEFAULT_DASHBOARD_WIDGET_WIDTH = 6
export const DEFAULT_DASHBOARD_WIDGET_HEIGHT = 4
export const DEFAULT_DASHBOARD_WIDGET_MIN_WIDTH = 3
export const DEFAULT_DASHBOARD_WIDGET_MIN_HEIGHT = 3

export interface DashboardWidgetLayout {
  x?: number
  y?: number
  w: number
  h: number
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number
}

export interface DashboardWidgetLayoutUpdate {
  widgetId: string
  layout: DashboardWidgetLayout
}

export interface DashboardWidget {
  id: string
  dashboardId: string
  title: string
  queryId: string
  pluginId: string
  pluginConfig: DashboardWidgetPluginConfig
  layout: DashboardWidgetLayout
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

const normalizePositiveInteger = (
  value: unknown,
  fallback?: number
) => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : fallback
}

const normalizeNonNegativeInteger = (
  value: unknown,
  fallback?: number
) => {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : fallback
}

const cloneDashboardWidgetLayout = (
  layout: DashboardWidgetLayout
): DashboardWidgetLayout => ({
  ...layout
})

export const normalizeDashboardWidgetLayout = (
  layout?: Partial<DashboardWidgetLayout> | null
): DashboardWidgetLayout => {
  const minW = normalizePositiveInteger(
    layout?.minW,
    DEFAULT_DASHBOARD_WIDGET_MIN_WIDTH
  )
  const minH = normalizePositiveInteger(
    layout?.minH,
    DEFAULT_DASHBOARD_WIDGET_MIN_HEIGHT
  )
  const w = Math.max(
    normalizePositiveInteger(layout?.w, DEFAULT_DASHBOARD_WIDGET_WIDTH) ?? DEFAULT_DASHBOARD_WIDGET_WIDTH,
    minW ?? DEFAULT_DASHBOARD_WIDGET_MIN_WIDTH
  )
  const h = Math.max(
    normalizePositiveInteger(layout?.h, DEFAULT_DASHBOARD_WIDGET_HEIGHT) ?? DEFAULT_DASHBOARD_WIDGET_HEIGHT,
    minH ?? DEFAULT_DASHBOARD_WIDGET_MIN_HEIGHT
  )
  const maxW = normalizePositiveInteger(layout?.maxW)
  const maxH = normalizePositiveInteger(layout?.maxH)

  return {
    x: normalizeNonNegativeInteger(layout?.x),
    y: normalizeNonNegativeInteger(layout?.y),
    w,
    h,
    minW,
    minH,
    ...(maxW && maxW >= w ? { maxW } : {}),
    ...(maxH && maxH >= h ? { maxH } : {})
  }
}

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

export const createDashboardWidgetDraftFromWidget = (
  widget: DashboardWidget
): DashboardWidgetDraft => ({
  dashboardId: widget.dashboardId,
  title: widget.title,
  queryId: widget.queryId,
  pluginId: widget.pluginId,
  pluginConfig: cloneDashboardWidgetPluginConfig(widget.pluginConfig),
  refreshIntervalSeconds: widget.refreshIntervalSeconds
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
  layout: normalizeDashboardWidgetLayout(),
  refreshIntervalSeconds: draft.refreshIntervalSeconds
})

export const updateDashboardWidget = (
  widget: DashboardWidget,
  draft: DashboardWidgetDraft
): DashboardWidget => ({
  ...widget,
  dashboardId: draft.dashboardId.trim() || DEFAULT_DASHBOARD_ID,
  title: draft.title.trim(),
  queryId: draft.queryId.trim(),
  pluginId: draft.pluginId.trim(),
  pluginConfig: cloneDashboardWidgetPluginConfig(draft.pluginConfig),
  layout: cloneDashboardWidgetLayout(widget.layout),
  refreshIntervalSeconds: draft.refreshIntervalSeconds
})

export const updateDashboardWidgetLayout = (
  widget: DashboardWidget,
  layout: Partial<DashboardWidgetLayout>
): DashboardWidget => ({
  ...widget,
  layout: normalizeDashboardWidgetLayout({
    ...widget.layout,
    ...layout
  })
})
