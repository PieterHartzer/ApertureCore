<script>
import component from '~/view-models/components/ui/AppLocaleSelect'

export default component
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
