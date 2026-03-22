import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useSavedDatabaseConnection'))
    .useSavedDatabaseConnection
}

describe('useSavedDatabaseConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the saved connection details from the API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'connections.edit.success',
      messageKey: 'connections.edit.success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgres',
        host: 'db.internal',
        port: 5432,
        databaseName: 'app_db',
        username: 'app_user',
        sslMode: 'disable',
        hasPassword: true
      }
    })

    const useSavedDatabaseConnection = await loadComposable()

    await expect(
      useSavedDatabaseConnection().getConnection('connection-1')
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.edit.success',
      messageKey: 'connections.edit.success',
      connection: {
        id: 'connection-1',
        connectionName: 'Primary',
        databaseType: 'postgres',
        host: 'db.internal',
        port: 5432,
        databaseName: 'app_db',
        username: 'app_user',
        sslMode: 'disable',
        hasPassword: true
      }
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/connections/connection-1')
  })

  it('returns structured API errors from failed fetch responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'not_found',
        message: 'connections.edit.errors.notFound',
        messageKey: 'connections.edit.errors.notFound'
      }
    })

    const useSavedDatabaseConnection = await loadComposable()

    await expect(
      useSavedDatabaseConnection().getConnection('missing')
    ).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'connections.edit.errors.notFound',
      messageKey: 'connections.edit.errors.notFound'
    })
  })

  it('falls back to a generic error when fetch fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useSavedDatabaseConnection = await loadComposable()

    await expect(
      useSavedDatabaseConnection().getConnection('connection-1')
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.edit.errors.unexpected',
      messageKey: 'connections.edit.errors.unexpected'
    })
  })
})
