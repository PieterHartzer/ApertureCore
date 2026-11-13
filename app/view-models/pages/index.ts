import AppEmptyState from '~/components/ui/AppEmptyState.vue'
import ColorField from '~/components/ui/ColorField.vue'
import { settingInput } from '~/components/plugins/index'
import { DASHBOARD_APPEARANCES, DEFAULT_DASHBOARD_APPEARANCE, type DashboardAppearance } from '#shared/utils/dashboard-appearance'
import { MAX_EMBED_ORIGINS, normalizeEmbedOrigins } from '#shared/utils/embed-origins'
import { CARD, COLUMN_FORMATS, CURRENCIES, MAX_THRESHOLD_STEPS, getCardStyle, isCardShadowHidden, isCardTitleHidden, parseAdvancedOptions, parseLabelOverrides, parseThresholdSteps, type LabelOverride, THRESHOLD_STEP_COLORS, type ThresholdStep } from '~/utils/charts/chart-settings'
import { COLUMN_FORMAT_KINDS, DATE_PATTERN_PRESETS, DATE_STYLES, MAX_DATE_PATTERN_LENGTH, TEXT_CASES, defaultDatePattern, isDateKind, isNumberKind, parseColumnFormats, previewColumnFormat, type ColumnFormat, type ColumnFormatKind } from '~/utils/charts/column-formats'
import GettingStarted from '~/components/dashboard/GettingStarted.vue'
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import ExtensionSlot from '~/components/ui/ExtensionSlot.vue'
import { appExtensions, type WidgetPickerItem } from '~/extensions'

import DeleteDashboardDialog from '~/components/dashboard/DeleteDashboardDialog.vue'
import WidgetGallery from '~/components/dashboard/WidgetGallery.vue'
import WidgetGrid from '~/components/dashboard/WidgetGrid.vue'
import PluginRenderer from '~/components/dashboard/PluginRenderer.vue'
import WidgetSkeleton from '~/components/dashboard/WidgetSkeleton.vue'
import DashboardStyleEditor from '~/components/dashboard/DashboardStyleEditor.vue'
import { provideDashboardChartStyle } from '~/composables/useDashboardChartStyle'
import { buildDashboardCss, getDashboardChartStyle } from '#shared/utils/dashboard-style'
import type { DashboardStyle } from '#shared/utils/dashboard-style-fields'
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
  updateDashboardWidgetLayout,
  removeWidgetTypeFromTitle
} from '~/types/dashboard-widgets'
import type { SavedSqlQuerySummary } from '~/types/saved-sql-queries'
import {
  buildUIPluginFieldOptions,
  filterUIPluginFieldOptions,
  getUIPluginInputSelectionMode,
  getUIPluginInputSource,
  pluginUsesQuery,
  type PluginInputDefinition,
  type PluginInputOptionValue
} from '~/types/uiPlugin'
import { translateMessage } from '~/utils/translateMessage'
import { autoMapFields, describeResultShape, suggestCharts } from '~/utils/charts/chart-suggestions'
import { useAppPermissions } from '~/composables/useAppPermissions'

const DASHBOARD_REFRESH_TICK_MS = 5000
const WIDGET_REFRESH_INTERVALS = [60, 300, 900, 3600]
const DASHBOARD_LAYOUT_SAVE_DEBOUNCE_MS = 800

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
    WidgetGallery,
    ColorField,
    ExtensionSlot,
    WidgetSkeleton,
    DashboardStyleEditor,
    AppAlert,
    AppEmptyState,
    GettingStarted,
    AppLocaleSelect,
    DeleteDashboardDialog,
    PluginRenderer,
    WidgetGrid
  },
  async setup() {
    const { locale, t, te } = useI18n()
    // Hides controls the person can't use; the server checks every request.
    const permissions = useAppPermissions()
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
      saveDashboard: saveDashboardRequest,
      regenerateEmbedLink
    } = useDashboards(requestFetch)
    const { getPlugin, getPlugins } = useUIPlugins()
    const builderExtension = appExtensions.useDashboardBuilder?.()
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
      embedEnabled: false,
      isDefault: false,
      // One website per line; empty means the embed may appear anywhere.
      embedAllowedOrigins: '',
      appearance: DEFAULT_DASHBOARD_APPEARANCE as DashboardAppearance
    })

    const appearanceOptions = DASHBOARD_APPEARANCES

    // useHead must run before the first await in this setup.
    // The dialog previews its selection before the dashboard is saved.
    const activeAppearance = computed(() => {
      return isDashboardSettingsOpen.value
        ? dashboardSettingsInput.value.appearance
        : selectedDashboard.value?.appearance ?? DEFAULT_DASHBOARD_APPEARANCE
    })

    const isStyleEditorOpen = ref(false)
    const isSavingStyle = ref(false)
    const styleDraft = ref<DashboardStyle>({})
    // The panel previews its draft live; closing it falls back to the saved style.
    const activeStyle = computed(() => isStyleEditorOpen.value ? styleDraft.value : selectedDashboard.value?.style ?? {})
    const dashboardCss = computed(() => buildDashboardCss(activeStyle.value))

    provideDashboardChartStyle(computed(() => getDashboardChartStyle(activeStyle.value)))

    useHead({
      htmlAttrs: { 'data-appearance': activeAppearance },
      style: computed(() => [{ key: 'dashboard-style', textContent: dashboardCss.value }])
    })

    const dashboardSettingsErrorMessage = ref('')
    const deleteDashboardErrorMessage = ref('')

    let refreshTimer: ReturnType<typeof setInterval> | null = null
    let scheduledDashboardSave: ReturnType<typeof setTimeout> | null = null
    let dashboardSavePromise: Promise<boolean> | null = null
    let dashboardSaveQueued = false

    // Lifecycle hooks must be registered before the first await in this setup.
    onMounted(() => {
      void builderExtension?.refresh()
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
        value: dashboard.id,
        ...(dashboard.isDefault ? { icon: 'i-lucide-house' } : {})
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

    const pluginOptions = computed<WidgetPickerItem[]>(() => {
      const options = pluginDefinitions.value
        .map((plugin) => ({ label: getPluginDefinitionName(plugin), value: plugin.id }))
        .sort((left, right) => left.label.localeCompare(right.label, String(locale.value) === 'pseudo' ? 'en' : locale.value))

      return builderExtension?.arrangeWidgetOptions(options) ?? options
    })

    const fastestRefreshSeconds = computed(() => builderExtension?.fastestRefreshSeconds.value ?? WIDGET_REFRESH_INTERVALS[0]!)

    const refreshIntervalOptions = computed(() => {
      return WIDGET_REFRESH_INTERVALS
        .filter((intervalSeconds) => intervalSeconds >= fastestRefreshSeconds.value)
        .map((intervalSeconds) => ({
          label: t(`pages.dashboard.builder.refresh.every${intervalSeconds}`),
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

    // A text label or clock is added without a query.
    const selectedPluginUsesQuery = computed(() => pluginUsesQuery(selectedPlugin.value))

    const editingWidget = computed(() => {
      if (!editingWidgetId.value) {
        return null
      }

      return widgets.value.find((widget) => widget.id === editingWidgetId.value) ?? null
    })

    const isEditingWidget = computed(() => editingWidget.value !== null)

    const previewTarget = computed(() => {
      if (!selectedQuery.value || !selectedPluginUsesQuery.value) {
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

    // Widgets that fit what the chosen query returned, best first. Only widgets the
    // workspace can add are suggested.
    const suggestedPluginIds = computed(() => {
      if (!previewState.value || previewState.value.status !== 'success' || !previewFieldOptions.value.length) return []

      const available = pluginOptions.value.flatMap(item => 'value' in item && !item.trailingLabel ? [item.value] : [])

      return suggestCharts(describeResultShape(previewFieldOptions.value, previewState.value.rows), available)
    })

    const suggestedPlugins = computed(() => suggestedPluginIds.value.map(id => ({ id, label: getPluginLabel(id) })))

    // Set when the person picks a widget, so a suggestion never replaces their choice.
    const pluginChosenByPerson = ref(false)

    const choosePlugin = (pluginId: string) => {
      pluginChosenByPerson.value = true
      draft.value.pluginId = pluginId
    }

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

    const widgetBlockReason = computed(() => {
      return builderExtension?.blockReason({
        pluginId: selectedPlugin.value?.id ?? '',
        editingPluginId: editingWidget.value?.pluginId ?? '',
        isEditing: isEditingWidget.value,
        widgetCount: widgets.value.length,
        pluginConfig: draft.value.pluginConfig,
        savedPluginConfig: editingWidget.value?.pluginConfig ?? {}
      }) ?? ''
    })

    const isEmbedBlocked = computed(() => {
      return builderExtension?.isEmbedBlocked(selectedDashboard.value?.embedEnabled ?? false) ?? false
    })

    const submitWidgetDisabled = computed(() => {
      return (
        Boolean(widgetBlockReason.value) ||
        !hasSelectedDashboard.value ||
        !selectedPlugin.value ||
        (selectedPluginUsesQuery.value && (!selectedQuery.value || previewState.value?.status !== 'success')) ||
        !isDashboardWidgetPluginConfigComplete(
          selectedPlugin.value,
          draft.value.pluginConfig
        )
      )
    })

    // Widgets saved with an interval that is no longer offered move to the next one up.
    watch([() => draft.value.refreshIntervalSeconds, fastestRefreshSeconds], ([current, fastest]) => {
      if (!WIDGET_REFRESH_INTERVALS.includes(current) || current < fastest) {
        draft.value.refreshIntervalSeconds = WIDGET_REFRESH_INTERVALS.find(interval => interval >= Math.max(current, fastest)) ?? 3600
      }
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
        const query = widget.queryId ? queryLookup.value.get(widget.queryId) : undefined

        if (!query || !widget.queryId) {
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

      return isDashboardEditing.value ? t('pages.dashboard.status.ready') : ''
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

    const cleanWidgetTitle = (widget: DashboardWidget) => {
      const plugin = getPlugin(widget.pluginId)

      return removeWidgetTypeFromTitle(widget.title, plugin ? [getPluginDefinitionName(plugin), plugin.name] : [])
    }

    const getWidgetTitle = (widget: DashboardWidget) => {
      return cleanWidgetTitle(widget) || t('pages.dashboard.widgets.card.fallbackTitle')
    }

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
      return widget.queryId ? queryLookup.value.get(widget.queryId) ?? null : null
    }

    /** Widgets saved without a query (a text label, a clock) render straight away. */
    const isWidgetWithoutQuery = (widget: Pick<DashboardWidget, 'queryId'>) => widget.queryId === null

    const getWidgetState = (widget: DashboardWidget) => {
      const query = getWidgetQuery(widget)

      if (!query || !widget.queryId) {
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

    const pluginFieldInputs = computed(() => {
      return selectedPlugin.value?.inputSchema.filter(input => getUIPluginInputSource(input) !== 'value') ?? []
    })

    // Every widget gets the same card settings, after its own.
    const CARD_INPUTS = CARD.map(settingInput)
    const COLUMN_FORMAT_INPUT = settingInput(COLUMN_FORMATS)
    // Settings every widget shares: card looks, and column formats for widgets that show query results.
    const sharedInputs = (plugin: { dataSource?: 'query' | 'none' } | null) => pluginUsesQuery(plugin) ? [COLUMN_FORMAT_INPUT, ...CARD_INPUTS] : CARD_INPUTS
    // Saving must keep the shared settings alongside the plugin's own.
    const withCardInputs = <T extends { inputSchema: PluginInputDefinition[], dataSource?: 'query' | 'none' }>(plugin: T | null) => {
      return plugin ? { ...plugin, inputSchema: [...plugin.inputSchema, ...sharedInputs(plugin)] } : null
    }
    const STYLE_SECTIONS = new Set(['appearance', 'thresholds', 'card'])
    const SECTION_ORDER = {
      format: ['format', 'text', 'range', 'labels', 'advanced'],
      style: ['appearance', 'thresholds', 'range', 'card']
    } as const

    const visibleSettingInputs = computed(() => {
      if (!selectedPlugin.value) return []

      return [...selectedPlugin.value.inputSchema, ...sharedInputs(selectedPlugin.value)].filter((input) => {
        if (getUIPluginInputSource(input) !== 'value') return false

        const condition = input.visibleWhen

        return !condition || condition.values.includes(String(draft.value.pluginConfig[condition.key] ?? ''))
      })
    })

    // Colours and anything about looks go on the Style tab, wherever the plugin put them.
    const isStyleInput = (input: PluginInputDefinition) => input.control === 'color' || STYLE_SECTIONS.has(input.section ?? '')

    const buildSections = (tab: 'format' | 'style') => {
      const inputs = visibleSettingInputs.value.filter(input => (tab === 'style') === isStyleInput(input))

      return SECTION_ORDER[tab].flatMap((id) => {
        const sectionInputs = inputs.filter(input => input.section === id)

        return sectionInputs.length
          ? [{ id, title: t(`pages.dashboard.plugins.catalog.sections.${id}`), inputs: sectionInputs }]
          : []
      })
    }

    const formatSections = computed(() => buildSections('format'))
    const styleSections = computed(() => buildSections('style'))
    const pluginSettingSections = computed(() => [...formatSections.value, ...styleSections.value])
    // What a widget without a query shows (a label's text), edited on the Data tab.
    const contentInputs = computed(() => visibleSettingInputs.value.filter(input => input.section === 'content'))

    const builderTab = ref<'data' | 'format' | 'style'>('data')
    const isWidgetGalleryOpen = ref(false)
    const builderTabs = computed(() => [
      { label: t('pages.dashboard.builder.tabs.data'), value: 'data', icon: 'i-lucide-database' },
      { label: t('pages.dashboard.builder.tabs.format'), value: 'format', icon: 'i-lucide-sliders-horizontal', disabled: formatSections.value.length === 0 },
      { label: t('pages.dashboard.builder.tabs.style'), value: 'style', icon: 'i-lucide-palette', disabled: styleSections.value.length === 0 }
    ])
    const activeSettingSections = computed(() => builderTab.value === 'format'
      ? formatSections.value
      : builderTab.value === 'style' ? styleSections.value : [])

    // A tab with nothing on it for the new plugin falls back to Data.
    watch(builderTabs, (tabs) => {
      if (tabs.find(tab => tab.value === builderTab.value)?.disabled) builderTab.value = 'data'
    })
    watch(isWidgetBuilderOpen, (open) => {
      if (open) builderTab.value = 'data'
    })

    const getSettingValue = (key: string) => {
      const value = draft.value.pluginConfig[key]

      return value === null || value === undefined || Array.isArray(value) ? undefined : value
    }

    const setSettingValue = (key: string, value: unknown) => {
      draft.value.pluginConfig[key] = (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') ? value : null
    }

    const setNumberSetting = (key: string, value: unknown) => {
      const number = value === '' || value === null || value === undefined ? Number.NaN : Number(value)

      setSettingValue(key, Number.isFinite(number) ? number : null)
    }

    const SETTING_SPAN_CLASSES = {
      full: 'col-span-6',
      half: 'col-span-6 sm:col-span-3',
      third: 'col-span-6 sm:col-span-2'
    }

    // Without its currency neighbour, the format picker takes the whole row.
    const getSettingSpanClass = (input: PluginInputDefinition) => {
      const alone = input.key === 'valueFormat' && draft.value.pluginConfig.valueFormat !== 'currency'

      return SETTING_SPAN_CLASSES[alone ? 'full' : input.span ?? 'half']
    }

    const advancedOptionsInvalid = computed(() => parseAdvancedOptions(draft.value.pluginConfig).invalid)

    const maxThresholdSteps = MAX_THRESHOLD_STEPS

    const thresholdSteps = computed(() => parseThresholdSteps(draft.value.pluginConfig))

    const saveThresholdSteps = (steps: ThresholdStep[]) => {
      draft.value.pluginConfig.thresholds = steps.length ? JSON.stringify(steps) : null
    }

    const addThresholdStep = () => {
      const steps = thresholdSteps.value

      if (steps.length < MAX_THRESHOLD_STEPS) {
        saveThresholdSteps([...steps, { from: null, color: THRESHOLD_STEP_COLORS[steps.length]! }])
      }
    }

    const removeThresholdStep = (index: number) => {
      saveThresholdSteps(thresholdSteps.value.filter((_, position) => position !== index))
    }

    const setThresholdValue = (index: number, value: unknown) => {
      const number = value === '' || value === null || value === undefined ? Number.NaN : Number(value)

      saveThresholdSteps(thresholdSteps.value.map((step, position) => position === index ? { ...step, from: Number.isFinite(number) ? number : null } : step))
    }

    const setThresholdColor = (index: number, color: string) => {
      saveThresholdSteps(thresholdSteps.value.map((step, position) => position === index ? { ...step, color } : step))
    }

    const openStyleEditor = () => {
      styleDraft.value = { ...(selectedDashboard.value?.style ?? {}) }
      isStyleEditorOpen.value = true
    }

    const onSaveStyle = async () => {
      if (!selectedDashboard.value) {
        return
      }

      isSavingStyle.value = true

      try {
        const saved = await persistDashboard({ ...selectedDashboard.value, style: styleDraft.value }, { notifyError: true })

        if (saved) {
          isStyleEditorOpen.value = false
        }
      } finally {
        isSavingStyle.value = false
      }
    }

    const columnFormats = computed(() => parseColumnFormats(draft.value.pluginConfig))
    const saveColumnFormats = (items: ColumnFormat[]) => {
      draft.value.pluginConfig.columnFormats = items.length ? JSON.stringify(items) : null
    }
    const columnFormatColumnOptions = computed(() => previewFieldOptions.value.map(field => ({ label: field.label, value: field.value })))
    const columnFormatKindOptions = computed(() => COLUMN_FORMAT_KINDS.map(kind => ({ label: t(`pages.dashboard.plugins.catalog.columnFormats.kinds.${kind}`), value: kind })))
    // Grouped so the short names make sense: styles that follow each viewer's language, then ones everyone sees the same.
    const dateStyleOption = (style: typeof DATE_STYLES[number]) => ({ label: t(`pages.dashboard.plugins.catalog.columnFormats.dateStyles.${style}`), value: style })
    const dateStyleOptions = computed(() => [
      [{ type: 'label' as const, label: t('pages.dashboard.plugins.catalog.columnFormats.dateStyleGroups.viewer') }, ...(['short', 'medium', 'long'] as const).map(dateStyleOption)],
      [{ type: 'label' as const, label: t('pages.dashboard.plugins.catalog.columnFormats.dateStyleGroups.everyone') }, ...(['iso', 'pattern'] as const).map(dateStyleOption)]
    ])
    const currencyOptions = CURRENCIES.map(code => ({ label: code, value: code }))
    const textCaseOptions = computed(() => [
      { label: t('pages.dashboard.plugins.catalog.columnFormats.textCases.none'), value: 'none' },
      ...TEXT_CASES.map(textCase => ({ label: t(`pages.dashboard.plugins.catalog.columnFormats.textCases.${textCase}`), value: textCase }))
    ])
    const maxDatePatternLength = MAX_DATE_PATTERN_LENGTH
    const formatLocale = computed(() => String(locale.value) === 'pseudo' ? 'en' : locale.value)
    // Each preset is shown with today's date laid out by it.
    const datePatternOptions = computed(() => {
      const sample = new Date()

      return DATE_PATTERN_PRESETS.map(pattern => ({
        label: `${previewColumnFormat(sample.toISOString(), { column: '', kind: 'datetime', dateStyle: 'pattern', pattern }, formatLocale.value, sample)}   ${pattern}`,
        value: pattern
      }))
    })
    // The first value the query returned for the column, shown with its format.
    const columnFormatPreview = (item: ColumnFormat) => {
      const rows = previewState.value?.rows ?? []
      const sample = rows.map(row => row[item.column]).find(value => value !== null && value !== undefined && value !== '')

      return previewColumnFormat(sample, item, formatLocale.value)
    }

    // A new row picks the next column without a format, and a format that suits its data.
    const addColumnFormat = () => {
      const used = new Set(columnFormats.value.map(item => item.column))
      const field = previewFieldOptions.value.find(option => !used.has(option.value))
      const kind: ColumnFormatKind = field?.fieldType === 'date' ? 'date' : field?.fieldType === 'number' ? 'number' : 'text'

      saveColumnFormats([...columnFormats.value, { column: field?.value ?? '', kind }])
    }
    const removeColumnFormat = (index: number) => saveColumnFormats(columnFormats.value.filter((_, position) => position !== index))
    const setColumnFormat = (index: number, key: 'column' | 'kind' | 'decimals' | 'currency' | 'dateStyle' | 'pattern' | 'textCase', value: unknown) => {
      saveColumnFormats(columnFormats.value.map((item, position) => {
        if (position !== index) return item

        if (key === 'kind') {
          // Options for the old kind make no sense for the new one.
          return { column: item.column, kind: value as ColumnFormatKind }
        }

        if (key === 'decimals') {
          const number = value === '' || value === null || value === undefined ? Number.NaN : Number(value)
          const { decimals: _, ...rest } = item

          return Number.isFinite(number) ? { ...rest, decimals: number } : rest
        }

        if (key === 'textCase') {
          const { textCase: _, ...rest } = item

          return value === 'none' || !value ? rest : { ...rest, textCase: value as ColumnFormat['textCase'] }
        }

        if (key === 'dateStyle') {
          const { pattern, ...rest } = item

          // A fixed pattern starts from one that suits the kind of date.
          return value === 'pattern'
            ? { ...rest, dateStyle: 'pattern', pattern: pattern || defaultDatePattern(item.kind) }
            : { ...rest, dateStyle: value as ColumnFormat['dateStyle'] }
        }

        if (key === 'pattern') {
          return { ...item, pattern: String(value ?? '').slice(0, MAX_DATE_PATTERN_LENGTH) }
        }

        return { ...item, [key]: String(value ?? '') }
      }))
    }

    const labelOverrides = computed(() => parseLabelOverrides(draft.value.pluginConfig))

    const saveLabelOverrides = (items: LabelOverride[]) => {
      draft.value.pluginConfig.labelOverrides = items.length ? JSON.stringify(items) : null
    }

    const addLabelOverride = () => saveLabelOverrides([...labelOverrides.value, { from: '', to: '' }])

    const removeLabelOverride = (index: number) => {
      saveLabelOverrides(labelOverrides.value.filter((_, position) => position !== index))
    }

    const setLabelOverride = (index: number, key: 'from' | 'to', value: unknown) => {
      saveLabelOverrides(labelOverrides.value.map((item, position) => position === index ? { ...item, [key]: String(value ?? '') } : item))
    }

    // Offers the text values and series columns this widget is actually showing.
    const addLabelsFromData = () => {
      const mapped = pluginFieldInputs.value.flatMap((input) => {
        const value = draft.value.pluginConfig[input.key]

        return Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : []
      })
      const multiple = pluginFieldInputs.value.flatMap((input) => {
        const value = draft.value.pluginConfig[input.key]

        return Array.isArray(value) ? value.map(String) : []
      })
      const found = [
        ...multiple,
        ...(previewState.value?.rows ?? []).flatMap(row => mapped.flatMap((column) => {
          const value = row[column]

          return typeof value === 'string' && value.trim() && Number.isNaN(Number(value)) ? [value] : []
        }))
      ]
      const existing = new Set(labelOverrides.value.map(item => item.from))
      const additions = [...new Set(found)].filter(label => !existing.has(label)).slice(0, 50)

      saveLabelOverrides([...labelOverrides.value, ...additions.map(from => ({ from, to: '' }))])
    }

    const getSettingOptions = (input: PluginInputDefinition) => {
      return (input.options ?? []).map(option => ({ label: getPluginInputOptionLabel(option), value: option.value }))
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
        withCardInputs(selectedPlugin.value),
        draft.value.pluginConfig
      )

      if (selectedPlugin.value) {
        selectedPlugin.value.inputSchema.forEach((input) => {
          if (getUIPluginInputSource(input) === 'value') {
            return
          }

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

      draft.value.pluginConfig = selectedPlugin.value && previewFieldOptions.value.length
        ? autoMapFields(selectedPlugin.value.inputSchema, previewFieldOptions.value, normalizedConfig)
        : normalizedConfig
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
      embedAllowedOrigins: dashboard.embedAllowedOrigins,
      isDefault: dashboard.isDefault,
      appearance: dashboard.appearance,
      style: dashboard.style,
      widgetCount: dashboard.widgets.length,
      createdAt: dashboard.createdAt,
      updatedAt: dashboard.updatedAt
    })

    const upsertDashboardSummary = (dashboard: DashboardDetails) => {
      const nextSummary = mapDashboardSummary(dashboard)
      const existingIndex = dashboards.value.findIndex((item) => item.id === dashboard.id)
      // A new default replaces the old one.
      const others = dashboard.isDefault
        ? dashboards.value.map(item => item.isDefault && item.id !== dashboard.id ? { ...item, isDefault: false } : item)
        : dashboards.value

      dashboards.value = sortDashboards(
        existingIndex >= 0
          ? others.map((item, index) => {
              return index === existingIndex
                ? nextSummary
                : item
            })
          : [...others, nextSummary]
      )
    }

    const resetDraft = () => {
      editingWidgetId.value = null
      pluginChosenByPerson.value = false
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

      // The organisation's default opens first, otherwise the first by name.
      const firstDashboard = dashboards.value.find(dashboard => dashboard.isDefault) ?? dashboards.value[0]

      if (!firstDashboard) {
        return
      }

      await loadSelectedDashboard(firstDashboard.id)
    }

    const persistDashboard = async (
      dashboardSnapshot: DashboardDetails,
      options: {
        notifyError?: boolean
        isDefault?: boolean
        embedAllowedOrigins?: string[]
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
          toDashboardSaveInput(dashboardSnapshot, { isDefault: options.isDefault, embedAllowedOrigins: options.embedAllowedOrigins })
        )

        if (response.ok && response.dashboard) {
          upsertDashboardSummary(response.dashboard)

          if (selectedDashboard.value?.id === response.dashboard.id) {
            selectedDashboard.value = response.dashboard
            selectedDashboardId.value = response.dashboard.id
          }

          dashboardSaveState.value = 'saved'
          dashboardSaveErrorMessage.value = ''
          await builderExtension?.refresh()
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
      draft.value = { ...createDashboardWidgetDraftFromWidget(widget), title: cleanWidgetTitle(widget) }
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
      const usesQuery = selectedPluginUsesQuery.value

      if (
        submitWidgetDisabled.value ||
        !selectedPlugin.value ||
        (usesQuery && !selectedQuery.value) ||
        !selectedDashboard.value
      ) {
        return
      }

      if (usesQuery) {
        await loadPreviewQuery()
      }

      const pluginName = getPluginLabel(selectedPlugin.value.id)
      const defaultTitle = usesQuery && selectedQuery.value
        ? t('pages.dashboard.builder.defaultTitle', { queryName: selectedQuery.value.queryName, pluginName })
        : pluginName

      const normalizedDraft: DashboardWidgetDraft = {
        ...draft.value,
        queryId: usesQuery ? draft.value.queryId : '',
        dashboardId: selectedDashboard.value.id,
        pluginConfig: normalizeDashboardWidgetPluginConfig(
          withCardInputs(selectedPlugin.value),
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

      if (!query || !widget.queryId) {
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
        embedEnabled: selectedDashboard.value.embedEnabled,
        isDefault: selectedDashboard.value.isDefault,
        embedAllowedOrigins: selectedDashboard.value.embedAllowedOrigins.join('\n'),
        appearance: selectedDashboard.value.appearance
      }
      dashboardSettingsErrorMessage.value = ''
      isConfirmingNewEmbedLink.value = false
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

    // "New link" asks once before cutting off everyone who has the current link.
    const isConfirmingNewEmbedLink = ref(false)
    const isRegeneratingEmbedLink = ref(false)

    const onNewEmbedLink = async () => {
      if (!selectedDashboard.value) return

      if (!isConfirmingNewEmbedLink.value) {
        isConfirmingNewEmbedLink.value = true
        return
      }

      isRegeneratingEmbedLink.value = true

      try {
        const response = await regenerateEmbedLink(selectedDashboard.value.id)

        if (response.ok && response.embedId) {
          selectedDashboard.value = { ...selectedDashboard.value, embedId: response.embedId }
          upsertDashboardSummary(selectedDashboard.value)
          success(t('pages.dashboard.selector.embed.newLink.done'), t('pages.dashboard.selector.embed.newLink.doneTitle'))
        } else {
          dashboardSettingsErrorMessage.value = translateMessage(t, response.messageKey, 'dashboards.embed.regenerate.errors.unexpected')
        }
      } finally {
        isRegeneratingEmbedLink.value = false
        isConfirmingNewEmbedLink.value = false
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

      const embedAllowedOrigins = normalizeEmbedOrigins(
        dashboardSettingsInput.value.embedAllowedOrigins.split(/[\n,]+/).map(line => line.trim()).filter(Boolean)
      )

      if (!embedAllowedOrigins) {
        dashboardSettingsErrorMessage.value = t('pages.dashboard.selector.embed.allowedOrigins.invalid', { max: MAX_EMBED_ORIGINS })
        return
      }

      isSavingDashboardSettings.value = true
      dashboardSettingsErrorMessage.value = ''

      try {
        const nextDashboard: DashboardDetails = {
          ...selectedDashboard.value,
          dashboardName,
          embedEnabled: dashboardSettingsInput.value.embedEnabled,
          appearance: dashboardSettingsInput.value.appearance
        }

        const defaultChanged = dashboardSettingsInput.value.isDefault !== selectedDashboard.value.isDefault
        const originsChanged = embedAllowedOrigins.join('\n') !== selectedDashboard.value.embedAllowedOrigins.join('\n')

        // A background save in progress would otherwise swallow these changes.
        if ((defaultChanged || originsChanged) && dashboardSavePromise) {
          await dashboardSavePromise
        }

        const saved = await persistDashboard(nextDashboard, {
          notifyError: false,
          ...(defaultChanged ? { isDefault: dashboardSettingsInput.value.isDefault } : {}),
          ...(originsChanged ? { embedAllowedOrigins } : {})
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
      const nextDashboardId = (remainingDashboards.find(dashboard => dashboard.isDefault) ?? remainingDashboards[0])?.id ?? ''

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
        // The switch, not the saved value, so the link can be copied before saving.
        !dashboardSettingsInput.value.embedEnabled ||
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

    // A new widget starts on the best fit for its query, until the person picks one.
    watch(suggestedPluginIds, (ids) => {
      const best = ids[0]

      if (best && !isEditingWidget.value && !pluginChosenByPerson.value && draft.value.pluginId !== best) {
        draft.value.pluginId = best
      }
    })

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


    return {
      isConfirmingNewEmbedLink,
      isRegeneratingEmbedLink,
      onNewEmbedLink,
      choosePlugin,
      suggestedPluginIds,
      suggestedPlugins,
      permissions,
      addColumnFormat,
      columnFormatColumnOptions,
      columnFormatKindOptions,
      columnFormatPreview,
      columnFormats,
      datePatternOptions,
      maxDatePatternLength,
      textCaseOptions,
      currencyOptions,
      dateStyleOptions,
      isDateKind,
      isNumberKind,
      removeColumnFormat,
      setColumnFormat,
      addLabelOverride,
      addLabelsFromData,
      labelOverrides,
      removeLabelOverride,
      setLabelOverride,
      isSavingStyle,
      isStyleEditorOpen,
      onSaveStyle,
      openStyleEditor,
      styleDraft,
      advancedOptionsInvalid,
      addThresholdStep,
      getSettingSpanClass,
      maxThresholdSteps,
      removeThresholdStep,
      setThresholdColor,
      setThresholdValue,
      thresholdSteps,
      getWidgetTitle,
      getSettingOptions,
      getSettingValue,
      pluginFieldInputs,
      pluginSettingSections,
      activeSettingSections,
      builderTab,
      isWidgetGalleryOpen,
      builderTabs,
      getCardStyle,
      isCardShadowHidden,
      isCardTitleHidden,
      setNumberSetting,
      setSettingValue,
      appearanceOptions,
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
      getUIPluginInputSelectionMode,
      getWidgetErrorMessage,
      getWidgetInlineErrorMessage,
      getWidgetQuery,
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
      loadPreviewQuery,
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
      isEmbedBlocked,
      widgetBlockReason,
      previewErrorMessage,
      previewFieldOptions,
      previewState,
      previewStateKey,
      queryListErrorMessage,
      queryListStatus,
      queryOptions,
      refreshIntervalOptions,
      refreshWidgets,
      selectedDashboard,
      selectedDashboardId,
      selectedDashboardName,
      selectedPlugin,
      selectedPluginUsesQuery,
      contentInputs,
      isWidgetWithoutQuery,
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
