<script setup lang="ts">
import { addMonths, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import type { DailyEntry, Goal } from '#shared/types'
import { todayDateOnly } from '#shared/utils/date'
import { formatDateKey, formatMonthLabel } from '~/utils/date-display'

const route = useRoute()
const goalId = computed(() => String(route.params.id))

const today = ref(todayDateOnly())
const monthAnchor = ref(startOfMonth(parseISO(today.value)))

const { data: goalData, pending: goalPending, error: goalError } = await useFetch<{ goal: Goal }>(
  () => `/api/goals/${goalId.value}`,
  { key: `goal-detail:${goalId.value}` },
)

const goal = computed(() => goalData.value?.goal ?? null)

useHead(() => ({
  title: goal.value ? `${goal.value.title} · Anti-Habit` : '目标 · Anti-Habit',
}))

const monthKey = computed(() => format(monthAnchor.value, 'yyyy-MM'))
const monthLabel = computed(() => formatMonthLabel(monthAnchor.value))

const rangeFrom = computed(() => formatDateKey(startOfWeek(startOfMonth(monthAnchor.value), { weekStartsOn: 1 })))
const rangeTo = computed(() => formatDateKey(endOfWeek(endOfMonth(monthAnchor.value), { weekStartsOn: 1 })))

const entriesKey = computed(() => `goal-entries:${goalId.value}:${monthKey.value}`)

const {
  data: entriesData,
  pending: entriesPending,
  error: entriesError,
  refresh: refreshEntries,
} = await useAsyncData(
  entriesKey,
  async () => {
    if (!goal.value) return { entries: [] as DailyEntry[] }
    return await $fetch<{ entries: DailyEntry[] }>(`/api/goals/${goalId.value}/entries`, {
      query: { from: rangeFrom.value, to: rangeTo.value },
    })
  },
  {
    watch: [monthKey],
    default: () => ({ entries: [] as DailyEntry[] }),
  },
)

const entries = computed(() => entriesData.value?.entries ?? [])
const isCurrentMonth = computed(() => monthKey.value === format(parseISO(today.value), 'yyyy-MM'))

const selectedDate = ref<string | null>(null)
const editorOpen = ref(false)
const selectedEntry = computed(() => (
  entries.value.find(entry => entry.entryDate === selectedDate.value) ?? null
))

onMounted(() => {
  const actualToday = todayDateOnly()
  if (actualToday === today.value) return

  const wasCurrentMonth = isCurrentMonth.value
  today.value = actualToday
  if (wasCurrentMonth) monthAnchor.value = startOfMonth(parseISO(actualToday))
})

function previousMonth() {
  monthAnchor.value = addMonths(monthAnchor.value, -1)
}

function nextMonth() {
  monthAnchor.value = addMonths(monthAnchor.value, 1)
}

function goToCurrentMonth() {
  monthAnchor.value = startOfMonth(parseISO(today.value))
}

function openDay(date: string) {
  if (date > today.value) return
  selectedDate.value = date
  editorOpen.value = true
}
</script>

<template>
  <div class="min-h-screen">
    <main v-if="goal" class="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-1.5 rounded-lg text-sm text-neutral-500 transition hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />
        返回目标
      </NuxtLink>

      <header class="mt-5">
        <h1 class="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          {{ goal.title }}
        </h1>
        <p class="mt-2 text-sm text-neutral-600">
          点选今天或过去的一天来记录。未来日期不可编辑。
        </p>
      </header>

      <section
        class="mt-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6"
        aria-labelledby="calendar-heading"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="ghost"
              aria-label="上一个月"
              @click="previousMonth"
            />
            <h2 id="calendar-heading" class="min-w-32 text-center text-base font-medium text-neutral-900">
              {{ monthLabel }}
            </h2>
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="ghost"
              aria-label="下一个月"
              @click="nextMonth"
            />
          </div>

          <div class="flex items-center gap-2">
            <span v-if="entriesPending" class="text-xs text-neutral-400">载入中…</span>
            <UButton
              v-if="!isCurrentMonth"
              label="回到本月"
              icon="i-lucide-calendar"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="goToCurrentMonth"
            />
          </div>
        </div>

        <UAlert
          v-if="entriesError"
          color="error"
          variant="soft"
          title="记录加载失败"
          :description="getApiErrorMessage(entriesError)"
          class="mt-4"
        />

        <CalendarGrid
          :month="monthAnchor"
          :entries="entries"
          :today="today"
          @select="openDay"
        />
      </section>

      <p class="mt-4 text-xs leading-5 text-neutral-500">
        没有标记的日期不等于未完成，只表示还没有记录。浅绿色表示当天仍未完成，同时留下了 reflection。
      </p>
    </main>

    <main v-else-if="goalPending" class="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <div class="h-40 animate-pulse rounded-2xl bg-neutral-100" aria-busy="true" aria-label="正在载入目标" />
    </main>

    <main v-else class="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <div class="rounded-2xl border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
        <UIcon name="i-lucide-circle-help" class="mx-auto size-8 text-neutral-400" aria-hidden="true" />
        <h1 class="mt-4 text-xl font-medium text-neutral-900">
          {{ goalError ? '目标不存在或已被删除' : '找不到这个目标' }}
        </h1>
        <p class="mt-2 text-sm text-neutral-500">
          它可能已经被删除，或者链接不正确。
        </p>
        <UButton to="/" label="返回目标列表" class="mt-6" />
      </div>
    </main>

    <DayEditorModal
      v-if="goal"
      v-model:open="editorOpen"
      :goal-id="goalId"
      :date="selectedDate ?? ''"
      :entry="selectedEntry"
      @changed="refreshEntries"
    />
  </div>
</template>
