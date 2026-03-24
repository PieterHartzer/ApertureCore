import type { UIPluginDefinition } from '~/types/uiPlugin'

import { DEFAULT_UI_PLUGINS } from '~/components/plugins'

interface UIPluginRegistry {
  getPlugin: (id: string) => UIPluginDefinition | null
  getPlugins: () => UIPluginDefinition[]
  registerPlugin: (plugin: UIPluginDefinition) => void
}

export const createUIPluginRegistry = (
  initialPlugins: UIPluginDefinition[] = []
): UIPluginRegistry => {
  const plugins = new Map<string, UIPluginDefinition>()

  const registerPlugin = (plugin: UIPluginDefinition) => {
    plugins.set(plugin.id, plugin)
  }

  initialPlugins.forEach(registerPlugin)

  return {
    getPlugin: (id: string) => {
      return plugins.get(id) ?? null
    },
    getPlugins: () => {
      return [...plugins.values()]
    },
    registerPlugin
  }
}

let pluginRegistry = createUIPluginRegistry()
let defaultPluginsRegistered = false

const ensureDefaultPlugins = () => {
  if (defaultPluginsRegistered) {
    return
  }

  DEFAULT_UI_PLUGINS.forEach((plugin) => {
    pluginRegistry.registerPlugin(plugin)
  })

  defaultPluginsRegistered = true
}

export const resetUIPluginRegistryForTesting = () => {
  pluginRegistry = createUIPluginRegistry()
  defaultPluginsRegistered = false
}

export const useUIPlugins = () => {
  ensureDefaultPlugins()

  return pluginRegistry
}
