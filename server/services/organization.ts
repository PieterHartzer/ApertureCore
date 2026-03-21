import { v5 as uuidv5 } from 'uuid'

import type { AuthenticatedOrganizationContext } from '../types/database-connections'
import { getAppDatabase } from '../utils/app-database'
import { isUuid } from '../utils/is-uuid'

const ORGANIZATION_STORAGE_NAMESPACE = uuidv5(
  'aperture-core.organization-storage',
  uuidv5.URL
)

export const mapOrganizationIdToStorage = (organizationId: string): string => {
  if (isUuid(organizationId)) {
    return organizationId
  }

  return uuidv5(
    `organization:${organizationId}`,
    ORGANIZATION_STORAGE_NAMESPACE
  )
}

export const upsertOrganization = async (
  authContext: AuthenticatedOrganizationContext
) => {
  const db = getAppDatabase()
  const organizationId = mapOrganizationIdToStorage(authContext.organizationId)

  await db
    .insertInto('app_organizations')
    .values({
      organization_id: organizationId,
      organization_name: authContext.organizationName,
      organization_primary_domain: authContext.organizationPrimaryDomain ?? null
    })
    .onConflict((oc) =>
      oc.column('organization_id').doUpdateSet({
        organization_name: authContext.organizationName,
        organization_primary_domain: authContext.organizationPrimaryDomain ?? null,
        updated_at: new Date()
      })
    )
    .executeTakeFirst()
}
