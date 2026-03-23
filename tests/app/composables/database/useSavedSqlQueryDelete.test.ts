import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useSavedSqlQueryDelete'))
    .useSavedSqlQueryDelete
}

describe('useSavedSqlQueryDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes a saved SQL query through the API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'queries.delete.success',
      messageKey: 'queries.delete.success'
    })

    const useSavedSqlQueryDelete = await loadComposable()

    await expect(
      useSavedSqlQueryDelete().deleteQuery(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        {
          confirmationName: 'Top customers'
        }
      )
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.delete.success',
      messageKey: 'queries.delete.success'
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/queries/2f8f9425-55cf-4d8e-a446-638848de1942',
      {
        method: 'DELETE',
        body: {
          confirmationName: 'Top customers'
        }
      }
    )
  })

  it('returns structured API errors from failed delete responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'confirmation_mismatch',
        message: 'queries.delete.errors.confirmationMismatch',
        messageKey: 'queries.delete.errors.confirmationMismatch'
      }
    })

    const useSavedSqlQueryDelete = await loadComposable()

    await expect(
      useSavedSqlQueryDelete().deleteQuery(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        {
          confirmationName: 'Wrong name'
        }
      )
    ).resolves.toEqual({
      ok: false,
      code: 'confirmation_mismatch',
      message: 'queries.delete.errors.confirmationMismatch',
      messageKey: 'queries.delete.errors.confirmationMismatch'
    })
  })

  it('falls back to a generic error when delete fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useSavedSqlQueryDelete = await loadComposable()

    await expect(
      useSavedSqlQueryDelete().deleteQuery(
        '2f8f9425-55cf-4d8e-a446-638848de1942',
        {
          confirmationName: 'Top customers'
        }
      )
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.delete.errors.unexpected',
      messageKey: 'queries.delete.errors.unexpected'
    })
  })
})
