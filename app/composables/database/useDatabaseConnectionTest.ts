import type {
  DatabaseConnection,
  DatabaseConnectionTestResponse,
} from '~/types/database'

interface TestDatabaseConnectionOptions {
  connectionId?: string
}

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
    connection: DatabaseConnection,
    options: TestDatabaseConnectionOptions = {}
  ): Promise<DatabaseConnectionTestResponse> => {
    try {
      return await $fetch<DatabaseConnectionTestResponse>('/api/connections/test', {
        method: 'POST',
        body: {
          ...connection,
          ...(options.connectionId
            ? {
                connectionId: options.connectionId
              }
            : {})
        }
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
