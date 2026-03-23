<script setup lang="ts">
import { en } from '@nuxt/ui/locale'

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
    <NuxtPage />
    <DebugLinksMenu />
  </UApp>
</template>
