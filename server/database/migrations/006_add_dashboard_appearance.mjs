import { sql } from 'kysely'

export const up = async (db) => {
  await db.schema
    .alterTable('app_dashboards')
    .addColumn('appearance', 'text', (column) =>
      column.notNull().defaultTo(sql`'default'`)
    )
    .execute()
}

export const down = async (db) => {
  await db.schema
    .alterTable('app_dashboards')
    .dropColumn('appearance')
    .execute()
}
