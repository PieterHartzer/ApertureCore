<script setup lang="ts">
const route = useRoute()
await navigateTo({ path: '/sql-workspace', query: { queryId: String(route.params.queryId) } }, { replace: true, redirectCode: 302 })
</script>

<template>
  <div />
</template>
