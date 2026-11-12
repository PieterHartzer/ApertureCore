import { sql } from 'kysely'

const DEFAULT_DASHBOARD_INDEX = 'app_dashboards_one_default_per_org'

// One dashboard per organisation can open first for everyone.
export const up = async (db) => {
  await db.schema
    .alterTable('app_dashboards')
    .addColumn('is_default', 'boolean', (column) =>
      column.notNull().defaultTo(false)
    )
    .execute()

  await sql`
    create unique index if not exists ${sql.raw(DEFAULT_DASHBOARD_INDEX)}
    on app_dashboards (organization_id)
    where is_default and deleted_at is null
  `.execute(db)
}

export const down = async (db) => {
  await sql`drop index if exists ${sql.raw(DEFAULT_DASHBOARD_INDEX)}`.execute(db)

  await db.schema
    .alterTable('app_dashboards')
    .dropColumn('is_default')
    .execute()
}
