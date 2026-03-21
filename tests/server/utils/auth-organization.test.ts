import { beforeEach, describe, expect, it, vi } from 'vitest'

const useRuntimeConfigMock = vi.fn()

vi.mock('#imports', () => ({
  useRuntimeConfig: useRuntimeConfigMock
}))

vi.mock('h3', () => ({
  createError: (input: Record<string, unknown>) => input
}))

describe('getAuthenticatedOrganizationContext', () => {
  beforeEach(() => {
    vi.resetModules()
    useRuntimeConfigMock.mockReturnValue({
      oidcOrganizationClaims: {
        idClaim: 'org_id',
        nameClaim: 'org_name',
        primaryDomainClaim: 'org_primary_domain'
      }
    })
  })

  it('returns the tenant context from the authenticated session claims', async () => {
    const { getAuthenticatedOrganizationContext } = await import(
      '../../../server/utils/auth-organization'
    )
    const event = {
      context: {
        auth: {
          claims: {
            sub: 'user-1',
            org_id: 'org-1',
            org_name: 'ACME',
            org_primary_domain: 'acme.test'
          }
        }
      }
    }

    expect(getAuthenticatedOrganizationContext(event as never)).toEqual({
      userId: 'user-1',
      organizationId: 'org-1',
      organizationName: 'ACME',
      organizationPrimaryDomain: 'acme.test'
    })
  })

  it('falls back to userInfo when the claim is not present in claims', async () => {
    const { getAuthenticatedOrganizationContext } = await import(
      '../../../server/utils/auth-organization'
    )
    const event = {
      context: {
        auth: {
          userInfo: {
            sub: 'user-2',
            org_id: 'org-2',
            org_name: 'Beta'
          }
        }
      }
    }

    expect(getAuthenticatedOrganizationContext(event as never)).toEqual({
      userId: 'user-2',
      organizationId: 'org-2',
      organizationName: 'Beta',
      organizationPrimaryDomain: undefined
    })
  })

  it('uses configured organisation claim names when the provider uses custom keys', async () => {
    useRuntimeConfigMock.mockReturnValue({
      oidcOrganizationClaims: {
        idClaim: 'tenant_id',
        nameClaim: 'tenant_name',
        primaryDomainClaim: 'tenant_domain'
      }
    })

    const { getAuthenticatedOrganizationContext } = await import(
      '../../../server/utils/auth-organization'
    )
    const event = {
      context: {
        auth: {
          claims: {
            sub: 'user-custom',
            tenant_id: 'org-custom',
            tenant_name: 'Custom Org',
            tenant_domain: 'custom.example'
          }
        }
      }
    }

    expect(getAuthenticatedOrganizationContext(event as never)).toEqual({
      userId: 'user-custom',
      organizationId: 'org-custom',
      organizationName: 'Custom Org',
      organizationPrimaryDomain: 'custom.example'
    })
  })

  it('falls back to the organization id when no organization name is present', async () => {
    const { getAuthenticatedOrganizationContext } = await import(
      '../../../server/utils/auth-organization'
    )
    const event = {
      context: {
        auth: {
          claims: {
            sub: 'user-4',
            org_id: 'org-4'
          }
        }
      }
    }

    expect(getAuthenticatedOrganizationContext(event as never)).toEqual({
      userId: 'user-4',
      organizationId: 'org-4',
      organizationName: 'org-4',
      organizationPrimaryDomain: undefined
    })
  })

  it('throws a forbidden error when the organization context is missing', async () => {
    const { getAuthenticatedOrganizationContext } = await import(
      '../../../server/utils/auth-organization'
    )
    const event = {
      context: {
        auth: {
          claims: {
            sub: 'user-3'
          }
        }
      }
    }

    expect(() => getAuthenticatedOrganizationContext(event as never)).toThrowError(
      expect.objectContaining({
        statusCode: 403,
        statusMessage: 'errors.auth.organizationRequired'
      })
    )
  })

  it('throws a forbidden error when the user id is missing', async () => {
    const { getAuthenticatedOrganizationContext } = await import(
      '../../../server/utils/auth-organization'
    )
    const event = {
      context: {
        auth: {
          claims: {
            org_id: 'org-5'
          }
        }
      }
    }

    expect(() => getAuthenticatedOrganizationContext(event as never)).toThrowError(
      expect.objectContaining({
        statusCode: 403,
        statusMessage: 'errors.auth.organizationRequired'
      })
    )
  })
})
