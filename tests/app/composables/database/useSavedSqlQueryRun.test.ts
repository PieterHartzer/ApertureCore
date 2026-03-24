import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rawFetchMock = vi.fn()

const fetchMock = Object.assign(vi.fn(), {
  raw: rawFetchMock
})

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/database/useSavedSqlQueryRun'))
    .useSavedSqlQueryRun
}

describe('useSavedSqlQueryRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a successful query run response', async () => {
    rawFetchMock.mockResolvedValue({
      status: 200,
      _data: {
        columns: ['day', 'sales_total'],
        rows: [{
          day: '2026-03-24',
          sales_total: 120
        }],
        etag: '"etag-1"'
      },
      headers: new Headers({
        etag: '"etag-1"'
      })
    })

    const useSavedSqlQueryRun = await loadComposable()

    await expect(
      useSavedSqlQueryRun().runQuery({
        connectionId: 'connection-1',
        queryId: 'query-1'
      })
    ).resolves.toEqual({
      ok: true,
      code: 'success',
      columns: ['day', 'sales_total'],
      rows: [{
        day: '2026-03-24',
        sales_total: 120
      }],
      etag: '"etag-1"'
    })

    expect(rawFetchMock).toHaveBeenCalledWith('/api/query/run', {
      method: 'POST',
      body: {
        connectionId: 'connection-1',
        queryId: 'query-1'
      },
      headers: undefined,
      ignoreResponseError: true
    })
  })

  it('returns a not modified response when the ETag matches', async () => {
    rawFetchMock.mockResolvedValue({
      status: 304,
      headers: new Headers({
        etag: '"etag-1"'
      })
    })

    const useSavedSqlQueryRun = await loadComposable()

    await expect(
      useSavedSqlQueryRun().runQuery({
        connectionId: 'connection-1',
        queryId: 'query-1'
      }, {
        etag: '"etag-1"'
      })
    ).resolves.toEqual({
      ok: true,
      code: 'not_modified',
      etag: '"etag-1"'
    })
  })

  it('returns structured API errors from failed responses', async () => {
    rawFetchMock.mockResolvedValue({
      status: 403,
      _data: {
        ok: false,
        code: 'forbidden',
        message: 'queries.test.errors.forbidden',
        messageKey: 'queries.test.errors.forbidden'
      },
      headers: new Headers()
    })

    const useSavedSqlQueryRun = await loadComposable()

    await expect(
      useSavedSqlQueryRun().runQuery({
        connectionId: 'connection-1',
        queryId: 'query-1'
      })
    ).resolves.toEqual({
      ok: false,
      code: 'forbidden',
      message: 'queries.test.errors.forbidden',
      messageKey: 'queries.test.errors.forbidden'
    })
  })

  it('falls back to an unexpected error when the request throws', async () => {
    rawFetchMock.mockRejectedValue(new Error('network boom'))

    const useSavedSqlQueryRun = await loadComposable()

    await expect(
      useSavedSqlQueryRun().runQuery({
        connectionId: 'connection-1',
        queryId: 'query-1'
      })
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'queries.run.errors.unexpected',
      messageKey: 'queries.run.errors.unexpected'
    })
  })
})
