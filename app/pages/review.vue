<script setup lang="ts">
import type { ReviewItem, ReviewPage } from '#shared/types'
import { todayDateOnly } from '#shared/utils/date'
import { formatFullDayLabel, formatWeekday } from '~/utils/date-display'

useHead({ title: '回看 · Anti-Habit' })

const router = useRouter()
const toast = useToast()

const today = ref(todayDateOnly())
const todayLabel = computed(() => `${formatFullDayLabel(today.value)}，${formatWeekday(today.value)}`)

const items = ref<ReviewItem[]>([])
const nextCursor = ref<string | null>(null)
const pending = ref(false)
const busy = ref(false)
const error = ref('')
const loaded = ref(false)
const handled = ref(0)

const current = computed(() => items.value[0] ?? null)
const remaining = computed(() => Math.max(items.value.length - 1, 0))

async function load(reset = true) {
  if (reset) {
    pending.value = true
    error.value = ''
    items.value = []
    nextCursor.value = null
  }

  try {
    const page = await $fetch<ReviewPage>('/api/review', {
      query: {
        limit: 20,
        cursor: reset ? undefined : nextCursor.value ?? undefined,
      },
    })

    items.value = reset ? page.items : [...items.value, ...page.items]
    nextCursor.value = page.nextCursor
    loaded.value = true
  } catch (caught) {
    error.value = getApiErrorMessage(caught)
    loaded.value = true
  } finally {
    pending.value = false
  }
}

async function act(action: 'read' | 'later' | 'dismiss') {
  const item = current.value
  if (!item || busy.value) return

  busy.value = true
  error.value = ''

  try {
    await $fetch(`/api/review/${item.sourceType}/${item.id}`, {
      method: 'POST',
      body: { action },
    })

    items.value = items.value.slice(1)
    handled.value += 1

    if (items.value.length === 0 && nextCursor.value) {
      await load(false)
    }

    toast.add({
      title: action === 'read'
        ? '已读过，二十一天后再看'
        : action === 'later'
          ? '七天后再看'
          : '不再推荐这则记录',
      color: 'neutral',
    })
  } catch (caught) {
    error.value = getApiErrorMessage(caught)
  } finally {
    busy.value = false
  }
}

async function continueWriting() {
  const item = current.value
  if (!item) return

  await router.push({
    path: '/',
    query: item.sourceType === 'memo'
      ? { replyToMemo: item.id }
      : { replyToEntry: item.id },
  })
}

onMounted(() => {
  const actualToday = todayDateOnly()
  if (actualToday !== today.value) today.value = actualToday
  void load(true)
})
</script>

<template>
  <div class="min-h-dvh">
    <main class="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6 lg:py-10">
      <header class="reveal flex flex-wrap items-center justify-between gap-4 border-b border-rule pb-5">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <NuxtLink
            to="/"
            class="font-serif text-[1.6rem] leading-none tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-done"
          >
            Anti-Habit
          </NuxtLink>
          <SiteNav active="review" />
        </div>
        <p class="hidden items-center gap-2 text-sm text-ink-soft sm:flex">
          <span class="inline-block h-px w-6 bg-brass/70" aria-hidden="true" />
          {{ todayLabel }}
        </p>
      </header>

      <section class="reveal reveal-late mt-8" aria-labelledby="review-heading">
        <div class="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-4">
          <div>
            <h1 id="review-heading" class="font-serif text-3xl tracking-tight text-ink sm:text-4xl">
              回看
            </h1>
            <p class="mt-1.5 max-w-xl text-sm leading-6 text-ink-soft">
              一次读一则旧记录。动作只影响回看队列，不会删除原文。
            </p>
          </div>
          <div class="flex items-center gap-4 text-xs text-ink-faint">
            <span v-if="handled">已处理 {{ handled }} 则</span>
            <span v-if="remaining">后面还有 {{ remaining }} 则</span>
            <NuxtLink
              to="/"
              class="text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
            >
              回到笔记
            </NuxtLink>
          </div>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          title="回看没有读出来"
          :description="error"
          class="mt-5"
        />

        <div
          v-if="pending"
          class="mt-5 h-72 animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none"
          aria-busy="true"
          aria-label="正在读取回看队列"
        />

        <div v-else-if="current" class="mt-5">
          <ReviewCard
            :key="`${current.sourceType}:${current.id}`"
            :item="current"
            :busy="busy"
            @read="act('read')"
            @later="act('later')"
            @dismiss="act('dismiss')"
            @continue="continueWriting"
          />
        </div>

        <div
          v-else-if="loaded"
          class="mt-6 rounded-sm border border-dashed border-rule-strong bg-sheet/60 px-6 py-10 text-center"
        >
          <UIcon name="i-lucide-book-open" class="mx-auto size-6 text-brass" aria-hidden="true" />
          <p class="mt-3 font-serif text-2xl text-ink">
            现在没有需要回看的记录
          </p>
          <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">
            记录创建七天后会出现在这里。也可以先回去写一则新的笔记。
          </p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <UButton label="回到笔记" icon="i-lucide-feather" @click="router.push('/')" />
            <UButton
              label="重新读取"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="soft"
              @click="load(true)"
            />
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
