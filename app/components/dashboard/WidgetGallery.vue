<script>
import component from '~/view-models/components/dashboard/WidgetGallery'

export default component
</script>

<template>
  <UModal
    :open="open"
    :title="t('pages.dashboard.gallery.title')"
    :description="t('pages.dashboard.gallery.description')"
    :ui="{ content: 'sm:max-w-6xl', body: 'p-0 sm:p-0' }"
    @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="grid min-h-0 lg:h-[70vh] lg:grid-cols-[minmax(0,1fr)_380px]">
        <div class="flex min-h-0 flex-col border-default lg:border-r">
          <div class="space-y-3 border-b border-default p-4">
            <UInput
              v-model="search"
              icon="i-lucide-search"
              class="w-full"
              :placeholder="t('pages.dashboard.gallery.search')"
              :aria-label="t('pages.dashboard.gallery.search')"
            />
            <div class="flex flex-wrap gap-1.5" role="group" :aria-label="t('pages.dashboard.gallery.groupsLabel')">
              <UButton
                v-for="group in groups"
                :key="group.id"
                size="xs"
                :variant="activeGroup === group.id ? 'solid' : 'soft'"
                :color="activeGroup === group.id ? 'primary' : 'neutral'"
                :aria-pressed="activeGroup === group.id"
                :label="group.label"
                @click="activeGroup = group.id"
              />
            </div>
          </div>

          <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <p v-if="sections.every(section => section.items.length === 0)" class="py-10 text-center text-sm text-muted">
              {{ t('pages.dashboard.gallery.empty') }}
            </p>
            <section v-for="section in sections" v-show="section.items.length" :key="section.id" class="space-y-2">
              <h3 v-if="section.title" class="text-xs font-medium text-muted">{{ section.title }}</h3>
              <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                <li v-for="item in section.items" :key="item.id">
                  <button
                    type="button"
                    class="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-lg border text-left transition focus-visible:outline-2 focus-visible:outline-primary"
                    :class="focusedId === item.id ? 'border-primary ring-1 ring-primary' : 'border-default hover:border-accented'"
                    :aria-pressed="focusedId === item.id"
                    data-gallery-item
                    @click="focus(item.id)"
                    @dblclick="choose(item.id)"
                  >
                    <div class="pointer-events-none h-28 w-full bg-elevated/40 p-2" aria-hidden="true">
                      <WidgetSample :plugin-id="item.id" :sample="item.sample" minimal />
                    </div>
                    <div class="flex items-start justify-between gap-2 border-t border-default px-2.5 py-2">
                      <span class="text-xs font-medium text-highlighted">{{ item.label }}</span>
                      <span v-if="item.trailingLabel" class="shrink-0 text-[11px] text-dimmed">{{ item.trailingLabel }}</span>
                    </div>
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </div>

        <aside v-if="focused" ref="details" class="flex min-h-0 flex-col border-t border-default lg:border-t-0" aria-live="polite">
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div class="h-52 rounded-lg border border-default bg-elevated/40 p-3">
              <WidgetSample :key="focused.id" :plugin-id="focused.id" :sample="focused.sample" eager />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-semibold text-highlighted">{{ focused.label }}</h3>
                <UBadge v-if="focused.trailingLabel" size="sm" variant="subtle" color="neutral" :label="focused.trailingLabel" />
              </div>
              <p class="mt-1 text-sm text-muted">{{ focused.description }}</p>
            </div>
            <div v-if="focused.useWhen">
              <h4 class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ t('pages.dashboard.gallery.useWhen') }}</h4>
              <p class="mt-1 text-sm text-default">{{ focused.useWhen }}</p>
            </div>
            <div v-if="focused.needs.length">
              <h4 class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ t('pages.dashboard.gallery.needs') }}</h4>
              <ul class="mt-1 space-y-1">
                <li v-for="need in focused.needs" :key="need.label" class="flex gap-2 text-sm">
                  <UIcon name="i-lucide-columns-3" class="mt-0.5 size-4 shrink-0 text-dimmed" aria-hidden="true" />
                  <span><span class="text-highlighted">{{ need.label }}</span> <span class="text-muted">· {{ need.types }}</span></span>
                </li>
              </ul>
            </div>
            <div v-if="focused.sample?.rows.length">
              <h4 class="text-xs font-medium uppercase tracking-wide text-dimmed">{{ t('pages.dashboard.gallery.exampleData') }}</h4>
              <div class="mt-1 overflow-x-auto rounded-md border border-default">
                <table class="w-full text-left text-xs">
                  <thead class="bg-elevated/60 text-muted">
                    <tr>
                      <th v-for="column in focused.columns" :key="column" scope="col" class="px-2 py-1.5 font-medium">{{ column }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, index) in focused.exampleRows" :key="index" class="border-t border-default">
                      <td v-for="column in focused.columns" :key="column" class="whitespace-nowrap px-2 py-1 font-mono text-default">{{ row[column] }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-if="focused.moreRows" class="mt-1 text-xs text-dimmed">{{ t('pages.dashboard.gallery.moreRows', { count: focused.moreRows }) }}</p>
            </div>
          </div>
          <div class="flex justify-end gap-2 border-t border-default p-4">
            <UButton color="neutral" variant="ghost" :label="t('pages.dashboard.gallery.cancel')" @click="$emit('update:open', false)" />
            <UButton icon="i-lucide-check" :label="t('pages.dashboard.gallery.use')" @click="choose(focused.id)" />
          </div>
        </aside>
      </div>
    </template>
  </UModal>
</template>
