interface DeleteDatabaseConnectionRequest {
  confirmationName: string
  deleteLinkedQueries: boolean
}

type DeleteDatabaseConnectionResponse = {
  ok: boolean
  code:
    | 'success'
    | 'forbidden'
    | 'invalid_input'
    | 'confirmation_mismatch'
    | 'not_found'
    | 'persistence_unavailable'
    | 'unexpected_error'
  message: string
  messageKey?: string
  field?: 'connectionId' | 'confirmationName' | 'deleteLinkedQueries' | 'body'
  issue?:
    | 'body_invalid'
    | 'connection_id_invalid'
    | 'confirmation_name_invalid'
    | 'confirmation_name_required'
    | 'delete_linked_queries_invalid'
}

const createUnexpectedResponse = (): DeleteDatabaseConnectionResponse => ({
  ok: false,
  code: 'unexpected_error',
  message: 'connections.delete.errors.unexpected',
  messageKey: 'connections.delete.errors.unexpected'
})

const isDeleteConnectionResponse = (
  value: unknown
): value is DeleteDatabaseConnectionResponse => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    'code' in value &&
    'message' in value
  )
}

/**
 * Deletes a saved connection through the API after the caller confirms the
 * visible connection name.
 */
export const useDatabaseConnectionDelete = () => {
  const deleteConnection = async (
    connectionId: string,
    payload: DeleteDatabaseConnectionRequest
  ): Promise<DeleteDatabaseConnectionResponse> => {
    try {
      return await $fetch<DeleteDatabaseConnectionResponse>(
        `/api/connections/${connectionId}`,
        {
          method: 'DELETE',
          body: payload
        }
      )
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        isDeleteConnectionResponse(error.data)
      ) {
        return error.data
      }

      return createUnexpectedResponse()
    }
  }

  return {
    deleteConnection
  }
}
