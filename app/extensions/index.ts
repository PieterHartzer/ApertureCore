import type { Component, ComputedRef, Ref } from 'vue'

export interface NavigationGroup {
  key: string
  label?: string
  items: Array<{ to: string, label: string, icon: string }>
}

export interface WidgetOption {
  label: string
  value: string
}

export type WidgetPickerItem = (WidgetOption & { trailingLabel?: string }) | { type: 'separator' | 'label', label?: string }

export interface DashboardBuilderExtension {
  arrangeWidgetOptions: (options: WidgetOption[]) => WidgetPickerItem[]
  blockReason: (request: {
    pluginId: string
    editingPluginId: string
    isEditing: boolean
    widgetCount: number
    /** The draft's settings, and the saved widget's (empty for a new widget). */
    pluginConfig: Record<string, unknown>
    savedPluginConfig: Record<string, unknown>
  }) => string
  fastestRefreshSeconds: ComputedRef<number>
  isEmbedBlocked: (isAlreadyEmbedded: boolean) => boolean
  refresh: () => Promise<void>
}

/**
 * Places where a layer built on top of this app can add to the interface. Core
 * runs unchanged when none are set. The use* hooks are called during setup, so
 * they may use composables. Assign them from a Nuxt plugin.
 */
export interface AppExtensions {
  slots: Record<string, Component[]>
  useNavigationGroups?: () => ComputedRef<NavigationGroup[]> | Ref<NavigationGroup[]>
  useDashboardBuilder?: () => DashboardBuilderExtension
  useConnectionCreationBlocked?: () => ComputedRef<boolean>
  canSaveDashboardStyle?: (style: Record<string, unknown>) => boolean
}

export const appExtensions: AppExtensions = {
  slots: {}
}

export const registerAppSlot = (name: string, component: Component) => {
  appExtensions.slots[name] = [...(appExtensions.slots[name] ?? []), component]
}
