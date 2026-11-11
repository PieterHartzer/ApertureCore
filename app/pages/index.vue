<script>
import component from '~/view-models/pages/index'

export default component
</script>

<template>
  <UPage>
    <UPageHeader
      :title="selectedDashboardName || t('pages.dashboard.title')"
      :description="hasSelectedDashboard ? undefined : t('pages.dashboard.description')"
    >
      <template #links>
        <div class="flex flex-wrap items-center gap-2">
          <span v-if="dashboards.length > 1" class="hidden text-xs font-medium text-muted sm:inline">{{ t('pages.dashboard.selector.switchLabel') }}</span>
          <USelect
            v-if="dashboards.length > 1"
            :model-value="selectedDashboardId || undefined"
            class="w-full min-w-0 sm:w-56"
            :items="dashboardSelectOptions"
            :placeholder="t('pages.dashboard.selector.placeholder')"
            :aria-label="t('pages.dashboard.selector.placeholder')"
            :disabled="dashboardListStatus === 'pending'"
            @update:model-value="onDashboardSelectionChange"
          />

          <UButton
            v-if="hasSelectedDashboard"
            :color="isDashboardEditing ? 'primary' : 'neutral'"
            :variant="isDashboardEditing ? 'solid' : 'outline'"
            :icon="isDashboardEditing ? 'i-lucide-check' : 'i-lucide-pencil'"
            :label="dashboardEditActionLabel"
            @click="onToggleDashboardEditing"
          />

          <UDropdownMenu
            v-if="dashboards.length > 0"
            :items="[
              [
                { label: t('pages.dashboard.selector.actions.new'), icon: 'i-lucide-plus', onSelect: openCreateDashboardDialog },
                ...(hasSelectedDashboard ? [{ label: t('pages.dashboard.selector.actions.settings'), icon: 'i-lucide-settings-2', onSelect: openDashboardSettings }, { label: t('pages.dashboard.style.open'), icon: 'i-lucide-paintbrush', onSelect: openStyleEditor }] : [])
              ],
              ...(hasSelectedDashboard ? [[{ label: t('pages.dashboard.selector.settings.actions.delete'), icon: 'i-lucide-trash-2', color: 'error', disabled: isSavingDashboardSettings || isDeletingDashboard, onSelect: openDeleteDashboardDialog }]] : [])
            ]"
          >
            <UButton color="neutral" variant="outline" square icon="i-lucide-ellipsis" :aria-label="t('pages.dashboard.selector.actions.settings')" />
          </UDropdownMenu>
        </div>
      </template>
    </UPageHeader>

    <UPageBody class="space-y-4">
      <AppAlert
        v-if="dashboardListErrorMessage"
        kind="error"
        :title="t('pages.dashboard.errors.loadDashboardsTitle')"
      >
        {{ localizeAppMessage($t, dashboardListErrorMessage) }}
      </AppAlert>

      <AppAlert
        v-if="queryListErrorMessage"
        kind="error"
        :title="t('pages.dashboard.errors.loadQueriesTitle')"
      >
        {{ localizeAppMessage($t, queryListErrorMessage) }}
      </AppAlert>

      <UModal
        :open="isCreateDashboardOpen"
        :title="t('pages.dashboard.selector.create.title')"
        :description="t('pages.dashboard.selector.create.description')"
        @update:open="onCreateDashboardOpenChange"
      >
        <template #body>
          <div class="space-y-4 sm:space-y-6">
            <AppAlert
              v-if="createDashboardErrorMessage"
              kind="error"
              :title="t('pages.dashboard.selector.create.errorTitle')"
            >
              {{ localizeAppMessage($t, createDashboardErrorMessage) }}
            </AppAlert>

            <ExtensionSlot name="dashboard.create" />

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
          <div class="space-y-6 sm:space-y-8">
            <AppAlert
              v-if="dashboardSettingsErrorMessage"
              kind="error"
              :title="t('pages.dashboard.selector.settings.errorTitle')"
            >
              {{ localizeAppMessage($t, dashboardSettingsErrorMessage) }}
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
              name="appearance"
              :label="t('pages.dashboard.selector.settings.fields.appearance.label')"
              :description="t('pages.dashboard.selector.settings.fields.appearance.description')"
            >
              <div
                role="radiogroup"
                :aria-label="t('pages.dashboard.selector.settings.fields.appearance.label')"
                class="grid grid-cols-3 gap-2"
              >
                <button
                  v-for="option in appearanceOptions"
                  :key="option"
                  type="button"
                  role="radio"
                  :aria-checked="dashboardSettingsInput.appearance === option"
                  class="appearance-option"
                  @click="dashboardSettingsInput.appearance = option"
                >
                  <span class="appearance-swatch" :data-appearance="option" />
                  <span>{{ t(`pages.dashboard.selector.settings.fields.appearance.options.${option}`) }}</span>
                </button>
              </div>
            </UFormField>

            <UFormField
              name="embedEnabled"
              :label="t('pages.dashboard.selector.settings.fields.embedEnabled.label')"
              :description="t('pages.dashboard.selector.settings.fields.embedEnabled.description')"
            >
              <USwitch v-model="dashboardSettingsInput.embedEnabled" :disabled="isEmbedBlocked" />
              <ExtensionSlot name="dashboard.embedSetting" :slot-props="{ blocked: isEmbedBlocked }" />
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
                  :disabled="!dashboardSettingsInput.embedEnabled"
                  @click="onCopyEmbedUrl"
                />
              </div>

              <p class="mt-2 text-xs text-muted">
                {{
                  !dashboardSettingsInput.embedEnabled
                    ? t('pages.dashboard.selector.embed.disabledHint')
                    : selectedDashboard?.embedEnabled
                      ? t('pages.dashboard.selector.embed.enabledHint')
                      : t('pages.dashboard.selector.embed.pendingHint')
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

      <DashboardStyleEditor
        v-model="styleDraft"
        :open="isStyleEditorOpen"
        :saving="isSavingStyle"
        @update:open="isStyleEditorOpen = $event"
        @save="onSaveStyle"
      />

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
          content: 'w-[calc(100vw-2rem)] max-w-7xl rounded-[10px] ring ring-default',
          body: 'p-0',
          footer: 'border-t border-default'
        }"
        @update:open="onBuilderOpenChange"
      >
        <template #body>
          <div class="grid items-start gap-5 p-4 sm:p-5 xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)]">
            <div class="min-w-0 space-y-3">
              <WidgetGallery
                v-model:open="isWidgetGalleryOpen"
                :items="pluginOptions"
                :selected-id="draft.pluginId"
                @select="draft.pluginId = $event"
              />

              <UTabs
                v-model="builderTab"
                :items="builderTabs"
                :content="false"
                variant="link"
                size="sm"
                class="w-full"
              />

              <div v-show="builderTab === 'data'" class="space-y-3">
              <section class="rounded-lg border border-default">
                <h3 class="px-3 py-2.5 text-sm font-medium text-highlighted">{{ t('pages.dashboard.builder.groups.widget') }}</h3>
                <div class="grid grid-cols-6 gap-3 border-t border-default p-3">
                  <UFormField v-if="selectedPluginUsesQuery" class="col-span-6 sm:col-span-3" name="queryId" :label="t('pages.dashboard.builder.fields.query.label')">
                    <USelect v-model="draft.queryId" class="w-full" :items="queryOptions" :placeholder="t('pages.dashboard.builder.fields.query.placeholder')" />
                  </UFormField>
                  <UFormField class="col-span-6 sm:col-span-3" name="pluginId" :label="t('pages.dashboard.builder.fields.plugin.label')">
                    <template #hint>
                      <UButton
                        variant="link"
                        size="xs"
                        class="p-0"
                        icon="i-lucide-layout-grid"
                        :label="t('pages.dashboard.gallery.open')"
                        data-open-widget-gallery
                        @click="isWidgetGalleryOpen = true"
                      />
                    </template>
                    <USelect v-model="draft.pluginId" class="w-full" :items="pluginOptions" :placeholder="t('pages.dashboard.builder.fields.plugin.placeholder')">
                      <template #item-trailing="{ item }">
                        <span v-if="item.trailingLabel" class="text-xs text-dimmed">{{ item.trailingLabel }}</span>
                      </template>
                    </USelect>
                  </UFormField>
                  <UFormField class="col-span-6 sm:col-span-3" name="title" :label="t('pages.dashboard.builder.fields.title.label')">
                    <UInput v-model="draft.title" class="w-full" :placeholder="t('pages.dashboard.builder.fields.title.placeholder')" />
                  </UFormField>
                  <UFormField v-if="selectedPluginUsesQuery" class="col-span-6 sm:col-span-3" name="refreshIntervalSeconds" :label="t('pages.dashboard.builder.fields.refresh.label')">
                    <USelect v-model="draft.refreshIntervalSeconds" class="w-full" :items="refreshIntervalOptions" />
                  </UFormField>
                  <p v-if="selectedPluginDescription" class="col-span-6 text-xs leading-5 text-muted">{{ selectedPluginDescription }}</p>
                </div>
              </section>

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
                    {{ localizeAppMessage($t, previewErrorMessage) }}
                  </AppAlert>

                  <AppAlert
                    v-else-if="!selectedPlugin"
                    kind="info"
                    :title="t('pages.dashboard.builder.mapping.emptyTitle')"
                  >
                    {{ t('pages.dashboard.builder.mapping.emptyDescription') }}
                  </AppAlert>

                <section v-else-if="contentInputs.length" class="rounded-lg border border-default" data-widget-content>
                  <h3 class="px-3 py-2.5 text-sm font-medium text-highlighted">{{ t('pages.dashboard.builder.groups.content') }}</h3>
                  <div class="grid grid-cols-6 gap-3 border-t border-default p-3">
                    <UFormField
                      v-for="input in contentInputs"
                      :key="input.key"
                      :class="getSettingSpanClass(input)"
                      :name="input.key"
                      :label="getPluginInputLabel(input)"
                      :description="getPluginInputDescription(input)"
                      :required="input.required"
                    >
                      <UTextarea
                        v-if="input.control === 'textarea'"
                        class="w-full"
                        autoresize
                        :rows="4"
                        :maxlength="input.maxLength"
                        :model-value="getSettingValue(input.key) ?? ''"
                        @update:model-value="setSettingValue(input.key, $event)"
                      />
                      <USelect
                        v-else-if="input.control === 'select'"
                        class="w-full"
                        :items="getSettingOptions(input)"
                        :model-value="getSettingValue(input.key)"
                        :placeholder="t('pages.dashboard.builder.mapping.placeholder')"
                        @update:model-value="setSettingValue(input.key, $event)"
                      />
                      <USwitch
                        v-else-if="input.control === 'switch'"
                        :model-value="getSettingValue(input.key) === true"
                        @update:model-value="setSettingValue(input.key, $event)"
                      />
                      <UInput
                        v-else
                        class="w-full"
                        :maxlength="input.maxLength"
                        :model-value="getSettingValue(input.key) ?? ''"
                        @update:model-value="setSettingValue(input.key, $event)"
                      />
                    </UFormField>
                  </div>
                </section>

                  <AppAlert
                    v-else-if="pluginFieldInputs.length === 0 && pluginSettingSections.length === 0"
                    kind="info"
                    :title="t('pages.dashboard.builder.mapping.noneTitle')"
                  >
                    {{ t('pages.dashboard.builder.mapping.noneDescription') }}
                  </AppAlert>

                <section v-else-if="pluginFieldInputs.length" class="rounded-lg border border-default">
                  <h3 class="px-3 py-2.5 text-sm font-medium text-highlighted">{{ t('pages.dashboard.builder.groups.data') }}</h3>
                  <div class="grid grid-cols-6 gap-3 border-t border-default p-3">
                    <UFormField
                      v-for="input in pluginFieldInputs"
                      :key="input.key"
                      class="col-span-6 sm:col-span-3"
                      :name="input.key"
                      :label="getPluginInputLabel(input)"
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
                </section>
              </div>

              <div v-if="builderTab !== 'data'" class="space-y-3">
                <details
                  v-for="section in activeSettingSections"
                  :key="`${builderTab}-${section.id}`"
                  :open="section.id !== 'advanced'"
                  class="group rounded-lg border border-default"
                >
                  <summary class="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-highlighted">
                    {{ section.title }}
                    <UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div class="grid grid-cols-6 gap-3 border-t border-default p-3">
                    <UFormField
                      v-for="input in section.inputs"
                      :key="input.key"
                      :class="getSettingSpanClass(input)"
                      :name="input.key"
                      :label="getPluginInputLabel(input)"
                    >
                      <UInput
                        v-if="input.control === 'number'"
                        type="number"
                        class="w-full"
                        :min="input.min"
                        :max="input.max"
                        :placeholder="builderTab === 'style' ? t('pages.dashboard.plugins.catalog.defaultColor') : undefined"
                        :model-value="getSettingValue(input.key) ?? ''"
                        @update:model-value="setNumberSetting(input.key, $event)"
                      />
                      <UInput
                        v-else-if="input.control === 'text'"
                        class="w-full"
                        :maxlength="input.maxLength"
                        :model-value="getSettingValue(input.key) ?? ''"
                        @update:model-value="setSettingValue(input.key, $event)"
                      />
                      <UTextarea
                        v-else-if="input.control === 'textarea'"
                        class="w-full"
                        autoresize
                        :rows="3"
                        :maxlength="input.maxLength"
                        :model-value="getSettingValue(input.key) ?? ''"
                        @update:model-value="setSettingValue(input.key, $event)"
                      />
                      <ColorField
                        v-else-if="input.control === 'color'"
                        :label="getPluginInputLabel(input)"
                        :placeholder="t('pages.dashboard.plugins.catalog.defaultColor')"
                        :model-value="getSettingValue(input.key) ?? null"
                        @update:model-value="setSettingValue(input.key, $event)"
                      />
                      <div
                        v-else-if="input.control === 'thresholds'"
                        class="space-y-2"
                      >
                        <div
                          v-for="(step, index) in thresholdSteps"
                          :key="index"
                          class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_2rem] items-start gap-2"
                        >
                          <UInput
                            type="number"
                            class="w-full"
                            :placeholder="t('pages.dashboard.plugins.catalog.stepValue')"
                            :aria-label="t('pages.dashboard.plugins.catalog.stepValue')"
                            :model-value="step.from ?? ''"
                            @update:model-value="setThresholdValue(index, $event)"
                          />
                          <ColorField
                            :label="t('pages.dashboard.plugins.catalog.stepColor')"
                            :model-value="step.color"
                            :clearable="false"
                            @update:model-value="setThresholdColor(index, $event ?? step.color)"
                          />
                          <UButton
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            square
                            icon="i-lucide-x"
                            :aria-label="t('pages.dashboard.plugins.catalog.removeStep')"
                            @click="removeThresholdStep(index)"
                          />
                        </div>
                        <UButton
                          color="neutral"
                          variant="outline"
                          size="xs"
                          icon="i-lucide-plus"
                          :label="t('pages.dashboard.plugins.catalog.addStep')"
                          :disabled="thresholdSteps.length >= maxThresholdSteps"
                          @click="addThresholdStep"
                        />
                      </div>
                      <div
                        v-else-if="input.control === 'labels'"
                        class="space-y-2"
                      >
                        <div
                          v-for="(item, index) in labelOverrides"
                          :key="index"
                          class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2"
                        >
                          <UInput
                            class="w-full"
                            :placeholder="t('pages.dashboard.plugins.catalog.labelFrom')"
                            :aria-label="t('pages.dashboard.plugins.catalog.labelFrom')"
                            :model-value="item.from"
                            @update:model-value="setLabelOverride(index, 'from', $event)"
                          />
                          <UInput
                            class="w-full"
                            :placeholder="t('pages.dashboard.plugins.catalog.labelTo')"
                            :aria-label="t('pages.dashboard.plugins.catalog.labelTo')"
                            :model-value="item.to"
                            @update:model-value="setLabelOverride(index, 'to', $event)"
                          />
                          <UButton
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            square
                            icon="i-lucide-x"
                            :aria-label="t('pages.dashboard.plugins.catalog.removeLabel')"
                            @click="removeLabelOverride(index)"
                          />
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <UButton color="neutral" variant="outline" size="xs" icon="i-lucide-wand-sparkles" :label="t('pages.dashboard.plugins.catalog.addLabelsFromData')" @click="addLabelsFromData" />
                          <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-plus" :label="t('pages.dashboard.plugins.catalog.addLabel')" @click="addLabelOverride" />
                        </div>
                      </div>
                      <div
                        v-else-if="input.control === 'json'"
                        class="space-y-1.5"
                      >
                        <UTextarea
                          class="w-full"
                          :rows="8"
                          :maxlength="20000"
                          spellcheck="false"
                          :ui="{ base: 'font-mono text-xs' }"
                          :model-value="getSettingValue(input.key) ?? ''"
                          @update:model-value="setSettingValue(input.key, $event)"
                        />
                        <p
                          v-if="advancedOptionsInvalid"
                          role="alert"
                          class="text-xs text-error"
                        >
                          {{ t('pages.dashboard.plugins.catalog.advancedInvalid') }}
                        </p>
                        <p class="text-xs leading-5 text-muted">
                          {{ t('pages.dashboard.plugins.catalog.advancedHelp') }}
                          <a href="https://echarts.apache.org/en/option.html" target="_blank" rel="noopener" class="text-primary hover:underline">{{ t('pages.dashboard.plugins.catalog.advancedDocs') }}</a>
                        </p>
                      </div>
                      <USelect
                        v-else-if="input.control === 'select'"
                        class="w-full"
                        :items="getSettingOptions(input)"
                        :model-value="getSettingValue(input.key)"
                        :placeholder="builderTab === 'style' ? t('pages.dashboard.plugins.catalog.defaultColor') : t('pages.dashboard.builder.mapping.placeholder')"
                        @update:model-value="setSettingValue(input.key, $event)"
                      />
                      <USwitch
                        v-else
                        :model-value="getSettingValue(input.key) === true"
                        @update:model-value="setSettingValue(input.key, $event)"
                      />
                    </UFormField>
                  </div>
                </details>
              </div>
            </div>

            <UPageCard
              class="min-w-0 xl:sticky xl:top-0"
              :ui="{ container: 'min-w-0', wrapper: 'min-w-0', body: 'min-w-0 w-full' }"
              :title="t('pages.dashboard.preview.title')"
            >
              <div class="min-w-0 space-y-4">
                <div
                  v-if="selectedPluginUsesQuery && !selectedQuery"
                  class="flex min-h-[320px] items-center justify-center rounded-[10px] border border-dashed border-default px-6 py-10 text-sm text-muted"
                >
                  {{ t('pages.dashboard.preview.empty') }}
                </div>

                <div
                  v-else-if="selectedQuery && previewState?.status === 'pending' && previewStateKey === selectedQuery.id"
                  class="flex min-h-[320px] items-center justify-center rounded-[10px] border border-dashed border-default px-6 py-10 text-sm text-muted"
                >
                  {{ t('pages.dashboard.builder.preview.loadingDescription') }}
                </div>

                <div
                  v-else
                  class="h-96 min-w-0 overflow-hidden"
                >
                  <PluginRenderer
                    :widget="{
                      pluginId: draft.pluginId,
                      pluginConfig: draft.pluginConfig
                    }"
                    :columns="previewState?.columns ?? []"
                    :rows="previewState?.rows ?? []"
                  />
                </div>
              </div>
            </UPageCard>
          </div>
        </template>

        <template #footer>
          <div class="flex w-full flex-wrap items-center justify-end gap-3">
            <p v-if="widgetBlockReason" role="status" class="mr-auto text-xs leading-5 text-muted">{{ widgetBlockReason }}</p>
            <UButton
              v-if="selectedPluginUsesQuery"
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

      <section data-dashboard-canvas :data-editing="isDashboardEditing ? '' : undefined" class="space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-1">
            <p class="text-sm leading-6 text-muted">
              {{
                hasSelectedDashboard
                  ? dashboardSaveStatusMessage
                  : ''
              }}
            </p>
          </div>

          <div
            v-if="hasSelectedDashboard"
            class="flex flex-wrap items-center gap-2"
          >
            <UButton
              v-if="isDashboardEditing"
              size="sm"
              icon="i-lucide-plus"
              :label="t('pages.dashboard.builder.actions.add')"
              @click="openWidgetBuilder"
            />
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
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

        <GettingStarted
          v-else-if="dashboards.length === 0"
          @create="openCreateDashboardDialog"
        />

        <AppAlert
          v-else-if="dashboardStatus === 'error'"
          kind="error"
          :title="t('pages.dashboard.errors.loadDashboardTitle')"
        >
          {{ localizeAppMessage($t, dashboardErrorMessage) }}
        </AppAlert>

        <UPageCard
          v-else-if="dashboardStatus === 'pending'"
          icon="i-lucide-loader-circle"
          :title="t('pages.dashboard.states.loadingDashboardTitle')"
          :description="t('pages.dashboard.states.loadingDashboardDescription')"
        />

        <AppEmptyState
          v-else-if="widgets.length === 0"
          icon="i-lucide-layout-dashboard"
          :title="t('pages.dashboard.widgets.empty.title')"
          :description="t('pages.dashboard.widgets.empty.description')"
        >
          <UButton
            icon="i-lucide-plus"
            :label="t('pages.dashboard.builder.actions.add')"
            @click="() => { if (!isDashboardEditing) onToggleDashboardEditing(); openWidgetBuilder() }"
          />
        </AppEmptyState>

        <WidgetGrid
          v-else
          :editable="isDashboardEditing"
          :widgets="widgets"
          @layout-change="onWidgetLayoutChange"
        >
          <template #item="{ widget }">
            <UCard
              data-widget-card
              :data-hide-shadow="isCardShadowHidden(widget.pluginConfig) || undefined"
              class="h-full w-full"
              :style="getCardStyle(widget.pluginConfig ?? {})"
              :ui="{
                root: 'flex h-full min-h-0 w-full flex-col divide-y-0 overflow-hidden ring-inset',
                header: 'flex-none px-4 pb-0 pt-3 sm:px-4 sm:pb-0 sm:pt-3',
                body: isDashboardEditing || !isCardTitleHidden(widget.pluginConfig)
                  ? 'flex min-h-0 flex-1 flex-col px-4 pb-3 pt-1 sm:px-4 sm:pb-3 sm:pt-1'
                  : 'flex min-h-0 flex-1 flex-col p-3 sm:p-4'
              }"
            >
              <template v-if="isDashboardEditing || !isCardTitleHidden(widget.pluginConfig)" #header>
                <div class="flex min-w-0 items-start justify-between gap-3">
                  <h3 data-widget-title class="min-w-0 truncate text-[13px] font-normal text-muted">
                    {{ getWidgetTitle(widget) }}<span v-if="isDashboardEditing" class="text-dimmed"> · {{ getPluginLabel(widget.pluginId) }}</span>
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
                <PluginRenderer
                  v-if="isWidgetWithoutQuery(widget)"
                  class="h-full min-h-0"
                  :widget="widget"
                  :columns="[]"
                  :rows="[]"
                />

                <AppAlert
                  v-else-if="!getWidgetQuery(widget)"
                  kind="warning"
                  :title="t('pages.dashboard.widgets.card.queryMissingTitle')"
                >
                  {{ t('pages.dashboard.widgets.card.queryMissingDescription') }}
                </AppAlert>

                <WidgetSkeleton
                  v-else-if="!getWidgetState(widget) || ['idle', 'pending'].includes(getWidgetState(widget).status)"
                  :plugin-id="widget.pluginId"
                />

                <AppAlert
                  v-else-if="getWidgetState(widget)?.status === 'error'"
                  kind="error"
                  :title="t('pages.dashboard.widgets.card.errorTitle')"
                >
                  {{ localizeAppMessage($t, getWidgetErrorMessage(widget)) }}
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
                      class="max-w-full rounded-lg border px-3 py-2 text-xs"
                      :class="isWidgetRefreshing(widget)
                        ? 'border-default bg-default/90 text-muted'
                        : 'border-error/30 bg-error/10 text-error'"
                    >
                      <div
                        v-if="isWidgetRefreshing(widget)"
                        class="flex items-center gap-2 font-medium"
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
                        <span>{{ localizeAppMessage($t, getWidgetInlineErrorMessage(widget)) }}</span>
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
