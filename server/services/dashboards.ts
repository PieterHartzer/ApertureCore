import type { Transaction } from 'kysely'

import type {
  AuthenticatedOrganizationContext,
  CreateDashboardInput,
  CreateDashboardResult,
  DeleteDashboardInput,
  DeleteDashboardResult,
  DashboardDetails,
  DashboardSummary,
  DashboardWidget,
  DashboardWidgetInput,
  GetDashboardResult,
  GetEmbeddedDashboardResult,
  ListDashboardsResult,
  SaveDashboardInput,
  SaveDashboardResult
} from '../types/dashboards'
import {
  AppDatabaseConfigurationError,
  getAppDatabase,
  type AppDatabase,
  type AppDatabaseClient
} from '../utils/app-database'
import {
  mapOrganizationIdToStorage,
  upsertOrganization
} from './organization'

interface DashboardRow {
  dashboard_id: string
  dashboard_name: string
  embed_id: string
  embed_enabled: boolean
  created_at: Date
  updated_at: Date
}

interface DashboardWidgetRow {
  widget_id: string
  dashboard_id: string
  query_id: string
  widget_title: string
  plugin_id: string
  plugin_config: unknown
  layout: unknown
  refresh_interval_seconds: number
}

interface DashboardReferenceRow {
  dashboard_id: string
}

interface DashboardIdentityRow {
  dashboard_id: string
  dashboard_name: string
}

interface DashboardWidgetCountRow {
  dashboard_id: string
}

const UNIQUE_DASHBOARD_NAME_CONSTRAINT =
  'app_dashboards_unique_name_per_org'

const isPersistenceConfigurationError = (value: unknown) => {
  return value instanceof AppDatabaseConfigurationError
}

const isPostgresError = (
  value: unknown
): value is { code?: string, constraint?: string } => {
  return typeof value === 'object' && value !== null && 'code' in value
}

const isDuplicateDashboardNameError = (value: unknown) => {
  return (
    isPostgresError(value) &&
    value.code === '23505' &&
    value.constraint === UNIQUE_DASHBOARD_NAME_CONSTRAINT
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const normalizePositiveInteger = (value: unknown, fallback: number) => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : fallback
}

const normalizeNonNegativeInteger = (value: unknown) => {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined
}

const normalizePluginConfigPrimitive = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  return null
}

const normalizePluginConfig = (value: unknown) => {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, configValue]) => {
      if (Array.isArray(configValue)) {
        const normalizedValues = configValue.flatMap((entry) => {
          const normalizedEntry = normalizePluginConfigPrimitive(entry)

          if (normalizedEntry === null) {
            return []
          }

          if (typeof normalizedEntry === 'string' && normalizedEntry.length === 0) {
            return []
          }

          return [normalizedEntry]
        })

        return [key, [...new Set(normalizedValues)]]
      }

      return [key, normalizePluginConfigPrimitive(configValue)]
    })
  )
}

const normalizeLayout = (value: unknown) => {
  if (!isRecord(value)) {
    return {
      w: 6,
      h: 4,
      minW: 3,
      minH: 3
    }
  }

  const minW = normalizePositiveInteger(value.minW, 3)
  const minH = normalizePositiveInteger(value.minH, 3)
  const w = Math.max(normalizePositiveInteger(value.w, 6), minW)
  const h = Math.max(normalizePositiveInteger(value.h, 4), minH)
  const maxW = normalizePositiveInteger(value.maxW, 0)
  const maxH = normalizePositiveInteger(value.maxH, 0)

  return {
    x: normalizeNonNegativeInteger(value.x),
    y: normalizeNonNegativeInteger(value.y),
    w,
    h,
    minW,
    minH,
    ...(maxW >= w ? { maxW } : {}),
    ...(maxH >= h ? { maxH } : {})
  }
}

const mapDashboardSummary = (
  row: DashboardRow,
  widgetCount: number
): DashboardSummary => ({
  id: row.dashboard_id,
  dashboardName: row.dashboard_name,
  embedId: row.embed_id,
  embedEnabled: row.embed_enabled,
  widgetCount,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
})

const mapDashboardWidget = (
  row: DashboardWidgetRow
): DashboardWidget => ({
  id: row.widget_id,
  dashboardId: row.dashboard_id,
  title: row.widget_title,
  queryId: row.query_id,
  pluginId: row.plugin_id,
  pluginConfig: normalizePluginConfig(row.plugin_config),
  layout: normalizeLayout(row.layout),
  refreshIntervalSeconds: normalizePositiveInteger(
    row.refresh_interval_seconds,
    60
  )
})

const mapDashboardDetails = (
  row: DashboardRow,
  widgets: DashboardWidget[]
): DashboardDetails => ({
  ...mapDashboardSummary(row, widgets.length),
  widgets
})

const loadDashboardWidgets = async (
  db: AppDatabaseClient | Transaction<AppDatabase>,
  dashboardId: string
) => {
  return await db
    .selectFrom('app_dashboard_widgets')
    .select([
      'widget_id',
      'dashboard_id',
      'query_id',
      'widget_title',
      'plugin_id',
      'plugin_config',
      'layout',
      'refresh_interval_seconds'
    ])
    .where('dashboard_id', '=', dashboardId)
    .where('deleted_at', 'is', null)
    .orderBy('created_at asc')
    .execute() as DashboardWidgetRow[]
}

const loadDashboardRow = async (
  db: AppDatabaseClient | Transaction<AppDatabase>,
  organizationId: string,
  dashboardId: string
) => {
  return await db
    .selectFrom('app_dashboards')
    .select([
      'dashboard_id',
      'dashboard_name',
      'embed_id',
      'embed_enabled',
      'created_at',
      'updated_at'
    ])
    .where('organization_id', '=', organizationId)
    .where('dashboard_id', '=', dashboardId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst() as DashboardRow | undefined
}

const loadDashboardDetails = async (
  db: AppDatabaseClient | Transaction<AppDatabase>,
  organizationId: string,
  dashboardId: string
) => {
  const dashboard = await loadDashboardRow(db, organizationId, dashboardId)

  if (!dashboard) {
    return null
  }

  const widgets = await loadDashboardWidgets(db, dashboardId)

  return mapDashboardDetails(
    dashboard,
    widgets.map(mapDashboardWidget)
  )
}

const ensureDashboardQueriesBelongToOrganization = async (
  db: AppDatabaseClient | Transaction<AppDatabase>,
  organizationId: string,
  widgets: DashboardWidgetInput[]
) => {
  const uniqueQueryIds = [...new Set(widgets.map((widget) => widget.queryId))]

  if (uniqueQueryIds.length === 0) {
    return true
  }

  const savedQueries = await db
    .selectFrom('app_saved_sql_queries')
    .select(['query_id'])
    .where('organization_id', '=', organizationId)
    .where('deleted_at', 'is', null)
    .where('query_id', 'in', uniqueQueryIds)
    .execute() as Array<{ query_id: string }>

  return savedQueries.length === uniqueQueryIds.length
}

const replaceDashboardWidgets = async (
  db: AppDatabaseClient | Transaction<AppDatabase>,
  dashboardId: string,
  widgets: DashboardWidgetInput[]
) => {
  await db
    .deleteFrom('app_dashboard_widgets')
    .where('dashboard_id', '=', dashboardId)
    .execute()

  if (widgets.length === 0) {
    return
  }

  await db
    .insertInto('app_dashboard_widgets')
    .values(
      widgets.map((widget) => ({
        widget_id: widget.id,
        dashboard_id: dashboardId,
        query_id: widget.queryId,
        widget_title: widget.title,
        plugin_id: widget.pluginId,
        plugin_config: widget.pluginConfig,
        layout: widget.layout,
        refresh_interval_seconds: widget.refreshIntervalSeconds
      }))
    )
    .execute()
}

export const listDashboards = async (
  authContext: AuthenticatedOrganizationContext
): Promise<ListDashboardsResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const dashboards = await db
      .selectFrom('app_dashboards')
      .select([
        'dashboard_id',
        'dashboard_name',
        'embed_id',
        'embed_enabled',
        'created_at',
        'updated_at'
      ])
      .where('organization_id', '=', organizationId)
      .where('deleted_at', 'is', null)
      .orderBy('dashboard_name asc')
      .execute() as DashboardRow[]

    if (dashboards.length === 0) {
      return {
        ok: true,
        code: 'success',
        dashboards: []
      }
    }

    const dashboardIds = dashboards.map((dashboard) => dashboard.dashboard_id)
    const widgetRows = await db
      .selectFrom('app_dashboard_widgets')
      .select(['dashboard_id'])
      .where('dashboard_id', 'in', dashboardIds)
      .where('deleted_at', 'is', null)
      .execute() as DashboardWidgetCountRow[]

    const widgetCountByDashboardId = widgetRows.reduce<Map<string, number>>(
      (counts, row) => {
        counts.set(
          row.dashboard_id,
          (counts.get(row.dashboard_id) ?? 0) + 1
        )
        return counts
      },
      new Map()
    )

    return {
      ok: true,
      code: 'success',
      dashboards: dashboards.map((dashboard) =>
        mapDashboardSummary(
          dashboard,
          widgetCountByDashboardId.get(dashboard.dashboard_id) ?? 0
        )
      )
    }
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    console.error(error)

    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    }
  }
}

export const getDashboard = async (
  authContext: AuthenticatedOrganizationContext,
  dashboardId: string
): Promise<GetDashboardResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const dashboard = await loadDashboardDetails(
      db,
      organizationId,
      dashboardId
    )

    if (!dashboard) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    return {
      ok: true,
      code: 'success',
      dashboard
    }
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    console.error(error)

    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    }
  }
}

export const createDashboard = async (
  authContext: AuthenticatedOrganizationContext,
  input: CreateDashboardInput
): Promise<CreateDashboardResult> => {
  try {
    await upsertOrganization(authContext)

    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const createdDashboard = await db
      .insertInto('app_dashboards')
      .values({
        organization_id: organizationId,
        dashboard_name: input.dashboardName,
        created_by_user_id: authContext.userId,
        updated_by_user_id: authContext.userId
      })
      .returning(['dashboard_id'])
      .executeTakeFirst() as DashboardReferenceRow | undefined

    if (!createdDashboard) {
      return {
        ok: false,
        code: 'unexpected_error',
        message: 'unexpected_error'
      }
    }

    const dashboard = await loadDashboardDetails(
      db,
      organizationId,
      createdDashboard.dashboard_id
    )

    if (!dashboard) {
      return {
        ok: false,
        code: 'unexpected_error',
        message: 'unexpected_error'
      }
    }

    return {
      ok: true,
      code: 'success',
      dashboard
    }
  } catch (error) {
    if (isDuplicateDashboardNameError(error)) {
      return {
        ok: false,
        code: 'duplicate_dashboard_name',
        message: 'duplicate_dashboard_name'
      }
    }

    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    console.error(error)

    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    }
  }
}

export const saveDashboard = async (
  authContext: AuthenticatedOrganizationContext,
  input: SaveDashboardInput
): Promise<SaveDashboardResult> => {
  try {
    await upsertOrganization(authContext)

    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const dashboard = await db.transaction().execute(async (trx) => {
      const existingDashboard = await loadDashboardRow(
        trx,
        organizationId,
        input.dashboardId
      )

      if (!existingDashboard) {
        return null
      }

      const queriesBelongToOrganization = await ensureDashboardQueriesBelongToOrganization(
        trx,
        organizationId,
        input.widgets
      )

      if (!queriesBelongToOrganization) {
        return false
      }

      await trx
        .updateTable('app_dashboards')
        .set({
          dashboard_name: input.dashboardName,
          embed_enabled: input.embedEnabled,
          updated_by_user_id: authContext.userId
        })
        .where('organization_id', '=', organizationId)
        .where('dashboard_id', '=', input.dashboardId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()

      await replaceDashboardWidgets(trx, input.dashboardId, input.widgets)

      return await loadDashboardDetails(
        trx,
        organizationId,
        input.dashboardId
      )
    })

    if (dashboard === null || dashboard === false) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    if (!dashboard) {
      return {
        ok: false,
        code: 'unexpected_error',
        message: 'unexpected_error'
      }
    }

    return {
      ok: true,
      code: 'success',
      dashboard
    }
  } catch (error) {
    if (isDuplicateDashboardNameError(error)) {
      return {
        ok: false,
        code: 'duplicate_dashboard_name',
        message: 'duplicate_dashboard_name'
      }
    }

    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    console.error(error)

    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    }
  }
}

export const deleteDashboard = async (
  authContext: AuthenticatedOrganizationContext,
  input: DeleteDashboardInput
): Promise<DeleteDashboardResult> => {
  try {
    const db = getAppDatabase()
    const organizationId = mapOrganizationIdToStorage(authContext.organizationId)
    const dashboard = await db
      .selectFrom('app_dashboards')
      .select(['dashboard_id', 'dashboard_name'])
      .where('organization_id', '=', organizationId)
      .where('dashboard_id', '=', input.dashboardId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst() as DashboardIdentityRow | undefined

    if (!dashboard) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    if (dashboard.dashboard_name !== input.confirmationName) {
      return {
        ok: false,
        code: 'confirmation_mismatch',
        message: 'confirmation_mismatch'
      }
    }

    await db
      .updateTable('app_dashboards')
      .set({
        deleted_at: new Date(),
        updated_by_user_id: authContext.userId
      })
      .where('organization_id', '=', organizationId)
      .where('dashboard_id', '=', input.dashboardId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()

    return {
      ok: true,
      code: 'success'
    }
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    console.error(error)

    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    }
  }
}

export const getEmbeddedDashboard = async (
  embedId: string
): Promise<GetEmbeddedDashboardResult> => {
  try {
    const db = getAppDatabase()
    const dashboard = await db
      .selectFrom('app_dashboards')
      .select([
        'dashboard_id',
        'dashboard_name',
        'embed_id',
        'embed_enabled',
        'created_at',
        'updated_at'
      ])
      .where('embed_id', '=', embedId)
      .where('embed_enabled', '=', true)
      .where('deleted_at', 'is', null)
      .executeTakeFirst() as DashboardRow | undefined

    if (!dashboard) {
      return {
        ok: false,
        code: 'not_found',
        message: 'not_found'
      }
    }

    const widgets = await loadDashboardWidgets(db, dashboard.dashboard_id)

    return {
      ok: true,
      code: 'success',
      dashboard: {
        embedId: dashboard.embed_id,
        dashboardName: dashboard.dashboard_name,
        updatedAt: new Date(dashboard.updated_at).toISOString(),
        widgets: widgets.map((widget) => ({
          id: widget.widget_id,
          title: widget.widget_title,
          pluginId: widget.plugin_id,
          pluginConfig: normalizePluginConfig(widget.plugin_config),
          layout: normalizeLayout(widget.layout),
          refreshIntervalSeconds: normalizePositiveInteger(
            widget.refresh_interval_seconds,
            60
          )
        }))
      }
    }
  } catch (error) {
    if (isPersistenceConfigurationError(error)) {
      return {
        ok: false,
        code: 'persistence_unavailable',
        message: 'persistence_unavailable'
      }
    }

    console.error(error)

    return {
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error'
    }
  }
}
