import type { DashboardWidget } from './dashboard-widgets'
import type { SavedSqlQueryResultRow } from './saved-sql-queries'

export interface DashboardSummary {
  id: string
  dashboardName: string
  embedId: string
  embedEnabled: boolean
  widgetCount: number
  createdAt: string
  updatedAt: string
}

export interface DashboardDetails extends DashboardSummary {
  widgets: DashboardWidget[]
}

export interface EmbeddedDashboardWidget {
  id: string
  title: string
  pluginId: string
  pluginConfig: DashboardWidget['pluginConfig']
  layout: DashboardWidget['layout']
  refreshIntervalSeconds: number
}

export interface EmbeddedDashboardDetails {
  embedId: string
  dashboardName: string
  updatedAt: string
  widgets: EmbeddedDashboardWidget[]
}

export interface DashboardCreateInput {
  dashboardName: string
}

export type DashboardSaveWidgetInput = Omit<DashboardWidget, 'dashboardId'>

export interface DashboardSaveInput {
  dashboardName: string
  embedEnabled: boolean
  widgets: DashboardSaveWidgetInput[]
}

export interface DashboardDeleteInput {
  confirmationName: string
}

export interface DashboardCreateResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | 'duplicate_dashboard_name'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: keyof DashboardCreateInput | 'body'
  issue?:
    | 'body_invalid'
    | 'dashboard_name_invalid'
    | 'dashboard_name_required'
  dashboard?: DashboardDetails
}

export interface DashboardListResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  dashboards?: DashboardSummary[]
}

export interface DashboardGetResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | 'not_found'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: 'dashboardId'
  issue?: 'dashboard_id_invalid'
  dashboard?: DashboardDetails
}

export interface DashboardSaveResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | 'not_found'
    | 'duplicate_dashboard_name'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: 'dashboardId' | 'dashboardName' | 'embedEnabled' | 'widgets' | 'body'
  issue?: string
  dashboard?: DashboardDetails
}

export interface DashboardDeleteResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | 'confirmation_mismatch'
    | 'not_found'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: 'dashboardId' | 'confirmationName' | 'body'
  issue?:
    | 'body_invalid'
    | 'dashboard_id_invalid'
    | 'confirmation_name_invalid'
    | 'confirmation_name_required'
}

export interface EmbeddedDashboardGetResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'not_found'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: 'embedId'
  issue?: 'embed_id_invalid'
  dashboard?: EmbeddedDashboardDetails
}

export interface EmbeddedDashboardWidgetRunSuccessResponse {
  columns: string[]
  rows: SavedSqlQueryResultRow[]
  etag: string
}

export interface EmbeddedDashboardWidgetRunErrorResponse {
  ok: false
  code:
    | 'invalid_input'
    | 'not_found'
    | 'unsupported_database_type'
    | 'authentication_failed'
    | 'database_not_found'
    | 'connection_failed'
    | 'timeout'
    | 'ssl_required'
    | 'query_rejected'
    | 'query_failed'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: 'embedId' | 'widgetId'
  issue?: 'embed_id_invalid' | 'widget_id_invalid'
}

export type EmbeddedDashboardWidgetRunResponse =
  | {
      ok: true
      code: 'success'
      columns: string[]
      rows: SavedSqlQueryResultRow[]
      etag: string
    }
  | {
      ok: true
      code: 'not_modified'
      etag: string
    }
  | EmbeddedDashboardWidgetRunErrorResponse

export const createEmptyDashboardCreateInput = (): DashboardCreateInput => ({
  dashboardName: ''
})

export const toDashboardSaveInput = (
  dashboard: Pick<DashboardDetails, 'dashboardName' | 'embedEnabled' | 'widgets'>
): DashboardSaveInput => ({
  dashboardName: dashboard.dashboardName,
  embedEnabled: dashboard.embedEnabled,
  widgets: dashboard.widgets.map((widget) => ({
    id: widget.id,
    title: widget.title,
    queryId: widget.queryId,
    pluginId: widget.pluginId,
    pluginConfig: widget.pluginConfig,
    layout: widget.layout,
    refreshIntervalSeconds: widget.refreshIntervalSeconds
  }))
})
