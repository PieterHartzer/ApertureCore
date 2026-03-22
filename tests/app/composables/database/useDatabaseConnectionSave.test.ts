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

  return (await import('../../../../../app/composables/database/useDatabaseConnectionSave'))
    .useDatabaseConnectionSave
}

describe('useDatabaseConnectionSave', () => {
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
      message: 'connections.save.success',
      messageKey: 'connections.save.success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgres',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z'
      }
    })

    const useDatabaseConnectionSave = await loadComposable()

    await expect(
      useDatabaseConnectionSave().saveConnection(connection)
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.save.success',
      messageKey: 'connections.save.success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgres',
        createdAt: '2026-03-18T00:00:00.000Z',
        updatedAt: '2026-03-18T00:00:00.000Z'
      }
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/connections', {
      method: 'POST',
      body: connection
    })
  })

  it('returns structured API errors from failed fetch responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'forbidden',
        message: 'connections.save.errors.forbidden',
        messageKey: 'connections.save.errors.forbidden'
      }
    })

    const useDatabaseConnectionSave = await loadComposable()

    await expect(
      useDatabaseConnectionSave().saveConnection(connection)
    ).resolves.toEqual({
      ok: false,
      code: 'forbidden',
      message: 'connections.save.errors.forbidden',
      messageKey: 'connections.save.errors.forbidden'
    })
  })

  it('falls back to a generic error when fetch fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useDatabaseConnectionSave = await loadComposable()

    await expect(
      useDatabaseConnectionSave().saveConnection(connection)
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.save.errors.unexpected',
      messageKey: 'connections.save.errors.unexpected'
    })
  })
})
