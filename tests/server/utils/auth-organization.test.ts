import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('h3', () => ({
  createError: (input: Record<string, unknown>) => input
}))

describe('getAuthenticatedOrganizationContext', () => {
  beforeEach(() => {
    vi.resetModules()
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
            'urn:zitadel:iam:user:resourceowner:id': 'org-1',
            'urn:zitadel:iam:user:resourceowner:name': 'ACME',
            'urn:zitadel:iam:user:resourceowner:primary_domain': 'acme.test'
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
            'urn:zitadel:iam:user:resourceowner:id': 'org-2',
            'urn:zitadel:iam:user:resourceowner:name': 'Beta'
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
})
