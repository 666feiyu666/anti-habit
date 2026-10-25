<script setup lang="ts">
import type { GoalSummary } from '#shared/types'
import { getDayAppearance, hasReflection } from '#shared/utils/day-appearance'

const props = defineProps<{
  goal: GoalSummary
}>()

const emit = defineEmits<{
  rename: []
  delete: []
}>()

const appearance = computed(() => getDayAppearance(props.goal.todayEntry))
const reflected = computed(() => hasReflection(props.goal.todayEntry))

const statusLabel = computed(() => {
  if (appearance.value === 'completed') return '今天已完成'
  if (appearance.value === 'missed') return '今天未完成'
  if (appearance.value === 'reflected-miss') return '今天未完成 · 已记录 reflection'
  return '今天尚未记录'
})

const statusIcon = computed(() => {
  if (appearance.value === 'completed') return 'i-lucide-check'
  if (appearance.value === 'missed') return 'i-lucide-x'
  if (appearance.value === 'reflected-miss') return 'i-lucide-notebook-pen'
  return 'i-lucide-circle-dashed'
})

const statusClasses = computed(() => {
  if (appearance.value === 'completed') return 'bg-emerald-100 text-emerald-900'
  if (appearance.value === 'missed') return 'bg-red-50 text-red-700'
  if (appearance.value === 'reflected-miss') return 'bg-green-100 text-green-950'
  return 'bg-neutral-100 text-neutral-600'
})

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
  <div class="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 sm:gap-4 sm:p-5">
    <NuxtLink
      :to="`/goals/${goal.id}`"
      class="min-w-0 flex-1 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
    >
      <h2 class="truncate text-lg font-medium tracking-tight text-neutral-900">
        {{ goal.title }}
      </h2>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          :class="statusClasses"
        >
          <UIcon :name="statusIcon" class="size-3.5 shrink-0" aria-hidden="true" />
          {{ statusLabel }}
        </span>
        <span
          v-if="reflected && goal.todayEntry?.status === 'completed'"
          class="text-xs text-neutral-500"
        >
          已记录 reflection
        </span>
      </div>
    </NuxtLink>

    <UDropdownMenu v-model:open="menuOpen" :items="menuItems" :content="{ align: 'end' }">
      <UButton
        icon="i-lucide-ellipsis-vertical"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="目标菜单"
      />
    </UDropdownMenu>
  </div>
</template>
