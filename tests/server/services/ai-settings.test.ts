import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AISettings } from '../../../shared/types/ai'
import { applyAISettingsAction, readAISettings, updateAISettings } from '../../../server/services/ai-settings'
import { encryptAICredentials, decryptAICredentials } from '../../../server/utils/ai-secrets'
const mocks = vi.hoisted(() => ({ db: vi.fn(), config: vi.fn() }))
vi.mock('../../../server/utils/app-database', () => ({ getAppDatabase: mocks.db }))
vi.mock('h3', () => ({ createError: (input: { statusMessage: string, statusCode: number }) => Object.assign(new Error(input.statusMessage), input) }))
vi.mock('#imports', () => ({ useRuntimeConfig: mocks.config }))
let settings: AISettings
let credentials: Record<string, string>
beforeEach(() => { settings = { connections: [], models: [] }; credentials = {}; mocks.config.mockReturnValue({ appDatabaseEncryptionKey: 'test-server-secret' }) })
const addConnection = () => applyAISettingsAction(settings, credentials, { action: 'connection', providerType: 'openai', name: 'My OpenAI', apiKey: 'test-key' })!
describe('AI settings mutations', () => {
  it('adds connections, keeps credentials out of public settings and retains stored keys during edits', () => {
    const id = addConnection()
    expect(credentials[id]).toBe('test-key')
    expect(JSON.stringify(settings)).not.toContain('test-key')
    applyAISettingsAction(settings, credentials, { action: 'connection', id, providerType: 'openai', name: 'Renamed' })
    expect(credentials[id]).toBe('test-key')
    expect(settings.connections[0]?.name).toBe('Renamed')
    expect(settings.connections[0]?.baseUrl).toBe('https://api.openai.com/v1')
  })
  it('validates credentials and prevents accidental browser-key persistence', () => {
    expect(() => applyAISettingsAction(settings, credentials, { action: 'connection', providerType: 'openai', name: 'No key' })).toThrow('API key is required')
    expect(() => applyAISettingsAction(settings, credentials, { action: 'connection', providerType: 'lmstudio', name: 'Local', baseUrl: 'http://localhost:1234/v1', apiKey: 'local-key' })).toThrow('browser session only')
  })
  it('adds multiple models without replacing default; switches default and selects a replacement on removal', () => {
    const id = addConnection()
    applyAISettingsAction(settings, credentials, { action: 'models', id, modelIds: ['gpt-4.1', 'gpt-4o'] })
    expect(settings.models.filter(model => model.isDefault)).toHaveLength(1)
    const second = settings.models[1]!.id
    applyAISettingsAction(settings, credentials, { action: 'default', id: second })
    applyAISettingsAction(settings, credentials, { action: 'models', id, modelIds: ['gpt-4.1-mini'] })
    expect(settings.models.find(model => model.isDefault)?.id).toBe(second)
    applyAISettingsAction(settings, credentials, { action: 'rename', id: second, name: 'Assistant' })
    expect(settings.models[1]?.displayName).toBe('Assistant')
    applyAISettingsAction(settings, credentials, { action: 'remove', id: second })
    expect(settings.models.filter(model => model.isDefault)).toHaveLength(1)
    applyAISettingsAction(settings, credentials, { action: 'removeConnection', id })
    expect(settings.models).toEqual([])
    expect(credentials).toEqual({})
  })
  it('rejects unknown model and connection references', () => {
    expect(() => applyAISettingsAction(settings, credentials, { action: 'default', id: 'other-user-model' })).toThrow('Model not found')
    expect(() => applyAISettingsAction(settings, credentials, { action: 'models', id: 'other-user-connection', modelIds: ['gpt-4.1'] })).toThrow('Connection not found')
  })
})
describe('AI storage and encryption', () => {
  it('encrypts with randomized authenticated encryption and rejects a different server key', () => {
    const encrypted = encryptAICredentials({ connection: 'secret-key' })
    expect(encrypted).not.toContain('secret-key')
    expect(encryptAICredentials({ connection: 'secret-key' })).not.toBe(encrypted)
    expect(decryptAICredentials(encrypted)).toEqual({ connection: 'secret-key' })
    mocks.config.mockReturnValue({ appDatabaseEncryptionKey: 'wrong-key' })
    expect(() => decryptAICredentials(encrypted)).toThrow()
    mocks.config.mockReturnValue({ appDatabaseEncryptionKey: '' })
    expect(() => encryptAICredentials({})).toThrow('APP_DATABASE_ENCRYPTION_KEY')
  })
  it('scopes reads and transactional writes to both authenticated organization and user', async () => {
    const id = addConnection()
    applyAISettingsAction(settings, credentials, { action: 'models', id, modelIds: ['gpt-4.1'] })
    const row = { settings, encrypted_credentials: encryptAICredentials(credentials) }
    const query = { selectAll: vi.fn(), where: vi.fn(), executeTakeFirst: vi.fn().mockResolvedValue(row), forUpdate: vi.fn(), executeTakeFirstOrThrow: vi.fn().mockResolvedValue(row), values: vi.fn(), onConflict: vi.fn(), execute: vi.fn(), set: vi.fn() }
    for (const name of ['selectAll', 'where', 'forUpdate', 'values', 'onConflict', 'set'] as const) query[name].mockReturnValue(query)
    const db = { selectFrom: vi.fn().mockReturnValue(query), insertInto: vi.fn().mockReturnValue(query), updateTable: vi.fn().mockReturnValue(query), transaction: () => ({ execute: (callback: (value: unknown) => unknown) => callback(db) }) }
    mocks.db.mockReturnValue(db)
    const owner = { organizationId: 'org-a', organizationName: 'A', userId: 'user-a' }
    expect((await readAISettings(owner)).credentials[id]).toBe('test-key')
    await updateAISettings(owner, { action: 'rename', id: settings.models[0]!.id, name: 'Stored assistant' })
    expect(query.where).toHaveBeenCalledWith('organization_id', '=', 'org-a')
    expect(query.where).toHaveBeenCalledWith('user_id', '=', 'user-a')
    expect(query.forUpdate).toHaveBeenCalled()
    expect(query.set.mock.calls[0]?.[0].settings.models[0].displayName).toBe('Stored assistant')
    expect(JSON.stringify(query.set.mock.calls[0]?.[0])).not.toContain('test-key')
  })
})
