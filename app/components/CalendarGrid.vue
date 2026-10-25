<script setup lang="ts">
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import type { DailyEntry } from '#shared/types'
import type { DayAppearance } from '#shared/utils/day-appearance'
import { getDayAppearance, hasReflection } from '#shared/utils/day-appearance'
import { formatDateKey, formatFullDayLabel } from '~/utils/date-display'

const props = defineProps<{
  month: Date
  entries: DailyEntry[]
  today: string
}>()

const emit = defineEmits<{
  select: [date: string]
}>()

const weekdays = ['一', '二', '三', '四', '五', '六', '日']

const entriesByDate = computed(() => {
  const map = new Map<string, DailyEntry>()
  for (const entry of props.entries) map.set(entry.entryDate, entry)
  return map
})

interface DayCell {
  date: string
  dayNumber: number
  inMonth: boolean
  isToday: boolean
  isFuture: boolean
  entry: DailyEntry | null
  appearance: DayAppearance
}

const cells = computed<DayCell[]>(() => {
  const monthStart = startOfMonth(props.month)
  const monthEnd = endOfMonth(props.month)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) => {
    const key = formatDateKey(date)
    const entry = entriesByDate.value.get(key) ?? null

    return {
      date: key,
      dayNumber: date.getDate(),
      inMonth: isSameMonth(date, props.month),
      isToday: key === props.today,
      isFuture: key > props.today,
      entry,
      appearance: getDayAppearance(entry),
    }
  })
})

const appearanceClasses: Record<DayAppearance, string> = {
  completed: 'bg-emerald-700 text-white hover:bg-emerald-800',
  missed: 'bg-red-600 text-white hover:bg-red-700',
  'reflected-miss': 'bg-green-200 text-green-950 hover:bg-green-300',
  unrecorded: 'bg-white text-neutral-700 ring-1 ring-inset ring-neutral-200 hover:bg-neutral-50',
}

const appearanceIcons: Record<DayAppearance, string | null> = {
  completed: 'i-lucide-check',
  missed: 'i-lucide-x',
  'reflected-miss': 'i-lucide-notebook-pen',
  unrecorded: null,
}

function cellClasses(cell: DayCell): string[] {
  if (cell.isFuture) {
    return [
      'bg-neutral-50 text-neutral-300 ring-1 ring-inset ring-neutral-100 cursor-not-allowed',
    ]
  }

  const classes = [appearanceClasses[cell.appearance]]
  if (cell.isToday) {
    classes.push('outline outline-2 outline-offset-2 outline-emerald-600')
  }
  return classes
}

function ariaLabel(cell: DayCell): string {
  const prefix = `${formatFullDayLabel(cell.date)}${cell.isToday ? '，今天' : ''}`

  if (cell.isFuture) return `${prefix}，未来日期，不可编辑`

  if (cell.appearance === 'unrecorded') return `${prefix}，尚未记录`
  if (cell.appearance === 'completed') {
    return `${prefix}，完成${hasReflection(cell.entry) ? '，已反思' : ''}`
  }
  if (cell.appearance === 'reflected-miss') return `${prefix}，未完成，已反思`
  return `${prefix}，未完成`
}
</script>

<template>
  <div class="mt-4">
    <div class="grid grid-cols-7 gap-1 text-center text-xs font-medium text-neutral-500" aria-hidden="true">
      <div v-for="day in weekdays" :key="day" class="py-1">
        {{ day }}
      </div>
    </div>

    <div class="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
      <template v-for="cell in cells" :key="cell.date">
        <div v-if="!cell.inMonth" class="h-12 sm:h-16" aria-hidden="true" />
        <button
          v-else
          type="button"
          :class="['relative flex h-12 flex-col items-center justify-center rounded-xl text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed sm:h-16', cellClasses(cell)]"
          :disabled="cell.isFuture"
          :aria-label="ariaLabel(cell)"
          :aria-current="cell.isToday ? 'date' : undefined"
          @click="emit('select', cell.date)"
        >
          <span class="leading-none">{{ cell.dayNumber }}</span>
          <UIcon
            v-if="appearanceIcons[cell.appearance]"
            :name="appearanceIcons[cell.appearance]!"
            class="mt-1 size-3.5"
            aria-hidden="true"
          />
          <UIcon
            v-if="cell.entry?.status === 'completed' && hasReflection(cell.entry)"
            name="i-lucide-notebook-pen"
            class="absolute right-1.5 top-1.5 size-2.5 text-white/90"
            aria-hidden="true"
          />
        </button>
      </template>
    </div>

    <ul class="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-neutral-600 sm:flex sm:flex-wrap">
      <li class="flex items-center gap-2">
        <span class="size-3 shrink-0 rounded-sm bg-emerald-700" aria-hidden="true" />
        完成
      </li>
      <li class="flex items-center gap-2">
        <span class="relative size-3 shrink-0 rounded-sm bg-emerald-700" aria-hidden="true">
          <span class="absolute right-0.5 top-0.5 size-1 rounded-full bg-white" />
        </span>
        完成 + reflection
      </li>
      <li class="flex items-center gap-2">
        <span class="size-3 shrink-0 rounded-sm bg-red-600" aria-hidden="true" />
        未完成
      </li>
      <li class="flex items-center gap-2">
        <span class="size-3 shrink-0 rounded-sm bg-green-200 ring-1 ring-inset ring-green-300" aria-hidden="true" />
        未完成 + reflection
      </li>
      <li class="flex items-center gap-2">
        <span class="size-3 shrink-0 rounded-sm bg-white ring-1 ring-inset ring-neutral-300" aria-hidden="true" />
        未记录
      </li>
    </ul>
  </div>
</template>
