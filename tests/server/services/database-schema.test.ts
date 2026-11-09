import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDatabaseSchema, SCHEMA_SQL } from '../../../server/services/database-schema'
const { run, type } = vi.hoisted(() => ({ run: vi.fn(), type: vi.fn() }))
vi.mock('../../../server/services/saved-sql-queries', () => ({ testSavedSqlQuery: run, getSavedConnectionDatabaseType: type }))
const context = { organizationId: 'tenant-a', userId: 'user-a' }

describe('database schema discovery', () => {
  beforeEach(() => { run.mockReset(); type.mockReset(); type.mockResolvedValue('postgres') })
  it('uses the tenant-scoped query service and quotes identifiers with key metadata', async () => {
    run.mockResolvedValue({ ok: true, rows: [{ table_schema: 'public', table_name: 'order"items', column_name: 'id', data_type: 'int4', is_nullable: 'NO', constraints: 'PRIMARY KEY (id)' }] })
    const result = await getDatabaseSchema(context, 'connection-a')
    expect(run).toHaveBeenCalledWith(context, { connectionId: 'connection-a', sql: SCHEMA_SQL.postgres }, { maxRows: 1501 })
    expect(result).toEqual({ ok: true, databaseType: 'postgres', columnCount: 1, schema: '"public"."order""items"."id" int4 NOT NULL [PRIMARY KEY (id)]' })
  })
  it.each([
    ['mysql', '`public`.`order"items`.`id` int4 NOT NULL [PRIMARY KEY (id)]'],
    ['mssql', '[public].[order"items].[id] int4 NOT NULL [PRIMARY KEY (id)]']
  ])('uses the %s discovery query and identifier quoting', async (databaseType, schema) => {
    type.mockResolvedValue(databaseType)
    run.mockResolvedValue({ ok: true, rows: [{ table_schema: 'public', table_name: 'order"items', column_name: 'id', data_type: 'int4', is_nullable: 'NO', constraints: 'PRIMARY KEY (id)' }] })
    expect(await getDatabaseSchema(context, 'connection-a')).toMatchObject({ ok: true, databaseType, schema })
    expect(run.mock.calls[0]?.[1].sql).toBe(SCHEMA_SQL[databaseType as 'mysql' | 'mssql'])
  })
  it('does not query a connection the organization cannot see', async () => {
    type.mockResolvedValue(null)
    expect(await getDatabaseSchema(context, 'other-tenant')).toEqual({ ok: false, code: 'saved_connection_not_found' })
    expect(run).not.toHaveBeenCalled()
  })
  it('does not expose a partial schema when the limit is exceeded', async () => {
    run.mockResolvedValue({ ok: true, rows: Array(1501).fill({}) })
    expect(await getDatabaseSchema(context, 'connection-a')).toMatchObject({ ok: false, code: 'schema_too_large' })
  })
  it('propagates inaccessible connections without returning schema', async () => {
    run.mockResolvedValue({ ok: false, code: 'saved_connection_not_found' })
    expect(await getDatabaseSchema(context, 'other-tenant')).toEqual({ ok: false, code: 'saved_connection_not_found' })
  })
  it('returns an empty schema when no tables are accessible', async () => {
    run.mockResolvedValue({ ok: true, rows: [] })
    expect(await getDatabaseSchema(context, 'connection-a')).toEqual({ ok: true, databaseType: 'postgres', schema: '', columnCount: 0 })
  })
})
