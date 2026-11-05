<script setup lang="ts">
const route = useRoute()

const goalId = Array.isArray(route.params.id) ? route.params.id[0] : String(route.params.id)
await navigateTo(
  { path: '/habits', query: goalId ? { goal: goalId } : {} },
  { replace: true },
)
</script>

<template>
  <div class="min-h-dvh" />
</template>
