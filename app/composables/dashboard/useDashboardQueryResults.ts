import { ref } from 'vue'

import type {
  SavedSqlQueryResultRow,
  SavedSqlQueryRunErrorResponse,
  SavedSqlQueryRunInput
} from '~/types/saved-sql-queries'

import { useSavedSqlQueryRun } from '../database/useSavedSqlQueryRun'
import { DEFAULT_WIDGET_REFRESH_INTERVAL_SECONDS } from '../../types/dashboard-widgets'

export interface DashboardQueryResultTarget extends SavedSqlQueryRunInput {
  refreshIntervalMs?: number
  queryParameters?: Record<string, unknown>
}

export interface DashboardQueryResultState {
  key: string
  status: 'idle' | 'pending' | 'success' | 'error'
  isRefreshing: boolean
  columns: string[]
  rows: SavedSqlQueryResultRow[]
  etag: string
  errorCode?: SavedSqlQueryRunErrorResponse['code']
  errorMessage: string
  errorMessageKey?: string
  lastFetchedAt: number | null
}

const normalizeSerializableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeSerializableValue)
  }

  if (
    value &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((normalizedValue, key) => {
        normalizedValue[key] = normalizeSerializableValue(
          (value as Record<string, unknown>)[key]
        )

        return normalizedValue
      }, {})
  }

  return value
}

const hasQueryResultData = (state: DashboardQueryResultState) => {
  return (
    state.columns.length > 0 ||
    state.rows.length > 0 ||
    state.etag.length > 0
  )
}

export const buildDashboardQueryResultCacheKey = (
  target: Pick<DashboardQueryResultTarget, 'queryId' | 'connectionId'>,
  queryParameters?: Record<string, unknown>
) => {
  const baseKey = `query:${target.queryId}:${target.connectionId}`

  if (!queryParameters) {
    return baseKey
  }

  return `${baseKey}:${JSON.stringify(normalizeSerializableValue(queryParameters))}`
}

const createDashboardQueryResultState = (
  key: string
): DashboardQueryResultState => ({
  key,
  status: 'idle',
  isRefreshing: false,
  columns: [],
  rows: [],
  etag: '',
  errorMessage: '',
  lastFetchedAt: null
})

export const useDashboardQueryResults = (
  requestFetch: typeof $fetch = $fetch,
  options: {
    defaultRefreshIntervalMs?: number
    now?: () => number
  } = {}
) => {
  const { runQuery } = useSavedSqlQueryRun(requestFetch)
  const queryStates = ref<Record<string, DashboardQueryResultState>>({})
  const inFlightRequests = new Map<string, Promise<DashboardQueryResultState>>()
  const defaultRefreshIntervalMs = options.defaultRefreshIntervalMs
    ?? DEFAULT_WIDGET_REFRESH_INTERVAL_SECONDS * 1000
  const now = options.now ?? (() => Date.now())

  const getState = (target: DashboardQueryResultTarget) => {
    const key = buildDashboardQueryResultCacheKey(target, target.queryParameters)

    queryStates.value[key] ??= createDashboardQueryResultState(key)

    return queryStates.value[key]
  }

  const load = async (
    target: DashboardQueryResultTarget,
    loadOptions: {
      force?: boolean
    } = {}
  ): Promise<DashboardQueryResultState> => {
    const state = getState(target)
    const key = state.key
    const refreshIntervalMs = target.refreshIntervalMs ?? defaultRefreshIntervalMs

    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key) as Promise<DashboardQueryResultState>
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

    const request = runQuery(
      {
        connectionId: target.connectionId,
        queryId: target.queryId
      },
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

  const refreshStale = async (
    targets: DashboardQueryResultTarget[]
  ) => {
    const uniqueTargets = new Map<string, DashboardQueryResultTarget>()

    for (const target of targets) {
      uniqueTargets.set(
        buildDashboardQueryResultCacheKey(target, target.queryParameters),
        target
      )
    }

    await Promise.all(
      [...uniqueTargets.values()].map((target) => load(target))
    )
  }

  const clear = (target?: DashboardQueryResultTarget) => {
    if (!target) {
      queryStates.value = {}
      inFlightRequests.clear()
      return
    }

    const key = buildDashboardQueryResultCacheKey(target, target.queryParameters)
    const { [key]: _removedState, ...remainingStates } = queryStates.value

    queryStates.value = remainingStates
    inFlightRequests.delete(key)
  }

  return {
    clear,
    getState,
    load,
    queryStates,
    refreshStale
  }
}
