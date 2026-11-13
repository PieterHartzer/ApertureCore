<script setup lang="ts">
// The brand mark for public pages (sign-in, sign-up). A layer may set brand.logo;
// with includesName the image already holds the name, so it isn't typed beside it.
const brandName = useAppConfig().brand.name
const brandLogo = (useAppConfig().brand as { logo?: { light: string, dark: string, includesName?: boolean } }).logo
</script>

<template>
  <div class="flex items-center justify-center gap-2 text-lg font-semibold text-highlighted">
    <template v-if="brandLogo">
      <img :src="brandLogo.light" :alt="brandLogo.includesName ? brandName : ''" class="h-8 w-auto dark:hidden">
      <img :src="brandLogo.dark" :alt="brandLogo.includesName ? brandName : ''" class="hidden h-8 w-auto dark:block">
    </template>
    <span v-else class="grid size-8 place-items-center rounded-md bg-linear-to-br from-blue-500 to-violet-600 text-white">
      <UIcon name="i-lucide-aperture" class="size-5" aria-hidden="true" />
    </span>
    <span v-if="!brandLogo?.includesName">{{ brandName }}</span>
  </div>
</template>
