<script setup lang="ts">
import { en } from '@nuxt/ui/locale'

const { locale } = useI18n()
const htmlLang = computed(() => {
  return locale.value === 'pseudo' ? 'en-XA' : 'en'
})

useHead({
  htmlAttrs: {
    lang: htmlLang,
    dir: 'ltr'
  }
})
</script>

<template>
  <UApp
    :locale="en"
    :toaster="{ position: 'top-right', duration: 5000 }"
  >
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <DebugLinksMenu />
  </UApp>
</template>
