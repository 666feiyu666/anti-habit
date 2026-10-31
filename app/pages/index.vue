<script setup lang="ts">
import { addMonths, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import type { DailyEntryWithLinks, EssayEntry, Goal, GoalSummary } from '#shared/types'
import { getDayAppearance } from '#shared/utils/day-appearance'
import { isValidDateOnly, todayDateOnly } from '#shared/utils/date'
import { formatDateKey, formatDayLabel, formatMonthLabel, formatWeekday } from '~/utils/date-display'
import { dayStatusDot, dayStatusLabel } from '~/utils/day-display'

useHead({ title: 'Anti-Habit' })

const route = useRoute()
const router = useRouter()

const today = ref(todayDateOnly())
const todayLabel = computed(() => `${formatDayLabel(today.value)}，${formatWeekday(today.value)}`)

function queryValue(key: string): string | null {
  const value = route.query[key]
  return typeof value === 'string' ? value : null
}

function resolveDate(value: string | null): string {
  if (value && isValidDateOnly(value) && value <= today.value) return value
  return today.value
}

const queryDate = computed(() => queryValue('date'))
const selectedDate = ref(resolveDate(queryDate.value))
const monthAnchor = ref(startOfMonth(parseISO(selectedDate.value)))

const { data, pending, error, refresh } = await useFetch<{ goals: GoalSummary[] }>('/api/goals', {
  key: 'goals-workbench',
  query: computed(() => ({ date: today.value })),
  default: () => ({ goals: [] }),
})

const goals = computed(() => data.value?.goals ?? [])

const requestedGoalId = computed(() => queryValue('goal'))
const selectedGoalId = computed(() => {
  const requested = requestedGoalId.value
  if (requested && goals.value.some(goal => goal.id === requested)) return requested
  return goals.value[0]?.id ?? null
})
const selectedGoal = computed(() => (
  goals.value.find(goal => goal.id === selectedGoalId.value) ?? null
))

const monthKey = computed(() => format(monthAnchor.value, 'yyyy-MM'))
const monthLabel = computed(() => formatMonthLabel(monthAnchor.value))
const rangeFrom = computed(() => formatDateKey(startOfWeek(startOfMonth(monthAnchor.value), { weekStartsOn: 1 })))
const rangeTo = computed(() => formatDateKey(endOfWeek(endOfMonth(monthAnchor.value), { weekStartsOn: 1 })))
const entriesKey = computed(() => `workbench-entries:${selectedGoalId.value ?? 'none'}:${monthKey.value}`)

const {
  data: entriesData,
  pending: entriesPending,
  error: entriesError,
  refresh: refreshEntries,
} = await useAsyncData(
  entriesKey,
  async () => {
    const goalId = selectedGoalId.value
    if (!goalId) return { entries: [] as DailyEntryWithLinks[] }

    return await $fetch<{ entries: DailyEntryWithLinks[] }>(`/api/goals/${goalId}/entries`, {
      query: { from: rangeFrom.value, to: rangeTo.value },
    })
  },
  {
    watch: [selectedGoalId, monthKey],
    default: () => ({ entries: [] as DailyEntryWithLinks[] }),
  },
)

const entries = computed(() => entriesData.value?.entries ?? [])
const selectedEntry = computed(() => (
  entries.value.find(entry => entry.entryDate === selectedDate.value) ?? null
))
const currentAppearance = computed(() => getDayAppearance(selectedGoal.value?.todayEntry))
const isCurrentMonth = computed(() => monthKey.value === format(parseISO(today.value), 'yyyy-MM'))

const monthStats = computed(() => {
  const monthEntries = entries.value.filter(entry => entry.entryDate.startsWith(monthKey.value))
  return {
    completed: monthEntries.filter(entry => entry.status === 'completed').length,
    missed: monthEntries.filter(entry => entry.status === 'missed').length,
    written: monthEntries.filter(entry => Boolean(entry.reflection?.trim())).length,
  }
})

const isCreateOpen = ref(false)
const editTarget = ref<GoalSummary | null>(null)
const deleteTarget = ref<GoalSummary | null>(null)
const editorOpen = ref(false)
const targetsOpen = ref(false)

const readerOpen = ref(false)
const readerGoal = ref<GoalSummary | null>(null)
const essayEntries = ref<EssayEntry[]>([])
const essayPending = ref(false)
const essayError = ref('')

const editOpen = computed({
  get: () => editTarget.value !== null,
  set: (open: boolean) => {
    if (!open) editTarget.value = null
  },
})

const deleteOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (open: boolean) => {
    if (!open) deleteTarget.value = null
  },
})

function sameQuery(query: { goal?: string, date?: string }) {
  const goal = typeof route.query.goal === 'string' ? route.query.goal : undefined
  const date = typeof route.query.date === 'string' ? route.query.date : undefined
  return (query.goal ?? undefined) === goal && (query.date ?? undefined) === date
}

async function syncQuery() {
  if (!import.meta.client) return

  const query: { goal?: string, date?: string } = selectedGoalId.value
    ? { goal: selectedGoalId.value, date: selectedDate.value }
    : {}

  if (sameQuery(query)) return
  await router.replace({ query })
}

async function selectGoal(goal: GoalSummary) {
  if (goal.id === selectedGoalId.value) return
  await router.replace({ query: { goal: goal.id, date: selectedDate.value } })
}

async function selectGoalById(goalId: string) {
  await router.replace({ query: { goal: goalId, date: selectedDate.value } })
}

function openDay(date: string) {
  if (date > today.value) return
  selectedDate.value = date
  monthAnchor.value = startOfMonth(parseISO(date))
  void syncQuery()
  editorOpen.value = true
}

function openReaderDate(date: string) {
  readerOpen.value = false
  openDay(date)
}

async function loadEssay(goal: GoalSummary) {
  essayPending.value = true
  essayError.value = ''

  try {
    const result = await $fetch<{ entries: EssayEntry[] }>(`/api/goals/${goal.id}/essays`)
    essayEntries.value = result.entries
  } catch (caught) {
    essayError.value = getApiErrorMessage(caught)
  } finally {
    essayPending.value = false
  }
}

async function openEssay(goal: GoalSummary) {
  readerGoal.value = goal
  readerOpen.value = true
  essayEntries.value = []
  await selectGoal(goal)
  await loadEssay(goal)
}

function previousMonth() {
  monthAnchor.value = addMonths(monthAnchor.value, -1)
}

function nextMonth() {
  monthAnchor.value = addMonths(monthAnchor.value, 1)
}

function goToCurrentMonth() {
  monthAnchor.value = startOfMonth(parseISO(today.value))
}

async function handleEntryChanged() {
  await Promise.all([refreshEntries(), refresh()])
}

async function handleGoalSaved(goal: Goal) {
  const wasNew = !goals.value.some(item => item.id === goal.id)
  await refresh()

  if (wasNew) {
    await selectGoalById(goal.id)
    return
  }

  await syncQuery()
}

async function handleGoalDeleted() {
  await refresh()
  await syncQuery()
}

watch(queryDate, (value) => {
  const next = resolveDate(value)
  if (next !== selectedDate.value) {
    selectedDate.value = next
    monthAnchor.value = startOfMonth(parseISO(next))
  }
  void syncQuery()
})

watch([selectedGoalId, selectedDate], () => {
  void syncQuery()
})

onMounted(() => {
  const actualToday = todayDateOnly()
  if (actualToday !== today.value) {
    const wasToday = selectedDate.value === today.value
    today.value = actualToday

    if (wasToday || selectedDate.value > actualToday) {
      selectedDate.value = actualToday
      monthAnchor.value = startOfMonth(parseISO(actualToday))
    }
  }

  void syncQuery()
})
</script>

<template>
  <div class="min-h-dvh">
    <main class="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6 lg:px-10 lg:py-12">
      <header class="reveal flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
        <div>
          <p class="font-serif text-[1.7rem] leading-none tracking-tight text-ink">
            Anti-Habit
          </p>
          <p class="mt-2 flex items-center gap-2 text-sm text-ink-soft">
            <span class="inline-block h-px w-6 bg-brass/70" aria-hidden="true" />
            {{ todayLabel }}
          </p>
        </div>
        <p class="hidden max-w-[17rem] border-l border-rule-strong/70 pl-4 font-serif text-sm italic leading-6 text-ink-soft sm:block">
          一次打卡，也可以是一篇随笔的开头。
        </p>
      </header>

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        title="没能读到目标"
        :description="getApiErrorMessage(error)"
        class="mt-6"
      />

      <div
        v-if="pending && !goals.length"
        class="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12"
        aria-busy="true"
        aria-label="正在读取工作台"
      >
        <div class="h-96 animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
        <div class="h-64 animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
      </div>

      <div
        v-else-if="selectedGoal"
        class="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12"
      >
        <section class="reveal reveal-late" aria-labelledby="calendar-heading">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <h1 class="truncate font-serif text-3xl tracking-tight text-ink sm:text-4xl">
                {{ selectedGoal.essayTitle || '随笔' }}
              </h1>
              <p class="mt-1 truncate text-sm text-ink-soft">
                {{ selectedGoal.title }}
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-2 pt-1">
              <span
                class="flex items-center gap-2 text-xs"
                :class="currentAppearance === 'unrecorded' ? 'text-ink-faint' : 'text-ink-soft'"
              >
                <span
                  class="size-2 rounded-[2px]"
                  :class="dayStatusDot[currentAppearance]"
                  aria-hidden="true"
                />
                {{ dayStatusLabel[currentAppearance] }}
              </span>
              <UButton
                label="目标进度"
                icon="i-lucide-list-checks"
                color="neutral"
                variant="soft"
                class="shrink-0"
                aria-label="目标进度"
                @click="targetsOpen = true"
              />
            </div>
          </div>

          <div
            class="paper-stack paper-card relative mt-6 p-4 sm:p-6"
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

            <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule/70 pt-4 text-xs text-ink-soft">
              <span class="inline-flex items-center gap-1.5">
                <span class="size-1.5 rounded-full bg-done" aria-hidden="true" />
                <strong class="font-medium tabular-nums text-ink">{{ monthStats.completed }}</strong> 天完成
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="size-1.5 rounded-full bg-miss" aria-hidden="true" />
                <strong class="font-medium tabular-nums text-ink">{{ monthStats.missed }}</strong> 天未完成
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="size-1.5 rounded-full bg-brass" aria-hidden="true" />
                <strong class="font-medium tabular-nums text-ink">{{ monthStats.written }}</strong> 天有记录
              </span>
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

          <p class="mt-4 max-w-xl text-pretty text-xs leading-5 text-ink-faint">
            点一天，写下完成或未完成，也可以继续以前的想法。
          </p>
        </section>

        <aside class="reveal reveal-later" aria-labelledby="shelf-heading">
          <div class="flex items-center justify-between gap-3 border-b border-rule pb-3">
            <h2 id="shelf-heading" class="font-serif text-2xl text-ink">
              书架
            </h2>
            <UButton
              icon="i-lucide-plus"
              label="新增目标"
              size="sm"
              @click="isCreateOpen = true"
            />
          </div>

          <p class="mt-2 flex items-center gap-2 text-xs leading-5 text-ink-faint">
            <span class="rounded-sm bg-paper px-1.5 py-0.5 tabular-nums text-ink-soft">{{ goals.length }} 本</span>
            选一本，日历会跟着切换。
          </p>

          <ul class="mt-2 divide-y divide-rule/70">
            <li v-for="goal in goals" :key="goal.id">
              <EssayBook
                :goal="goal"
                :selected="goal.id === selectedGoalId"
                @select="selectGoal(goal)"
                @open-essay="openEssay(goal)"
                @edit="editTarget = goal"
                @delete="deleteTarget = goal"
              />
            </li>
          </ul>

          <div class="mt-8 border-t border-rule/70 pt-4">
            <p class="flex items-start gap-2 font-serif text-sm italic leading-7 text-ink-faint">
              <span class="mt-2.5 inline-block h-px w-4 shrink-0 bg-brass/70" aria-hidden="true" />
              随笔不会一次写完。它跟着日历，一天一天长出来。
            </p>
          </div>
        </aside>
      </div>

      <section v-else-if="!error" class="reveal mt-16 max-w-lg">
        <p class="font-serif text-5xl leading-tight tracking-tight text-ink sm:text-6xl">
          还没有目标
        </p>
        <p class="mt-5 max-w-md text-sm leading-7 text-ink-soft">
          写下一个想持续观察的目标。比如，晚上十一点后不看手机。
        </p>
        <div class="mt-8 flex flex-wrap items-center gap-4">
          <UButton
            icon="i-lucide-plus"
            label="写下第一个目标"
            @click="isCreateOpen = true"
          />
          <span class="inline-flex items-center gap-2 text-xs text-ink-faint">
            <span class="size-1.5 rounded-full bg-brass" aria-hidden="true" />
            从今天开始，不必等到明天
          </span>
        </div>
      </section>
    </main>

    <GoalFormModal
      v-model:open="isCreateOpen"
      mode="create"
      @saved="handleGoalSaved"
    />
    <GoalFormModal
      v-model:open="editOpen"
      mode="edit"
      :goal="editTarget"
      @saved="handleGoalSaved"
    />
    <GoalDeleteModal
      v-model:open="deleteOpen"
      :goal="deleteTarget"
      @deleted="handleGoalDeleted"
    />
    <GoalTargetsModal
      v-model:open="targetsOpen"
      :goal="selectedGoal"
    />
    <DayEditorModal
      v-if="selectedGoal"
      v-model:open="editorOpen"
      :goal-id="selectedGoal.id"
      :date="selectedDate"
      :entry="selectedEntry"
      @changed="handleEntryChanged"
    />
    <EssayReader
      v-model:open="readerOpen"
      :goal="readerGoal"
      :entries="essayEntries"
      :pending="essayPending"
      :error="essayError"
      @select-date="openReaderDate"
    />
  </div>
</template>
