<script setup lang="ts">
import type { GoalSummary } from '#shared/types'
import type { DayAppearance } from '#shared/utils/day-appearance'
import { getDayAppearance } from '#shared/utils/day-appearance'

const props = defineProps<{
  goal: GoalSummary
}>()

const emit = defineEmits<{
  rename: []
  delete: []
}>()

const appearance = computed(() => getDayAppearance(props.goal.todayEntry))
const reflection = computed(() => props.goal.todayEntry?.reflection?.trim() ?? '')

const statusLabel: Record<DayAppearance, string> = {
  completed: '完成',
  missed: '未完成',
  'reflected-miss': '未完成，有记录',
  unrecorded: '尚未记录',
}

const statusDot: Record<DayAppearance, string> = {
  completed: 'bg-done',
  missed: 'bg-miss',
  'reflected-miss': 'bg-mist ring-1 ring-inset ring-[#b7cfb6]',
  unrecorded: 'bg-transparent ring-1 ring-inset ring-rule-strong',
}

const menuOpen = ref(false)

const menuItems = computed(() => [
  [
    {
      label: '重命名',
      icon: 'i-lucide-pencil',
      onSelect: () => {
        menuOpen.value = false
        emit('rename')
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
  <div class="group flex items-start gap-2 px-2 py-4 hover:bg-sheet sm:items-center sm:px-3">
    <NuxtLink
      :to="`/goals/${goal.id}`"
      class="grid min-w-0 flex-1 grid-cols-1 items-center gap-x-4 gap-y-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-done sm:grid-cols-[minmax(0,1fr)_auto]"
    >
      <h2 class="min-w-0 truncate font-serif text-xl tracking-tight text-ink sm:text-2xl">
        {{ goal.title }}
      </h2>

      <span
        class="flex shrink-0 items-center gap-2 text-sm sm:col-start-2 sm:row-start-1"
        :class="appearance === 'unrecorded' ? 'text-ink-faint' : 'text-ink-soft'"
      >
        <span class="size-2.5 rounded-[2px]" :class="statusDot[appearance]" aria-hidden="true" />
        {{ statusLabel[appearance] }}
      </span>

      <p
        v-if="reflection"
        class="line-clamp-1 min-w-0 font-serif text-sm leading-6 text-ink-soft sm:col-start-1 sm:row-start-2"
      >
        {{ reflection }}
      </p>
    </NuxtLink>

    <UDropdownMenu v-model:open="menuOpen" :items="menuItems" :content="{ align: 'end' }">
      <UButton
        icon="i-lucide-ellipsis-vertical"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="目标菜单"
        class="shrink-0 opacity-60 group-hover:opacity-100"
      />
    </UDropdownMenu>
  </div>
</template>
