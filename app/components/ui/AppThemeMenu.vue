<script setup lang="ts">
// System / Light / Dark. "System" follows the device, as the website and the
// sign-in pages do, so the theme stays the same across them.
const colorMode = useColorMode()
const { t } = useI18n()

const ICONS: Record<string, string> = { system: 'i-lucide-monitor', light: 'i-lucide-sun', dark: 'i-lucide-moon' }

const items = computed(() => [['system', 'light', 'dark'].map(mode => ({
  label: t(`navigation.theme.${mode}`),
  icon: ICONS[mode],
  type: 'checkbox' as const,
  checked: colorMode.preference === mode,
  onSelect: () => { colorMode.preference = mode }
}))])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      color="neutral"
      variant="ghost"
      size="sm"
      square
      :icon="ICONS[colorMode.preference] ?? ICONS.system"
      :aria-label="t('navigation.theme.label')"
      :title="t('navigation.theme.label')"
    />
  </UDropdownMenu>
</template>
