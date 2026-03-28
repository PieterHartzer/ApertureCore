import type {
  CreateDashboardInput,
  CreateDashboardValidationError,
  CreateDashboardValidationIssue,
  CreateDashboardValidationResult,
  DeleteDashboardInput,
  DeleteDashboardValidationError,
  DeleteDashboardValidationIssue,
  DeleteDashboardValidationResult,
  DashboardEmbedIdValidationResult,
  DashboardIdValidationResult,
  DashboardWidgetInput,
  DashboardWidgetLayout,
  DashboardWidgetPluginConfig,
  DashboardWidgetPluginConfigPrimitive,
  SaveDashboardInput,
  SaveDashboardValidationError,
  SaveDashboardValidationIssue,
  SaveDashboardValidationResult,
  DashboardWidgetIdValidationResult
} from '../types/dashboards'
import { isUuid } from '../utils/is-uuid'

const DEFAULT_WIDGET_WIDTH = 6
const DEFAULT_WIDGET_HEIGHT = 4
const DEFAULT_WIDGET_MIN_WIDTH = 3
const DEFAULT_WIDGET_MIN_HEIGHT = 3

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const createDashboardValidationError = (
  issue: CreateDashboardValidationIssue,
  field?: CreateDashboardValidationError['field']
): CreateDashboardValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const createSaveDashboardValidationError = (
  issue: SaveDashboardValidationIssue,
  field?: SaveDashboardValidationError['field']
): SaveDashboardValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const createDeleteDashboardValidationError = (
  issue: DeleteDashboardValidationIssue,
  field?: DeleteDashboardValidationError['field']
): DeleteDashboardValidationError => ({
  ok: false,
  code: 'invalid_input',
  issue,
  message: issue,
  field
})

const normalizeNonEmptyString = (value: unknown) => {
  return typeof value === 'string'
    ? value.trim()
    : ''
}

const parsePositiveInteger = (value: unknown) => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }

  return undefined
}

const parseNonNegativeInteger = (value: unknown) => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value
  }

  return undefined
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

const normalizePluginConfigValue = (value: unknown) => {
  if (Array.isArray(value)) {
    const normalizedValues = value.flatMap((entry) => {
      const normalizedEntry = normalizePluginConfigPrimitive(entry)

      if (normalizedEntry === null) {
        return []
      }

      if (typeof normalizedEntry === 'string' && normalizedEntry.length === 0) {
        return []
      }

      return [normalizedEntry]
    })

    return [...new Set(normalizedValues)]
  }

  return normalizePluginConfigPrimitive(value)
}

const normalizePluginConfig = (
  value: unknown
): DashboardWidgetPluginConfig | null => {
  if (!isRecord(value)) {
    return null
  }

  return Object.entries(value).reduce<DashboardWidgetPluginConfig>((config, [key, entryValue]) => {
    config[key] = normalizePluginConfigValue(entryValue)
    return config
  }, {})
}

const normalizeWidgetLayout = (
  value: unknown
): DashboardWidgetLayout | null => {
  if (!isRecord(value)) {
    return null
  }

  const minW = parsePositiveInteger(value.minW) ?? DEFAULT_WIDGET_MIN_WIDTH
  const minH = parsePositiveInteger(value.minH) ?? DEFAULT_WIDGET_MIN_HEIGHT
  const w = Math.max(
    parsePositiveInteger(value.w) ?? DEFAULT_WIDGET_WIDTH,
    minW
  )
  const h = Math.max(
    parsePositiveInteger(value.h) ?? DEFAULT_WIDGET_HEIGHT,
    minH
  )
  const maxW = parsePositiveInteger(value.maxW)
  const maxH = parsePositiveInteger(value.maxH)

  return {
    x: parseNonNegativeInteger(value.x),
    y: parseNonNegativeInteger(value.y),
    w,
    h,
    minW,
    minH,
    ...(maxW && maxW >= w ? { maxW } : {}),
    ...(maxH && maxH >= h ? { maxH } : {})
  }
}

const normalizeDashboardWidgetInput = (
  value: unknown
): DashboardWidgetInput | SaveDashboardValidationError => {
  if (!isRecord(value)) {
    return createSaveDashboardValidationError(
      'widgets_invalid',
      'widgets'
    )
  }

  const widgetId = normalizeNonEmptyString(value.id)

  if (!isUuid(widgetId)) {
    return createSaveDashboardValidationError(
      'widget_id_invalid',
      'widgets'
    )
  }

  if (typeof value.title !== 'string') {
    return createSaveDashboardValidationError(
      'widget_title_invalid',
      'widgets'
    )
  }

  const title = value.title.trim()

  if (!title) {
    return createSaveDashboardValidationError(
      'widget_title_required',
      'widgets'
    )
  }

  const queryId = normalizeNonEmptyString(value.queryId)

  if (!isUuid(queryId)) {
    return createSaveDashboardValidationError(
      'widget_query_id_invalid',
      'widgets'
    )
  }

  if (typeof value.pluginId !== 'string') {
    return createSaveDashboardValidationError(
      'widget_plugin_id_invalid',
      'widgets'
    )
  }

  const pluginId = value.pluginId.trim()

  if (!pluginId) {
    return createSaveDashboardValidationError(
      'widget_plugin_id_required',
      'widgets'
    )
  }

  const pluginConfig = normalizePluginConfig(value.pluginConfig)

  if (!pluginConfig) {
    return createSaveDashboardValidationError(
      'widget_plugin_config_invalid',
      'widgets'
    )
  }

  const layout = normalizeWidgetLayout(value.layout)

  if (!layout) {
    return createSaveDashboardValidationError(
      'widget_layout_invalid',
      'widgets'
    )
  }

  const refreshIntervalSeconds = parsePositiveInteger(
    value.refreshIntervalSeconds
  )

  if (!refreshIntervalSeconds) {
    return createSaveDashboardValidationError(
      'widget_refresh_interval_invalid',
      'widgets'
    )
  }

  return {
    id: widgetId,
    title,
    queryId,
    pluginId,
    pluginConfig,
    layout,
    refreshIntervalSeconds
  }
}

export const validateCreateDashboardInput = (
  value: unknown
): CreateDashboardValidationResult => {
  if (!isRecord(value)) {
    return createDashboardValidationError(
      'body_invalid',
      'body'
    )
  }

  if (typeof value.dashboardName !== 'string') {
    return createDashboardValidationError(
      'dashboard_name_invalid',
      'dashboardName'
    )
  }

  const dashboardName = value.dashboardName.trim()

  if (!dashboardName) {
    return createDashboardValidationError(
      'dashboard_name_required',
      'dashboardName'
    )
  }

  const normalizedInput: CreateDashboardInput = {
    dashboardName
  }

  return {
    ok: true,
    data: normalizedInput
  }
}

export const validateDashboardId = (
  dashboardId: unknown
): DashboardIdValidationResult => {
  if (typeof dashboardId !== 'string' || !isUuid(dashboardId.trim())) {
    return {
      ok: false,
      code: 'invalid_input',
      issue: 'dashboard_id_invalid',
      message: 'dashboard_id_invalid',
      field: 'dashboardId'
    }
  }

  return {
    ok: true,
    data: {
      dashboardId: dashboardId.trim()
    }
  }
}

export const validateDashboardEmbedId = (
  embedId: unknown
): DashboardEmbedIdValidationResult => {
  if (typeof embedId !== 'string' || !isUuid(embedId.trim())) {
    return {
      ok: false,
      code: 'invalid_input',
      issue: 'embed_id_invalid',
      message: 'embed_id_invalid',
      field: 'embedId'
    }
  }

  return {
    ok: true,
    data: {
      embedId: embedId.trim()
    }
  }
}

export const validateDashboardWidgetId = (
  widgetId: unknown
): DashboardWidgetIdValidationResult => {
  if (typeof widgetId !== 'string' || !isUuid(widgetId.trim())) {
    return {
      ok: false,
      code: 'invalid_input',
      issue: 'widget_id_invalid',
      message: 'widget_id_invalid',
      field: 'widgetId'
    }
  }

  return {
    ok: true,
    data: {
      widgetId: widgetId.trim()
    }
  }
}

export const validateDeleteDashboardInput = (
  dashboardId: unknown,
  value: unknown
): DeleteDashboardValidationResult => {
  const dashboardIdValidation = validateDashboardId(dashboardId)

  if (!dashboardIdValidation.ok) {
    return dashboardIdValidation
  }

  if (!isRecord(value)) {
    return createDeleteDashboardValidationError(
      'body_invalid',
      'body'
    )
  }

  if (typeof value.confirmationName !== 'string') {
    return createDeleteDashboardValidationError(
      'confirmation_name_invalid',
      'confirmationName'
    )
  }

  const confirmationName = value.confirmationName.trim()

  if (!confirmationName) {
    return createDeleteDashboardValidationError(
      'confirmation_name_required',
      'confirmationName'
    )
  }

  const normalizedInput: DeleteDashboardInput = {
    dashboardId: dashboardIdValidation.data.dashboardId,
    confirmationName
  }

  return {
    ok: true,
    data: normalizedInput
  }
}

export const validateSaveDashboardInput = (
  dashboardId: unknown,
  value: unknown
): SaveDashboardValidationResult => {
  const dashboardIdValidation = validateDashboardId(dashboardId)

  if (!dashboardIdValidation.ok) {
    return dashboardIdValidation
  }

  if (!isRecord(value)) {
    return createSaveDashboardValidationError(
      'body_invalid',
      'body'
    )
  }

  if (typeof value.dashboardName !== 'string') {
    return createSaveDashboardValidationError(
      'dashboard_name_invalid',
      'dashboardName'
    )
  }

  const dashboardName = value.dashboardName.trim()

  if (!dashboardName) {
    return createSaveDashboardValidationError(
      'dashboard_name_required',
      'dashboardName'
    )
  }

  if (typeof value.embedEnabled !== 'boolean') {
    return createSaveDashboardValidationError(
      'embed_enabled_invalid',
      'embedEnabled'
    )
  }

  if (!Array.isArray(value.widgets)) {
    return createSaveDashboardValidationError(
      'widgets_invalid',
      'widgets'
    )
  }

  const widgets: DashboardWidgetInput[] = []

  for (const widget of value.widgets) {
    const normalizedWidget = normalizeDashboardWidgetInput(widget)

    if ('ok' in normalizedWidget) {
      return normalizedWidget
    }

    widgets.push(normalizedWidget)
  }

  const uniqueWidgetIds = new Set(widgets.map((widget) => widget.id))

  if (uniqueWidgetIds.size !== widgets.length) {
    return createSaveDashboardValidationError(
      'widget_id_invalid',
      'widgets'
    )
  }

  const normalizedInput: SaveDashboardInput = {
    dashboardId: dashboardIdValidation.data.dashboardId,
    dashboardName,
    embedEnabled: value.embedEnabled,
    widgets
  }

  return {
    ok: true,
    data: normalizedInput
  }
}
