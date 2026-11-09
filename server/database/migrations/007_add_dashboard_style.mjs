import { sql } from 'kysely'

export const up = async (db) => {
  await db.schema
    .alterTable('app_dashboards')
    .addColumn('style', 'jsonb', (column) =>
      column.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .execute()
}

export const down = async (db) => {
  await db.schema
    .alterTable('app_dashboards')
    .dropColumn('style')
    .execute()
}
