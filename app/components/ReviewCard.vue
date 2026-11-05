<script setup lang="ts">
import { format } from 'date-fns'
import type { ReviewItem } from '#shared/types'
import { formatDateKey, formatDayLabel } from '~/utils/date-display'
import { renderMarkdown } from '~/utils/markdown'

const props = withDefaults(defineProps<{
  item: ReviewItem
  compact?: boolean
  busy?: boolean
}>(), {
  compact: false,
  busy: false,
})

const emit = defineEmits<{
  read: []
  later: []
  dismiss: []
  continue: []
}>()

const rendered = computed(() => renderMarkdown(props.item.content))
const timeLabel = computed(() => format(new Date(props.item.createdAt * 1000), 'HH:mm'))
const dateLabel = computed(() => props.item.kind === 'daily_reflection'
  ? formatDayLabel(props.item.entryDate)
  : formatDayLabel(formatDateKey(new Date(props.item.createdAt * 1000))),
)
const reasonLabel = computed(() => (
  props.item.reviewReason === 'first' ? '第一次回看' : '到了回看时间'
))
const sourceLabel = computed(() => (
  props.item.kind === 'memo' ? '笔记' : '打卡反思'
))
const replies = computed(() => (
  props.item.kind === 'memo' ? props.item.incomingMemos : props.item.replies
))
const goalRef = computed(() => (
  props.item.kind === 'memo' ? props.item.goals[0] ?? null : null
))
const entryRef = computed(() => (
  props.item.kind === 'memo' ? props.item.entries[0] ?? null : null
))
const sourceLink = computed(() => {
  if (props.item.kind === 'memo') {
    return { path: '/', query: { memo: props.item.id } }
  }

  return props.item.goalDeletedAt
    ? null
    : {
        path: '/habits',
        query: {
          goal: props.item.goalId,
          date: props.item.entryDate,
          edit: '1',
        },
      }
})
</script>

<template>
  <article class="paper-card relative overflow-hidden rounded-sm p-5 sm:p-6">
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass/70 to-transparent"
      aria-hidden="true"
    />

    <header class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-faint">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-brass-soft/70 px-2.5 py-1 font-medium text-brass-ink">
        <UIcon name="i-lucide-book-open" class="size-3.5" aria-hidden="true" />
        回看 · {{ sourceLabel }}
      </span>
      <span>{{ reasonLabel }}</span>
      <span aria-hidden="true">·</span>
      <span>{{ dateLabel }}</span>
      <time :datetime="new Date(item.createdAt * 1000).toISOString()">{{ timeLabel }}</time>
    </header>

    <div
      class="relative mt-4"
      :class="compact ? 'max-h-64 overflow-hidden' : ''"
    >
      <div class="essay-markdown" v-html="rendered" />
      <div
        v-if="compact && item.content.length > 480"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-sheet to-transparent"
        aria-hidden="true"
      />
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-faint">
      <NuxtLink
        v-if="goalRef && !goalRef.deletedAt"
        :to="{ path: '/habits', query: { goal: goalRef.id } }"
        class="inline-flex items-center gap-1 text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
      >
        <UIcon name="i-lucide-hash" class="size-3" aria-hidden="true" />
        {{ goalRef.title }}
      </NuxtLink>
      <NuxtLink
        v-else-if="item.kind === 'daily_reflection' && !item.goalDeletedAt"
        :to="{ path: '/habits', query: { goal: item.goalId } }"
        class="inline-flex items-center gap-1 text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
      >
        <UIcon name="i-lucide-hash" class="size-3" aria-hidden="true" />
        {{ item.goalTitle }}
      </NuxtLink>
      <span v-else-if="item.kind === 'daily_reflection'" class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-archive" class="size-3" aria-hidden="true" />
        {{ item.goalTitle }} · 已删除
      </span>

      <span
        v-if="entryRef && entryRef.goalDeletedAt"
        class="inline-flex items-center gap-1"
      >
        <UIcon name="i-lucide-calendar-check" class="size-3" aria-hidden="true" />
        打卡 {{ formatDayLabel(entryRef.entryDate) }} · 已删除
      </span>
      <NuxtLink
        v-else-if="entryRef"
        :to="{ path: '/habits', query: { goal: entryRef.goalId, date: entryRef.entryDate } }"
        class="inline-flex items-center gap-1 text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
      >
        <UIcon name="i-lucide-calendar-check" class="size-3" aria-hidden="true" />
        打卡 {{ formatDayLabel(entryRef.entryDate) }}
      </NuxtLink>

      <NuxtLink
        v-if="sourceLink"
        :to="sourceLink"
        class="inline-flex items-center gap-1 underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
      >
        <UIcon name="i-lucide-arrow-up-right" class="size-3" aria-hidden="true" />
        打开原记录
      </NuxtLink>
    </div>

    <div v-if="replies.length" class="mt-3 border-t border-rule/70 pt-3">
      <p class="text-xs text-ink-faint">
        后来的回应
      </p>
      <ul class="mt-1.5 space-y-1.5">
        <li v-for="reply in replies" :key="reply.id">
          <NuxtLink
            :to="{ path: '/', query: { memo: reply.id } }"
            class="group flex items-baseline gap-2 text-sm text-ink-soft"
          >
            <UIcon name="i-lucide-corner-down-right" class="size-3.5 shrink-0 text-done" aria-hidden="true" />
            <span class="line-clamp-1 min-w-0 font-serif group-hover:text-done">
              {{ reply.excerpt }}
            </span>
          </NuxtLink>
        </li>
      </ul>
    </div>

    <footer class="mt-5 flex flex-wrap items-center gap-2 border-t border-rule/70 pt-4">
      <UButton
        label="继续写"
        icon="i-lucide-feather"
        size="sm"
        :disabled="busy"
        @click="emit('continue')"
      />
      <UButton
        label="读过"
        icon="i-lucide-check"
        color="neutral"
        variant="soft"
        size="sm"
        :disabled="busy"
        @click="emit('read')"
      />
      <button
        type="button"
        class="rounded-sm px-2.5 py-1.5 text-xs text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="busy"
        @click="emit('later')"
      >
        稍后再看
      </button>
      <button
        type="button"
        class="rounded-sm px-2.5 py-1.5 text-xs text-ink-faint underline-offset-4 hover:text-miss hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-miss disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="busy"
        @click="emit('dismiss')"
      >
        不再推荐
      </button>
    </footer>
  </article>
</template>
