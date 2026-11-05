<script setup lang="ts">
import { format, parseISO, subDays } from 'date-fns'
import type {
  FeedItem,
  FeedLinkedFilter,
  FeedMemoItem,
  FeedPage,
  GoalSummary,
  Memo,
} from '#shared/types'
import { getDayAppearance } from '#shared/utils/day-appearance'
import { todayDateOnly } from '#shared/utils/date'
import { formatDateKey, formatDayLabel, formatFullDayLabel, formatWeekday } from '~/utils/date-display'
import { dayStatusDot, dayStatusLabel } from '~/utils/day-display'

useHead({ title: '笔记 · Anti-Habit' })

const route = useRoute()
const router = useRouter()
const toast = useToast()

const today = ref(todayDateOnly())
const todayLabel = computed(() => `${formatFullDayLabel(today.value)}，${formatWeekday(today.value)}`)

const { data: goalsData, pending: goalsPending, error: goalsError } = await useFetch<{
  goals: GoalSummary[]
}>('/api/goals', {
  key: 'memo-home-goals',
  query: computed(() => ({ date: today.value })),
  default: () => ({ goals: [] }),
})

const goals = computed(() => goalsData.value?.goals ?? [])
const essays = computed(() => goals.value.filter(goal => Boolean(goal.essayTitle)))

/* ---------------- 写作区上下文 ---------------- */

const composeGoalId = ref<string | null>(null)
const composeEntryId = ref<string | null>(null)
const composeDate = ref<string | null>(null)
const composeKey = ref(0)

const initialGoalIds = computed(() => composeGoalId.value ? [composeGoalId.value] : [])
const initialEntryIds = computed(() => composeEntryId.value ? [composeEntryId.value] : [])
const composerDraftKey = computed(
  () => `new:${composeGoalId.value ?? 'none'}:${composeEntryId.value ?? composeDate.value ?? 'none'}`,
)
const composeContextLabel = computed(() => {
  if (!composeGoalId.value) return ''
  const goal = goals.value.find(item => item.id === composeGoalId.value)
  const title = goal?.title ?? '这次打卡'
  return composeDate.value ? `从「${title}」${formatDayLabel(composeDate.value)}的打卡写起` : `关联「${title}」`
})

function applyComposeQuery() {
  const goal = typeof route.query.composeGoal === 'string' ? route.query.composeGoal : null

  if (goal) {
    composeGoalId.value = goal
    composeEntryId.value = typeof route.query.composeEntry === 'string' ? route.query.composeEntry : null
    composeDate.value = typeof route.query.composeDate === 'string' ? route.query.composeDate : null
    composeKey.value += 1
  }

  const filterGoal = typeof route.query.filterGoal === 'string' ? route.query.filterGoal : null
  if (filterGoal && filterGoal !== goalFilter.value) {
    goalFilter.value = filterGoal
  }

  const query = { ...route.query }
  let changed = false
  for (const key of ['composeGoal', 'composeEntry', 'composeDate', 'filterGoal']) {
    if (key in query) {
      delete query[key]
      changed = true
    }
  }
  if (changed) void router.replace({ query })
}

/* ---------------- 时间线 ---------------- */

const feedItems = ref<FeedItem[]>([])
const nextCursor = ref<string | null>(null)
const feedPending = ref(false)
const feedLoadingMore = ref(false)
const feedLoaded = ref(false)
const feedError = ref('')
const highlightId = ref<string | null>(null)
const requestSerial = ref(0)
let highlightApplied = false

const searchInput = ref('')
const searchQuery = ref('')
const linkedFilter = ref<FeedLinkedFilter>('all')
const goalFilter = ref(typeof route.query.filterGoal === 'string' ? route.query.filterGoal : '')
const hasFilters = computed(
  () => Boolean(searchQuery.value || goalFilter.value || linkedFilter.value !== 'all'),
)

let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(searchInput, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchQuery.value = value.trim()
  }, 280)
})

const linkedOptions: Array<{ value: FeedLinkedFilter, label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'linked', label: '关联习惯' },
  { value: 'unlinked', label: '未关联' },
]

interface FeedGroup {
  key: string
  label: string
  items: FeedItem[]
}

function dayGroupLabel(key: string): string {
  if (key === today.value) return '今天'
  if (key === formatDateKey(subDays(parseISO(today.value), 1))) return '昨天'
  return formatFullDayLabel(key)
}

const groups = computed<FeedGroup[]>(() => {
  const keys: string[] = []
  const map = new Map<string, FeedItem[]>()

  for (const item of feedItems.value) {
    const key = format(new Date(item.createdAt * 1000), 'yyyy-MM-dd')
    if (!map.has(key)) {
      map.set(key, [])
      keys.push(key)
    }
    map.get(key)!.push(item)
  }

  return keys.map(key => ({
    key,
    label: dayGroupLabel(key),
    items: map.get(key) ?? [],
  }))
})

async function focusRequestedMemo() {
  const requested = typeof route.query.memo === 'string' ? route.query.memo : null
  if (!requested || highlightApplied) return

  highlightId.value = requested
  const present = feedItems.value.some(item => item.kind === 'memo' && item.id === requested)

  if (!present) {
    try {
      const { memo } = await $fetch<{ memo: Memo }>(`/api/memos/${requested}`)
      feedItems.value = [{ ...memo, kind: 'memo' }, ...feedItems.value]
    } catch {
      return
    }
  }

  highlightApplied = true
  await nextTick()
  document.getElementById(`memo-${requested}`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}

async function loadFeed(reset = true) {
  if (!import.meta.client) return
  if (!reset && (!nextCursor.value || feedLoadingMore.value || feedPending.value)) return

  const serial = ++requestSerial.value
  if (reset) {
    feedPending.value = true
    feedError.value = ''
  } else {
    feedLoadingMore.value = true
  }

  try {
    const page = await $fetch<FeedPage>('/api/feed', {
      query: {
        q: searchQuery.value || undefined,
        linked: linkedFilter.value,
        goalId: goalFilter.value || undefined,
        limit: 20,
        cursor: reset ? undefined : nextCursor.value ?? undefined,
      },
    })

    if (serial !== requestSerial.value) return

    feedItems.value = reset ? page.items : [...feedItems.value, ...page.items]
    nextCursor.value = page.nextCursor
    feedLoaded.value = true

    if (reset) await focusRequestedMemo()
  } catch (caught) {
    if (serial === requestSerial.value) {
      feedError.value = getApiErrorMessage(caught)
      feedLoaded.value = true
    }
  } finally {
    if (serial === requestSerial.value) {
      feedPending.value = false
      feedLoadingMore.value = false
    }
  }
}

watch([searchQuery, linkedFilter, goalFilter], () => {
  void loadFeed(true)
})

/* ---------------- 笔记操作 ---------------- */

const editingMemo = ref<FeedMemoItem | null>(null)

async function handleCreated(memo: Memo) {
  toast.add({ title: '笔记已保存', color: 'neutral' })
  await loadFeed(true)
  await nextTick()
  document.getElementById(`memo-${memo.id}`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}

function handleUpdated(memo: Memo) {
  feedItems.value = feedItems.value.map(item => (
    item.kind === 'memo' && item.id === memo.id ? { ...memo, kind: 'memo' } : item
  ))
  editingMemo.value = null
  toast.add({ title: '已保存修改', color: 'neutral' })
}

async function handleDelete(item: FeedMemoItem) {
  if (!window.confirm('删除这则笔记？它会从时间线隐藏，关联的打卡和目标不受影响。')) return

  try {
    await $fetch(`/api/memos/${item.id}`, { method: 'DELETE' })
    feedItems.value = feedItems.value.filter(
      entry => !(entry.kind === 'memo' && entry.id === item.id),
    )
    toast.add({ title: '已删除笔记', color: 'neutral' })
  } catch (caught) {
    toast.add({ title: getApiErrorMessage(caught), color: 'error' })
  }
}

function statusFor(goal: GoalSummary): 'completed' | 'missed' | 'reflected-miss' | 'unrecorded' {
  return getDayAppearance(goal.todayEntry)
}

onMounted(() => {
  applyComposeQuery()

  const actualToday = todayDateOnly()
  if (actualToday !== today.value) today.value = actualToday

  void loadFeed(true)
})

watch(() => route.fullPath, () => {
  if (route.query.composeGoal || route.query.filterGoal) applyComposeQuery()
})
</script>

<template>
  <div class="min-h-dvh">
    <main class="mx-auto w-full max-w-6xl px-5 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header class="reveal flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-5">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <NuxtLink
            to="/"
            class="font-serif text-[1.6rem] leading-none tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-done"
          >
            Anti-Habit
          </NuxtLink>
          <SiteNav active="notes" />
        </div>
        <p class="hidden items-center gap-2 text-sm text-ink-soft sm:flex">
          <span class="inline-block h-px w-6 bg-brass/70" aria-hidden="true" />
          {{ todayLabel }}
        </p>
      </header>

      <div class="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-12">
        <section class="min-w-0" aria-labelledby="composer-heading">
          <div class="paper-stack paper-card relative rounded-sm p-4 sm:p-6">
            <h1 id="composer-heading" class="sr-only">写一则笔记</h1>

            <p
              v-if="composeContextLabel"
              class="mb-3 inline-flex items-center gap-1.5 rounded-full border border-brass/40 bg-brass-soft/50 px-2.5 py-1 text-xs text-brass-ink"
            >
              <UIcon name="i-lucide-corner-down-right" class="size-3.5" aria-hidden="true" />
              {{ composeContextLabel }}
            </p>

            <MemoForm
              :key="composeKey"
              :goals="goals"
              :initial-goal-ids="initialGoalIds"
              :initial-entry-ids="initialEntryIds"
              :draft-key="composerDraftKey"
              autofocus
              @saved="handleCreated"
            />
          </div>

          <div class="reveal reveal-late mt-8" aria-labelledby="timeline-heading">
            <div class="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
              <h2 id="timeline-heading" class="font-serif text-2xl text-ink">
                时间线
              </h2>
              <span class="text-xs text-ink-faint">
                {{ feedItems.length ? `已显示 ${feedItems.length} 则` : '按写作时间排列' }}
              </span>
            </div>

            <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label class="relative block flex-1">
                <span class="sr-only">搜索笔记和打卡反思</span>
                <UIcon
                  name="i-lucide-search"
                  class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
                  aria-hidden="true"
                />
                <input
                  v-model="searchInput"
                  type="search"
                  class="h-10 w-full rounded-md border border-rule bg-sheet pl-9 pr-3 text-sm text-ink transition-colors placeholder:text-ink-faint focus:border-done focus:outline-none focus:ring-2 focus:ring-done/15"
                  placeholder="搜索笔记和打卡反思"
                >
              </label>

              <div class="flex flex-wrap items-center gap-2">
                <div
                  class="flex items-center gap-0.5 rounded-md border border-rule bg-sheet p-0.5"
                  role="group"
                  aria-label="关联状态"
                >
                  <button
                    v-for="option in linkedOptions"
                    :key="option.value"
                    type="button"
                    class="rounded-sm px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done motion-reduce:transition-none"
                    :class="linkedFilter === option.value
                      ? 'bg-paper text-ink'
                      : 'text-ink-faint hover:text-ink'"
                    :aria-pressed="linkedFilter === option.value"
                    @click="linkedFilter = option.value"
                  >
                    {{ option.label }}
                  </button>
                </div>

                <label class="sr-only" for="goal-filter">按习惯筛选</label>
                <select
                  id="goal-filter"
                  v-model="goalFilter"
                  class="h-[34px] max-w-44 rounded-md border border-rule bg-sheet px-2 text-xs text-ink-soft focus:border-done focus:outline-none focus:ring-2 focus:ring-done/15"
                >
                  <option value="">
                    全部习惯
                  </option>
                  <option v-for="goal in goals" :key="goal.id" :value="goal.id">
                    {{ goal.title }}
                  </option>
                </select>
              </div>
            </div>

            <UAlert
              v-if="feedError"
              color="error"
              variant="soft"
              title="没能读到时间线"
              :description="feedError"
              class="mt-4"
            />

            <div
              v-if="feedPending && !feedItems.length"
              class="mt-5 space-y-4"
              aria-busy="true"
              aria-label="正在读取时间线"
            >
              <div class="h-28 animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
              <div class="h-20 animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
            </div>

            <div v-else-if="groups.length" class="mt-5 space-y-7">
              <section v-for="group in groups" :key="group.key" :aria-labelledby="`day-${group.key}`">
                <h3
                  :id="`day-${group.key}`"
                  class="mb-2 flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-ink-faint"
                >
                  <span class="inline-block h-px w-4 bg-rule-strong/80" aria-hidden="true" />
                  {{ group.label }}
                </h3>

                <div class="timeline space-y-3">
                  <div v-for="item in group.items" :key="`${item.kind}:${item.id}`" class="timeline-item">
                    <MemoCard
                      v-if="item.kind === 'memo'"
                      :item="item"
                      :highlighted="highlightId === item.id"
                      @edit="editingMemo = item"
                      @delete="handleDelete(item)"
                    />
                    <ReflectionCard v-else :item="item" />
                  </div>
                </div>
              </section>

              <div v-if="nextCursor" class="flex justify-center pt-1">
                <UButton
                  label="加载更早的记录"
                  icon="i-lucide-arrow-down"
                  color="neutral"
                  variant="soft"
                  :loading="feedLoadingMore"
                  @click="loadFeed(false)"
                />
              </div>
            </div>

            <div
              v-else-if="feedLoaded"
              class="mt-6 rounded-sm border border-dashed border-rule-strong bg-sheet/60 px-5 py-8 text-center"
            >
              <p class="font-serif text-xl text-ink">
                {{ hasFilters ? '没有找到对应的记录' : '还没有笔记' }}
              </p>
              <p class="mt-2 text-sm leading-6 text-ink-soft">
                {{ hasFilters
                  ? '换个关键词，或把筛选切回“全部”。'
                  : '在上面的写作区写下第一则。没有目标也可以开始。' }}
              </p>
            </div>
          </div>
        </section>

        <aside class="reveal reveal-later space-y-7 lg:sticky lg:top-8 lg:self-start" aria-labelledby="today-heading">
          <section class="paper-card rounded-sm p-4">
            <div class="flex items-center justify-between gap-2 border-b border-rule pb-2.5">
              <h2 id="today-heading" class="font-serif text-lg text-ink">
                今日习惯
              </h2>
              <span class="text-xs tabular-nums text-ink-faint">{{ goals.length }} 个</span>
            </div>

            <p v-if="goalsPending" class="mt-3 text-xs text-ink-faint">
              正在读取…
            </p>
            <p v-else-if="goalsError" class="mt-3 text-xs leading-5 text-miss">
              {{ getApiErrorMessage(goalsError) }}
            </p>
            <p v-else-if="!goals.length" class="mt-3 text-xs leading-5 text-ink-faint">
              还没有习惯。笔记可以先写；想开始记录时再去习惯页。
            </p>

            <ul v-else class="mt-2 divide-y divide-rule/60">
              <li v-for="goal in goals" :key="goal.id">
                <NuxtLink
                  :to="{ path: '/habits', query: { goal: goal.id, date: today } }"
                  class="flex items-center justify-between gap-2 py-2.5 text-sm transition-colors hover:text-done focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
                >
                  <span class="min-w-0 truncate text-ink">{{ goal.title }}</span>
                  <span class="flex shrink-0 items-center gap-1.5 text-xs text-ink-soft">
                    <span
                      class="size-2 rounded-[2px]"
                      :class="dayStatusDot[statusFor(goal)]"
                      aria-hidden="true"
                    />
                    {{ dayStatusLabel[statusFor(goal)].replace('今天', '') }}
                  </span>
                </NuxtLink>
              </li>
            </ul>

            <NuxtLink
              to="/habits"
              class="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-rule bg-paper/50 px-3 py-2 text-xs text-ink-soft transition-colors hover:border-done/50 hover:text-done focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
            >
              <UIcon name="i-lucide-calendar-days" class="size-3.5" aria-hidden="true" />
              打开完整日历
            </NuxtLink>
          </section>

          <section v-if="essays.length" class="border-t border-rule/70 pt-4">
            <h2 class="font-serif text-lg text-ink">
              正在写的随笔
            </h2>
            <ul class="mt-2 space-y-2">
              <li v-for="goal in essays" :key="goal.id">
                <NuxtLink
                  :to="{ path: '/habits', query: { goal: goal.id, essay: '1' } }"
                  class="group block rounded-sm border border-rule/70 bg-sheet/70 px-3 py-2.5 transition-colors hover:border-done/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
                >
                  <span class="block truncate font-serif text-base text-ink group-hover:text-done">
                    {{ goal.essayTitle }}
                  </span>
                  <span class="mt-0.5 block truncate text-xs text-ink-faint">
                    跟着「{{ goal.title }}」一天一天长出来
                  </span>
                </NuxtLink>
              </li>
            </ul>
          </section>

          <p class="border-t border-rule/70 pt-4 font-serif text-sm italic leading-7 text-ink-faint">
            先记下，再归类。写的时候不必决定它属于哪里。
          </p>
        </aside>
      </div>
    </main>

    <MemoEditModal
      :memo="editingMemo"
      :goals="goals"
      @update:memo="editingMemo = $event"
      @saved="handleUpdated"
      @cancel="editingMemo = null"
    />
  </div>
</template>
