import { beforeEach, describe, expect, it, vi } from 'vitest'

const poolClient = {
  query: vi.fn(),
  release: vi.fn()
}

const poolInstance = {
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  removeListener: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  getMaxPoolSize: vi.fn(),
  setMaxPoolSize: vi.fn(),
  getPoolQueueSize: vi.fn(),
  destroy: vi.fn(),
}

const poolConstructorMock = vi.fn()
function MockPool(config: unknown) {
  poolConstructorMock(config)
  return poolInstance
}

vi.mock('pg', () => {
  return {
    default: { Pool: MockPool },
    Pool: MockPool
  }
})

const connectionInput = {
  connectionName: 'Primary DB',
  databaseType: 'postgres' as const,
  host: 'db.internal',
  port: 5432,
  databaseName: 'app_db',
  username: 'admin',
  password: 'secret',
  sslMode: 'disable' as const,
}

const queryInput = {
  databaseType: 'postgres' as const,
  host: 'db.internal',
  port: 5432,
  databaseName: 'app_db',
  username: 'admin',
  password: 'secret',
  sslMode: 'disable' as const,
  sql: 'select id, name, metadata, created_at, payload from customers'
}

describe('PostgreSqlConnectionTester', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    poolInstance.connect.mockResolvedValue(poolClient)
  })

  it('runs a select 1 probe and returns success', async () => {
    poolInstance.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.testConnection(connectionInput)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'success',
    })

    expect(poolInstance.query).toHaveBeenCalledWith('select 1')
    expect(poolInstance.end).toHaveBeenCalled()
  })

  it.each([
    [
      Object.assign(new Error('password authentication failed'), {
        code: '28P01',
        detail: 'password rejected',
      }),
      'authentication_failed',
      'authentication_failed',
      'password authentication failed password rejected',
    ],
    [
      Object.assign(new Error('database missing'), { code: '3D000' }),
      'database_not_found',
      'database_not_found',
      'database missing',
    ],
    [
      Object.assign(new Error('timed out'), { code: 'CONNECT_TIMEOUT' }),
      'timeout',
      'timeout',
      'timed out',
    ],
    [
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }),
      'connection_failed',
      'connection_failed',
      'connect ECONNREFUSED',
    ],
    [
      new Error('ssl is required when connecting to this server'),
      'ssl_required',
      'ssl_required',
      'ssl is required when connecting to this server',
    ],
    [
      new Error('no pg_hba.conf entry for host "1.2.3.4", user "admin", database "app_db", SSL off'),
      'ssl_required',
      'ssl_required',
      'no pg_hba.conf entry for host "1.2.3.4", user "admin", database "app_db", SSL off',
    ],
  ])(
    'maps PostgreSQL connection error %# to the expected result',
    async (error, code, message, details) => {
      poolInstance.query.mockRejectedValue(error)

      const { PostgreSqlConnectionTester } = await import(
        '../../../../server/services/database/postgresql'
      )

      const tester = new PostgreSqlConnectionTester()

      await expect(tester.testConnection(connectionInput)).resolves.toEqual({
        ok: false,
        code,
        message,
        details,
      })
      expect(poolInstance.end).toHaveBeenCalled()
    }
  )

  it('returns an unexpected error result for non-Error connection failures', async () => {
    poolInstance.query.mockRejectedValue('boom')

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.testConnection(connectionInput)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error',
      details: 'boom',
    })
    expect(poolInstance.end).toHaveBeenCalled()
  })

  it('does not classify every ssl-related message as ssl_required for connection tests', async () => {
    poolInstance.query.mockRejectedValue(new Error('ssl handshake failed unexpectedly'))

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.testConnection(connectionInput)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error',
      details: 'ssl handshake failed unexpectedly',
    })
    expect(poolInstance.end).toHaveBeenCalled()
  })

  it('uses require ssl when requested', async () => {
    poolInstance.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await tester.testConnection({
      ...connectionInput,
      sslMode: 'require',
    })

    expect(poolConstructorMock).toHaveBeenCalledWith(expect.objectContaining({
      ssl: { rejectUnauthorized: false }
    }))
  })

  it('passes the validated port through to the PostgreSQL pool config', async () => {
    poolInstance.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await tester.testConnection({
      ...connectionInput,
      port: 6543,
    })

    expect(poolConstructorMock).toHaveBeenCalledWith(expect.objectContaining({
      port: 6543
    }))
  })

  it('runs a read-only wrapped query and sanitizes the returned rows', async () => {
    poolClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        fields: [
          { name: 'id' },
          { name: 'name' },
          { name: 'metadata' },
          { name: 'created_at' },
          { name: 'payload' }
        ],
        rows: [{
          id: 1,
          name: 'Alice',
          metadata: { active: true },
          created_at: new Date('2026-03-22T00:00:00.000Z'),
          payload: Buffer.from('abc')
        }]
      })
      .mockResolvedValueOnce(undefined)

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.executeReadOnlyQuery(queryInput)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'success',
      columns: ['id', 'name', 'metadata', 'created_at', 'payload'],
      rows: [{
        id: 1,
        name: 'Alice',
        metadata: '{"active":true}',
        created_at: '2026-03-22T00:00:00.000Z',
        payload: '[binary 3 bytes]'
      }],
      rowLimit: 25
    })
    expect(poolClient.query).toHaveBeenNthCalledWith(1, 'begin')
    expect(poolClient.query).toHaveBeenNthCalledWith(
      6,
      'select * from (select id, name, metadata, created_at, payload from customers) as aperture_query_result limit 25'
    )
    expect(poolClient.query).toHaveBeenLastCalledWith('rollback')
    expect(poolClient.release).toHaveBeenCalled()
    expect(poolInstance.end).toHaveBeenCalled()
  })

  it('uses caller-provided row and timeout limits for wrapped queries', async () => {
    poolClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        fields: [{ name: 'id' }],
        rows: [{ id: 1 }]
      })
      .mockResolvedValueOnce(undefined)

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.executeReadOnlyQuery({
      ...queryInput,
      maxRows: 5,
      timeoutMs: 12_000
    })).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'success',
      columns: ['id'],
      rows: [{ id: 1 }],
      rowLimit: 5
    })
    expect(poolClient.query).toHaveBeenNthCalledWith(
      2,
      "set local statement_timeout = '12000ms'"
    )
    expect(poolClient.query).toHaveBeenNthCalledWith(
      3,
      "set local idle_in_transaction_session_timeout = '12000ms'"
    )
    expect(poolClient.query).toHaveBeenNthCalledWith(
      6,
      'select * from (select id, name, metadata, created_at, payload from customers) as aperture_query_result limit 5'
    )
  })

  it('allows wrapped common table expression queries', async () => {
    poolClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        fields: [{ name: 'id' }],
        rows: [{ id: 1 }]
      })
      .mockResolvedValueOnce(undefined)

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await tester.executeReadOnlyQuery({
      ...queryInput,
      sql: 'with active_customers as (select id from customers where active = true) select id from active_customers'
    })

    expect(poolClient.query).toHaveBeenNthCalledWith(
      6,
      'select * from (with active_customers as (select id from customers where active = true) select id from active_customers) as aperture_query_result limit 25'
    )
  })

  it('rejects multiple statements before opening a database session', async () => {
    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.executeReadOnlyQuery({
      ...queryInput,
      sql: 'select 1; select 2'
    })).resolves.toEqual({
      ok: false,
      code: 'query_rejected',
      message: 'query_rejected',
      details: 'Only a single SQL statement can be used.'
    })
    expect(poolInstance.connect).not.toHaveBeenCalled()
  })

  it('rejects non-select statements before opening a database session', async () => {
    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.executeReadOnlyQuery({
      ...queryInput,
      sql: 'delete from customers'
    })).resolves.toEqual({
      ok: false,
      code: 'query_rejected',
      message: 'query_rejected',
      details: 'Only read-only SELECT queries are allowed.'
    })
    expect(poolInstance.connect).not.toHaveBeenCalled()
  })

  it('maps a read-only transaction violation to query_rejected', async () => {
    poolClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(
        new Error('cannot execute DELETE in a read-only transaction'),
        { code: '25006' }
      ))
      .mockResolvedValueOnce(undefined)

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.executeReadOnlyQuery({
      ...queryInput,
      sql: 'with deleted as (delete from customers returning id) select id from deleted'
    })).resolves.toEqual({
      ok: false,
      code: 'query_rejected',
      message: 'query_rejected',
      details: 'cannot execute DELETE in a read-only transaction'
    })
    expect(poolClient.query).toHaveBeenLastCalledWith('rollback')
    expect(poolClient.release).toHaveBeenCalled()
    expect(poolInstance.end).toHaveBeenCalled()
  })

  it('maps PostgreSQL statement errors to query_failed', async () => {
    poolClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(
        new Error('syntax error at or near "from"'),
        { code: '42601' }
      ))
      .mockResolvedValueOnce(undefined)

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.executeReadOnlyQuery(queryInput)).resolves.toEqual({
      ok: false,
      code: 'query_failed',
      message: 'query_failed',
      details: 'syntax error at or near "from"'
    })
    expect(poolClient.query).toHaveBeenLastCalledWith('rollback')
  })

  it('maps connection-level failures during query execution', async () => {
    poolInstance.connect.mockRejectedValueOnce(Object.assign(
      new Error('password authentication failed'),
      { code: '28P01' }
    ))

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.executeReadOnlyQuery(queryInput)).resolves.toEqual({
      ok: false,
      code: 'authentication_failed',
      message: 'authentication_failed',
      details: 'password authentication failed'
    })
    expect(poolClient.release).not.toHaveBeenCalled()
    expect(poolInstance.end).toHaveBeenCalled()
  })

  it.each([
    [
      Object.assign(new Error('database missing'), { code: '3D000' }),
      {
        ok: false,
        code: 'database_not_found',
        message: 'database_not_found',
        details: 'database missing'
      }
    ],
    [
      Object.assign(new Error('timed out'), { code: 'CONNECT_TIMEOUT' }),
      {
        ok: false,
        code: 'timeout',
        message: 'timeout',
        details: 'timed out'
      }
    ],
    [
      Object.assign(new Error('connect ECONNRESET'), { code: 'ECONNRESET' }),
      {
        ok: false,
        code: 'connection_failed',
        message: 'connection_failed',
        details: 'connect ECONNRESET'
      }
    ],
    [
      new Error('mystery failure'),
      {
        ok: false,
        code: 'unexpected_error',
        message: 'unexpected_error',
        details: 'mystery failure'
      }
    ]
  ])(
    'maps query execution connection error %# to the expected result',
    async (error, expected) => {
      poolInstance.connect.mockRejectedValueOnce(error)

      const { PostgreSqlConnectionTester } = await import(
        '../../../../server/services/database/postgresql'
      )

      const tester = new PostgreSqlConnectionTester()

      await expect(tester.executeReadOnlyQuery(queryInput)).resolves.toEqual(expected)
      expect(poolClient.release).not.toHaveBeenCalled()
      expect(poolInstance.end).toHaveBeenCalled()
    }
  )

  it('returns unexpected_error for non-Error query execution failures', async () => {
    poolInstance.connect.mockRejectedValueOnce('boom')

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.executeReadOnlyQuery(queryInput)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error',
      details: 'boom'
    })
    expect(poolInstance.end).toHaveBeenCalled()
  })

  it('truncates oversized scalar values in query results', async () => {
    const longValue = 'x'.repeat(2_100)
    poolClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        fields: [{ name: 'description' }],
        rows: [{ description: longValue }]
      })
      .mockResolvedValueOnce(undefined)

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()
    const result = await tester.executeReadOnlyQuery(queryInput)

    expect(result).toEqual({
      ok: true,
      code: 'success',
      message: 'success',
      columns: ['description'],
      rows: [{
        description: `${'x'.repeat(2_000)}...`
      }],
      rowLimit: 25
    })
  })
})
