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
const menuOpen = ref(false)
const rendered = computed(() => renderMarkdown(props.item.content))
const isLong = computed(
  () => props.item.content.length > 520 || props.item.content.split('\n').length > 12,
)
const timeLabel = computed(() => format(new Date(props.item.createdAt * 1000), 'HH:mm'))

const menuItems = computed(() => [
  [
    {
      label: '编辑正文',
      icon: 'i-lucide-pencil',
      onSelect: () => {
        menuOpen.value = false
        emit('edit')
      },
    },
    {
      label: '复制正文',
      icon: 'i-lucide-copy',
      onSelect: () => {
        menuOpen.value = false
        void copyText()
      },
    },
    {
      label: '删除这则笔记',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => {
        menuOpen.value = false
        emit('delete')
      },
    },
  ],
])

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
    class="group relative border-b border-rule/70 px-1 py-4 transition-colors motion-reduce:transition-none sm:px-2"
    :class="highlighted ? 'rounded-sm bg-sheet/70 ring-2 ring-brass ring-offset-2 ring-offset-paper' : ''"
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

      <UDropdownMenu
        v-model:open="menuOpen"
        :items="menuItems"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="笔记操作"
        />
      </UDropdownMenu>
    </header>

    <div class="relative mt-2.5">
      <div
        class="essay-markdown"
        :class="isLong && !expanded ? 'max-h-72 overflow-hidden' : ''"
        v-html="rendered"
      />
      <div
        v-if="isLong && !expanded"
        class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-paper to-transparent"
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

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <NuxtLink
        :to="{ path: '/', query: { replyToMemo: item.id } }"
        class="inline-flex items-center gap-1.5 text-sm text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
      >
        <UIcon name="i-lucide-corner-down-right" class="size-3.5" aria-hidden="true" />
        继续写
      </NuxtLink>
      <button
        type="button"
        class="text-xs text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
        @click="emit('edit')"
      >
        关联
      </button>
    </div>

    <footer
      v-if="item.goals.length || item.entries.length || item.outgoingMemos.length || item.incomingMemos.length"
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

      <div
        v-if="item.outgoingMemos.length"
        class="flex w-full flex-wrap items-center gap-1.5 pt-1 text-xs text-ink-faint"
      >
        <span class="inline-flex items-center gap-1">
          <UIcon name="i-lucide-corner-up-left" class="size-3" aria-hidden="true" />
          回应了
        </span>
        <NuxtLink
          v-for="relation in item.outgoingMemos"
          :key="relation.id"
          :to="{ path: '/', query: { memo: relation.id } }"
          class="inline-block max-w-64 truncate text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
          :title="relation.excerpt"
        >
          {{ relation.excerpt }}
        </NuxtLink>
      </div>

      <div
        v-if="item.incomingMemos.length"
        class="flex w-full flex-wrap items-center gap-1.5 pt-1 text-xs text-ink-faint"
      >
        <span class="inline-flex items-center gap-1">
          <UIcon name="i-lucide-corner-down-right" class="size-3" aria-hidden="true" />
          后来被
        </span>
        <NuxtLink
          v-for="relation in item.incomingMemos"
          :key="relation.id"
          :to="{ path: '/', query: { memo: relation.id } }"
          class="inline-block max-w-64 truncate text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
          :title="relation.excerpt"
        >
          {{ relation.excerpt }}
        </NuxtLink>
      </div>
    </footer>
  </article>
</template>
