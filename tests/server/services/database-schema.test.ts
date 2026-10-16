import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDatabaseSchema, SCHEMA_SQL } from '../../../server/services/database-schema'
const { run } = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock('../../../server/services/saved-sql-queries', () => ({ testSavedSqlQuery: run }))
const context = { organizationId: 'tenant-a', userId: 'user-a' }

describe('database schema discovery', () => {
  beforeEach(() => run.mockReset())
  it('uses the tenant-scoped query service and quotes identifiers with key metadata', async () => {
    run.mockResolvedValue({ ok: true, rows: [{ table_schema: 'public', table_name: 'order"items', column_name: 'id', data_type: 'int4', is_nullable: 'NO', constraints: 'PRIMARY KEY (id)' }] })
    const result = await getDatabaseSchema(context, 'connection-a')
    expect(run).toHaveBeenCalledWith(context, { connectionId: 'connection-a', sql: SCHEMA_SQL }, { maxRows: 1501 })
    expect(result).toEqual({ ok: true, databaseType: 'postgres', columnCount: 1, schema: '"public"."order""items"."id" int4 NOT NULL [PRIMARY KEY (id)]' })
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
