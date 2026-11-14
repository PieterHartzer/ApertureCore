import { sql } from 'kysely'

// Which way the dashboard prints: landscape (the default) or portrait.
export const up = async (db) => {
  await db.schema
    .alterTable('app_dashboards')
    .addColumn('print_layout', 'text', (column) =>
      column.notNull().defaultTo('landscape').check(sql`print_layout in ('landscape', 'portrait')`)
    )
    .execute()
}

export const down = async (db) => {
  await db.schema.alterTable('app_dashboards').dropColumn('print_layout').execute()
}
