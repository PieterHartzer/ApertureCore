import { computed, onMounted, reactive, watch } from 'vue'

export type WorkspacePanelId = 'prompt' | 'sql' | 'results'

const STORAGE_KEY = 'autodash.sqlEditor.layout.v2'
const COLLAPSED_PANEL_DEFAULTS: Record<WorkspacePanelId, boolean> = { prompt: false, sql: false, results: false }

export const clampPanelRatio = (ratio: number) => Math.min(0.8, Math.max(0.15, ratio))

export const useWorkspaceLayout = () => {
  const layout = reactive({
    promptRatio: 0.26,
    resultsRatio: 0.42,
    resultsBelow: true,
    collapsed: { ...COLLAPSED_PANEL_DEFAULTS }
  })

  const canCollapse = (panel: WorkspacePanelId) => {
    return (Object.keys(layout.collapsed) as WorkspacePanelId[]).some(other => other !== panel && !layout.collapsed[other])
  }

  const togglePanel = (panel: WorkspacePanelId) => {
    if (layout.collapsed[panel] || canCollapse(panel)) layout.collapsed[panel] = !layout.collapsed[panel]
  }

  const rightCollapsed = computed(() => layout.collapsed.sql && layout.collapsed.results)
  // Two collapsed bars stacked in a column would leave the column empty.
  const stackRight = computed(() => layout.resultsBelow && !rightCollapsed.value)

  onMounted(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')

      if (typeof saved.promptRatio === 'number') layout.promptRatio = clampPanelRatio(saved.promptRatio)
      if (typeof saved.resultsRatio === 'number') layout.resultsRatio = clampPanelRatio(saved.resultsRatio)
      if (typeof saved.resultsBelow === 'boolean') layout.resultsBelow = saved.resultsBelow
      for (const panel of Object.keys(COLLAPSED_PANEL_DEFAULTS) as WorkspacePanelId[]) {
        layout.collapsed[panel] = saved.collapsed?.[panel] === true
      }
    } catch {
      // A blocked or malformed saved layout falls back to the defaults.
    }

    watch(layout, () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
      } catch {
        // The layout still works for this visit without storage.
      }
    })
  })

  return { canCollapse, layout, rightCollapsed, stackRight, togglePanel }
}
