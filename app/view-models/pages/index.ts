import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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

type PluginInputSelectValue = Exclude<
  DashboardWidgetPluginConfigPrimitive,
  null
>

interface PluginInputSelectOption {
  label: string
  value: PluginInputOptionValue
}

export default defineComponent({
  components: {
    AppAlert,
    AppLocaleSelect,
    DeleteDashboardDialog,
    PluginRenderer,
    WidgetGrid
  },
  async setup() {
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

    return {
      builderDescription,
      builderTitle,
      createDashboardErrorMessage,
      createDashboardInput,
      dashboardEditActionLabel,
      dashboardEmbedUrl,
      dashboardErrorMessage,
      dashboardListErrorMessage,
      dashboardListStatus,
      dashboardSaveErrorMessage,
      dashboardSaveState,
      dashboardSaveStatusMessage,
      dashboardSelectOptions,
      dashboardSettingsErrorMessage,
      dashboardSettingsInput,
      dashboardStatus,
      dashboards,
      deleteDashboardErrorMessage,
      draft,
      editingWidget,
      getDraftPluginConfigValue,
      getDraftPluginConfigValues,
      getPluginInputDescription,
      getPluginInputLabel,
      getPluginInputOptions,
      getPluginLabel,
      getWidgetErrorMessage,
      getWidgetInlineErrorMessage,
      getWidgetState,
      hasSelectedDashboard,
      isCreateDashboardOpen,
      isCreatingDashboard,
      isDashboardEditing,
      isDashboardSettingsOpen,
      isDeleteDashboardOpen,
      isDeletingDashboard,
      isEditingWidget,
      isSavingDashboardSettings,
      isWidgetBuilderOpen,
      isWidgetRefreshing,
      onBuilderOpenChange,
      onCancelEditingWidget,
      onCopyEmbedUrl,
      onCreateDashboard,
      onCreateDashboardOpenChange,
      onDashboardSelectionChange,
      onDashboardSettingsOpenChange,
      onDeleteDashboard,
      onDeleteDashboardOpenChange,
      onEditWidget,
      onRefreshWidget,
      onRemoveWidget,
      onSaveDashboardSettings,
      onSubmitWidget,
      onToggleDashboardEditing,
      onWidgetLayoutChange,
      openCreateDashboardDialog,
      openDashboardSettings,
      openDeleteDashboardDialog,
      openWidgetBuilder,
      pluginDefinitions,
      pluginOptions,
      previewErrorMessage,
      previewFieldOptions,
      previewState,
      previewStateKey,
      queryListErrorMessage,
      queryListStatus,
      queryOptions,
      refreshIntervalOptions,
      selectedDashboard,
      selectedDashboardId,
      selectedDashboardName,
      selectedPlugin,
      selectedPluginDescription,
      selectedQuery,
      setDraftPluginConfigValue,
      setDraftPluginConfigValues,
      submitWidgetActionIcon,
      submitWidgetActionLabel,
      submitWidgetDisabled,
      t,
      te,
      widgetTargets,
      widgets
    }
  }
})
