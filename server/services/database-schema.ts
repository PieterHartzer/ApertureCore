import { testSavedSqlQuery } from './saved-sql-queries'
import type { AuthenticatedOrganizationContext } from '../types/database-connections'

// One row per column avoids truncating a whole table definition in the query adapter.
export const SCHEMA_SQL = `select c.table_schema, c.table_name, c.column_name,
  c.udt_name as data_type, c.is_nullable,
  (select string_agg(pg_get_constraintdef(pc.oid), ', ')
   from pg_catalog.pg_constraint pc
   where pc.conrelid = (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass
     and pc.contype in ('p', 'f')
     and c.ordinal_position = any(pc.conkey)) as constraints
from information_schema.columns c
where c.table_schema not in ('pg_catalog', 'information_schema')
  and c.table_schema not like 'pg_toast%'
order by c.table_schema, c.table_name, c.ordinal_position`

export const getDatabaseSchema = async (
  context: AuthenticatedOrganizationContext,
  connectionId: string
) => {
  const result = await testSavedSqlQuery(context, { connectionId, sql: SCHEMA_SQL }, { maxRows: 1501 })
  if (!result.ok) return result
  if (result.rows.length > 1500) {
    return { ok: false as const, code: 'schema_too_large', message: 'This database has too many columns for the local SQL assistant. Use a connection with access to fewer tables.' }
  }
  const quote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`
  const schema = result.rows.map((row) =>
    `${quote(row.table_schema)}.${quote(row.table_name)}.${quote(row.column_name)} ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}${row.constraints ? ` [${row.constraints}]` : ''}`
  ).join('\n')
  // This discovery query belongs to the currently supported PostgreSQL adapter.
  return { ok: true as const, databaseType: 'postgres' as const, schema, columnCount: result.rows.length }
}
