import { getSavedConnectionDatabaseType, testSavedSqlQuery } from './saved-sql-queries'
import type { AuthenticatedOrganizationContext } from '../types/database-connections'
import type { DatabaseType } from '../types/database'

// One row per column avoids truncating a whole table definition in the query adapter.
export const SCHEMA_SQL: Record<DatabaseType, string> = {
  postgres: `select c.table_schema, c.table_name, c.column_name,
  c.udt_name as data_type, c.is_nullable,
  (select string_agg(pg_get_constraintdef(pc.oid), ', ')
   from pg_catalog.pg_constraint pc
   where pc.conrelid = (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass
     and pc.contype in ('p', 'f')
     and c.ordinal_position = any(pc.conkey)) as constraints
from information_schema.columns c
where c.table_schema not in ('pg_catalog', 'information_schema')
  and c.table_schema not like 'pg_toast%'
order by c.table_schema, c.table_name, c.ordinal_position`,
  mysql: `select c.table_schema as table_schema, c.table_name as table_name, c.column_name as column_name,
  c.column_type as data_type, c.is_nullable as is_nullable,
  nullif(concat_ws(', ',
    case when c.column_key = 'PRI' then 'PRIMARY KEY' end,
    (select group_concat(concat('REFERENCES ', k.referenced_table_name, '(', k.referenced_column_name, ')') separator ', ')
     from information_schema.key_column_usage k
     where k.table_schema = c.table_schema and k.table_name = c.table_name
       and k.column_name = c.column_name and k.referenced_table_name is not null)
  ), '') as constraints
from information_schema.columns c
where c.table_schema = database()
order by c.table_schema, c.table_name, c.ordinal_position`,
  mssql: `select c.TABLE_SCHEMA as table_schema, c.TABLE_NAME as table_name, c.COLUMN_NAME as column_name,
  c.DATA_TYPE as data_type, c.IS_NULLABLE as is_nullable,
  nullif(concat_ws(', ',
    (select top 1 'PRIMARY KEY'
     from INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
     join INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
       on k.CONSTRAINT_NAME = tc.CONSTRAINT_NAME and k.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
     where tc.CONSTRAINT_TYPE = 'PRIMARY KEY' and k.TABLE_SCHEMA = c.TABLE_SCHEMA
       and k.TABLE_NAME = c.TABLE_NAME and k.COLUMN_NAME = c.COLUMN_NAME),
    (select string_agg(concat('REFERENCES ', object_schema_name(f.referenced_object_id), '.', object_name(f.referenced_object_id), '(', col_name(f.referenced_object_id, f.referenced_column_id), ')'), ', ')
     from sys.foreign_key_columns f
     where f.parent_object_id = object_id(quotename(c.TABLE_SCHEMA) + '.' + quotename(c.TABLE_NAME))
       and col_name(f.parent_object_id, f.parent_column_id) = c.COLUMN_NAME)
  ), '') as constraints
from INFORMATION_SCHEMA.COLUMNS c
order by c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION`
}

const quoteIdentifier: Record<DatabaseType, (value: unknown) => string> = {
  postgres: (value) => `"${String(value).replaceAll('"', '""')}"`,
  mysql: (value) => `\`${String(value).replaceAll('`', '``')}\``,
  mssql: (value) => `[${String(value).replaceAll(']', ']]')}]`
}

export const getDatabaseSchema = async (
  context: AuthenticatedOrganizationContext,
  connectionId: string
) => {
  const databaseType = await getSavedConnectionDatabaseType(context, connectionId)
  if (!databaseType) return { ok: false as const, code: 'saved_connection_not_found' as const }
  const result = await testSavedSqlQuery(context, { connectionId, sql: SCHEMA_SQL[databaseType] }, { maxRows: 1501 })
  if (!result.ok) return result
  if (result.rows.length > 1500) {
    return { ok: false as const, code: 'schema_too_large', message: 'This database has too many columns for the local SQL assistant. Use a connection with access to fewer tables.' }
  }
  const quote = quoteIdentifier[databaseType]
  const schema = result.rows.map((row) =>
    `${quote(row.table_schema)}.${quote(row.table_name)}.${quote(row.column_name)} ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}${row.constraints ? ` [${row.constraints}]` : ''}`
  ).join('\n')
  return { ok: true as const, databaseType, schema, columnCount: result.rows.length }
}
