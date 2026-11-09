import type { H3Event } from 'h3'

/** Returned when an extension refuses a write. */
export interface GuardRejection {
  ok: false
  code: 'limit_reached'
  limit: string
  message: string
}

export type CreateKind = 'connections' | 'queries' | 'dashboards'

export interface DashboardSaveContext<Input, Row, WidgetRow> {
  organizationId: string
  input: Input
  existingDashboard: Row
  existingWidgets: WidgetRow[]
}

export interface QueryRunPolicy {
  /** Changes whenever cached rows should stop being used. Must not contain colons. */
  cacheVersion?: string
  minimumTtlSeconds?: number
  /** Set to false to serve a manual refresh like a scheduled read. */
  allowForcedRun?: boolean
}

/**
 * Hooks that let a layer built on top of this app add behaviour. Core runs
 * unchanged when none are set. Assign them from a Nitro plugin.
 */
export interface ServerExtensions {
  /** Runs after a session is confirmed. Returning a value ends the request with it. */
  authenticatedRequest?: (event: H3Event) => Promise<unknown>
  guardCreate?: <Database, Result>(
    kind: CreateKind,
    organizationId: string,
    database: Database,
    work: (database: Database) => Promise<Result>
  ) => Promise<Result | GuardRejection>
  guardDashboardSave?: (
    database: never,
    context: DashboardSaveContext<never, never, never>
  ) => Promise<GuardRejection | { widgets: never[] } | null>
  queryRunPolicy?: (
    event: H3Event,
    request: { organizationId: string, queryId: string, force: boolean }
  ) => Promise<QueryRunPolicy>
  embedRunPolicy?: (
    embedId: string,
    widgetId: string
  ) => Promise<Pick<QueryRunPolicy, 'cacheVersion' | 'minimumTtlSeconds'>>
  embeddedDashboardDetails?: (organizationId: string) => Promise<Record<string, unknown>>
}

export const serverExtensions: ServerExtensions = {}

export const extraPublicApiPaths = new Set<string>()

export const isGuardRejection = (value: unknown): value is GuardRejection => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    value.code === 'limit_reached'
  )
}

export const buildGuardRejectionResponse = (event: H3Event, result: GuardRejection) => {
  setResponseStatus(event, 403)

  return {
    ok: false as const,
    code: result.code,
    limit: result.limit,
    message: result.message,
    messageKey: result.message
  }
}

export const runGuardedCreate = async <Database, Result>(
  kind: CreateKind,
  organizationId: string,
  database: Database,
  work: (database: Database) => Promise<Result>
): Promise<Result | GuardRejection> => {
  return serverExtensions.guardCreate
    ? await serverExtensions.guardCreate(kind, organizationId, database, work)
    : await work(database)
}
