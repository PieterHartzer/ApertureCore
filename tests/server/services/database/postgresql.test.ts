import { beforeEach, describe, expect, it, vi } from 'vitest'

const postgresMock = vi.fn()

vi.mock('postgres', () => ({
  default: postgresMock,
}))

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

const createSqlClient = () => {
  const sql = vi.fn()
  const end = vi.fn().mockResolvedValue(undefined)

  return Object.assign(sql, { end })
}

describe('PostgreSqlConnectionTester', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs a select 1 probe and returns success', async () => {
    const sql = createSqlClient()
    postgresMock.mockReturnValue(sql)

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await expect(tester.testConnection(input)).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'success',
    })

    expect(postgresMock).toHaveBeenCalledWith({
      host: 'db.internal',
      port: 5432,
      database: 'app_db',
      user: 'admin',
      password: 'secret',
      ssl: false,
      max: 1,
      idle_timeout: 1,
      connect_timeout: 5,
      prepare: false,
      onnotice: expect.any(Function),
    })
    expect(sql).toHaveBeenCalledOnce()
    expect(sql.end).toHaveBeenCalledWith({ timeout: 0 })
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
      const sql = createSqlClient()
      sql.mockRejectedValue(error)
      postgresMock.mockReturnValue(sql)

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
      expect(sql.end).toHaveBeenCalledWith({ timeout: 0 })
    }
  )

  it('returns an unexpected error result for non-Error failures', async () => {
    const sql = createSqlClient()
    sql.mockRejectedValue('boom')
    postgresMock.mockReturnValue(sql)

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
    expect(sql.end).toHaveBeenCalledWith({ timeout: 0 })
  })

  it('returns an unexpected error result for unmapped Error instances', async () => {
    const sql = createSqlClient()
    sql.mockRejectedValue(new Error('something odd happened'))
    postgresMock.mockReturnValue(sql)

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
    expect(sql.end).toHaveBeenCalledWith({ timeout: 0 })
  })

  it('does not classify every ssl-related message as ssl_required', async () => {
    const sql = createSqlClient()
    sql.mockRejectedValue(new Error('ssl handshake failed unexpectedly'))
    postgresMock.mockReturnValue(sql)

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
    expect(sql.end).toHaveBeenCalledWith({ timeout: 0 })
  })

  it('uses require ssl when requested', async () => {
    const sql = createSqlClient()
    postgresMock.mockReturnValue(sql)

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await tester.testConnection({
      ...input,
      sslMode: 'require',
    })

    expect(postgresMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: 'require',
      })
    )
  })

  it('falls back to the default PostgreSQL port when port is null', async () => {
    const sql = createSqlClient()
    postgresMock.mockReturnValue(sql)

    const { PostgreSqlConnectionTester } = await import(
      '../../../../server/services/database/postgresql'
    )

    const tester = new PostgreSqlConnectionTester()

    await tester.testConnection({
      ...input,
      port: null,
    })

    expect(postgresMock).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 5432,
      })
    )
  })
})
