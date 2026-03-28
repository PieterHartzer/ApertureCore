import type {
  DashboardCreateInput,
  DashboardCreateResponse,
  DashboardDeleteInput,
  DashboardDeleteResponse,
  DashboardGetResponse,
  DashboardListResponse,
  DashboardSaveInput,
  DashboardSaveResponse
} from '~/types/dashboards'

type RequestFetch = <T>(
  request: string,
  options?: Record<string, unknown>
) => Promise<T>

const createUnexpectedListResponse = (): DashboardListResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'dashboards.list.errors.unexpected',
  messageKey: 'dashboards.list.errors.unexpected'
})

const createUnexpectedGetResponse = (): DashboardGetResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'dashboards.get.errors.unexpected',
  messageKey: 'dashboards.get.errors.unexpected'
})

const createUnexpectedCreateResponse = (): DashboardCreateResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'dashboards.create.errors.unexpected',
  messageKey: 'dashboards.create.errors.unexpected'
})

const createUnexpectedSaveResponse = (): DashboardSaveResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'dashboards.save.errors.unexpected',
  messageKey: 'dashboards.save.errors.unexpected'
})

const createUnexpectedDeleteResponse = (): DashboardDeleteResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'dashboards.delete.errors.unexpected',
  messageKey: 'dashboards.delete.errors.unexpected'
})

const isResponseWithCode = (value: unknown): value is { ok: boolean, code: string, message: string } => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

export const useDashboards = (
  requestFetch: RequestFetch = $fetch
) => {
  const listDashboards = async (): Promise<DashboardListResponse> => {
    try {
      return await requestFetch<DashboardListResponse>('/api/dashboards')
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isResponseWithCode(error.data)
      ) {
        return error.data as DashboardListResponse
      }

      return createUnexpectedListResponse()
    }
  }

  const getDashboard = async (
    dashboardId: string
  ): Promise<DashboardGetResponse> => {
    try {
      return await requestFetch<DashboardGetResponse>(
        `/api/dashboards/${dashboardId}`
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isResponseWithCode(error.data)
      ) {
        return error.data as DashboardGetResponse
      }

      return createUnexpectedGetResponse()
    }
  }

  const createDashboard = async (
    input: DashboardCreateInput
  ): Promise<DashboardCreateResponse> => {
    try {
      return await requestFetch<DashboardCreateResponse>(
        '/api/dashboards',
        {
          method: 'POST',
          body: input
        }
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isResponseWithCode(error.data)
      ) {
        return error.data as DashboardCreateResponse
      }

      return createUnexpectedCreateResponse()
    }
  }

  const saveDashboard = async (
    dashboardId: string,
    input: DashboardSaveInput
  ): Promise<DashboardSaveResponse> => {
    try {
      return await requestFetch<DashboardSaveResponse>(
        `/api/dashboards/${dashboardId}`,
        {
          method: 'PUT',
          body: input
        }
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isResponseWithCode(error.data)
      ) {
        return error.data as DashboardSaveResponse
      }

      return createUnexpectedSaveResponse()
    }
  }

  const deleteDashboard = async (
    dashboardId: string,
    input: DashboardDeleteInput
  ): Promise<DashboardDeleteResponse> => {
    try {
      return await requestFetch<DashboardDeleteResponse>(
        `/api/dashboards/${dashboardId}`,
        {
          method: 'DELETE',
          body: input
        }
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isResponseWithCode(error.data)
      ) {
        return error.data as DashboardDeleteResponse
      }

      return createUnexpectedDeleteResponse()
    }
  }

  return {
    listDashboards,
    getDashboard,
    createDashboard,
    saveDashboard,
    deleteDashboard
  }
}
