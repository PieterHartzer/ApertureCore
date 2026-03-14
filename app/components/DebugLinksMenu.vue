<script setup lang="ts">
const isOpen = ref(false)
const showMenu = ref(false)
const {
  public: { devToolsLinks },
} = useRuntimeConfig()

onMounted(() => {
  showMenu.value = import.meta.dev && Boolean(devToolsLinks?.enabled)
})

const links = computed(() => {
  const items = [
    {
      href: devToolsLinks?.mailInboxUrl,
      label: 'Mail Inbox',
    },
    {
      href: devToolsLinks?.providerConsoleUrl,
      label: 'Dev Provider Console',
    },
  ]

  return items.filter((item) => Boolean(item.href))
})
</script>

<template>
  <ClientOnly>
    <Teleport
      v-if="showMenu && links.length"
      to="body"
    >
      <div class="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
        <div
          v-if="isOpen"
          id="debug-links-menu"
          class="w-56 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Debug Links
          </p>
          <div class="mt-3 flex flex-col gap-2">
            <a
              v-for="link in links"
              :key="link.label"
              :href="link.href"
              target="_blank"
              rel="noreferrer"
              class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              {{ link.label }}
            </a>
          </div>
        </div>

        <button
          type="button"
          class="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800"
          :aria-expanded="isOpen"
          aria-controls="debug-links-menu"
          @click="isOpen = !isOpen"
        >
          {{ isOpen ? 'Close Debug' : 'Debug' }}
        </button>
      </div>
    </Teleport>
  </ClientOnly>
</template>
