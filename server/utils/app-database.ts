import { useRuntimeConfig } from '#imports'
import { Kysely, PostgresDialect } from 'kysely'
import type { Generated } from 'kysely'
import pg from 'pg'
import type { DatabaseType } from '../types/database'

const { Pool } = pg

export class AppDatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppDatabaseConfigurationError'
  }
}

export interface AppDatabase {
  app_organizations: {
    organization_id: string
    organization_name: string
    organization_primary_domain: string | null
    created_at: Generated<Date>
    updated_at: Generated<Date>
    deleted_at: Date | null
  }
  app_database_connections: {
    connection_id: string
    organization_id: string
    connection_name: string
    connection_target_fingerprint: string
    database_type: DatabaseType
    encrypted_secret: string
    created_by_user_id: string
    updated_by_user_id: string
    created_at: Generated<Date>
    updated_at: Generated<Date>
    deleted_at: Date | null
  }
  app_saved_sql_queries: {
    query_id: string
    organization_id: string
    connection_id: string
    query_name: string
    encrypted_sql: string
    created_by_user_id: string
    updated_by_user_id: string
    created_at: Generated<Date>
    updated_at: Generated<Date>
    deleted_at: Date | null
  }
  app_dashboards: {
    dashboard_id: Generated<string>
    organization_id: string
    dashboard_name: string
    embed_id: Generated<string>
    embed_enabled: Generated<boolean>
    created_by_user_id: string
    updated_by_user_id: string
    created_at: Generated<Date>
    updated_at: Generated<Date>
    deleted_at: Date | null
  }
  app_dashboard_widgets: {
    widget_id: string
    dashboard_id: string
    query_id: string
    widget_title: string
    plugin_id: string
    plugin_config: unknown
    layout: unknown
    refresh_interval_seconds: number
    created_at: Generated<Date>
    updated_at: Generated<Date>
    deleted_at: Date | null
  }
}

export type AppDatabaseClient = Kysely<AppDatabase>

declare global {
  var __apertureCoreAppDatabase: AppDatabaseClient | undefined
  var __apertureCoreAppDatabaseUrl: string | undefined
}

/**
 * Creates a Kysely client for the configured application database URL.
 */
const createAppDatabaseClient = (url: string): AppDatabaseClient => {
  return new Kysely<AppDatabase>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: url,
        max: 10,
        idleTimeoutMillis: 20_000,
        connectionTimeoutMillis: 5_000
      })
    })
  })
}

/**
 * Returns a cached Kysely client for the application database, recreating it
 * when the configured connection URL changes.
 */
export const getAppDatabase = (): AppDatabaseClient => {
  const { appDatabaseUrl } = useRuntimeConfig()

  if (!appDatabaseUrl) {
    throw new AppDatabaseConfigurationError(
      'APP_DATABASE_URL is not configured.'
    )
  }

  if (
    !globalThis.__apertureCoreAppDatabase ||
    globalThis.__apertureCoreAppDatabaseUrl !== appDatabaseUrl
  ) {
    if (globalThis.__apertureCoreAppDatabase) {
      void globalThis.__apertureCoreAppDatabase.destroy()
    }

    globalThis.__apertureCoreAppDatabase = createAppDatabaseClient(appDatabaseUrl)
    globalThis.__apertureCoreAppDatabaseUrl = appDatabaseUrl
  }

  return globalThis.__apertureCoreAppDatabase
}

/**
 * Disposes the cached database client between tests so each test can control
 * its own runtime configuration.
 */
export const resetAppDatabaseForTests = async () => {
  if (globalThis.__apertureCoreAppDatabase) {
    await globalThis.__apertureCoreAppDatabase.destroy()
  }

  globalThis.__apertureCoreAppDatabase = undefined
  globalThis.__apertureCoreAppDatabaseUrl = undefined
}
