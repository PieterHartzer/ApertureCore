<script setup lang="ts">
const { locale, locales } = useI18n()

const availableLocales = computed(() => {
  return locales.value
    .filter((entry): entry is { code: string, name?: string } => {
      return typeof entry === 'object' && entry !== null && 'code' in entry
    })
    .map((entry) => {
      return {
        code: entry.code,
        name: entry.name ?? entry.code
      }
    })
})
</script>

<template>
  <USelectMenu
    v-model="locale"
    :items="availableLocales"
    value-key="code"
    label-key="name"
    :search-input="false"
    leading-icon="i-lucide-languages"
    size="sm"
    variant="outline"
  />
</template>
