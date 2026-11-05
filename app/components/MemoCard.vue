<script setup lang="ts">
import { format } from 'date-fns'
import type { FeedMemoItem, MemoEntryRef, MemoGoalRef } from '#shared/types'
import { formatDayLabel } from '~/utils/date-display'
import { renderMarkdown } from '~/utils/markdown'

const props = defineProps<{
  item: FeedMemoItem
  highlighted?: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const expanded = ref(false)
const rendered = computed(() => renderMarkdown(props.item.content))
const isLong = computed(
  () => props.item.content.length > 520 || props.item.content.split('\n').length > 12,
)
const timeLabel = computed(() => format(new Date(props.item.createdAt * 1000), 'HH:mm'))

function goalLink(goal: MemoGoalRef) {
  return { path: '/habits', query: { goal: goal.id } }
}

function entryLink(entry: MemoEntryRef) {
  return { path: '/habits', query: { goal: entry.goalId, date: entry.entryDate } }
}

async function copyText() {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(props.item.content)
  } catch {
    // 剪贴板不可用时保持安静。
  }
}
</script>

<template>
  <article
    :id="`memo-${item.id}`"
    class="paper-card group relative rounded-sm px-4 py-4 transition-shadow motion-reduce:transition-none sm:px-5"
    :class="highlighted ? 'ring-2 ring-brass ring-offset-2 ring-offset-paper' : ''"
    :aria-label="`笔记，${timeLabel}`"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2 text-xs text-ink-faint">
        <UIcon name="i-lucide-feather" class="size-3.5 shrink-0 text-done" aria-hidden="true" />
        <span class="font-medium text-ink-soft">笔记</span>
        <span aria-hidden="true">·</span>
        <time :datetime="new Date(item.createdAt * 1000).toISOString()">{{ timeLabel }}</time>
        <span v-if="item.updatedAt > item.createdAt" class="text-ink-faint">已编辑</span>
      </div>

      <div class="flex shrink-0 items-center gap-0.5">
        <UButton
          icon="i-lucide-copy"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="复制正文"
          @click="copyText"
        />
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="编辑这则笔记"
          @click="emit('edit')"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="删除这则笔记"
          @click="emit('delete')"
        />
      </div>
    </header>

    <div class="relative mt-2.5">
      <div
        class="essay-markdown"
        :class="isLong && !expanded ? 'max-h-72 overflow-hidden' : ''"
        v-html="rendered"
      />
      <div
        v-if="isLong && !expanded"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-sheet to-transparent"
        aria-hidden="true"
      />
      <button
        v-if="isLong && !expanded"
        type="button"
        class="absolute bottom-0 left-0 text-xs text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
        @click="expanded = true"
      >
        展开全文
      </button>
      <button
        v-else-if="isLong"
        type="button"
        class="mt-2 text-xs text-ink-faint underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
        @click="expanded = false"
      >
        收起
      </button>
    </div>

    <footer
      v-if="item.goals.length || item.entries.length"
      class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-rule/70 pt-2.5"
    >
      <template v-for="goal in item.goals" :key="goal.id">
        <NuxtLink
          v-if="!goal.deletedAt"
          :to="goalLink(goal)"
          class="inline-flex items-center gap-1 rounded-full border border-rule bg-paper/50 px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-done/50 hover:text-done focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
        >
          <UIcon name="i-lucide-hash" class="size-3" aria-hidden="true" />
          {{ goal.title }}
        </NuxtLink>
        <span
          v-else
          class="inline-flex items-center gap-1 rounded-full border border-dashed border-rule-strong bg-paper/40 px-2.5 py-1 text-xs text-ink-faint"
        >
          <UIcon name="i-lucide-archive" class="size-3" aria-hidden="true" />
          {{ goal.title }} · 已删除
        </span>
      </template>

      <template v-for="entry in item.entries" :key="entry.id">
        <NuxtLink
          v-if="!entry.goalDeletedAt"
          :to="entryLink(entry)"
          class="inline-flex items-center gap-1 rounded-full border border-done/25 bg-done-soft/30 px-2.5 py-1 text-xs text-done transition-colors hover:border-done/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
        >
          <UIcon name="i-lucide-calendar-check" class="size-3" aria-hidden="true" />
          打卡 {{ formatDayLabel(entry.entryDate) }} · {{ entry.goalTitle }}
        </NuxtLink>
        <span
          v-else
          class="inline-flex items-center gap-1 rounded-full border border-dashed border-rule-strong bg-paper/40 px-2.5 py-1 text-xs text-ink-faint"
        >
          <UIcon name="i-lucide-calendar-check" class="size-3" aria-hidden="true" />
          打卡 {{ formatDayLabel(entry.entryDate) }} · {{ entry.goalTitle }} · 已删除
        </span>
      </template>

      <span
        v-if="item.hiddenEntryIds.length"
        class="inline-flex items-center gap-1 text-xs text-ink-faint"
        :title="'关联的打卡已被清除，恢复打卡后会重新显示。'"
      >
        <UIcon name="i-lucide-eye-off" class="size-3" aria-hidden="true" />
        {{ item.hiddenEntryIds.length }} 条打卡关联暂时隐藏
      </span>
    </footer>
  </article>
</template>
