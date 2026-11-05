<script setup lang="ts">
import { format } from 'date-fns'
import type { FeedReflectionItem } from '#shared/types'
import { formatDayLabel } from '~/utils/date-display'
import { renderMarkdown } from '~/utils/markdown'

const props = defineProps<{
  item: FeedReflectionItem
}>()

const rendered = computed(() => renderMarkdown(props.item.content))
const timeLabel = computed(() => format(new Date(props.item.createdAt * 1000), 'HH:mm'))
const entryLabel = computed(() => formatDayLabel(props.item.entryDate))
const editTarget = computed(() => props.item.goalDeletedAt
  ? null
  : {
      path: '/habits',
      query: {
        goal: props.item.goalId,
        date: props.item.entryDate,
        edit: '1',
      },
    },
)
</script>

<template>
  <article
    class="relative border-b border-l-2 border-b-rule/70 border-l-brass/70 px-3 py-4 sm:px-4"
    :aria-label="`打卡反思，${entryLabel}`"
  >
    <header class="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-brass-soft/70 px-2.5 py-1 font-medium text-brass-ink">
        <UIcon name="i-lucide-notebook-pen" class="size-3.5" aria-hidden="true" />
        打卡反思
      </span>
      <span class="flex items-center gap-1.5">
        <UIcon name="i-lucide-hash" class="size-3" aria-hidden="true" />
        {{ item.goalTitle }}
        <span v-if="item.goalDeletedAt" class="text-ink-faint">· 习惯已删除</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>记录于 {{ entryLabel }}</span>
      <time :datetime="new Date(item.createdAt * 1000).toISOString()">{{ timeLabel }}</time>
    </header>

    <div class="essay-markdown mt-2.5" v-html="rendered" />

    <footer class="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-rule/70 pt-2.5">
      <p class="text-xs leading-5 text-ink-faint">
        这段正文只在原来那一天的编辑器里修改。
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <NuxtLink
          :to="{ path: '/', query: { replyToEntry: item.id } }"
          class="inline-flex items-center gap-1 text-xs text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
        >
          <UIcon name="i-lucide-corner-down-right" class="size-3.5" aria-hidden="true" />
          继续写
        </NuxtLink>
        <NuxtLink
          v-if="editTarget"
          :to="editTarget"
          class="inline-flex items-center gap-1 text-xs text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
        >
          <UIcon name="i-lucide-arrow-left-right" class="size-3.5" aria-hidden="true" />
          回到这一天
        </NuxtLink>
        <span v-else class="text-xs text-ink-faint">
          原习惯已删除，这段反思仍保留。
        </span>
      </div>
    </footer>

    <div
      v-if="item.replies.length"
      class="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint"
    >
      <span class="inline-flex items-center gap-1">
        <UIcon name="i-lucide-corner-down-right" class="size-3" aria-hidden="true" />
        后来被
      </span>
      <NuxtLink
        v-for="reply in item.replies"
        :key="reply.id"
        :to="{ path: '/', query: { memo: reply.id } }"
        class="inline-block max-w-64 truncate text-done underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
        :title="reply.excerpt"
      >
        {{ reply.excerpt }}
      </NuxtLink>
    </div>
  </article>
</template>
