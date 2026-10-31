<script setup lang="ts">
import type { GoalSummary } from '#shared/types'
import { getDayAppearance } from '#shared/utils/day-appearance'
import { dayStatusDot, dayStatusLabel } from '~/utils/day-display'

const props = defineProps<{
  goal: GoalSummary
  selected: boolean
}>()

const emit = defineEmits<{
  select: []
  openEssay: []
  edit: []
  delete: []
}>()

const appearance = computed(() => getDayAppearance(props.goal.todayEntry))
const menuOpen = ref(false)

const menuItems = computed(() => [
  [
    {
      label: '编辑',
      icon: 'i-lucide-pencil',
      onSelect: () => {
        menuOpen.value = false
        emit('edit')
      },
    },
    {
      label: '删除',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => {
        menuOpen.value = false
        emit('delete')
      },
    },
  ],
])
</script>

<template>
  <article
    class="book-item group py-4 pl-4 pr-2"
    :data-selected="selected"
  >
    <span v-if="selected" class="book-ribbon" aria-hidden="true" />
    <button
      type="button"
      class="block w-full min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-done"
      :aria-pressed="selected"
      @click="emit('select')"
    >
      <span
        class="block truncate font-serif text-xl leading-7 transition-colors motion-reduce:transition-none"
        :class="selected ? 'text-done' : 'text-ink group-hover:text-done'"
      >
        {{ goal.essayTitle || '随笔' }}
      </span>
      <span class="mt-0.5 block truncate text-sm text-ink-soft">
        {{ goal.title }}
      </span>
      <span
        class="mt-1.5 flex items-center gap-2 text-xs"
        :class="appearance === 'unrecorded' ? 'text-ink-faint' : 'text-ink-soft'"
      >
        <span class="size-2 rounded-[2px]" :class="dayStatusDot[appearance]" aria-hidden="true" />
        {{ dayStatusLabel[appearance] }}
      </span>
    </button>

    <div class="mt-2 flex items-center justify-between gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 text-xs text-done/90 underline-offset-4 hover:text-done hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
        @click="emit('openEssay')"
      >
        <UIcon name="i-lucide-book-open" class="size-3.5" aria-hidden="true" />
        打开随笔
      </button>

      <UDropdownMenu v-model:open="menuOpen" :items="menuItems" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="目标菜单"
          class="opacity-60 group-hover:opacity-100"
        />
      </UDropdownMenu>
    </div>
  </article>
</template>
