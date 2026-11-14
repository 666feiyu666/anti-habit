<script setup lang="ts">
defineProps<{
  active: 'notes' | 'habits' | 'review'
  todayLabel: string
  note?: string
}>()
</script>

<template>
  <header class="reveal flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-rule pb-5">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
      <NuxtLink
        to="/"
        class="font-serif text-[1.6rem] leading-none tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-done"
      >
        Anti-Habit
      </NuxtLink>
      <SiteNav :active="active" />
    </div>

    <div class="hidden text-right sm:block">
      <p class="flex items-center justify-end gap-2 text-sm text-ink-soft">
        <span class="inline-block h-px w-6 bg-brass/70" aria-hidden="true" />
        {{ todayLabel }}
      </p>
      <p v-if="note" class="ml-auto mt-1 max-w-[18rem] font-serif text-xs italic leading-5 text-ink-faint">
        {{ note }}
      </p>
    </div>

    <p class="flex items-center gap-2 text-sm text-ink-soft sm:hidden">
      <span class="inline-block h-px w-6 bg-brass/70" aria-hidden="true" />
      {{ todayLabel }}
    </p>
  </header>
</template>
