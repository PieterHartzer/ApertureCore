import type { H3Event } from 'h3'
import { createError } from 'h3'

import type { AuthenticatedOrganizationContext } from '../types/database-connections'
import { pickString } from './pick-string'

const RESOURCE_OWNER_ID_CLAIM = 'urn:zitadel:iam:user:resourceowner:id'
const RESOURCE_OWNER_NAME_CLAIM = 'urn:zitadel:iam:user:resourceowner:name'
const RESOURCE_OWNER_PRIMARY_DOMAIN_CLAIM =
  'urn:zitadel:iam:user:resourceowner:primary_domain'

export const getAuthenticatedOrganizationContext = (
  event: H3Event
): AuthenticatedOrganizationContext => {
  const auth = event.context.auth

  const userId = pickString(
    auth?.claims?.sub,
    auth?.userInfo?.sub
  )

  const organizationId = pickString(
    auth?.claims?.[RESOURCE_OWNER_ID_CLAIM],
    auth?.userInfo?.[RESOURCE_OWNER_ID_CLAIM]
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
      auth?.claims?.[RESOURCE_OWNER_NAME_CLAIM],
      auth?.userInfo?.[RESOURCE_OWNER_NAME_CLAIM],
      organizationId
    ) || organizationId,
    organizationPrimaryDomain: pickString(
      auth?.claims?.[RESOURCE_OWNER_PRIMARY_DOMAIN_CLAIM],
      auth?.userInfo?.[RESOURCE_OWNER_PRIMARY_DOMAIN_CLAIM]
    )
  }
}
