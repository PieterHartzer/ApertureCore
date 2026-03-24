<script setup lang="ts">
import PluginRenderer from '~/components/dashboard/PluginRenderer.vue'
import AppAlert from '~/components/ui/AppAlert.vue'
import AppLocaleSelect from '~/components/ui/AppLocaleSelect.vue'
import { useDashboardQueryResults } from '~/composables/dashboard/useDashboardQueryResults'
import { useSavedSqlQueries } from '~/composables/database/useSavedSqlQueries'
import { useUIPlugins } from '~/composables/useUIPlugins'
import type {
  DashboardWidget,
  DashboardWidgetDraft,
  DashboardWidgetPluginConfigPrimitive
} from '~/types/dashboard-widgets'
import {
  createDashboardWidget,
  createDashboardWidgetDraftFromWidget,
  createEmptyDashboardWidgetDraft,
  isDashboardWidgetPluginConfigComplete,
  normalizeDashboardWidgetPluginConfig,
  updateDashboardWidget
} from '~/types/dashboard-widgets'
import type { SavedSqlQuerySummary } from '~/types/saved-sql-queries'
import {
  buildUIPluginFieldOptions,
  getUIPluginInputSelectionMode,
  getUIPluginInputSource,
  type PluginInputDefinition,
  type PluginInputOptionValue,
  filterUIPluginFieldOptions
} from '~/types/uiPlugin'
import { translateMessage } from '~/utils/translateMessage'

const DASHBOARD_REFRESH_TICK_MS = 5000
const WIDGET_REFRESH_INTERVAL_OPTIONS = [15, 30, 60, 300]

const { t, te } = useI18n()
const requestFetch = import.meta.server
  ? useRequestFetch()
  : $fetch
const { listQueries } = useSavedSqlQueries(requestFetch)
const { getPlugin, getPlugins } = useUIPlugins()
const queryResults = useDashboardQueryResults()
const widgets = useState<DashboardWidget[]>('dashboard-widgets', () => [])
const draft = ref<DashboardWidgetDraft>(createEmptyDashboardWidgetDraft())
const editingWidgetId = ref<string | null>(null)
const previewStateKey = ref('')
let refreshTimer: ReturnType<typeof setInterval> | null = null

type PluginInputSelectValue = Exclude<
  DashboardWidgetPluginConfigPrimitive,
  null
>

interface PluginInputSelectOption {
  label: string
  value: PluginInputOptionValue
}

const { data: listResponse, status } = await useAsyncData(
  'dashboard-saved-sql-queries',
  listQueries
)

const queries = computed<SavedSqlQuerySummary[]>(() => {
  return listResponse.value?.ok
    ? listResponse.value.queries ?? []
    : []
})

const queryLookup = computed(() => {
  return new Map(queries.value.map((query) => [query.id, query]))
})

const pluginDefinitions = computed(() => getPlugins())

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

const listErrorMessage = computed(() => {
  if (!listResponse.value || listResponse.value.ok) {
    return ''
  }

  return translateMessage(
    t,
    listResponse.value.messageKey,
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

const resetDraft = () => {
  editingWidgetId.value = null
  draft.value = createEmptyDashboardWidgetDraft()
}

const onEditWidget = (widget: DashboardWidget) => {
  editingWidgetId.value = widget.id
  draft.value = createDashboardWidgetDraftFromWidget(widget)
}

const onCancelEditingWidget = () => {
  resetDraft()
}

const onSubmitWidget = async () => {
  if (submitWidgetDisabled.value || !selectedPlugin.value || !selectedQuery.value) {
    return
  }

  await loadPreviewQuery()

  const defaultTitle = t('pages.dashboard.builder.defaultTitle', {
    queryName: selectedQuery.value.queryName,
    pluginName: getPluginLabel(selectedPlugin.value.id)
  })

  const normalizedDraft: DashboardWidgetDraft = {
    ...draft.value,
    pluginConfig: normalizeDashboardWidgetPluginConfig(
      selectedPlugin.value,
      draft.value.pluginConfig
    ),
    title: draft.value.title.trim() || defaultTitle
  }

  if (editingWidget.value) {
    widgets.value = widgets.value.map((widget) => {
      return widget.id === editingWidget.value?.id
        ? updateDashboardWidget(widget, normalizedDraft)
        : widget
    })
  } else {
    widgets.value = [
      ...widgets.value,
      createDashboardWidget(normalizedDraft)
    ]
  }

  resetDraft()
  await refreshWidgets()
}

const onRemoveWidget = (widgetId: string) => {
  if (editingWidgetId.value === widgetId) {
    resetDraft()
  }

  widgets.value = widgets.value.filter((widget) => widget.id !== widgetId)
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
  () => widgetTargets.value.map((target) => target.queryId).join('|'),
  async () => {
    await refreshWidgets()
  },
  {
    immediate: true
  }
)

onMounted(() => {
  refreshTimer = setInterval(() => {
    void refreshWidgets()
  }, DASHBOARD_REFRESH_TICK_MS)
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
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
        <AppLocaleSelect />
      </template>
    </UPageHeader>

    <UPageBody class="space-y-8">
      <AppAlert
        v-if="listErrorMessage"
        kind="error"
        :title="t('pages.dashboard.errors.loadQueriesTitle')"
      >
        {{ listErrorMessage }}
      </AppAlert>

      <div
        v-else
        class="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"
      >
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

            <div class="flex flex-wrap items-center gap-3">
              <UButton
                :icon="submitWidgetActionIcon"
                :label="submitWidgetActionLabel"
                :disabled="submitWidgetDisabled"
                @click="onSubmitWidget"
              />
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

      <section class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-highlighted">
              {{ t('pages.dashboard.widgets.title') }}
            </h2>
            <p class="text-sm leading-6 text-muted">
              {{ t('pages.dashboard.widgets.description') }}
            </p>
          </div>

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-rotate-cw"
            :label="t('pages.dashboard.widgets.actions.refreshAll')"
            :disabled="widgets.length === 0 || status === 'pending'"
            @click="refreshWidgets(true)"
          />
        </div>

        <UPageCard
          v-if="widgets.length === 0"
          icon="i-lucide-layout-dashboard"
          :title="t('pages.dashboard.widgets.empty.title')"
          :description="t('pages.dashboard.widgets.empty.description')"
        />

        <div
          v-else
          class="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3"
        >
          <UCard
            v-for="widget in widgets"
            :key="widget.id"
            class="h-full"
          >
            <template #header>
              <div class="flex items-start justify-between gap-4">
                <div class="space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="font-semibold text-highlighted">
                      {{ widget.title || getWidgetQuery(widget)?.queryName || t('pages.dashboard.widgets.card.fallbackTitle') }}
                    </h3>
                    <UBadge
                      color="neutral"
                      variant="subtle"
                    >
                      {{ getPluginLabel(widget.pluginId) }}
                    </UBadge>
                  </div>
                  <p class="text-sm leading-6 text-muted">
                    {{ getWidgetQuery(widget)?.queryName ?? t('pages.dashboard.widgets.card.missingQuery') }}
                  </p>
                </div>

                <div class="flex items-center gap-2">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-pencil"
                    :label="t('pages.dashboard.widgets.actions.edit')"
                    @click="onEditWidget(widget)"
                  />
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-rotate-cw"
                    :label="t('pages.dashboard.widgets.actions.refreshOne')"
                    @click="onRefreshWidget(widget)"
                  />
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    :label="t('pages.dashboard.widgets.actions.remove')"
                    @click="onRemoveWidget(widget.id)"
                  />
                </div>
              </div>
            </template>

            <div class="space-y-4">
              <p class="text-xs uppercase tracking-[0.18em] text-muted">
                {{ t('pages.dashboard.widgets.card.refreshEvery', {
                  seconds: widget.refreshIntervalSeconds
                }) }}
              </p>

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

              <div v-else>
                <AppAlert
                  v-if="getWidgetState(widget)?.errorMessage"
                  kind="warning"
                  :title="t('pages.dashboard.widgets.card.warningTitle')"
                  class="mb-4"
                >
                  {{ getWidgetErrorMessage(widget) }}
                </AppAlert>

                <PluginRenderer
                  :widget="widget"
                  :columns="getWidgetState(widget)?.columns ?? []"
                  :rows="getWidgetState(widget)?.rows ?? []"
                />
              </div>
            </div>
          </UCard>
        </div>
      </section>
    </UPageBody>
  </UPage>
</template>
