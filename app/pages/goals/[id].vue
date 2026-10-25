<script setup lang="ts">
const route = useRoute()

await navigateTo(`/?goal=${encodeURIComponent(String(route.params.id))}`, { replace: true })
</script>

<template>
  <div class="min-h-dvh" />
</template>
