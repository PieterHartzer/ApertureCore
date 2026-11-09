<script>
import component from '~/view-models/components/ui/AppLocaleSelect'

export default component
</script>

<template>
  <USelectMenu
    :class="compact ? '' : 'min-h-11'"
    :aria-label="$t('common.labels.locale')"
    :model-value="locale"
    :items="availableLocales"
    value-key="code"
    label-key="name"
    :search-input="false"
    leading-icon="i-lucide-languages"
    size="sm"
    :variant="compact ? 'ghost' : 'outline'"
    @update:model-value="updateLocale"
  />
</template>
