import type {
  DatabaseConnection,
  DatabaseConnectionTestResponse,
} from '~/types/database'

const createUnexpectedResponse = (): DatabaseConnectionTestResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'connections.test.errors.unexpected',
  messageKey: 'connections.test.errors.unexpected'
})

const isConnectionTestResponse = (
  value: unknown
): value is DatabaseConnectionTestResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

export const useDatabaseConnectionTest = () => {
  const testConnection = async (
    connection: DatabaseConnection
  ): Promise<DatabaseConnectionTestResponse> => {
    try {
      return await $fetch<DatabaseConnectionTestResponse>('/api/connections/test', {
        method: 'POST',
        body: connection
      })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isConnectionTestResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    testConnection
  }
}
