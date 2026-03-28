import type { AuthenticatedOrganizationContext } from './database-connections'

export type { AuthenticatedOrganizationContext }

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

export interface DashboardWidgetInput {
  id: string
  title: string
  queryId: string
  pluginId: string
  pluginConfig: DashboardWidgetPluginConfig
  layout: DashboardWidgetLayout
  refreshIntervalSeconds: number
}

export interface DashboardWidget extends DashboardWidgetInput {
  dashboardId: string
}

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
  pluginConfig: DashboardWidgetPluginConfig
  layout: DashboardWidgetLayout
  refreshIntervalSeconds: number
}

export interface EmbeddedDashboardDetails {
  embedId: string
  dashboardName: string
  updatedAt: string
  widgets: EmbeddedDashboardWidget[]
}

export interface CreateDashboardInput {
  dashboardName: string
}

export interface SaveDashboardInput extends CreateDashboardInput {
  dashboardId: string
  embedEnabled: boolean
  widgets: DashboardWidgetInput[]
}

export interface DeleteDashboardInput {
  dashboardId: string
  confirmationName: string
}

export type DashboardWidgetResultValue =
  | string
  | number
  | boolean
  | null

export interface DashboardWidgetResultRow {
  [column: string]: DashboardWidgetResultValue
}

export type CreateDashboardValidationIssue =
  | 'body_invalid'
  | 'dashboard_name_invalid'
  | 'dashboard_name_required'

export interface CreateDashboardValidationError {
  ok: false
  code: 'invalid_input'
  issue: CreateDashboardValidationIssue
  message: string
  field?: keyof CreateDashboardInput | 'body'
}

export type CreateDashboardValidationResult =
  | {
      ok: true
      data: CreateDashboardInput
    }
  | CreateDashboardValidationError

export type SaveDashboardValidationIssue =
  | 'body_invalid'
  | 'dashboard_id_invalid'
  | 'dashboard_name_invalid'
  | 'dashboard_name_required'
  | 'embed_enabled_invalid'
  | 'widgets_invalid'
  | 'widget_id_invalid'
  | 'widget_title_invalid'
  | 'widget_title_required'
  | 'widget_query_id_invalid'
  | 'widget_plugin_id_invalid'
  | 'widget_plugin_id_required'
  | 'widget_plugin_config_invalid'
  | 'widget_layout_invalid'
  | 'widget_refresh_interval_invalid'

export interface SaveDashboardValidationError {
  ok: false
  code: 'invalid_input'
  issue: SaveDashboardValidationIssue
  message: string
  field?: 'dashboardId' | 'dashboardName' | 'embedEnabled' | 'widgets' | 'body'
}

export type SaveDashboardValidationResult =
  | {
      ok: true
      data: SaveDashboardInput
    }
  | SaveDashboardValidationError

export type DeleteDashboardField =
  | keyof DeleteDashboardInput
  | 'body'

export type DeleteDashboardValidationIssue =
  | 'body_invalid'
  | 'dashboard_id_invalid'
  | 'confirmation_name_invalid'
  | 'confirmation_name_required'

export interface DeleteDashboardValidationError {
  ok: false
  code: 'invalid_input'
  issue: DeleteDashboardValidationIssue
  message: string
  field?: DeleteDashboardField
}

export type DeleteDashboardValidationResult =
  | {
      ok: true
      data: DeleteDashboardInput
    }
  | DeleteDashboardValidationError

export interface DashboardIdValidationError {
  ok: false
  code: 'invalid_input'
  issue: 'dashboard_id_invalid'
  message: string
  field: 'dashboardId'
}

export type DashboardIdValidationResult =
  | DashboardIdValidationError
  | {
      ok: true
      data: {
        dashboardId: string
      }
    }

export interface DashboardEmbedIdValidationError {
  ok: false
  code: 'invalid_input'
  issue: 'embed_id_invalid'
  message: string
  field: 'embedId'
}

export type DashboardEmbedIdValidationResult =
  | DashboardEmbedIdValidationError
  | {
      ok: true
      data: {
        embedId: string
      }
    }

export interface DashboardWidgetIdValidationError {
  ok: false
  code: 'invalid_input'
  issue: 'widget_id_invalid'
  message: string
  field: 'widgetId'
}

export type DashboardWidgetIdValidationResult =
  | DashboardWidgetIdValidationError
  | {
      ok: true
      data: {
        widgetId: string
      }
    }

export type DashboardResultError<TCode extends string> = {
  ok: false
  code: TCode
  message: string
}

export type ListDashboardsResultCode =
  | 'success'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type ListDashboardsResult =
  | {
      ok: true
      code: 'success'
      dashboards: DashboardSummary[]
    }
  | DashboardResultError<Exclude<ListDashboardsResultCode, 'success'>>

export type GetDashboardResultCode =
  | 'success'
  | 'not_found'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type GetDashboardResult =
  | {
      ok: true
      code: 'success'
      dashboard: DashboardDetails
    }
  | DashboardResultError<Exclude<GetDashboardResultCode, 'success'>>

export type CreateDashboardResultCode =
  | 'success'
  | 'duplicate_dashboard_name'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type CreateDashboardResult =
  | {
      ok: true
      code: 'success'
      dashboard: DashboardDetails
    }
  | DashboardResultError<Exclude<CreateDashboardResultCode, 'success'>>

export type SaveDashboardResultCode =
  | 'success'
  | 'not_found'
  | 'duplicate_dashboard_name'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type SaveDashboardResult =
  | {
      ok: true
      code: 'success'
      dashboard: DashboardDetails
    }
  | DashboardResultError<Exclude<SaveDashboardResultCode, 'success'>>

export type DeleteDashboardResultCode =
  | 'success'
  | 'confirmation_mismatch'
  | 'not_found'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type DeleteDashboardResult =
  | {
      ok: true
      code: 'success'
    }
  | DashboardResultError<Exclude<DeleteDashboardResultCode, 'success'>>

export type GetEmbeddedDashboardResultCode =
  | 'success'
  | 'not_found'
  | 'persistence_unavailable'
  | 'unexpected_error'

export type GetEmbeddedDashboardResult =
  | {
      ok: true
      code: 'success'
      dashboard: EmbeddedDashboardDetails
    }
  | DashboardResultError<Exclude<GetEmbeddedDashboardResultCode, 'success'>>

export type ExecuteEmbeddedDashboardWidgetQueryResultCode =
  | 'success'
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

export type ExecuteEmbeddedDashboardWidgetQueryResult =
  | {
      ok: true
      code: 'success'
      columns: string[]
      rows: DashboardWidgetResultRow[]
      rowLimit: number
    }
  | (
      DashboardResultError<
        Exclude<ExecuteEmbeddedDashboardWidgetQueryResultCode, 'success'>
      > & {
        details?: string
      }
    )

export interface ListDashboardsApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | Exclude<ListDashboardsResultCode, 'success'>
  message: string
  messageKey?: string
  dashboards?: DashboardSummary[]
}

export interface GetDashboardApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | Exclude<GetDashboardResultCode, 'success'>
  message: string
  messageKey?: string
  field?: 'dashboardId'
  issue?: 'dashboard_id_invalid'
  dashboard?: DashboardDetails
}

export interface CreateDashboardApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | Exclude<CreateDashboardResultCode, 'success'>
  message: string
  messageKey?: string
  field?: keyof CreateDashboardInput | 'body'
  issue?: CreateDashboardValidationIssue
  dashboard?: DashboardDetails
}

export interface SaveDashboardApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | Exclude<SaveDashboardResultCode, 'success'>
  message: string
  messageKey?: string
  field?: SaveDashboardValidationError['field']
  issue?: SaveDashboardValidationIssue
  dashboard?: DashboardDetails
}

export interface DeleteDashboardApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | 'forbidden'
    | Exclude<DeleteDashboardResultCode, 'success'>
  message: string
  messageKey?: string
  field?: DeleteDashboardField
  issue?: DeleteDashboardValidationIssue
}

export interface EmbeddedDashboardApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'invalid_input'
    | Exclude<GetEmbeddedDashboardResultCode, 'success'>
  message: string
  messageKey?: string
  field?: 'embedId'
  issue?: 'embed_id_invalid'
  dashboard?: EmbeddedDashboardDetails
}

export interface EmbeddedDashboardWidgetRunApiResponse {
  ok: boolean
  code:
    | 'success'
    | 'not_modified'
    | 'invalid_input'
    | Exclude<ExecuteEmbeddedDashboardWidgetQueryResultCode, 'success'>
  message?: string
  messageKey?: string
  field?: 'embedId' | 'widgetId'
  issue?: 'embed_id_invalid' | 'widget_id_invalid'
  columns?: string[]
  rows?: DashboardWidgetResultRow[]
  etag?: string
}
