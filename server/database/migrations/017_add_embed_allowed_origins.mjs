import { sql } from 'kysely'

// The websites an embedded dashboard may appear on. Empty means anywhere.
export const up = async (db) => {
  await db.schema
    .alterTable('app_dashboards')
    .addColumn('embed_allowed_origins', 'jsonb', (column) =>
      column.notNull().defaultTo(sql`'[]'::jsonb`)
    )
    .execute()
}

export const down = async (db) => {
  await db.schema
    .alterTable('app_dashboards')
    .dropColumn('embed_allowed_origins')
    .execute()
}
