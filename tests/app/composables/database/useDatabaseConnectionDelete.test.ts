import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useDatabaseConnectionDelete'))
    .useDatabaseConnectionDelete
}

describe('useDatabaseConnectionDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes a saved connection through the API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'connections.delete.success',
      messageKey: 'connections.delete.success'
    })

    const useDatabaseConnectionDelete = await loadComposable()

    await expect(
      useDatabaseConnectionDelete().deleteConnection(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        {
          confirmationName: 'Primary',
          deleteLinkedQueries: true
        }
      )
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'connections.delete.success',
      messageKey: 'connections.delete.success'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/connections/2f8f9425-55cf-4d8e-a446-638848de1942',
      {
        method: 'DELETE',
        body: {
          confirmationName: 'Primary',
          deleteLinkedQueries: true
        }
      }
    )
  })

  it('returns structured API errors from failed delete responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'confirmation_mismatch',
        message: 'connections.delete.errors.confirmationMismatch',
        messageKey: 'connections.delete.errors.confirmationMismatch'
      }
    })

    const useDatabaseConnectionDelete = await loadComposable()

    await expect(
      useDatabaseConnectionDelete().deleteConnection(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        {
          confirmationName: 'Wrong name',
          deleteLinkedQueries: false
        }
      )
    ).resolves.toEqual({
      ok: false,
      code: 'confirmation_mismatch',
      message: 'connections.delete.errors.confirmationMismatch',
      messageKey: 'connections.delete.errors.confirmationMismatch'
    })
  })

  it('falls back to a generic error when delete fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useDatabaseConnectionDelete = await loadComposable()

    await expect(
      useDatabaseConnectionDelete().deleteConnection(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        {
          confirmationName: 'Primary',
          deleteLinkedQueries: false
        }
      )
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'connections.delete.errors.unexpected',
      messageKey: 'connections.delete.errors.unexpected'
    })
  })
})
