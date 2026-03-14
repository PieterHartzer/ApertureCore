<script setup lang="ts">
const { currentProvider, loggedIn, user } = useOidcAuth()

if (import.meta.client) {
  watch(
    [loggedIn, currentProvider, user],
    ([isLoggedIn, provider, currentUser]) => {
      console.info('[oidc] dashboard session', {
        loggedIn: isLoggedIn,
        provider: provider ?? null,
        user: currentUser ?? null,
      })
    },
    {
      immediate: true,
    }
  )
}
</script>

<template>
  <h1>Dashboard</h1>
</template>
