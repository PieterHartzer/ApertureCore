import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rawFetchMock = vi.fn()

const fetchMock = Object.assign(vi.fn(), {
  raw: rawFetchMock
})

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/dashboard/useDashboardQueryResults'))
    .useDashboardQueryResults
}

describe('useDashboardQueryResults additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks the state as error when the initial load fails', async () => {
    rawFetchMock.mockResolvedValue({
      status: 503,
      _data: {
        ok: false,
        code: 'connection_failed',
        message: 'queries.run.errors.connectionFailed',
        messageKey: 'queries.run.errors.connectionFailed'
      },
      headers: new Headers()
    })

    const useDashboardQueryResults = await loadComposable()
    const queryResults = useDashboardQueryResults(fetchMock as typeof $fetch, {
      now: () => 1_000
    })
    const target = {
      connectionId: 'connection-1',
      queryId: 'query-1'
    }

    await queryResults.load(target)

    expect(queryResults.getState(target)).toMatchObject({
      status: 'error',
      isRefreshing: false,
      errorCode: 'connection_failed',
      errorMessage: 'queries.run.errors.connectionFailed',
      errorMessageKey: 'queries.run.errors.connectionFailed',
      lastFetchedAt: null
    })
  })

  it('keeps cached rows visible when a background refresh fails', async () => {
    let now = 1_000

    rawFetchMock
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        status: 400,
        _data: {
          ok: false,
          code: 'query_failed',
          message: 'queries.run.errors.queryFailed',
          messageKey: 'queries.run.errors.queryFailed'
        },
        headers: new Headers()
      })

    const useDashboardQueryResults = await loadComposable()
    const queryResults = useDashboardQueryResults(fetchMock as typeof $fetch, {
      defaultRefreshIntervalMs: 1_000,
      now: () => now
    })
    const target = {
      connectionId: 'connection-1',
      queryId: 'query-1'
    }

    await queryResults.load(target)

    now = 2_500

    await queryResults.load(target)

    expect(queryResults.getState(target)).toMatchObject({
      status: 'success',
      isRefreshing: false,
      rows: [{
        day: '2026-03-24',
        sales_total: 120
      }],
      errorCode: 'query_failed',
      errorMessage: 'queries.run.errors.queryFailed',
      errorMessageKey: 'queries.run.errors.queryFailed',
      lastFetchedAt: 1_000
    })
  })

  it('deduplicates in-flight loads for the same target', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    rawFetchMock.mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const useDashboardQueryResults = await loadComposable()
    const queryResults = useDashboardQueryResults(fetchMock as typeof $fetch)
    const target = {
      connectionId: 'connection-1',
      queryId: 'query-1'
    }

    const requestA = queryResults.load(target)
    const requestB = queryResults.load(target)

    expect(rawFetchMock).toHaveBeenCalledTimes(1)

    resolveFetch?.({
      status: 200,
      _data: {
        columns: ['id'],
        rows: [{ id: 1 }],
        etag: '"etag-1"'
      },
      headers: new Headers({
        etag: '"etag-1"'
      })
    })

    const [stateA, stateB] = await Promise.all([requestA, requestB])

    expect(stateA).toBe(stateB)
    expect(stateA).toMatchObject({
      status: 'success'
    })
  })

  it('supports clearing one cached target or all cached targets', async () => {
    rawFetchMock
      .mockResolvedValueOnce({
        status: 200,
        _data: {
          columns: ['id'],
          rows: [{ id: 1 }],
          etag: '"etag-1"'
        },
        headers: new Headers({
          etag: '"etag-1"'
        })
      })
      .mockResolvedValueOnce({
        status: 200,
        _data: {
          columns: ['id'],
          rows: [{ id: 2 }],
          etag: '"etag-2"'
        },
        headers: new Headers({
          etag: '"etag-2"'
        })
      })

    const useDashboardQueryResults = await loadComposable()
    const queryResults = useDashboardQueryResults(fetchMock as typeof $fetch)
    const targetA = {
      connectionId: 'connection-1',
      queryId: 'query-1'
    }
    const targetB = {
      connectionId: 'connection-2',
      queryId: 'query-2'
    }

    await queryResults.load(targetA)
    await queryResults.load(targetB)

    queryResults.clear(targetA)

    expect(queryResults.queryStates.value).toEqual({
      'query:query-2:connection-2': expect.objectContaining({
        key: 'query:query-2:connection-2'
      })
    })

    queryResults.clear()

    expect(queryResults.queryStates.value).toEqual({})
  })
})
