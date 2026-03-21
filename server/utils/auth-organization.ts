import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'
import { createError } from 'h3'

import type { AuthenticatedOrganizationContext } from '../types/database-connections'
import { pickString } from './pick-string'

/**
 * Reads the configured organization claim names from server runtime config and
 * normalizes empty values away.
 */
const getOrganizationClaimConfiguration = () => {
  const { oidcOrganizationClaims } = useRuntimeConfig()

  return {
    idClaim: pickString(oidcOrganizationClaims?.idClaim),
    nameClaim: pickString(oidcOrganizationClaims?.nameClaim),
    primaryDomainClaim: pickString(oidcOrganizationClaims?.primaryDomainClaim)
  }
}

/**
 * Looks up a configured claim in either the ID token claims or user info
 * payload and returns the first non-empty string value.
 */
const getConfiguredClaimValue = (
  auth: H3Event['context']['auth'],
  claimName?: string
) => {
  if (!claimName) {
    return undefined
  }

  return pickString(
    auth?.claims?.[claimName],
    auth?.userInfo?.[claimName]
  )
}

/**
 * Extracts the authenticated user and organization context required for
 * organization-scoped operations.
 */
export const getAuthenticatedOrganizationContext = (
  event: H3Event
): AuthenticatedOrganizationContext => {
  const auth = event.context.auth
  const organizationClaims = getOrganizationClaimConfiguration()

  const userId = pickString(
    auth?.claims?.sub,
    auth?.userInfo?.sub
  )

  const organizationId = getConfiguredClaimValue(
    auth,
    organizationClaims.idClaim
  )

  if (!userId || !organizationId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'errors.auth.organizationRequired'
    })
  }

  return {
    userId,
    organizationId,
    organizationName: pickString(
      getConfiguredClaimValue(auth, organizationClaims.nameClaim),
      organizationId
    ) || organizationId,
    organizationPrimaryDomain: getConfiguredClaimValue(
      auth,
      organizationClaims.primaryDomainClaim
    )
  }
}
