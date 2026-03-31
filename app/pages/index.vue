<script>
import component from '~/view-models/pages/index'

export default component
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
