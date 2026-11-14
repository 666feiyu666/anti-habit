<script setup lang="ts">
defineProps<{
  active: 'notes' | 'habits' | 'review'
}>()

const links = [
  { value: 'notes', to: '/', label: '笔记' },
  { value: 'habits', to: '/habits', label: '习惯' },
  { value: 'review', to: '/review', label: '回看' },
] as const
</script>

<template>
  <nav aria-label="主导航" class="flex items-center gap-1 text-sm">
    <NuxtLink
      v-for="link in links"
      :key="link.value"
      :to="link.to"
      class="rounded-sm px-2.5 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done motion-reduce:transition-none"
      :class="active === link.value
        ? 'bg-sheet text-done shadow-[inset_0_-2px_0_var(--color-done)]'
        : 'text-ink-soft hover:bg-sheet/70 hover:text-ink'"
      :aria-current="active === link.value ? 'page' : undefined"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
