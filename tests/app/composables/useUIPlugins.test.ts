import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/components/plugins', () => ({
  DEFAULT_UI_PLUGINS: [{
    id: 'table',
    name: 'Table',
    description: 'Render rows in a table.',
    component: {},
    inputSchema: []
  }]
}))

const loadComposable = async () => {
  vi.resetModules()

  return (await import('../../../../app/composables/useUIPlugins'))
}

describe('useUIPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    const { resetUIPluginRegistryForTesting } = await import('../../../../app/composables/useUIPlugins')
    resetUIPluginRegistryForTesting()
  })

  it('registers default plugins once and supports custom plugins', async () => {
    const {
      useUIPlugins,
      resetUIPluginRegistryForTesting
    } = await loadComposable()

    resetUIPluginRegistryForTesting()

    const registry = useUIPlugins()

    expect(registry.getPlugins()).toEqual([{
      id: 'table',
      name: 'Table',
      description: 'Render rows in a table.',
      component: {},
      inputSchema: []
    }])

    registry.registerPlugin({
      id: 'stat-card',
      name: 'Stat card',
      description: 'Highlight a single metric.',
      component: {},
      inputSchema: []
    })

    expect(registry.getPlugin('stat-card')).toEqual({
      id: 'stat-card',
      name: 'Stat card',
      description: 'Highlight a single metric.',
      component: {},
      inputSchema: []
    })
  })

  it('can create an isolated registry for direct testing', async () => {
    const { createUIPluginRegistry } = await loadComposable()
    const registry = createUIPluginRegistry()

    registry.registerPlugin({
      id: 'line-chart',
      name: 'Line chart',
      component: {},
      inputSchema: []
    })

    expect(registry.getPlugins()).toEqual([{
      id: 'line-chart',
      name: 'Line chart',
      component: {},
      inputSchema: []
    }])
  })
})
