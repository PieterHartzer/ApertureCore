import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }))

vi.mock('node:dns/promises', () => ({ lookup, default: { lookup } }))

import { resolveDatabaseTarget } from '../../../server/utils/database-host-guard'

const BLOCKED = { allowed: false, reason: 'blocked' }

describe('resolveDatabaseTarget', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_PRIVATE_DATABASE_HOSTS', '')
    vi.stubEnv('APP_DATABASE_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    lookup.mockReset()
  })

  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.9', '192.168.1.1', '100.64.0.1', '0.0.0.0',
    '::1', 'fd12::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1'
  ])('blocks private address %s on a hosted deployment', async (host) => {
    await expect(resolveDatabaseTarget(host, 5432)).resolves.toEqual(BLOCKED)
  })

  it('blocks a name when any of its addresses is private', async () => {
    lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.5', family: 4 }])

    await expect(resolveDatabaseTarget('mixed.attacker.test', 5432)).resolves.toEqual(BLOCKED)
  })

  it('connects to the address it checked', async () => {
    lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }])

    await expect(resolveDatabaseTarget('db.example.com', 5432)).resolves.toEqual({
      allowed: true,
      connectAddress: '8.8.8.8'
    })
  })

  it('refuses a name that does not resolve', async () => {
    lookup.mockRejectedValue(new Error('ENOTFOUND'))

    await expect(resolveDatabaseTarget('missing.test', 5432)).resolves.toEqual({
      allowed: false,
      reason: 'unresolved'
    })
  })

  describe('when private networks are allowed', () => {
    beforeEach(() => {
      vi.stubEnv('ALLOW_PRIVATE_DATABASE_HOSTS', 'true')
    })

    it('allows private hosts and leaves the name to the driver', async () => {
      await expect(resolveDatabaseTarget('10.1.2.3', 5432)).resolves.toEqual({ allowed: true })
    })

    it('leaves unresolvable hosts for the driver to report', async () => {
      lookup.mockRejectedValue(new Error('ENOTFOUND'))

      await expect(resolveDatabaseTarget('missing.test', 5432)).resolves.toEqual({ allowed: true })
    })

    it.each(['169.254.169.254', 'fe80::1', '::ffff:169.254.169.254'])('still blocks metadata address %s', async (host) => {
      await expect(resolveDatabaseTarget(host, 5432)).resolves.toEqual(BLOCKED)
    })

    it('still blocks names that resolve to a metadata address', async () => {
      lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }, { address: '169.254.169.254', family: 4 }])

      await expect(resolveDatabaseTarget('metadata.attacker.test', 5432)).resolves.toEqual(BLOCKED)
    })

    it('still blocks the application database, on its port only', async () => {
      vi.stubEnv('APP_DATABASE_URL', 'postgres://user:pass@10.9.9.9:5432/app')

      await expect(resolveDatabaseTarget('10.9.9.9', 5432)).resolves.toEqual(BLOCKED)
      await expect(resolveDatabaseTarget('10.9.9.9', 3306)).resolves.toEqual({ allowed: true })
    })
  })

  it('treats development as a private network deployment', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    await expect(resolveDatabaseTarget('127.0.0.1', 5432)).resolves.toEqual({ allowed: true })
  })
})
