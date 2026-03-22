import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const input = {
  connectionName: 'Primary DB',
  databaseType: 'postgresql' as const,
  host: 'db.internal',
  port: 5432,
  databaseName: 'app_db',
  username: 'admin',
  password: 'secret',
  sslMode: 'disable' as const,
}

describe('PostgreSqlConnectionTester', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs a select 1 probe and returns success', async () => {
    poolInstance.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.testConnection(input)).resolves.toEqual({
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
    'maps PostgreSQL error %# to the expected result',
    async (error, code, message, details) => {
      poolInstance.query.mockRejectedValue(error)

      const { PostgreSqlConnectionTester } = await import(
        '../../../../server/services/database/postgresql'
      )

      const tester = new PostgreSqlConnectionTester()

      await expect(tester.testConnection(input)).resolves.toEqual({
        ok: false,
        code,
        message,
        details,
      })
      expect(poolInstance.end).toHaveBeenCalled()
    }
  )

  it('returns an unexpected error result for non-Error failures', async () => {
    poolInstance.query.mockRejectedValue('boom')

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.testConnection(input)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error',
      details: 'boom',
    })
    expect(poolInstance.end).toHaveBeenCalled()
  })

  it('returns an unexpected error result for unmapped Error instances', async () => {
    poolInstance.query.mockRejectedValue(new Error('something odd happened'))

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.testConnection(input)).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'unexpected_error',
      details: 'something odd happened',
    })
    expect(poolInstance.end).toHaveBeenCalled()
  })

  it('does not classify every ssl-related message as ssl_required', async () => {
    poolInstance.query.mockRejectedValue(new Error('ssl handshake failed unexpectedly'))

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.testConnection(input)).resolves.toEqual({
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
      ...input,
      sslMode: 'require',
    })

    expect(poolInstance.query).toHaveBeenCalled()
  })

  it('passes the validated port through to the PostgreSQL pool config', async () => {
    poolInstance.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await tester.testConnection({
      ...input,
      port: 6543,
    })

    expect(poolConstructorMock).toHaveBeenCalledWith(expect.objectContaining({
      port: 6543
    }))
  })
})
