import { sql } from 'kysely'

const createUpdatedAtFunction = sql`
  create or replace function app_set_updated_at()
  returns trigger as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$ language plpgsql
`

const createOrganizationsUpdatedAtTrigger = sql`
  do $$
  begin
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'app_organizations_set_updated_at'
    ) then
      create trigger app_organizations_set_updated_at
      before update on app_organizations
      for each row
      execute function app_set_updated_at();
    end if;
  end;
  $$;
`

const createDatabaseConnectionsUpdatedAtTrigger = sql`
  do $$
  begin
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'app_database_connections_set_updated_at'
    ) then
      create trigger app_database_connections_set_updated_at
      before update on app_database_connections
      for each row
      execute function app_set_updated_at();
    end if;
  end;
  $$;
`

export const up = async (db) => {
  await sql`create extension if not exists pgcrypto`.execute(db)

  await db.schema
    .createTable('app_organizations')
    .ifNotExists()
    .addColumn('organization_id', 'uuid', (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('organization_name', 'text', (column) => column.notNull())
    .addColumn('organization_primary_domain', 'text')
    .addColumn('created_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(sql`now()`)
    )
    .addColumn('deleted_at', 'timestamptz')
    .execute()

  await db.schema
    .createTable('app_database_connections')
    .ifNotExists()
    .addColumn('connection_id', 'uuid', (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('organization_id', 'uuid', (column) => column.notNull())
    .addColumn('connection_name', 'text', (column) => column.notNull())
    .addColumn('database_type', 'text', (column) => column.notNull())
    .addColumn('encrypted_secret', 'text', (column) => column.notNull())
    .addColumn('created_by_user_id', 'text', (column) => column.notNull())
    .addColumn('updated_by_user_id', 'text', (column) => column.notNull())
    .addColumn('created_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(sql`now()`)
    )
    .addColumn('deleted_at', 'timestamptz')
    .addCheckConstraint(
      'app_database_connections_database_type_check',
      sql`"database_type" in ('postgres', 'mysql', 'mssql', 'sqlite')`
    )
    .addForeignKeyConstraint(
      'app_database_connections_organization_id_fkey',
      ['organization_id'],
      'app_organizations',
      ['organization_id'],
      (constraint) => constraint.onDelete('cascade')
    )
    .execute()

  await db.schema
    .createIndex('app_database_connections_organization_id_idx')
    .ifNotExists()
    .on('app_database_connections')
    .column('organization_id')
    .execute()

  await db.schema
    .createIndex('app_database_connections_unique_name_per_org')
    .ifNotExists()
    .unique()
    .on('app_database_connections')
    .columns(['organization_id', 'connection_name'])
    .where('deleted_at', 'is', null)
    .execute()

  await createUpdatedAtFunction.execute(db)
  await createOrganizationsUpdatedAtTrigger.execute(db)
  await createDatabaseConnectionsUpdatedAtTrigger.execute(db)
}

export const down = async (db) => {
  await sql`
    drop trigger if exists app_database_connections_set_updated_at
    on app_database_connections
  `.execute(db)

  await sql`
    drop trigger if exists app_organizations_set_updated_at
    on app_organizations
  `.execute(db)

  await sql`drop function if exists app_set_updated_at()`.execute(db)

  await db.schema
    .dropIndex('app_database_connections_unique_name_per_org')
    .ifExists()
    .execute()

  await db.schema
    .dropIndex('app_database_connections_organization_id_idx')
    .ifExists()
    .execute()

  await db.schema
    .dropTable('app_database_connections')
    .ifExists()
    .execute()

  await db.schema
    .dropTable('app_organizations')
    .ifExists()
    .execute()
}
