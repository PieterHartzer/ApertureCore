import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rawFetchMock = vi.fn()

const fetchMock = Object.assign(vi.fn(), {
  raw: rawFetchMock
})

const loadComposable = async () => {
  vi.resetModules()
  vi.stubGlobal('$fetch', fetchMock)

  return (await import('../../../../../app/composables/dashboard/useEmbeddedDashboardWidgetRun'))
    .useEmbeddedDashboardWidgetRun
}

describe('useEmbeddedDashboardWidgetRun', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns a successful embedded widget response', async () => {
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

    const useEmbeddedDashboardWidgetRun = await loadComposable()

    await expect(
      useEmbeddedDashboardWidgetRun().runWidget('embed-1', 'widget-1')
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

    expect(rawFetchMock).toHaveBeenCalledWith(
      '/api/embed/dashboards/embed-1/widgets/widget-1/run',
      {
        method: 'POST',
        headers: undefined,
        ignoreResponseError: true
      }
    )
  })

  it('returns not_modified when the embedded widget etag matches', async () => {
    rawFetchMock.mockResolvedValue({
      status: 304,
      headers: new Headers({
        etag: '"etag-1"'
      })
    })

    const useEmbeddedDashboardWidgetRun = await loadComposable()

    await expect(
      useEmbeddedDashboardWidgetRun().runWidget('embed-1', 'widget-1', {
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
      status: 404,
      _data: {
        ok: false,
        code: 'not_found',
        message: 'dashboards.embed.run.errors.notFound',
        messageKey: 'dashboards.embed.run.errors.notFound'
      },
      headers: new Headers()
    })

    const useEmbeddedDashboardWidgetRun = await loadComposable()

    await expect(
      useEmbeddedDashboardWidgetRun().runWidget('embed-1', 'widget-1')
    ).resolves.toEqual({
      ok: false,
      code: 'not_found',
      message: 'dashboards.embed.run.errors.notFound',
      messageKey: 'dashboards.embed.run.errors.notFound'
    })
  })

  it('falls back to the global raw fetch when the custom request fetch has no raw method', async () => {
    rawFetchMock.mockResolvedValue({
      status: 500,
      _data: undefined,
      headers: new Headers()
    })

    const useEmbeddedDashboardWidgetRun = await loadComposable()
    const requestFetch = vi.fn()

    await expect(
      useEmbeddedDashboardWidgetRun(requestFetch as typeof $fetch)
        .runWidget('embed-1', 'widget-1')
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.embed.run.errors.unexpected',
      messageKey: 'dashboards.embed.run.errors.unexpected'
    })

    expect(rawFetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to an unexpected error when the request throws', async () => {
    rawFetchMock.mockRejectedValue(new Error('network boom'))

    const useEmbeddedDashboardWidgetRun = await loadComposable()

    await expect(
      useEmbeddedDashboardWidgetRun().runWidget('embed-1', 'widget-1')
    ).resolves.toEqual({
      ok: false,
      code: 'unexpected_error',
      message: 'dashboards.embed.run.errors.unexpected',
      messageKey: 'dashboards.embed.run.errors.unexpected'
    })
  })
})
