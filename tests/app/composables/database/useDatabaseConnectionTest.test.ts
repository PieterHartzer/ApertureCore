import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const connection = {
  connectionName: 'Primary',
  databaseType: 'postgres' as const,
  host: 'db.internal',
  port: 5432,
  databaseName: 'app_db',
  username: 'admin',
  password: 'secret',
  sslMode: 'disable' as const,
}

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useDatabaseConnectionTest'))
    .useDatabaseConnectionTest
}

describe('useDatabaseConnectionTest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the connection payload and returns a successful response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'connections.test.success',
      messageKey: 'connections.test.success',
    })

    const useDatabaseConnectionTest = await loadComposable()

    await expect(
      useDatabaseConnectionTest().testConnection(connection)
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.test.success',
      messageKey: 'connections.test.success',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/connections/test', {
      method: 'POST',
      body: connection,
    })
  })

  it('includes the saved connection id when testing an existing connection', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'connections.test.success',
      messageKey: 'connections.test.success',
    })

    const useDatabaseConnectionTest = await loadComposable()

    await useDatabaseConnectionTest().testConnection(connection, {
      connectionId: 'connection-1'
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/connections/test', {
      method: 'POST',
      body: {
        ...connection,
        connectionId: 'connection-1'
      },
    })
  })

  it('returns structured API errors from failed fetch responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'unauthorized',
        message: 'connections.test.errors.unauthorized',
        messageKey: 'connections.test.errors.unauthorized',
      },
    })

    const useDatabaseConnectionTest = await loadComposable()

    await expect(
      useDatabaseConnectionTest().testConnection(connection)
    ).resolves.toEqual({
      ok: false,
      code: 'unauthorized',
      message: 'connections.test.errors.unauthorized',
      messageKey: 'connections.test.errors.unauthorized',
    })
  })

  it('falls back to a generic error when fetch fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useDatabaseConnectionTest = await loadComposable()

    await expect(
      useDatabaseConnectionTest().testConnection(connection)
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.test.errors.unexpected',
      messageKey: 'connections.test.errors.unexpected',
    })
  })
})
