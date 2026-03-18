import type { UserSession } from '#oidc-auth'
import { setResponseStatus } from 'h3'
import { requireUserSession } from 'nuxt-oidc-auth/runtime/server/utils/session.js'

const PUBLIC_API_PATHS = new Set([
  '/api/health'
])

const PUBLIC_API_PREFIXES = [
  '/api/_nuxt_icon'
]

const isProtectedApiRequest = (path: string) => {
  if (!path.startsWith('/api/')) {
    return false
  }

  if (PUBLIC_API_PATHS.has(path)) {
    return false
  }

  return !PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix))
}

export default defineEventHandler(async (event) => {
  if (!isProtectedApiRequest(event.path)) {
    return
  }

  try {
    event.context.auth = await requireUserSession(event) as UserSession
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 401
    ) {
      setResponseStatus(event, 401)

      return {
        ok: false,
        code: 'unauthorized',
        message: 'errors.auth.unauthorized',
        messageKey: 'errors.auth.unauthorized'
      }
    }

    throw error
  }
})
