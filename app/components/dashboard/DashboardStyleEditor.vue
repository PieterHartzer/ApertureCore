<script>
import component from '~/view-models/components/dashboard/DashboardStyleEditor'

export default component
</script>

<template>
  <USlideover
    :open="open"
    :overlay="false"
    :modal="false"
    :dismissible="false"
    :title="t('pages.dashboard.style.title')"
    :description="t('pages.dashboard.style.description')"
    @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-3">
        <section
          v-for="group in groups"
          :key="group.id"
          class="rounded-lg border border-default"
        >
          <h3 class="px-3 py-2.5 text-sm font-medium text-highlighted">{{ group.title }}</h3>
          <div class="grid grid-cols-2 gap-3 border-t border-default p-3">
            <UFormField
              v-for="field in group.fields"
              :key="field.key"
              :name="field.key"
              :label="fieldLabel(field)"
            >
              <div
                v-if="field.control === 'color'"
                class="flex h-8 items-center gap-2"
              >
                <input
                  type="color"
                  class="h-8 w-10 shrink-0 cursor-pointer rounded border border-default bg-transparent"
                  :aria-label="fieldLabel(field)"
                  :value="value(field.key) ?? '#808080'"
                  @input="setValue(field.key, $event.target.value)"
                >
                <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted">{{ value(field.key) ?? t('pages.dashboard.plugins.catalog.defaultColor') }}</span>
                <UButton
                  v-if="value(field.key)"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  square
                  icon="i-lucide-x"
                  :aria-label="t('pages.dashboard.plugins.catalog.clearColor')"
                  @click="setValue(field.key, null)"
                />
              </div>
              <UInput
                v-else-if="field.control === 'number'"
                type="number"
                class="w-full"
                :min="field.min"
                :max="field.max"
                :model-value="value(field.key) ?? ''"
                @update:model-value="setNumber(field.key, $event)"
              />
              <USelect
                v-else-if="field.control === 'select'"
                class="w-full"
                :items="fieldOptions(field)"
                :placeholder="t('pages.dashboard.plugins.catalog.defaultColor')"
                :model-value="value(field.key)"
                @update:model-value="setValue(field.key, $event)"
              />
              <USwitch
                v-else
                :model-value="value(field.key) === true"
                @update:model-value="setValue(field.key, $event)"
              />
            </UFormField>
          </div>
        </section>

      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton color="neutral" variant="ghost" :label="t('pages.dashboard.style.reset')" @click="reset" />
        <div class="flex gap-2">
          <UButton color="neutral" variant="ghost" :label="t('pages.dashboard.selector.settings.actions.cancel')" @click="$emit('update:open', false)" />
          <UButton icon="i-lucide-save" :label="t('pages.dashboard.style.save')" :loading="saving" @click="$emit('save')" />
        </div>
      </div>
    </template>
  </USlideover>
</template>
