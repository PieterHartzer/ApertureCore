import { sql } from 'kysely'

const DASHBOARD_ORGANIZATION_INDEX = 'app_dashboards_organization_id_idx'
const DASHBOARD_UNIQUE_NAME_INDEX = 'app_dashboards_unique_name_per_org'
const DASHBOARD_UNIQUE_EMBED_INDEX = 'app_dashboards_unique_embed_id'
const DASHBOARD_WIDGET_INDEX = 'app_dashboard_widgets_dashboard_id_idx'
const DASHBOARD_WIDGET_QUERY_INDEX = 'app_dashboard_widgets_query_id_idx'

const createDashboardsUpdatedAtTrigger = sql`
  do $$
  begin
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'app_dashboards_set_updated_at'
    ) then
      create trigger app_dashboards_set_updated_at
      before update on app_dashboards
      for each row
      execute function app_set_updated_at();
    end if;
  end;
  $$;
`

const createDashboardWidgetsUpdatedAtTrigger = sql`
  do $$
  begin
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'app_dashboard_widgets_set_updated_at'
    ) then
      create trigger app_dashboard_widgets_set_updated_at
      before update on app_dashboard_widgets
      for each row
      execute function app_set_updated_at();
    end if;
  end;
  $$;
`

export const up = async (db) => {
  await db.schema
    .createTable('app_dashboards')
    .ifNotExists()
    .addColumn('dashboard_id', 'uuid', (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('organization_id', 'uuid', (column) => column.notNull())
    .addColumn('dashboard_name', 'text', (column) => column.notNull())
    .addColumn('embed_id', 'uuid', (column) =>
      column.notNull().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('embed_enabled', 'boolean', (column) =>
      column.notNull().defaultTo(false)
    )
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
      'app_dashboards_organization_id_fkey',
      ['organization_id'],
      'app_organizations',
      ['organization_id'],
      (constraint) => constraint.onDelete('cascade')
    )
    .execute()

  await db.schema
    .createIndex(DASHBOARD_ORGANIZATION_INDEX)
    .ifNotExists()
    .on('app_dashboards')
    .column('organization_id')
    .where('deleted_at', 'is', null)
    .execute()

  await db.schema
    .createIndex(DASHBOARD_UNIQUE_NAME_INDEX)
    .ifNotExists()
    .unique()
    .on('app_dashboards')
    .columns(['organization_id', 'dashboard_name'])
    .where('deleted_at', 'is', null)
    .execute()

  await db.schema
    .createIndex(DASHBOARD_UNIQUE_EMBED_INDEX)
    .ifNotExists()
    .unique()
    .on('app_dashboards')
    .column('embed_id')
    .where('deleted_at', 'is', null)
    .execute()

  await db.schema
    .createTable('app_dashboard_widgets')
    .ifNotExists()
    .addColumn('widget_id', 'uuid', (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('dashboard_id', 'uuid', (column) => column.notNull())
    .addColumn('query_id', 'uuid', (column) => column.notNull())
    .addColumn('widget_title', 'text', (column) => column.notNull())
    .addColumn('plugin_id', 'text', (column) => column.notNull())
    .addColumn('plugin_config', 'jsonb', (column) =>
      column.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('layout', 'jsonb', (column) =>
      column.notNull().defaultTo(sql`'{}'::jsonb`)
    )
    .addColumn('refresh_interval_seconds', 'integer', (column) =>
      column.notNull().defaultTo(60)
    )
    .addColumn('created_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', 'timestamptz', (column) =>
      column.notNull().defaultTo(sql`now()`)
    )
    .addColumn('deleted_at', 'timestamptz')
    .addCheckConstraint(
      'app_dashboard_widgets_refresh_interval_check',
      sql`"refresh_interval_seconds" > 0`
    )
    .addForeignKeyConstraint(
      'app_dashboard_widgets_dashboard_id_fkey',
      ['dashboard_id'],
      'app_dashboards',
      ['dashboard_id'],
      (constraint) => constraint.onDelete('cascade')
    )
    .addForeignKeyConstraint(
      'app_dashboard_widgets_query_id_fkey',
      ['query_id'],
      'app_saved_sql_queries',
      ['query_id'],
      (constraint) => constraint.onDelete('restrict')
    )
    .execute()

  await db.schema
    .createIndex(DASHBOARD_WIDGET_INDEX)
    .ifNotExists()
    .on('app_dashboard_widgets')
    .column('dashboard_id')
    .where('deleted_at', 'is', null)
    .execute()

  await db.schema
    .createIndex(DASHBOARD_WIDGET_QUERY_INDEX)
    .ifNotExists()
    .on('app_dashboard_widgets')
    .column('query_id')
    .where('deleted_at', 'is', null)
    .execute()

  await createDashboardsUpdatedAtTrigger.execute(db)
  await createDashboardWidgetsUpdatedAtTrigger.execute(db)
}

export const down = async (db) => {
  await sql`
    drop trigger if exists app_dashboard_widgets_set_updated_at
    on app_dashboard_widgets
  `.execute(db)

  await sql`
    drop trigger if exists app_dashboards_set_updated_at
    on app_dashboards
  `.execute(db)

  await db.schema
    .dropIndex(DASHBOARD_WIDGET_QUERY_INDEX)
    .ifExists()
    .execute()

  await db.schema
    .dropIndex(DASHBOARD_WIDGET_INDEX)
    .ifExists()
    .execute()

  await db.schema
    .dropTable('app_dashboard_widgets')
    .ifExists()
    .execute()

  await db.schema
    .dropIndex(DASHBOARD_UNIQUE_EMBED_INDEX)
    .ifExists()
    .execute()

  await db.schema
    .dropIndex(DASHBOARD_UNIQUE_NAME_INDEX)
    .ifExists()
    .execute()

  await db.schema
    .dropIndex(DASHBOARD_ORGANIZATION_INDEX)
    .ifExists()
    .execute()

  await db.schema
    .dropTable('app_dashboards')
    .ifExists()
    .execute()
}
