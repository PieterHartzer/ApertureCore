// Some widgets show no query results, for example a text label or a clock.
export const up = async (db) => {
  await db.schema
    .alterTable('app_dashboard_widgets')
    .alterColumn('query_id', (column) => column.dropNotNull())
    .execute()
}

export const down = async (db) => {
  await db
    .deleteFrom('app_dashboard_widgets')
    .where('query_id', 'is', null)
    .execute()

  await db.schema
    .alterTable('app_dashboard_widgets')
    .alterColumn('query_id', (column) => column.setNotNull())
    .execute()
}
