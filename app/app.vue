<script setup lang="ts">
import AppNavigation from '~/components/ui/AppNavigation.vue'
import { en } from '@nuxt/ui/locale'

const route = useRoute()
const showNavigation = computed(() => !route.meta.public && !route.path.startsWith('/auth/') && !route.path.startsWith('/embed/'))
const { locale } = useI18n()
const pseudo = extendLocale(en, {
  code: 'en-XA',
  name: 'Pseudo'
})
const locales = {
  en,
  pseudo
} as const

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
    :toaster="{ position: 'top-right', duration: 5000 }"
  >
    <NuxtRouteAnnouncer />
    <AppNavigation v-if="showNavigation" />
    <div :class="showNavigation ? 'py-6 sm:py-8' : undefined"><NuxtPage /></div>
    <DebugLinksMenu />
  </UApp>
</template>
