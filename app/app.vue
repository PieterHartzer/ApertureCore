<script setup lang="ts">
import AppNavigation from '~/components/ui/AppNavigation.vue'
import { de, en, es, fr, pt, pt_br } from '@nuxt/ui/locale'

const route = useRoute()
const showNavigation = computed(() => !route.meta.public && !route.path.startsWith('/auth/') && !route.path.startsWith('/embed/'))
const { locale } = useI18n()
const pseudo = extendLocale(en, {
  code: 'en-XA',
  name: 'Pseudo'
})
// Nuxt UI's own words (date pickers, empty states) in the same language.
const locales: Record<string, typeof en> = {
  en,
  'es': es,
  'fr': fr,
  'de': de,
  'pt-BR': pt_br,
  'pt-PT': pt,
  pseudo
}

const uiLocale = computed(() => {
  return locales[locale.value] ?? en
})

useHead(() => ({
  htmlAttrs: {
    lang: uiLocale.value.code,
    dir: uiLocale.value.dir
  }
}))
</script>

<template>
  <UApp
    :locale="uiLocale"
    :toaster="{ position: 'bottom-right', duration: 5000 }"
  >
    <NuxtRouteAnnouncer />
    <div v-if="showNavigation" class="flex min-h-dvh flex-col lg:flex-row">
      <AppNavigation />
      <main class="min-w-0 flex-1">
        <div class="w-full px-4 py-6 sm:px-6 lg:px-8"><NuxtPage /></div>
      </main>
    </div>
    <NuxtPage v-else />
    <DebugLinksMenu />
  </UApp>
</template>
