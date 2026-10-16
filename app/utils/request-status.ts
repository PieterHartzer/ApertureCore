export const getRequestStatus = (cause: unknown): number | undefined => {
  if (typeof cause !== 'object' || cause === null) return undefined
  const failure = cause as { statusCode?: number, status?: number, response?: { status?: number }, data?: { code?: string } }
  return failure.statusCode ?? failure.status ?? failure.response?.status ?? (failure.data?.code === 'unauthorized' ? 401 : undefined)
}

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Sign in again in a new tab, then return here and retry. Your query has not been changed.'
