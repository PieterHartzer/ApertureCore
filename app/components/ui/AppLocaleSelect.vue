<script setup lang="ts">
const { locale, locales } = useI18n()

const availableLocales = computed(() => {
  return locales.value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || !('code' in entry)) {
      return []
    }

    const localeCode = entry.code

    if (typeof localeCode !== 'string') {
      return []
    }

    const localeName =
      'name' in entry && typeof entry.name === 'string'
        ? entry.name
        : localeCode

    return [{
      code: localeCode,
      name: localeName
    }]
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
