import { sql } from 'kysely'

const CONNECTION_ORG_PAIR_INDEX =
  'app_database_connections_org_connection_unique'
const QUERY_CONNECTION_INDEX = 'app_saved_sql_queries_org_connection_idx'
const QUERY_UNIQUE_NAME_INDEX =
  'app_saved_sql_queries_unique_name_per_connection'

const createSavedSqlQueriesUpdatedAtTrigger = sql`
  do $$
  begin
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'app_saved_sql_queries_set_updated_at'
    ) then
      create trigger app_saved_sql_queries_set_updated_at
      before update on app_saved_sql_queries
      for each row
      execute function app_set_updated_at();
    end if;
  end;
  $$;
`

export const up = async (db) => {
  await db.schema
    .createIndex(CONNECTION_ORG_PAIR_INDEX)
    .ifNotExists()
    .unique()
    .on('app_database_connections')
    .columns(['organization_id', 'connection_id'])
    .execute()

  await db.schema
    .createTable('app_saved_sql_queries')
    .ifNotExists()
    .addColumn('query_id', 'uuid', (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('organization_id', 'uuid', (column) => column.notNull())
    .addColumn('connection_id', 'uuid', (column) => column.notNull())
    .addColumn('query_name', 'text', (column) => column.notNull())
    .addColumn('encrypted_sql', 'text', (column) => column.notNull())
    .addColumn('created_by_user_id', 'text', (column) => column.notNull())
    .addColumn('updated_by_user_id', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(sql`now()`)
    )
    .addColumn('deleted_at', 'timestamptz')
    .addForeignKeyConstraint(
      'app_saved_sql_queries_organization_connection_fkey',
      ['organization_id', 'connection_id'],
      'app_database_connections',
      ['organization_id', 'connection_id'],
      (constraint) => constraint.onDelete('cascade')
    )
    .execute()

  await db.schema
    .createIndex(QUERY_CONNECTION_INDEX)
    .ifNotExists()
    .on('app_saved_sql_queries')
    .columns(['organization_id', 'connection_id'])
    .where('deleted_at', 'is', null)
    .execute()

  await db.schema
    .createIndex(QUERY_UNIQUE_NAME_INDEX)
    .ifNotExists()
    .unique()
    .on('app_saved_sql_queries')
    .columns(['organization_id', 'connection_id', 'query_name'])
    .where('deleted_at', 'is', null)
    .execute()

  await createSavedSqlQueriesUpdatedAtTrigger.execute(db)
}

export const down = async (db) => {
  await sql`
    drop trigger if exists app_saved_sql_queries_set_updated_at
    on app_saved_sql_queries
  `.execute(db)

  await db.schema
    .dropIndex(QUERY_UNIQUE_NAME_INDEX)
    .ifExists()
    .execute()

  await db.schema
    .dropIndex(QUERY_CONNECTION_INDEX)
    .ifExists()
    .execute()

  await db.schema
    .dropTable('app_saved_sql_queries')
    .ifExists()
    .execute()

  await db.schema
    .dropIndex(CONNECTION_ORG_PAIR_INDEX)
    .ifExists()
    .execute()
}
