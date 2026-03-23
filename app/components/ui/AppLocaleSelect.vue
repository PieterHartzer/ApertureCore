<script setup lang="ts">
const { locale, localeCodes, locales, setLocale } = useI18n()

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

async function updateLocale(localeCode: string | undefined) {
  if (!localeCode || localeCode === locale.value || !isLocaleCode(localeCode)) {
    return
  }

  await setLocale(localeCode)
}

function isLocaleCode(localeCode: string): localeCode is typeof locale.value {
  return localeCodes.value.some(code => code === localeCode)
}
</script>

<template>
  <USelectMenu
    :model-value="locale"
    :items="availableLocales"
    value-key="code"
    label-key="name"
    :search-input="false"
    leading-icon="i-lucide-languages"
    size="sm"
    variant="outline"
    @update:model-value="updateLocale"
  />
</template>
