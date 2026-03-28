<script setup lang="ts">
import DeleteDashboardDialog from '~/components/dashboard/DeleteDashboardDialog.vue'
import WidgetGrid from '~/components/dashboard/WidgetGrid.vue'
import PluginRenderer from '~/components/dashboard/PluginRenderer.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useDashboardQueryResults } from '~/composables/dashboard/useDashboardQueryResults'
import { useDashboards } from '~/composables/dashboard/useDashboards'
import { useSavedSqlQueries } from '~/composables/database/useSavedSqlQueries'
import { useNotifications } from '~/composables/ui/useNotifications'
import { useUIPlugins } from '~/composables/useUIPlugins'
import type {
  DashboardCreateInput,
  DashboardDetails,
  DashboardSummary
} from '~/types/dashboards'
import {
  createEmptyDashboardCreateInput,
  toDashboardSaveInput
} from '~/types/dashboards'
import type {
  DashboardWidget,
  DashboardWidgetDraft,
  DashboardWidgetLayoutUpdate,
  DashboardWidgetPluginConfigPrimitive
} from '~/types/dashboard-widgets'
import {
  createDashboardWidget,
  createDashboardWidgetDraftFromWidget,
  createEmptyDashboardWidgetDraft,
  isDashboardWidgetPluginConfigComplete,
  normalizeDashboardWidgetPluginConfig,
  updateDashboardWidget,
  updateDashboardWidgetLayout
} from '~/types/dashboard-widgets'
import type { SavedSqlQuerySummary } from '~/types/saved-sql-queries'
import {
  buildUIPluginFieldOptions,
  filterUIPluginFieldOptions,
  getUIPluginInputSelectionMode,
  getUIPluginInputSource,
  type PluginInputDefinition,
  type PluginInputOptionValue
} from '~/types/uiPlugin'
import { translateMessage } from '~/utils/translateMessage'

const DASHBOARD_REFRESH_TICK_MS = 5000
const DASHBOARD_LAYOUT_SAVE_DEBOUNCE_MS = 800
const WIDGET_REFRESH_INTERVAL_OPTIONS = [15, 30, 60, 300]

const { t, te } = useI18n()
const { success, error } = useNotifications()
const requestFetch = import.meta.server
  ? useRequestFetch()
  : $fetch
const requestUrl = useRequestURL()
const { listQueries } = useSavedSqlQueries(requestFetch)
const {
  createDashboard: createDashboardRequest,
  deleteDashboard: deleteDashboardRequest,
  getDashboard,
  listDashboards,
  saveDashboard: saveDashboardRequest
} = useDashboards(requestFetch)
const { getPlugin, getPlugins } = useUIPlugins()
const queryResults = useDashboardQueryResults()

const draft = ref<DashboardWidgetDraft>(createEmptyDashboardWidgetDraft())
const dashboards = ref<DashboardSummary[]>([])
const selectedDashboard = ref<DashboardDetails | null>(null)
const selectedDashboardId = ref('')
const dashboardListStatus = ref<'pending' | 'success' | 'error'>('pending')
const dashboardListErrorMessage = ref('')
const dashboardStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
const dashboardErrorMessage = ref('')
const dashboardSaveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const dashboardSaveErrorMessage = ref('')
const isDashboardEditing = ref(false)
const isWidgetBuilderOpen = ref(false)
const isCreateDashboardOpen = ref(false)
const isDashboardSettingsOpen = ref(false)
const isDeleteDashboardOpen = ref(false)
const isCreatingDashboard = ref(false)
const isSavingDashboardSettings = ref(false)
const isDeletingDashboard = ref(false)
const editingWidgetId = ref<string | null>(null)
const previewStateKey = ref('')
const createDashboardInput = ref<DashboardCreateInput>(
  createEmptyDashboardCreateInput()
)
const createDashboardErrorMessage = ref('')
const dashboardSettingsInput = ref({
  dashboardName: '',
  embedEnabled: false
})
const dashboardSettingsErrorMessage = ref('')
const deleteDashboardErrorMessage = ref('')

let refreshTimer: ReturnType<typeof setInterval> | null = null
let scheduledDashboardSave: ReturnType<typeof setTimeout> | null = null
let dashboardSavePromise: Promise<boolean> | null = null
let dashboardSaveQueued = false

type PluginInputSelectValue = Exclude<
  DashboardWidgetPluginConfigPrimitive,
  null
>

interface PluginInputSelectOption {
  label: string
  value: PluginInputOptionValue
}

const { data: queryListResponse, status: queryListStatus } = await useAsyncData(
  'dashboard-saved-sql-queries',
  listQueries
)

const queries = computed<SavedSqlQuerySummary[]>(() => {
  return queryListResponse.value?.ok
    ? queryListResponse.value.queries ?? []
    : []
})

const queryLookup = computed(() => {
  return new Map(queries.value.map((query) => [query.id, query]))
})

const pluginDefinitions = computed(() => getPlugins())

const widgets = computed(() => {
  return selectedDashboard.value?.widgets ?? []
})

const hasSelectedDashboard = computed(() => {
  return selectedDashboard.value !== null
})

const selectedDashboardName = computed(() => {
  return selectedDashboard.value?.dashboardName ?? ''
})

const dashboardSelectOptions = computed(() => {
  return dashboards.value.map((dashboard) => ({
    label: t('pages.dashboard.selector.option', {
      dashboardName: dashboard.dashboardName,
      widgetCount: dashboard.widgetCount
    }),
    value: dashboard.id
  }))
})

const queryOptions = computed(() => {
  return queries.value.map((query) => ({
    label: t('pages.dashboard.builder.fields.query.option', {
      queryName: query.queryName,
      connectionName: query.connectionName
    }),
    value: query.id
  }))
})

const pluginOptions = computed(() => {
  return pluginDefinitions.value.map((plugin) => ({
    label: getPluginDefinitionName(plugin),
    value: plugin.id
  }))
})

const refreshIntervalOptions = computed(() => {
  return WIDGET_REFRESH_INTERVAL_OPTIONS.map((intervalSeconds) => ({
    label: t('pages.dashboard.builder.refresh.option', {
      seconds: intervalSeconds
    }),
    value: intervalSeconds
  }))
})

const selectedQuery = computed(() => {
  return queryLookup.value.get(draft.value.queryId) ?? null
})

const selectedPlugin = computed(() => {
  return draft.value.pluginId
    ? getPlugin(draft.value.pluginId)
    : null
})

const editingWidget = computed(() => {
  if (!editingWidgetId.value) {
    return null
  }

  return widgets.value.find((widget) => widget.id === editingWidgetId.value) ?? null
})

const isEditingWidget = computed(() => editingWidget.value !== null)

const previewTarget = computed(() => {
  if (!selectedQuery.value) {
    return null
  }

  return {
    queryId: selectedQuery.value.id,
    connectionId: selectedQuery.value.connectionId,
    refreshIntervalMs: draft.value.refreshIntervalSeconds * 1000
  }
})

const previewState = computed(() => {
  return previewTarget.value
    ? queryResults.getState(previewTarget.value)
    : null
})

const previewFieldOptions = computed(() => {
  if (!previewState.value) {
    return []
  }

  return buildUIPluginFieldOptions(
    previewState.value.columns,
    previewState.value.rows
  )
})

const queryListErrorMessage = computed(() => {
  if (!queryListResponse.value || queryListResponse.value.ok) {
    return ''
  }

  return translateMessage(
    t,
    queryListResponse.value.messageKey,
    'queries.list.errors.unexpected'
  )
})

const previewErrorMessage = computed(() => {
  if (!previewState.value?.errorMessage) {
    return ''
  }

  return translateMessage(
    t,
    previewState.value.errorMessageKey,
    'queries.run.errors.unexpected'
  )
})

const selectedPluginDescription = computed(() => {
  if (!selectedPlugin.value) {
    return ''
  }

  return getPluginDefinitionDescription(selectedPlugin.value)
})

const submitWidgetDisabled = computed(() => {
  return (
    !hasSelectedDashboard.value ||
    !selectedQuery.value ||
    !selectedPlugin.value ||
    previewState.value?.status !== 'success' ||
    !isDashboardWidgetPluginConfigComplete(
      selectedPlugin.value,
      draft.value.pluginConfig
    )
  )
})

const builderTitle = computed(() => {
  return isEditingWidget.value
    ? t('pages.dashboard.builder.editTitle')
    : t('pages.dashboard.builder.title')
})

const builderDescription = computed(() => {
  return isEditingWidget.value
    ? t('pages.dashboard.builder.editDescription')
    : t('pages.dashboard.builder.description')
})

const submitWidgetActionLabel = computed(() => {
  return isEditingWidget.value
    ? t('pages.dashboard.builder.actions.save')
    : t('pages.dashboard.builder.actions.add')
})

const submitWidgetActionIcon = computed(() => {
  return isEditingWidget.value
    ? 'i-lucide-save'
    : 'i-lucide-plus'
})

const dashboardEditActionLabel = computed(() => {
  return isDashboardEditing.value
    ? t('pages.dashboard.widgets.actions.doneEditing')
    : t('pages.dashboard.widgets.actions.editDashboard')
})

const widgetTargets = computed(() => {
  return widgets.value.flatMap((widget) => {
    const query = queryLookup.value.get(widget.queryId)

    if (!query) {
      return []
    }

    return [{
      connectionId: query.connectionId,
      queryId: widget.queryId,
      refreshIntervalMs: widget.refreshIntervalSeconds * 1000
    }]
  })
})

const dashboardSaveStatusMessage = computed(() => {
  if (!hasSelectedDashboard.value) {
    return ''
  }

  if (dashboardSaveState.value === 'saving') {
    return t('pages.dashboard.status.saving')
  }

  if (dashboardSaveState.value === 'error') {
    return dashboardSaveErrorMessage.value
  }

  if (dashboardSaveState.value === 'saved') {
    return t('pages.dashboard.status.saved')
  }

  return t('pages.dashboard.status.ready')
})

const dashboardEmbedUrl = computed(() => {
  if (!selectedDashboard.value) {
    return ''
  }

  return new URL(
    `/embed/dashboard/${selectedDashboard.value.embedId}`,
    requestUrl.origin
  ).toString()
})

const getPluginLabel = (pluginId: string) => {
  const plugin = getPlugin(pluginId)

  if (!plugin) {
    return pluginId
  }

  return getPluginDefinitionName(plugin)
}

const getPluginDefinitionName = (
  plugin: {
    id: string
    name: string
    nameKey?: string
  }
) => {
  if (plugin.nameKey && te(plugin.nameKey)) {
    return t(plugin.nameKey)
  }

  if (te(`pages.dashboard.plugins.${plugin.id}.name`)) {
    return t(`pages.dashboard.plugins.${plugin.id}.name`)
  }

  return plugin.name
}

const getPluginDefinitionDescription = (
  plugin: {
    id: string
    description?: string
    descriptionKey?: string
  }
) => {
  if (plugin.descriptionKey && te(plugin.descriptionKey)) {
    return t(plugin.descriptionKey)
  }

  if (te(`pages.dashboard.plugins.${plugin.id}.description`)) {
    return t(`pages.dashboard.plugins.${plugin.id}.description`)
  }

  return plugin.description ?? ''
}

const getPluginInputLabel = (input: PluginInputDefinition) => {
  if (input.labelKey && te(input.labelKey)) {
    return t(input.labelKey)
  }

  return input.label
}

const getPluginInputDescription = (input: PluginInputDefinition) => {
  if (input.descriptionKey && te(input.descriptionKey)) {
    return t(input.descriptionKey)
  }

  return input.description
}

const getPluginInputOptionLabel = (
  option: {
    label: string
    labelKey?: string
  }
) => {
  if (option.labelKey && te(option.labelKey)) {
    return t(option.labelKey)
  }

  return option.label
}

const getWidgetQuery = (widget: DashboardWidget) => {
  return queryLookup.value.get(widget.queryId) ?? null
}

const getWidgetState = (widget: DashboardWidget) => {
  const query = getWidgetQuery(widget)

  if (!query) {
    return null
  }

  return queryResults.getState({
    connectionId: query.connectionId,
    queryId: widget.queryId,
    refreshIntervalMs: widget.refreshIntervalSeconds * 1000
  })
}

const getWidgetErrorMessage = (widget: DashboardWidget) => {
  const state = getWidgetState(widget)

  if (!state?.errorMessage) {
    return ''
  }

  return translateMessage(
    t,
    state.errorMessageKey,
    'queries.run.errors.unexpected'
  )
}

const isWidgetRefreshing = (widget: DashboardWidget) => {
  const state = getWidgetState(widget)

  return state?.status === 'success' && state.isRefreshing === true
}

const getWidgetInlineErrorMessage = (widget: DashboardWidget) => {
  const state = getWidgetState(widget)

  if (!state?.errorMessage || state.status !== 'success') {
    return ''
  }

  return getWidgetErrorMessage(widget)
}

const getPluginInputOptions = (
  input: PluginInputDefinition
): PluginInputSelectOption[] => {
  if (getUIPluginInputSource(input) === 'option') {
    return (input.options ?? []).map((option) => ({
      label: getPluginInputOptionLabel(option),
      value: option.value
    }))
  }

  return filterUIPluginFieldOptions(input, previewFieldOptions.value).map((fieldOption) => ({
    label: t('pages.dashboard.builder.mapping.option', {
      field: fieldOption.label,
      type: t(`pages.dashboard.builder.mapping.types.${fieldOption.fieldType}`)
    }),
    value: fieldOption.value
  }))
}

const getDraftPluginConfigValue = (inputKey: string) => {
  const value = draft.value.pluginConfig[inputKey]

  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    ? value
    : undefined
}

const getDraftPluginConfigValues = (inputKey: string) => {
  const value = draft.value.pluginConfig[inputKey]

  return Array.isArray(value)
    ? value.filter((item): item is PluginInputSelectValue => {
        return (
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean'
        )
      })
    : []
}

const setDraftPluginConfigValue = (
  inputKey: string,
  value: PluginInputSelectValue | undefined
) => {
  draft.value.pluginConfig[inputKey] = value ?? ''
}

const setDraftPluginConfigValues = (
  inputKey: string,
  value: PluginInputSelectValue[] | undefined
) => {
  draft.value.pluginConfig[inputKey] = value ?? []
}

const syncDraftPluginConfig = () => {
  const normalizedConfig = normalizeDashboardWidgetPluginConfig(
    selectedPlugin.value,
    draft.value.pluginConfig
  )

  if (selectedPlugin.value) {
    selectedPlugin.value.inputSchema.forEach((input) => {
      const allowedValues = new Set(
        getPluginInputOptions(input).map((option) => option.value)
      )
      const value = normalizedConfig[input.key]
      const shouldValidateSelection = (
        getUIPluginInputSource(input) === 'option' ||
        allowedValues.size > 0
      )

      if (getUIPluginInputSelectionMode(input) === 'multiple') {
        if (!Array.isArray(value)) {
          normalizedConfig[input.key] = []
          return
        }

        if (!shouldValidateSelection) {
          return
        }

        normalizedConfig[input.key] = value.filter((selectedValue) => {
          return allowedValues.has(selectedValue)
        })

        return
      }

      if (
        shouldValidateSelection &&
        (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) &&
        !allowedValues.has(value)
      ) {
        normalizedConfig[input.key] = null
      }
    })
  }

  draft.value.pluginConfig = normalizedConfig
}

const loadPreviewQuery = async (force = false) => {
  if (!previewTarget.value) {
    previewStateKey.value = ''
    return
  }

  previewStateKey.value = previewTarget.value.queryId
  await queryResults.load(previewTarget.value, {
    force
  })
}

const refreshWidgets = async (force = false) => {
  if (widgetTargets.value.length === 0) {
    return
  }

  if (force) {
    await Promise.all(
      widgetTargets.value.map((target) => queryResults.load(target, {
        force: true
      }))
    )
    return
  }

  await queryResults.refreshStale(widgetTargets.value)
}

const sortDashboards = (items: DashboardSummary[]) => {
  return [...items].sort((left, right) => {
    return left.dashboardName.localeCompare(right.dashboardName, undefined, {
      sensitivity: 'base'
    })
  })
}

const mapDashboardSummary = (dashboard: DashboardDetails): DashboardSummary => ({
  id: dashboard.id,
  dashboardName: dashboard.dashboardName,
  embedId: dashboard.embedId,
  embedEnabled: dashboard.embedEnabled,
  widgetCount: dashboard.widgets.length,
  createdAt: dashboard.createdAt,
  updatedAt: dashboard.updatedAt
})

const upsertDashboardSummary = (dashboard: DashboardDetails) => {
  const nextSummary = mapDashboardSummary(dashboard)
  const existingIndex = dashboards.value.findIndex((item) => item.id === dashboard.id)

  dashboards.value = sortDashboards(
    existingIndex >= 0
      ? dashboards.value.map((item, index) => {
          return index === existingIndex
            ? nextSummary
            : item
        })
      : [...dashboards.value, nextSummary]
  )
}

const resetDraft = () => {
  editingWidgetId.value = null
  draft.value = createEmptyDashboardWidgetDraft()
  draft.value.dashboardId = selectedDashboard.value?.id ?? ''
}

const setSelectedDashboardWidgets = (nextWidgets: DashboardWidget[]) => {
  if (!selectedDashboard.value) {
    return
  }

  selectedDashboard.value = {
    ...selectedDashboard.value,
    widgets: nextWidgets,
    widgetCount: nextWidgets.length
  }
  upsertDashboardSummary(selectedDashboard.value)
}

const refreshDashboardList = async () => {
  dashboardListStatus.value = 'pending'
  dashboardListErrorMessage.value = ''

  const response = await listDashboards()

  if (response.ok) {
    dashboards.value = sortDashboards(response.dashboards ?? [])
    dashboardListStatus.value = 'success'
    return true
  }

  dashboardListStatus.value = 'error'
  dashboardListErrorMessage.value = translateMessage(
    t,
    response.messageKey,
    'dashboards.list.errors.unexpected'
  )

  return false
}

const loadSelectedDashboard = async (dashboardId: string) => {
  dashboardStatus.value = 'pending'
  dashboardErrorMessage.value = ''

  const response = await getDashboard(dashboardId)

  if (response.ok && response.dashboard) {
    selectedDashboard.value = response.dashboard
    selectedDashboardId.value = response.dashboard.id
    dashboardStatus.value = 'success'
    dashboardSaveState.value = 'idle'
    dashboardSaveErrorMessage.value = ''
    resetDraft()
    return true
  }

  dashboardStatus.value = 'error'
  dashboardErrorMessage.value = translateMessage(
    t,
    response.messageKey,
    'dashboards.get.errors.unexpected'
  )

  return false
}

const initializeDashboards = async () => {
  const loadedList = await refreshDashboardList()

  if (!loadedList || dashboards.value.length === 0) {
    selectedDashboard.value = null
    selectedDashboardId.value = ''
    dashboardStatus.value = dashboards.value.length === 0
      ? 'idle'
      : 'error'
    resetDraft()
    return
  }

  const firstDashboard = dashboards.value[0]

  if (!firstDashboard) {
    return
  }

  await loadSelectedDashboard(firstDashboard.id)
}

const persistDashboard = async (
  dashboardSnapshot: DashboardDetails,
  options: {
    notifyError?: boolean
  } = {}
) => {
  if (scheduledDashboardSave) {
    clearTimeout(scheduledDashboardSave)
    scheduledDashboardSave = null
  }

  if (dashboardSavePromise) {
    dashboardSaveQueued = true
    return dashboardSavePromise
  }

  dashboardSaveState.value = 'saving'
  dashboardSaveErrorMessage.value = ''

  dashboardSavePromise = (async () => {
    const response = await saveDashboardRequest(
      dashboardSnapshot.id,
      toDashboardSaveInput(dashboardSnapshot)
    )

    if (response.ok && response.dashboard) {
      upsertDashboardSummary(response.dashboard)

      if (selectedDashboard.value?.id === response.dashboard.id) {
        selectedDashboard.value = response.dashboard
        selectedDashboardId.value = response.dashboard.id
      }

      dashboardSaveState.value = 'saved'
      dashboardSaveErrorMessage.value = ''
      return true
    }

    const message = translateMessage(
      t,
      response.messageKey,
      'dashboards.save.errors.unexpected'
    )

    dashboardSaveState.value = 'error'
    dashboardSaveErrorMessage.value = message

    if (options.notifyError !== false) {
      error(
        message,
        t('pages.dashboard.notifications.saveErrorTitle')
      )
    }

    return false
  })()

  const result = await dashboardSavePromise

  dashboardSavePromise = null

  if (dashboardSaveQueued) {
    dashboardSaveQueued = false

    if (selectedDashboard.value) {
      void persistDashboard(selectedDashboard.value, {
        notifyError: false
      })
    }
  }

  return result
}

const scheduleDashboardSave = () => {
  if (!selectedDashboard.value) {
    return
  }

  if (scheduledDashboardSave) {
    clearTimeout(scheduledDashboardSave)
  }

  scheduledDashboardSave = setTimeout(() => {
    scheduledDashboardSave = null

    if (selectedDashboard.value) {
      void persistDashboard(selectedDashboard.value, {
        notifyError: false
      })
    }
  }, DASHBOARD_LAYOUT_SAVE_DEBOUNCE_MS)
}

const waitForPendingDashboardSave = async () => {
  await flushScheduledDashboardSave()

  if (dashboardSavePromise) {
    await dashboardSavePromise
  }
}

const flushScheduledDashboardSave = async () => {
  if (!scheduledDashboardSave || !selectedDashboard.value) {
    return
  }

  clearTimeout(scheduledDashboardSave)
  scheduledDashboardSave = null

  await persistDashboard(selectedDashboard.value, {
    notifyError: false
  })
}

const openWidgetBuilder = () => {
  if (!isDashboardEditing.value || !selectedDashboard.value) {
    return
  }

  resetDraft()
  isWidgetBuilderOpen.value = true
}

const onBuilderOpenChange = (open: boolean) => {
  isWidgetBuilderOpen.value = open
}

const onEditWidget = (widget: DashboardWidget) => {
  if (!isDashboardEditing.value) {
    return
  }

  editingWidgetId.value = widget.id
  draft.value = createDashboardWidgetDraftFromWidget(widget)
  draft.value.dashboardId = selectedDashboard.value?.id ?? ''
  isWidgetBuilderOpen.value = true
}

const onCancelEditingWidget = () => {
  isWidgetBuilderOpen.value = false
}

const onToggleDashboardEditing = () => {
  if (!selectedDashboard.value) {
    return
  }

  isDashboardEditing.value = !isDashboardEditing.value

  if (!isDashboardEditing.value) {
    isWidgetBuilderOpen.value = false
  }
}

const onSubmitWidget = async () => {
  if (
    submitWidgetDisabled.value ||
    !selectedPlugin.value ||
    !selectedQuery.value ||
    !selectedDashboard.value
  ) {
    return
  }

  await loadPreviewQuery()

  const defaultTitle = t('pages.dashboard.builder.defaultTitle', {
    queryName: selectedQuery.value.queryName,
    pluginName: getPluginLabel(selectedPlugin.value.id)
  })

  const normalizedDraft: DashboardWidgetDraft = {
    ...draft.value,
    dashboardId: selectedDashboard.value.id,
    pluginConfig: normalizeDashboardWidgetPluginConfig(
      selectedPlugin.value,
      draft.value.pluginConfig
    ),
    title: draft.value.title.trim() || defaultTitle
  }

  const nextWidgets = editingWidget.value
    ? widgets.value.map((widget) => {
        return widget.id === editingWidget.value?.id
          ? updateDashboardWidget(widget, normalizedDraft)
          : widget
      })
    : [
        ...widgets.value,
        createDashboardWidget(normalizedDraft)
      ]

  setSelectedDashboardWidgets(nextWidgets)

  isWidgetBuilderOpen.value = false
  resetDraft()
  await refreshWidgets()

  if (selectedDashboard.value) {
    await persistDashboard(selectedDashboard.value)
  }
}

const onRemoveWidget = async (widgetId: string) => {
  if (!selectedDashboard.value) {
    return
  }

  if (editingWidgetId.value === widgetId) {
    isWidgetBuilderOpen.value = false
    resetDraft()
  }

  setSelectedDashboardWidgets(
    widgets.value.filter((widget) => widget.id !== widgetId)
  )

  await persistDashboard(selectedDashboard.value)
}

const onWidgetLayoutChange = (
  updates: DashboardWidgetLayoutUpdate[]
) => {
  if (updates.length === 0 || !selectedDashboard.value) {
    return
  }

  const layoutUpdates = new Map(
    updates.map((update) => [update.widgetId, update.layout])
  )

  setSelectedDashboardWidgets(
    widgets.value.map((widget) => {
      const nextLayout = layoutUpdates.get(widget.id)

      return nextLayout
        ? updateDashboardWidgetLayout(widget, nextLayout)
        : widget
    })
  )

  scheduleDashboardSave()
}

const onRefreshWidget = async (widget: DashboardWidget) => {
  const query = getWidgetQuery(widget)

  if (!query) {
    return
  }

  await queryResults.load({
    connectionId: query.connectionId,
    queryId: widget.queryId,
    refreshIntervalMs: widget.refreshIntervalSeconds * 1000
  }, {
    force: true
  })
}

const onDashboardSelectionChange = async (dashboardId: string | undefined) => {
  if (!dashboardId || dashboardId === selectedDashboardId.value) {
    return
  }

  await waitForPendingDashboardSave()

  const previousDashboard = selectedDashboard.value
  const previousDashboardId = selectedDashboardId.value
  const loaded = await loadSelectedDashboard(dashboardId)

  if (!loaded) {
    selectedDashboard.value = previousDashboard
    selectedDashboardId.value = previousDashboardId
    dashboardStatus.value = previousDashboard ? 'success' : 'error'

    error(
      dashboardErrorMessage.value || t('dashboards.get.errors.unexpected'),
      t('pages.dashboard.notifications.loadErrorTitle')
    )
  }
}

const openCreateDashboardDialog = () => {
  createDashboardInput.value = createEmptyDashboardCreateInput()
  createDashboardErrorMessage.value = ''
  isCreateDashboardOpen.value = true
}

const onCreateDashboardOpenChange = (open: boolean) => {
  isCreateDashboardOpen.value = open

  if (!open) {
    createDashboardInput.value = createEmptyDashboardCreateInput()
    createDashboardErrorMessage.value = ''
  }
}

const onCreateDashboard = async () => {
  if (!createDashboardInput.value.dashboardName.trim()) {
    createDashboardErrorMessage.value = t(
      'dashboards.create.errors.dashboardNameRequired'
    )
    return
  }

  isCreatingDashboard.value = true
  createDashboardErrorMessage.value = ''

  try {
    const response = await createDashboardRequest({
      dashboardName: createDashboardInput.value.dashboardName.trim()
    })

    if (response.ok && response.dashboard) {
      upsertDashboardSummary(response.dashboard)
      selectedDashboard.value = response.dashboard
      selectedDashboardId.value = response.dashboard.id
      dashboardStatus.value = 'success'
      isCreateDashboardOpen.value = false
      isDashboardEditing.value = true
      resetDraft()
      success(
        translateMessage(
          t,
          response.messageKey,
          'dashboards.create.success'
        ),
        t('pages.dashboard.notifications.createSuccessTitle')
      )
      return
    }

    createDashboardErrorMessage.value = translateMessage(
      t,
      response.messageKey,
      'dashboards.create.errors.unexpected'
    )
  } finally {
    isCreatingDashboard.value = false
  }
}

const openDashboardSettings = () => {
  if (!selectedDashboard.value) {
    return
  }

  dashboardSettingsInput.value = {
    dashboardName: selectedDashboard.value.dashboardName,
    embedEnabled: selectedDashboard.value.embedEnabled
  }
  dashboardSettingsErrorMessage.value = ''
  isDashboardSettingsOpen.value = true
}

const onDashboardSettingsOpenChange = (open: boolean) => {
  isDashboardSettingsOpen.value = open

  if (!open) {
    dashboardSettingsErrorMessage.value = ''
    if (!isDeletingDashboard.value) {
      isDeleteDashboardOpen.value = false
      deleteDashboardErrorMessage.value = ''
    }
  }
}

const openDeleteDashboardDialog = () => {
  if (!selectedDashboard.value) {
    return
  }

  deleteDashboardErrorMessage.value = ''
  isDeleteDashboardOpen.value = true
}

const onDeleteDashboardOpenChange = (open: boolean) => {
  if (isDeletingDashboard.value && !open) {
    return
  }

  isDeleteDashboardOpen.value = open

  if (!open) {
    deleteDashboardErrorMessage.value = ''
  }
}

const onSaveDashboardSettings = async () => {
  if (!selectedDashboard.value) {
    return
  }

  const dashboardName = dashboardSettingsInput.value.dashboardName.trim()

  if (!dashboardName) {
    dashboardSettingsErrorMessage.value = t(
      'dashboards.save.errors.dashboardNameRequired'
    )
    return
  }

  isSavingDashboardSettings.value = true
  dashboardSettingsErrorMessage.value = ''

  try {
    const nextDashboard: DashboardDetails = {
      ...selectedDashboard.value,
      dashboardName,
      embedEnabled: dashboardSettingsInput.value.embedEnabled
    }

    const saved = await persistDashboard(nextDashboard, {
      notifyError: false
    })

    if (saved) {
      isDashboardSettingsOpen.value = false
      success(
        t('dashboards.save.success'),
        t('pages.dashboard.notifications.settingsSavedTitle')
      )
      return
    }

    dashboardSettingsErrorMessage.value = dashboardSaveErrorMessage.value
  } finally {
    isSavingDashboardSettings.value = false
  }
}

const onDeleteDashboard = async (
  payload: {
    confirmationName: string
  }
) => {
  if (!selectedDashboard.value) {
    return
  }

  const dashboardId = selectedDashboard.value.id
  const remainingDashboards = dashboards.value.filter((dashboard) => {
    return dashboard.id !== dashboardId
  })
  const nextDashboardId = remainingDashboards[0]?.id ?? ''

  isDeletingDashboard.value = true
  deleteDashboardErrorMessage.value = ''

  try {
    await waitForPendingDashboardSave()

    const response = await deleteDashboardRequest(dashboardId, {
      confirmationName: payload.confirmationName
    })

    if (response.ok) {
      dashboards.value = remainingDashboards
      isDeleteDashboardOpen.value = false
      isDashboardSettingsOpen.value = false
      isWidgetBuilderOpen.value = false
      isDashboardEditing.value = false
      dashboardSaveState.value = 'idle'
      dashboardSaveErrorMessage.value = ''
      dashboardSettingsErrorMessage.value = ''
      dashboardErrorMessage.value = ''
      selectedDashboard.value = null
      selectedDashboardId.value = ''

      if (nextDashboardId) {
        await loadSelectedDashboard(nextDashboardId)
      } else {
        dashboardStatus.value = 'idle'
        resetDraft()
      }

      success(
        t('dashboards.delete.success'),
        t('pages.dashboard.notifications.deleteSuccessTitle')
      )
      return
    }

    deleteDashboardErrorMessage.value = translateMessage(
      t,
      response.messageKey,
      'dashboards.delete.errors.unexpected'
    )
  } finally {
    isDeletingDashboard.value = false
  }
}

const onCopyEmbedUrl = async () => {
  if (
    !dashboardEmbedUrl.value ||
    !selectedDashboard.value?.embedEnabled ||
    !import.meta.client ||
    !navigator.clipboard
  ) {
    return
  }

  await navigator.clipboard.writeText(dashboardEmbedUrl.value)
  success(
    t('pages.dashboard.selector.embed.copied'),
    t('pages.dashboard.notifications.embedCopiedTitle')
  )
}

watch(
  isWidgetBuilderOpen,
  (open) => {
    if (!open) {
      resetDraft()
    }
  }
)

watch(
  previewTarget,
  async () => {
    await loadPreviewQuery()
  },
  {
    immediate: true
  }
)

watch(
  editingWidget,
  (widget) => {
    if (editingWidgetId.value && !widget) {
      isWidgetBuilderOpen.value = false
      resetDraft()
    }
  }
)

watch(
  () => [
    selectedPlugin.value?.id ?? '',
    previewFieldOptions.value.map((field) => field.value).join('|')
  ],
  () => {
    syncDraftPluginConfig()
  },
  {
    immediate: true
  }
)

watch(
  () => widgetTargets.value.map((target) => {
    return `${target.queryId}:${target.refreshIntervalMs ?? ''}`
  }).join('|'),
  async () => {
    await refreshWidgets()
  },
  {
    immediate: true
  }
)

await initializeDashboards()

onMounted(() => {
  refreshTimer = setInterval(() => {
    void refreshWidgets()
  }, DASHBOARD_REFRESH_TICK_MS)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }

  if (scheduledDashboardSave) {
    clearTimeout(scheduledDashboardSave)
  }
})
</script>

<template>
  <UPage>
    <UPageHeader
      :headline="t('pages.dashboard.headline')"
      :title="t('pages.dashboard.title')"
      :description="t('pages.dashboard.description')"
    >
      <template #links>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <AppLocaleSelect />

          <USelect
            :model-value="selectedDashboardId || undefined"
            class="w-full min-w-0 sm:w-72"
            :items="dashboardSelectOptions"
            :placeholder="t('pages.dashboard.selector.placeholder')"
            :disabled="dashboardListStatus === 'pending' || dashboards.length === 0"
            @update:model-value="onDashboardSelectionChange"
          />

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-plus"
            :label="t('pages.dashboard.selector.actions.new')"
            @click="openCreateDashboardDialog"
          />

          <UButton
            v-if="hasSelectedDashboard"
            color="neutral"
            variant="soft"
            icon="i-lucide-settings-2"
            :label="t('pages.dashboard.selector.actions.settings')"
            @click="openDashboardSettings"
          />

          <UButton
            v-if="hasSelectedDashboard"
            color="neutral"
            variant="soft"
            icon="i-lucide-pen-square"
            :label="dashboardEditActionLabel"
            @click="onToggleDashboardEditing"
          />
        </div>
      </template>
    </UPageHeader>

    <UPageBody class="space-y-8">
      <AppAlert
        v-if="dashboardListErrorMessage"
        kind="error"
        :title="t('pages.dashboard.errors.loadDashboardsTitle')"
      >
        {{ dashboardListErrorMessage }}
      </AppAlert>

      <AppAlert
        v-if="queryListErrorMessage"
        kind="error"
        :title="t('pages.dashboard.errors.loadQueriesTitle')"
      >
        {{ queryListErrorMessage }}
      </AppAlert>

      <UModal
        :open="isCreateDashboardOpen"
        :title="t('pages.dashboard.selector.create.title')"
        :description="t('pages.dashboard.selector.create.description')"
        @update:open="onCreateDashboardOpenChange"
      >
        <template #body>
          <div class="space-y-4">
            <AppAlert
              v-if="createDashboardErrorMessage"
              kind="error"
              :title="t('pages.dashboard.selector.create.errorTitle')"
            >
              {{ createDashboardErrorMessage }}
            </AppAlert>

            <UFormField
              name="dashboardName"
              :label="t('pages.dashboard.selector.create.fields.dashboardName.label')"
              :description="t('pages.dashboard.selector.create.fields.dashboardName.description')"
            >
              <UInput
                v-model="createDashboardInput.dashboardName"
                class="w-full"
                :placeholder="t('pages.dashboard.selector.create.fields.dashboardName.placeholder')"
              />
            </UFormField>
          </div>
        </template>

        <template #footer>
          <div class="flex w-full justify-end gap-3">
            <UButton
              color="neutral"
              variant="ghost"
              :label="t('pages.dashboard.selector.create.actions.cancel')"
              @click="onCreateDashboardOpenChange(false)"
            />
            <UButton
              icon="i-lucide-plus"
              :loading="isCreatingDashboard"
              :label="t('pages.dashboard.selector.create.actions.submit')"
              @click="onCreateDashboard"
            />
          </div>
        </template>
      </UModal>

      <UModal
        :open="isDashboardSettingsOpen"
        :title="t('pages.dashboard.selector.settings.title')"
        :description="t('pages.dashboard.selector.settings.description')"
        @update:open="onDashboardSettingsOpenChange"
      >
        <template #body>
          <div class="space-y-6">
            <AppAlert
              v-if="dashboardSettingsErrorMessage"
              kind="error"
              :title="t('pages.dashboard.selector.settings.errorTitle')"
            >
              {{ dashboardSettingsErrorMessage }}
            </AppAlert>

            <UFormField
              name="dashboardName"
              :label="t('pages.dashboard.selector.settings.fields.dashboardName.label')"
              :description="t('pages.dashboard.selector.settings.fields.dashboardName.description')"
            >
              <UInput
                v-model="dashboardSettingsInput.dashboardName"
                class="w-full"
                :placeholder="t('pages.dashboard.selector.settings.fields.dashboardName.placeholder')"
              />
            </UFormField>

            <UFormField
              name="embedEnabled"
              :label="t('pages.dashboard.selector.settings.fields.embedEnabled.label')"
              :description="t('pages.dashboard.selector.settings.fields.embedEnabled.description')"
            >
              <USwitch v-model="dashboardSettingsInput.embedEnabled" />
            </UFormField>

            <UFormField
              name="embedId"
              :label="t('pages.dashboard.selector.embed.guidLabel')"
              :description="t('pages.dashboard.selector.embed.guidDescription')"
            >
              <UInput
                :model-value="selectedDashboard?.embedId ?? ''"
                readonly
                class="w-full font-mono text-xs"
              />
            </UFormField>

            <UFormField
              name="embedUrl"
              :label="t('pages.dashboard.selector.embed.urlLabel')"
              :description="t('pages.dashboard.selector.embed.urlDescription')"
            >
              <div class="flex flex-col gap-3 sm:flex-row">
                <UInput
                  :model-value="dashboardEmbedUrl"
                  readonly
                  class="w-full font-mono text-xs"
                />
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-copy"
                  :label="t('pages.dashboard.selector.embed.actions.copy')"
                  :disabled="!selectedDashboard?.embedEnabled"
                  @click="onCopyEmbedUrl"
                />
              </div>

              <p class="mt-2 text-xs text-muted">
                {{
                  selectedDashboard?.embedEnabled
                    ? t('pages.dashboard.selector.embed.enabledHint')
                    : t('pages.dashboard.selector.embed.disabledHint')
                }}
              </p>
            </UFormField>
          </div>
        </template>

        <template #footer>
          <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <UButton
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :label="t('pages.dashboard.selector.settings.actions.delete')"
              :disabled="isSavingDashboardSettings || isDeletingDashboard"
              @click="openDeleteDashboardDialog"
            />

            <div class="flex justify-end gap-3">
              <UButton
                color="neutral"
                variant="ghost"
                :label="t('pages.dashboard.selector.settings.actions.cancel')"
                :disabled="isSavingDashboardSettings || isDeletingDashboard"
                @click="onDashboardSettingsOpenChange(false)"
              />
              <UButton
                icon="i-lucide-save"
                :loading="isSavingDashboardSettings"
                :disabled="isDeletingDashboard"
                :label="t('pages.dashboard.selector.settings.actions.save')"
                @click="onSaveDashboardSettings"
              />
            </div>
          </div>
        </template>
      </UModal>

      <DeleteDashboardDialog
        :open="isDeleteDashboardOpen"
        :dashboard-name="selectedDashboardName"
        :is-deleting="isDeletingDashboard"
        :error-message="deleteDashboardErrorMessage"
        @update:open="onDeleteDashboardOpenChange"
        @confirm="onDeleteDashboard"
      />

      <UModal
        :open="isWidgetBuilderOpen"
        :title="builderTitle"
        :description="builderDescription"
        scrollable
        :ui="{
          content: 'w-[calc(100vw-2rem)] max-w-7xl rounded-2xl shadow-xl ring ring-default',
          body: 'p-0',
          footer: 'border-t border-default'
        }"
        @update:open="onBuilderOpenChange"
      >
        <template #body>
          <div class="grid gap-6 p-4 sm:p-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <UPageCard
              icon="i-lucide-sliders-horizontal"
              :title="builderTitle"
              :description="builderDescription"
            >
              <div class="space-y-6">
                <UFormField
                  name="queryId"
                  :label="t('pages.dashboard.builder.fields.query.label')"
                  :description="t('pages.dashboard.builder.fields.query.description')"
                >
                  <USelect
                    v-model="draft.queryId"
                    class="w-full"
                    :items="queryOptions"
                    :placeholder="t('pages.dashboard.builder.fields.query.placeholder')"
                  />
                </UFormField>

                <UFormField
                  name="pluginId"
                  :label="t('pages.dashboard.builder.fields.plugin.label')"
                  :description="t('pages.dashboard.builder.fields.plugin.description')"
                >
                  <USelect
                    v-model="draft.pluginId"
                    class="w-full"
                    :items="pluginOptions"
                    :placeholder="t('pages.dashboard.builder.fields.plugin.placeholder')"
                  />
                </UFormField>

                <p
                  v-if="selectedPluginDescription"
                  class="text-sm leading-6 text-muted"
                >
                  {{ selectedPluginDescription }}
                </p>

                <UFormField
                  name="title"
                  :label="t('pages.dashboard.builder.fields.title.label')"
                  :description="t('pages.dashboard.builder.fields.title.description')"
                >
                  <UInput
                    v-model="draft.title"
                    class="w-full"
                    :placeholder="t('pages.dashboard.builder.fields.title.placeholder')"
                  />
                </UFormField>

                <UFormField
                  name="refreshIntervalSeconds"
                  :label="t('pages.dashboard.builder.fields.refresh.label')"
                  :description="t('pages.dashboard.builder.fields.refresh.description')"
                >
                  <USelect
                    v-model="draft.refreshIntervalSeconds"
                    class="w-full"
                    :items="refreshIntervalOptions"
                  />
                </UFormField>

                <div class="space-y-4">
                  <div class="space-y-1">
                    <p class="text-sm font-medium text-highlighted">
                      {{ t('pages.dashboard.builder.mapping.title') }}
                    </p>
                    <p class="text-sm leading-6 text-muted">
                      {{ t('pages.dashboard.builder.mapping.description') }}
                    </p>
                  </div>

                  <AppAlert
                    v-if="draft.queryId && previewState?.status === 'pending'"
                    kind="info"
                    :title="t('pages.dashboard.builder.preview.loadingTitle')"
                  >
                    {{ t('pages.dashboard.builder.preview.loadingDescription') }}
                  </AppAlert>

                  <AppAlert
                    v-else-if="previewErrorMessage"
                    kind="error"
                    :title="t('pages.dashboard.builder.preview.errorTitle')"
                  >
                    {{ previewErrorMessage }}
                  </AppAlert>

                  <AppAlert
                    v-else-if="!selectedPlugin"
                    kind="info"
                    :title="t('pages.dashboard.builder.mapping.emptyTitle')"
                  >
                    {{ t('pages.dashboard.builder.mapping.emptyDescription') }}
                  </AppAlert>

                  <AppAlert
                    v-else-if="selectedPlugin.inputSchema.length === 0"
                    kind="info"
                    :title="t('pages.dashboard.builder.mapping.noneTitle')"
                  >
                    {{ t('pages.dashboard.builder.mapping.noneDescription') }}
                  </AppAlert>

                  <div
                    v-else
                    class="space-y-4"
                  >
                    <UFormField
                      v-for="input in selectedPlugin.inputSchema"
                      :key="input.key"
                      :name="input.key"
                      :label="getPluginInputLabel(input)"
                      :description="getPluginInputDescription(input)"
                      :required="input.required"
                    >
                      <USelectMenu
                        v-if="getUIPluginInputSelectionMode(input) === 'multiple'"
                        :model-value="getDraftPluginConfigValues(input.key)"
                        class="w-full"
                        :items="getPluginInputOptions(input)"
                        value-key="value"
                        label-key="label"
                        :search-input="false"
                        multiple
                        :placeholder="t('pages.dashboard.builder.mapping.multiplePlaceholder')"
                        @update:model-value="setDraftPluginConfigValues(input.key, $event)"
                      />

                      <USelect
                        v-else
                        :model-value="getDraftPluginConfigValue(input.key)"
                        class="w-full"
                        :items="getPluginInputOptions(input)"
                        :placeholder="t('pages.dashboard.builder.mapping.placeholder')"
                        @update:model-value="setDraftPluginConfigValue(input.key, $event)"
                      />
                    </UFormField>
                  </div>
                </div>
              </div>
            </UPageCard>

            <UPageCard
              icon="i-lucide-monitor-up"
              :title="t('pages.dashboard.preview.title')"
              :description="t('pages.dashboard.preview.description')"
            >
              <div class="space-y-4">
                <div
                  v-if="!selectedQuery"
                  class="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-default px-6 py-10 text-sm text-muted"
                >
                  {{ t('pages.dashboard.preview.empty') }}
                </div>

                <div
                  v-else-if="previewState?.status === 'pending' && previewStateKey === selectedQuery.id"
                  class="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-default px-6 py-10 text-sm text-muted"
                >
                  {{ t('pages.dashboard.builder.preview.loadingDescription') }}
                </div>

                <PluginRenderer
                  v-else
                  :widget="{
                    pluginId: draft.pluginId,
                    pluginConfig: draft.pluginConfig
                  }"
                  :columns="previewState?.columns ?? []"
                  :rows="previewState?.rows ?? []"
                />
              </div>
            </UPageCard>
          </div>
        </template>

        <template #footer>
          <div class="flex w-full flex-wrap items-center justify-end gap-3">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-rotate-cw"
              :label="t('pages.dashboard.builder.actions.refreshPreview')"
              :disabled="!selectedQuery"
              @click="loadPreviewQuery(true)"
            />
            <UButton
              v-if="isEditingWidget"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              :label="t('pages.dashboard.builder.actions.cancelEdit')"
              @click="onCancelEditingWidget"
            />
            <UButton
              :icon="submitWidgetActionIcon"
              :label="submitWidgetActionLabel"
              :disabled="submitWidgetDisabled"
              @click="onSubmitWidget"
            />
          </div>
        </template>
      </UModal>

      <section class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-highlighted">
              {{
                selectedDashboardName ||
                  t('pages.dashboard.widgets.title')
              }}
            </h2>
            <p class="text-sm leading-6 text-muted">
              {{
                hasSelectedDashboard
                  ? dashboardSaveStatusMessage
                  : t('pages.dashboard.widgets.description')
              }}
            </p>
          </div>

          <div
            v-if="hasSelectedDashboard"
            class="flex flex-wrap items-center gap-2"
          >
            <UButton
              v-if="isDashboardEditing"
              icon="i-lucide-plus"
              :label="t('pages.dashboard.builder.actions.add')"
              @click="openWidgetBuilder"
            />
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-rotate-cw"
              :label="t('pages.dashboard.widgets.actions.refreshAll')"
              :disabled="widgets.length === 0 || queryListStatus === 'pending'"
              @click="refreshWidgets(true)"
            />
          </div>
        </div>

        <UPageCard
          v-if="dashboardListStatus === 'pending'"
          icon="i-lucide-loader-circle"
          :title="t('pages.dashboard.states.loadingDashboardsTitle')"
          :description="t('pages.dashboard.states.loadingDashboardsDescription')"
        />

        <UPageCard
          v-else-if="dashboards.length === 0"
          icon="i-lucide-layout-dashboard"
          :title="t('pages.dashboard.empty.title')"
          :description="t('pages.dashboard.empty.description')"
        >
          <UButton
            icon="i-lucide-plus"
            :label="t('pages.dashboard.empty.action')"
            @click="openCreateDashboardDialog"
          />
        </UPageCard>

        <AppAlert
          v-else-if="dashboardStatus === 'error'"
          kind="error"
          :title="t('pages.dashboard.errors.loadDashboardTitle')"
        >
          {{ dashboardErrorMessage }}
        </AppAlert>

        <UPageCard
          v-else-if="dashboardStatus === 'pending'"
          icon="i-lucide-loader-circle"
          :title="t('pages.dashboard.states.loadingDashboardTitle')"
          :description="t('pages.dashboard.states.loadingDashboardDescription')"
        />

        <UPageCard
          v-else-if="widgets.length === 0"
          icon="i-lucide-layout-dashboard"
          :title="t('pages.dashboard.widgets.empty.title')"
          :description="t('pages.dashboard.widgets.empty.description')"
        />

        <WidgetGrid
          v-else
          :editable="isDashboardEditing"
          :widgets="widgets"
          @layout-change="onWidgetLayoutChange"
        >
          <template #item="{ widget }">
            <UCard
              class="h-full w-full"
              :ui="{
                root: 'flex h-full min-h-0 w-full flex-col overflow-hidden',
                header: 'flex-none p-4 sm:px-6 sm:py-4',
                body: 'flex min-h-0 flex-1 flex-col p-4 sm:p-6'
              }"
            >
              <template #header>
                <div class="flex min-w-0 items-start justify-between gap-3">
                  <h3 class="min-w-0 truncate font-semibold text-highlighted">
                    {{ widget.title || t('pages.dashboard.widgets.card.fallbackTitle') }}
                  </h3>

                  <div
                    v-if="isDashboardEditing"
                    class="flex items-center gap-1"
                  >
                    <div
                      data-dashboard-widget-drag-handle
                      class="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted transition hover:bg-elevated hover:text-highlighted active:cursor-grabbing"
                      :title="t('pages.dashboard.widgets.actions.drag')"
                    >
                      <UIcon
                        name="i-lucide-grip"
                        class="size-3.5"
                      />
                      <span class="sr-only">
                        {{ t('pages.dashboard.widgets.actions.drag') }}
                      </span>
                    </div>

                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      square
                      icon="i-lucide-pencil"
                      :aria-label="t('pages.dashboard.widgets.actions.edit')"
                      :title="t('pages.dashboard.widgets.actions.edit')"
                      @click="onEditWidget(widget)"
                    />
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      square
                      icon="i-lucide-rotate-cw"
                      :aria-label="t('pages.dashboard.widgets.actions.refreshOne')"
                      :title="t('pages.dashboard.widgets.actions.refreshOne')"
                      @click="onRefreshWidget(widget)"
                    />
                    <UButton
                      color="error"
                      variant="ghost"
                      size="xs"
                      square
                      icon="i-lucide-trash-2"
                      :aria-label="t('pages.dashboard.widgets.actions.remove')"
                      :title="t('pages.dashboard.widgets.actions.remove')"
                      @click="onRemoveWidget(widget.id)"
                    />
                  </div>
                </div>
              </template>

              <div class="flex h-full min-h-0 flex-col gap-4">
                <AppAlert
                  v-if="!getWidgetQuery(widget)"
                  kind="warning"
                  :title="t('pages.dashboard.widgets.card.queryMissingTitle')"
                >
                  {{ t('pages.dashboard.widgets.card.queryMissingDescription') }}
                </AppAlert>

                <AppAlert
                  v-else-if="getWidgetState(widget)?.status === 'pending'"
                  kind="info"
                  :title="t('pages.dashboard.widgets.card.loadingTitle')"
                >
                  {{ t('pages.dashboard.widgets.card.loadingDescription') }}
                </AppAlert>

                <AppAlert
                  v-else-if="getWidgetState(widget)?.status === 'error'"
                  kind="error"
                  :title="t('pages.dashboard.widgets.card.errorTitle')"
                >
                  {{ getWidgetErrorMessage(widget) }}
                </AppAlert>

                <div
                  v-else
                  class="relative min-h-0 flex-1"
                >
                  <div
                    v-if="isWidgetRefreshing(widget) || getWidgetInlineErrorMessage(widget)"
                    class="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-end p-3"
                  >
                    <div
                      class="max-w-full rounded-lg border px-3 py-2 text-xs shadow-sm backdrop-blur"
                      :class="isWidgetRefreshing(widget)
                        ? 'border-default bg-default/90 text-muted'
                        : 'border-error/30 bg-error/10 text-error'"
                    >
                      <div
                        v-if="isWidgetRefreshing(widget)"
                        class="flex items-center gap-2 font-medium uppercase tracking-[0.18em]"
                      >
                        <UIcon
                          name="i-lucide-loader-circle"
                          class="size-3.5 animate-spin"
                        />
                        <span>{{ t('pages.dashboard.widgets.card.refreshing') }}</span>
                      </div>

                      <div
                        v-else
                        class="flex items-start gap-2"
                      >
                        <UIcon
                          name="i-lucide-triangle-alert"
                          class="mt-0.5 size-4 shrink-0"
                        />
                        <span>{{ getWidgetInlineErrorMessage(widget) }}</span>
                      </div>
                    </div>
                  </div>

                  <PluginRenderer
                    class="h-full min-h-0"
                    :widget="widget"
                    :columns="getWidgetState(widget)?.columns ?? []"
                    :rows="getWidgetState(widget)?.rows ?? []"
                  />
                </div>
              </div>
            </UCard>
          </template>
        </WidgetGrid>
      </section>
    </UPageBody>
  </UPage>
</template>
