<script setup lang="ts">
import { addMonths, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import type { DailyEntry, Goal } from '#shared/types'
import { todayDateOnly } from '#shared/utils/date'
import { formatDateKey, formatMonthLabel } from '~/utils/date-display'

const route = useRoute()
const goalId = computed(() => String(route.params.id))
const isDesktop = useIsDesktop()

const today = ref(todayDateOnly())
const monthAnchor = ref(startOfMonth(parseISO(today.value)))
const selectedDate = ref(today.value)
const editorOpen = ref(false)

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
const selectionInMonth = computed(() => selectedDate.value.startsWith(monthKey.value))
const selectedEntry = computed(() => (
  entries.value.find(entry => entry.entryDate === selectedDate.value) ?? null
))
const isSelectedToday = computed(() => selectedDate.value === today.value)

onMounted(() => {
  const actualToday = todayDateOnly()
  if (actualToday === today.value) return

  const wasSelectedToday = selectedDate.value === today.value
  const wasCurrentMonth = isCurrentMonth.value

  today.value = actualToday
  if (wasSelectedToday) selectedDate.value = actualToday
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
  if (!isDesktop.value) editorOpen.value = true
}
</script>

<template>
  <div class="min-h-dvh">
    <main v-if="goal" class="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6 lg:px-10 lg:py-12">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-1.5 rounded-sm text-sm text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-done"
      >
        <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" />
        返回目标
      </NuxtLink>

      <div class="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 xl:gap-16">
        <section>
          <header class="max-w-xl">
            <h1 class="font-serif text-3xl tracking-tight text-ink sm:text-4xl">
              {{ goal.title }}
            </h1>
            <p class="mt-3 text-sm leading-6 text-ink-soft">
              点今天或过去的一天来记录。未来的日期还不能编辑。
            </p>
          </header>

          <div
            class="mt-7 border border-rule bg-sheet p-4 sm:p-6"
            aria-labelledby="calendar-heading"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-1">
                <UButton
                  icon="i-lucide-chevron-left"
                  color="neutral"
                  variant="ghost"
                  aria-label="上一个月"
                  @click="previousMonth"
                />
                <h2 id="calendar-heading" class="min-w-32 text-center font-serif text-lg text-ink">
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
                <span v-if="entriesPending" class="text-xs text-ink-faint">读取中…</span>
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
              title="没能读到这个月的记录"
              :description="getApiErrorMessage(entriesError)"
              class="mt-4"
            />

            <CalendarGrid
              :month="monthAnchor"
              :entries="entries"
              :today="today"
              @select="openDay"
            />
          </div>

          <p class="mt-4 max-w-xl text-xs leading-5 text-ink-faint">
            没完成、但留了记录的日子，格子里是浅绿色。
          </p>
        </section>

        <aside class="hidden lg:block">
          <div class="sticky top-12">
            <DayEditorPanel
              v-if="selectionInMonth"
              :goal-id="goalId"
              :date="selectedDate"
              :entry="selectedEntry"
              :is-today="isSelectedToday"
              @changed="refreshEntries"
            />
            <div v-else class="lg:border-l lg:border-rule lg:pl-8">
              <p class="font-serif text-2xl text-ink">
                选一天
              </p>
              <p class="mt-2 text-sm leading-6 text-ink-soft">
                点日历里的日期，在这里记下完成或未完成，也可以补一段记录。
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>

    <main v-else-if="goalPending" class="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 lg:px-10">
      <div class="h-40 animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" aria-busy="true" aria-label="正在读取目标" />
    </main>

    <main v-else class="mx-auto w-full max-w-6xl px-5 py-24 sm:px-6 lg:px-10">
      <div class="max-w-md">
        <UIcon name="i-lucide-circle-help" class="size-8 text-ink-faint" aria-hidden="true" />
        <h1 class="mt-4 font-serif text-2xl text-ink">
          {{ goalError ? '目标不存在或已被删除' : '找不到这个目标' }}
        </h1>
        <p class="mt-2 text-sm leading-6 text-ink-soft">
          它可能已经被删除，或者链接不正确。
        </p>
        <UButton to="/" label="返回目标列表" class="mt-6" />
      </div>
    </main>

    <DayEditorModal
      v-if="goal && !isDesktop"
      v-model:open="editorOpen"
      :goal-id="goalId"
      :date="selectedDate"
      :entry="selectedEntry"
      @changed="refreshEntries"
    />
  </div>
</template>
