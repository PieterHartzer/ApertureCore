import { beforeEach, describe, expect, it, vi } from 'vitest'

const useRuntimeConfigMock = vi.fn()
const kyselyDestroyMocks: Array<ReturnType<typeof vi.fn>> = []
const poolInstance = {
  connect: vi.fn(),
  end: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  removeAllListeners: vi.fn(),
  getMaxPoolSize: vi.fn(),
  setMaxPoolSize: vi.fn(),
  getPoolQueueSize: vi.fn(),
  destroy: vi.fn(),
}
function MockPool() {
  return poolInstance
}
function MockKysely() {
  const destroy = vi.fn().mockResolvedValue(undefined)
  kyselyDestroyMocks.push(destroy)

  return {
    destroy
  }
}

vi.mock('#imports', () => ({
  useRuntimeConfig: useRuntimeConfigMock
}))

vi.mock('pg', () => {
  return {
    default: { Pool: MockPool },
    Pool: MockPool
  }
})

vi.mock('kysely', () => ({
  Kysely: MockKysely,
  PostgresDialect: vi.fn()
}))

describe('app database utility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    kyselyDestroyMocks.length = 0
    globalThis.__apertureCoreAppDatabase = undefined
    globalThis.__apertureCoreAppDatabaseUrl = undefined
  })

  it('throws when the app database URL is missing', async () => {
    useRuntimeConfigMock.mockReturnValue({
      appDatabaseUrl: ''
    })

    const { getAppDatabase } = await import('../../../server/utils/app-database')

    expect(() => getAppDatabase()).toThrowError('APP_DATABASE_URL is not configured.')
  })

  it('creates and caches a Kysely client for the configured URL', async () => {
    useRuntimeConfigMock.mockReturnValue({
      appDatabaseUrl: 'postgres://db-a'
    })

    const { getAppDatabase } = await import('../../../server/utils/app-database')

    const client = getAppDatabase()
    const client2 = getAppDatabase()

    expect(client).toBe(client2)
  })

  it('recreates the client and destroys the old one when the URL changes', async () => {
    useRuntimeConfigMock
      .mockReturnValueOnce({
        appDatabaseUrl: 'postgres://db-a'
      })
      .mockReturnValueOnce({
        appDatabaseUrl: 'postgres://db-b'
      })

    const { getAppDatabase } = await import('../../../server/utils/app-database')

    const firstClient = getAppDatabase()
    const secondClient = getAppDatabase()

    expect(firstClient).not.toBe(secondClient)
  })

  it('resets the cached client for tests', async () => {
    useRuntimeConfigMock.mockReturnValue({
      appDatabaseUrl: 'postgres://db-a'
    })

    const {
      getAppDatabase,
      resetAppDatabaseForTests
    } = await import('../../../server/utils/app-database')

    getAppDatabase()

    await resetAppDatabaseForTests()

    expect(kyselyDestroyMocks).toHaveLength(1)
    expect(kyselyDestroyMocks[0]).toHaveBeenCalledTimes(1)
    expect(globalThis.__apertureCoreAppDatabase).toBeUndefined()
    expect(globalThis.__apertureCoreAppDatabaseUrl).toBeUndefined()
  })

  it('can reset tests when no cached client exists', async () => {
    const { resetAppDatabaseForTests } = await import(
      '../../../server/utils/app-database'
    )

    await expect(resetAppDatabaseForTests()).resolves.toBeUndefined()
    expect(globalThis.__apertureCoreAppDatabase).toBeUndefined()
    expect(globalThis.__apertureCoreAppDatabaseUrl).toBeUndefined()
  })
})
