import { ref } from 'vue'

import type { SavedSqlQueryResultRow } from '~/types/saved-sql-queries'
import type { EmbeddedDashboardWidgetRunErrorResponse } from '~/types/dashboards'

import { useEmbeddedDashboardWidgetRun } from './useEmbeddedDashboardWidgetRun'

export interface EmbeddedDashboardQueryTarget {
  embedId: string
  widgetId: string
  refreshIntervalMs?: number
}

export interface EmbeddedDashboardQueryState {
  key: string
  status: 'idle' | 'pending' | 'success' | 'error'
  isRefreshing: boolean
  columns: string[]
  rows: SavedSqlQueryResultRow[]
  etag: string
  errorCode?: EmbeddedDashboardWidgetRunErrorResponse['code']
  errorMessage: string
  errorMessageKey?: string
  lastFetchedAt: number | null
}

const hasQueryResultData = (state: EmbeddedDashboardQueryState) => {
  return (
    state.columns.length > 0 ||
    state.rows.length > 0 ||
    state.etag.length > 0
  )
}

const createState = (key: string): EmbeddedDashboardQueryState => ({
  key,
  status: 'idle',
  isRefreshing: false,
  columns: [],
  rows: [],
  etag: '',
  errorMessage: '',
  lastFetchedAt: null
})

const buildKey = (target: Pick<EmbeddedDashboardQueryTarget, 'embedId' | 'widgetId'>) => {
  return `embed-widget:${target.embedId}:${target.widgetId}`
}

export const useEmbeddedDashboardQueryResults = (
  requestFetch: typeof $fetch = $fetch,
  options: {
    now?: () => number
    defaultRefreshIntervalMs?: number
  } = {}
) => {
  const { runWidget } = useEmbeddedDashboardWidgetRun(requestFetch)
  const queryStates = ref<Record<string, EmbeddedDashboardQueryState>>({})
  const inFlightRequests = new Map<string, Promise<EmbeddedDashboardQueryState>>()
  const now = options.now ?? (() => Date.now())
  const defaultRefreshIntervalMs = options.defaultRefreshIntervalMs ?? 60_000

  const getState = (target: EmbeddedDashboardQueryTarget) => {
    const key = buildKey(target)

    queryStates.value[key] ??= createState(key)

    return queryStates.value[key]
  }

  const load = async (
    target: EmbeddedDashboardQueryTarget,
    loadOptions: {
      force?: boolean
    } = {}
  ) => {
    const state = getState(target)
    const key = state.key
    const refreshIntervalMs = target.refreshIntervalMs ?? defaultRefreshIntervalMs

    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key) as Promise<EmbeddedDashboardQueryState>
    }

    if (
      !loadOptions.force &&
      state.status === 'success' &&
      state.lastFetchedAt !== null &&
      now() - state.lastFetchedAt < refreshIntervalMs
    ) {
      return state
    }

    const hadCachedData = hasQueryResultData(state)

    if (hadCachedData) {
      state.isRefreshing = true
    } else {
      state.status = 'pending'
      state.errorCode = undefined
      state.errorMessage = ''
      state.errorMessageKey = undefined
    }

    const request = runWidget(
      target.embedId,
      target.widgetId,
      {
        etag: state.etag || undefined
      }
    )
      .then((response) => {
        if (response.ok) {
          if (response.code === 'success') {
            state.columns = response.columns
            state.rows = response.rows
            state.etag = response.etag
          }

          state.status = 'success'
          state.errorCode = undefined
          state.errorMessage = ''
          state.errorMessageKey = undefined
          state.lastFetchedAt = now()

          return state
        }

        state.errorCode = response.code
        state.errorMessage = response.message
        state.errorMessageKey = response.messageKey

        if (!hadCachedData) {
          state.status = 'error'
        }

        return state
      })
      .finally(() => {
        state.isRefreshing = false
        inFlightRequests.delete(key)
      })

    inFlightRequests.set(key, request)

    return request
  }

  const refreshStale = async (targets: EmbeddedDashboardQueryTarget[]) => {
    await Promise.all(targets.map((target) => load(target)))
  }

  return {
    getState,
    load,
    queryStates,
    refreshStale
  }
}
