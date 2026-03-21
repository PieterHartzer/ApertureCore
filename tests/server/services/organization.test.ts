import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isUuid } from '../../../server/utils/is-uuid'

const getAppDatabaseMock = vi.fn()

vi.mock('../../../server/utils/app-database', () => ({
  getAppDatabase: getAppDatabaseMock
}))

const authContext = {
  userId: 'user-1',
  organizationId: 'org-1',
  organizationName: 'ACME',
  organizationPrimaryDomain: undefined
}

describe('organization service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves UUID organization ids for storage', async () => {
    const { mapOrganizationIdToStorage } = await import(
      '../../../server/services/organization'
    )
    const organizationId = '8be9eb94-913d-4e17-ba6b-84b1ff1ba755'

    expect(mapOrganizationIdToStorage(organizationId)).toBe(organizationId)
  })

  it('maps non-UUID organization ids deterministically to UUIDs', async () => {
    const { mapOrganizationIdToStorage } = await import(
      '../../../server/services/organization'
    )

    const first = mapOrganizationIdToStorage('org-1')
    const second = mapOrganizationIdToStorage('org-1')

    expect(first).toBe(second)
    expect(first).not.toBe('org-1')
    expect(isUuid(first)).toBe(true)
  })

  it('upserts organization details and updates them on conflict', async () => {
    const conflictBuilder = {
      column: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnValue(undefined)
    }
    const insertBuilder = {
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn((callback: (builder: typeof conflictBuilder) => unknown) => {
        callback(conflictBuilder)
        return insertBuilder
      }),
      executeTakeFirst: vi.fn().mockResolvedValue(undefined)
    }
    getAppDatabaseMock.mockReturnValue({
      insertInto: vi.fn().mockReturnValue(insertBuilder)
    })

    const {
      mapOrganizationIdToStorage,
      upsertOrganization
    } = await import('../../../server/services/organization')

    await upsertOrganization(authContext)

    expect(insertBuilder.values).toHaveBeenCalledWith({
      organization_id: mapOrganizationIdToStorage(authContext.organizationId),
      organization_name: authContext.organizationName,
      organization_primary_domain: null
    })
    expect(conflictBuilder.column).toHaveBeenCalledWith('organization_id')
    expect(conflictBuilder.doUpdateSet).toHaveBeenCalledWith({
      organization_name: authContext.organizationName,
      organization_primary_domain: null,
      updated_at: expect.any(Date)
    })
    expect(insertBuilder.executeTakeFirst).toHaveBeenCalled()
  })
})
