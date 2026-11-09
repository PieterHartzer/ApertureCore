<script>
import component from '~/view-models/components/DebugLinksMenu'

export default component
</script>

<template>
  <ClientOnly>
    <Teleport
      v-if="showMenu && links.length"
      to="body"
    >
      <div class="fixed bottom-4 left-4 z-30 flex flex-col items-start gap-3 lg:left-60">
        <div
          v-if="isOpen"
          id="debug-links-menu"
          class="w-56 rounded-[10px] border border-default bg-elevated p-3"
        >
          <p class="text-xs font-medium text-muted">
            {{ $t('interface.debugLinks') }}
          </p>
          <div class="mt-3 flex flex-col gap-2">
            <a
              v-for="link in links"
              :key="link.label"
              :href="link.href"
              target="_blank"
              rel="noreferrer"
              class="rounded-xl border border-default px-3 py-2 text-sm font-medium text-toned transition hover:border-accented hover:bg-elevated hover:text-highlighted"
            >
              {{ localizeAppMessage($t, link.label) }}
            </a>
          </div>
        </div>

        <button
          type="button"
          class="rounded-full bg-inverted px-4 py-3 text-sm font-semibold text-inverted transition hover:opacity-90"
          :aria-expanded="isOpen"
          aria-controls="debug-links-menu"
          @click="isOpen = !isOpen"
        >
          {{ isOpen ? $t('interface.closeDebug') : $t('interface.debug') }}
        </button>
      </div>
    </Teleport>
  </ClientOnly>
</template>
