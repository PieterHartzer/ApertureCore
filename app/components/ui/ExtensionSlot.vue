<script>
import component from '~/view-models/components/ui/ExtensionSlot'

export default component
</script>

<template>
  <component :is="item" v-for="(item, index) in components" :key="index" v-bind="slotProps" />
</template>
