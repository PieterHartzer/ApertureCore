import { afterEach, describe, expect, it, vi } from 'vitest'
import component from '../../../app/view-models/pages/connections/new'
vi.mock('~/components/database/ConectionTestForm.vue', () => ({ default: { name: 'ConnectionTestForm' } }))
vi.mock('~/components/ui/AppLocaleSelect.vue', () => ({ default: {} }))
afterEach(() => vi.unstubAllGlobals())
describe('new database connection page', () => {
  it('retains the registered form and translated page labels', () => {
    vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
    const state = component.setup!({} as never, {} as never) as { t: (key: string) => string }
    expect(component.components?.ConectionTestForm).toBeDefined()
    expect(state.t('connections.new.title')).toBe('connections.new.title')

  })
})
