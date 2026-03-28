import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rawFetchMock = vi.fn()

const fetchMock = Object.assign(vi.fn(), {
  raw: rawFetchMock
})

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/dashboard/useEmbeddedDashboardQueryResults'))
    .useEmbeddedDashboardQueryResults
}

describe('useEmbeddedDashboardQueryResults additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks embedded widget state as error when the initial load fails', async () => {
    rawFetchMock.mockResolvedValue({
      status: 404,
      _data: {
        ok: false,
        code: 'not_found',
        message: 'dashboards.embed.run.errors.notFound',
        messageKey: 'dashboards.embed.run.errors.notFound'
      },
      headers: new Headers()
    })

    const useEmbeddedDashboardQueryResults = await loadComposable()
    const queryResults = useEmbeddedDashboardQueryResults(fetchMock as typeof $fetch, {
      now: () => 1_000
    })
    const target = {
      embedId: 'embed-1',
      widgetId: 'widget-1'
    }

    await queryResults.load(target)

    expect(queryResults.getState(target)).toMatchObject({
      status: 'error',
      isRefreshing: false,
      errorCode: 'not_found',
      errorMessage: 'dashboards.embed.run.errors.notFound',
      errorMessageKey: 'dashboards.embed.run.errors.notFound',
      lastFetchedAt: null
    })
  })

  it('keeps cached embedded widget rows visible when a background refresh fails', async () => {
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
        status: 503,
        _data: {
          ok: false,
          code: 'connection_failed',
          message: 'dashboards.embed.run.errors.connectionFailed',
          messageKey: 'dashboards.embed.run.errors.connectionFailed'
        },
        headers: new Headers()
      })

    const useEmbeddedDashboardQueryResults = await loadComposable()
    const queryResults = useEmbeddedDashboardQueryResults(fetchMock as typeof $fetch, {
      defaultRefreshIntervalMs: 1_000,
      now: () => now
    })
    const target = {
      embedId: 'embed-1',
      widgetId: 'widget-1'
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
      errorCode: 'connection_failed',
      errorMessage: 'dashboards.embed.run.errors.connectionFailed',
      errorMessageKey: 'dashboards.embed.run.errors.connectionFailed',
      lastFetchedAt: 1_000
    })
  })

  it('deduplicates in-flight embedded widget loads', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined
    rawFetchMock.mockReturnValue(new Promise((resolve) => {
      resolveFetch = resolve
    }))

    const useEmbeddedDashboardQueryResults = await loadComposable()
    const queryResults = useEmbeddedDashboardQueryResults(fetchMock as typeof $fetch)
    const target = {
      embedId: 'embed-1',
      widgetId: 'widget-1'
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
})
