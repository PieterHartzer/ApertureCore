import { useRuntimeConfig } from '#imports'
import { Kysely, PostgresDialect } from 'kysely'
import type { Generated } from 'kysely'
import pg from 'pg'

const { Pool } = pg

export class AppDatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppDatabaseConfigurationError'
  }
}

interface AppDatabase {
  app_organizations: {
    organization_id: string
    organization_name: string
    organization_primary_domain: string | null
    created_at: Generated<Date>
    updated_at: Generated<Date>
  }
  app_database_connections: {
    connection_id: string
    organization_id: string
    connection_name: string
    connection_target_fingerprint: string
    database_type: string
    encrypted_secret: string
    created_by_user_id: string
    updated_by_user_id: string
    created_at: Generated<Date>
    updated_at: Generated<Date>
  }
}

type AppDatabaseClient = Kysely<AppDatabase>

declare global {
  var __apertureCoreAppDatabase: AppDatabaseClient | undefined
  var __apertureCoreAppDatabaseUrl: string | undefined
}

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

export const resetAppDatabaseForTests = async () => {
  if (globalThis.__apertureCoreAppDatabase) {
    await globalThis.__apertureCoreAppDatabase.destroy()
  }

  globalThis.__apertureCoreAppDatabase = undefined
  globalThis.__apertureCoreAppDatabaseUrl = undefined
}
