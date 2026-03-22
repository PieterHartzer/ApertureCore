import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

const query = {
  queryName: 'Top customers',
  connectionId: '2f8f9425-55cf-4d8e-a446-638848de1942',
  sql: 'select * from customers order by total_spend desc'
}

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useSavedSqlQuerySave'))
    .useSavedSqlQuerySave
}

describe('useSavedSqlQuerySave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts the query payload and returns a successful response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      code: 'success',
      message: 'queries.save.success',
      messageKey: 'queries.save.success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: query.connectionId,
        connectionName: 'Primary DB',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z'
      }
    })

    const useSavedSqlQuerySave = await loadComposable()

    await expect(
      useSavedSqlQuerySave().saveQuery(query)
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      message: 'queries.save.success',
      messageKey: 'queries.save.success',
      query: {
        id: 'query-1',
        queryName: 'Top customers',
        connectionId: query.connectionId,
        connectionName: 'Primary DB',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z'
      }
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/queries', {
      method: 'POST',
      body: query
    })
  })

  it('returns structured API errors from failed fetch responses', async () => {
    fetchMock.mockRejectedValue({
      data: {
        ok: false,
        code: 'duplicate_query_name',
        message: 'queries.save.errors.duplicateQueryName',
        messageKey: 'queries.save.errors.duplicateQueryName'
      }
    })

    const useSavedSqlQuerySave = await loadComposable()

    await expect(
      useSavedSqlQuerySave().saveQuery(query)
    ).resolves.toEqual({
      ok: false,
      code: 'duplicate_query_name',
      message: 'queries.save.errors.duplicateQueryName',
      messageKey: 'queries.save.errors.duplicateQueryName'
    })
  })

  it('falls back to a generic error when fetch fails without API payload', async () => {
    fetchMock.mockRejectedValue(new Error('network boom'))

    const useSavedSqlQuerySave = await loadComposable()

    await expect(
      useSavedSqlQuerySave().saveQuery(query)
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.save.errors.unexpected',
      messageKey: 'queries.save.errors.unexpected'
    })
  })
})
