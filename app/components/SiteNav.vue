<script setup lang="ts">
defineProps<{
  active: 'notes' | 'habits' | 'review'
}>()
</script>

<template>
  <nav aria-label="主导航" class="flex items-center gap-1 text-sm">
    <NuxtLink
      to="/"
      class="rounded-sm px-2.5 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done motion-reduce:transition-none"
      :class="active === 'notes'
        ? 'bg-sheet text-done shadow-[inset_0_-2px_0_var(--color-done)]'
        : 'text-ink-soft hover:bg-sheet/70 hover:text-ink'"
      :aria-current="active === 'notes' ? 'page' : undefined"
    >
      笔记
    </NuxtLink>
    <NuxtLink
      to="/habits"
      class="rounded-sm px-2.5 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done motion-reduce:transition-none"
      :class="active === 'habits'
        ? 'bg-sheet text-done shadow-[inset_0_-2px_0_var(--color-done)]'
        : 'text-ink-soft hover:bg-sheet/70 hover:text-ink'"
      :aria-current="active === 'habits' ? 'page' : undefined"
    >
      习惯
    </NuxtLink>
    <NuxtLink
      to="/review"
      class="rounded-sm px-2.5 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done motion-reduce:transition-none"
      :class="active === 'review'
        ? 'bg-sheet text-done shadow-[inset_0_-2px_0_var(--color-done)]'
        : 'text-ink-soft hover:bg-sheet/70 hover:text-ink'"
      :aria-current="active === 'review' ? 'page' : undefined"
    >
      回看
    </NuxtLink>
  </nav>
</template>
