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
  completed: 'bg-done text-white hover:bg-done-deep',
  missed: 'bg-miss text-white hover:bg-miss-deep',
  'reflected-miss': 'bg-mist text-mist-ink hover:bg-[#c6dbc5]',
  unrecorded: 'bg-sheet text-ink ring-1 ring-inset ring-rule hover:bg-paper',
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
      'bg-transparent text-ink-faint/60 cursor-not-allowed',
    ]
  }

  const classes = [appearanceClasses[cell.appearance]]
  if (cell.isToday) {
    classes.push('outline outline-2 outline-offset-2 outline-done')
  }
  return classes
}

function ariaLabel(cell: DayCell): string {
  const prefix = `${formatFullDayLabel(cell.date)}${cell.isToday ? '，今天' : ''}`

  if (cell.isFuture) return `${prefix}，未来日期，不可编辑`

  if (cell.appearance === 'unrecorded') return `${prefix}，尚未记录`
  if (cell.appearance === 'completed') {
    return `${prefix}，完成${hasReflection(cell.entry) ? '，有记录' : ''}`
  }
  if (cell.appearance === 'reflected-miss') return `${prefix}，未完成，有记录`
  return `${prefix}，未完成`
}
</script>

<template>
  <div class="mt-4 lg:mt-5">
    <div class="grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-faint" aria-hidden="true">
      <div v-for="day in weekdays" :key="day" class="py-1">
        {{ day }}
      </div>
    </div>

    <div class="mt-1 grid grid-cols-7 gap-1 sm:gap-1.5">
      <template v-for="cell in cells" :key="cell.date">
        <div v-if="!cell.inMonth" class="h-12 sm:h-14 lg:h-20" aria-hidden="true" />
        <button
          v-else
          type="button"
          :class="['relative flex h-12 flex-col items-center justify-center rounded-[3px] transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done disabled:cursor-not-allowed sm:h-14 lg:h-20', cellClasses(cell)]"
          :disabled="cell.isFuture"
          :aria-label="ariaLabel(cell)"
          :aria-current="cell.isToday ? 'date' : undefined"
          @click="emit('select', cell.date)"
        >
          <span class="font-serif text-base leading-none sm:text-lg lg:text-2xl">{{ cell.dayNumber }}</span>
          <UIcon
            v-if="appearanceIcons[cell.appearance]"
            :name="appearanceIcons[cell.appearance]!"
            class="mt-1 size-3.5 lg:size-4"
            aria-hidden="true"
          />
          <span
            v-if="cell.entry?.status === 'completed' && hasReflection(cell.entry)"
            class="absolute right-1.5 top-1.5 size-1 rounded-full bg-white/90 lg:size-1.5"
            aria-hidden="true"
          />
        </button>
      </template>
    </div>

    <ul class="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-rule pt-4 text-xs text-ink-soft">
      <li class="flex items-center gap-2">
        <span class="size-2.5 shrink-0 rounded-[2px] bg-done" aria-hidden="true" />
        完成
      </li>
      <li class="flex items-center gap-2">
        <span class="relative size-2.5 shrink-0 rounded-[2px] bg-done" aria-hidden="true">
          <span class="absolute right-0.5 top-0.5 size-1 rounded-full bg-white" />
        </span>
        完成，有记录
      </li>
      <li class="flex items-center gap-2">
        <span class="size-2.5 shrink-0 rounded-[2px] bg-miss" aria-hidden="true" />
        未完成
      </li>
      <li class="flex items-center gap-2">
        <span class="size-2.5 shrink-0 rounded-[2px] bg-mist ring-1 ring-inset ring-[#b7cfb6]" aria-hidden="true" />
        未完成，有记录
      </li>
      <li class="flex items-center gap-2">
        <span class="size-2.5 shrink-0 rounded-[2px] bg-sheet ring-1 ring-inset ring-rule-strong" aria-hidden="true" />
        尚未记录
      </li>
    </ul>
  </div>
</template>
