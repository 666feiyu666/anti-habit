<script setup lang="ts">
import { subDays } from 'date-fns'
import type {
  CheckInOption,
  DailyEntryWithLinks,
  GoalSummary,
  Memo,
  MemoGoalRef,
} from '#shared/types'
import { MEMO_CONTENT_MAX_LENGTH } from '#shared/schemas'
import { todayDateOnly } from '#shared/utils/date'
import { formatDateKey } from '~/utils/date-display'
import { markdownExcerpt, renderMarkdown } from '~/utils/markdown'
import { clearMemoDraft, readMemoDraft, writeMemoDraft } from '~/utils/memo-draft'

const props = withDefaults(defineProps<{
  goals: GoalSummary[]
  mode?: 'create' | 'edit'
  memoId?: string
  initialContent?: string
  initialGoalIds?: string[]
  initialEntryIds?: string[]
  linkedGoalRefs?: MemoGoalRef[]
  draftKey: string
  submitLabel?: string
  autofocus?: boolean
  showHeading?: boolean
}>(), {
  mode: 'create',
  memoId: undefined,
  initialContent: '',
  initialGoalIds: () => [],
  initialEntryIds: () => [],
  linkedGoalRefs: () => [],
  submitLabel: '保存笔记',
  autofocus: false,
  showHeading: true,
})

const emit = defineEmits<{
  saved: [memo: Memo]
  cancel: []
}>()

const content = ref(props.initialContent)
const goalIds = ref([...props.initialGoalIds])
const entryIds = ref([...props.initialEntryIds])
const viewMode = ref<'write' | 'preview'>('write')
const saving = ref(false)
const error = ref('')
const restored = ref(false)
const checkIns = ref<CheckInOption[]>([])
const checkInsPending = ref(false)
const checkInsError = ref('')
const textarea = ref<HTMLTextAreaElement | null>(null)

const renderedContent = computed(() => renderMarkdown(content.value))
const remaining = computed(() => MEMO_CONTENT_MAX_LENGTH - content.value.length)
const linkedRefs = computed(() => [
  ...props.goals
    .filter(goal => goalIds.value.includes(goal.id))
    .map(goal => ({ id: goal.id, title: goal.title, deletedAt: null })),
  ...props.linkedGoalRefs.filter(goal => goal.deletedAt !== null),
])
const hasPreservedGoals = computed(
  () => props.linkedGoalRefs.some(goal => goal.deletedAt !== null && goalIds.value.includes(goal.id)),
)
const canSave = computed(() => content.value.trim().length > 0 && !saving.value)

const range = (() => {
  const to = todayDateOnly()
  return { from: formatDateKey(subDays(new Date(), 365)), to }
})()

let draftTimer: ReturnType<typeof setTimeout> | null = null

function flushDraft() {
  if (!import.meta.client) return
  if (draftTimer) {
    clearTimeout(draftTimer)
    draftTimer = null
  }
  if (content.value.trim()) writeMemoDraft(props.draftKey, content.value)
  else clearMemoDraft(props.draftKey)
}

watch(content, () => {
  if (!import.meta.client) return
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(flushDraft, 350)
})

onBeforeUnmount(flushDraft)

async function loadCheckIns() {
  if (!import.meta.client) return

  const goalIdsToLoad = goalIds.value.filter(
    id => props.goals.some(goal => goal.id === id),
  )

  if (goalIdsToLoad.length === 0) {
    checkIns.value = []
    checkInsError.value = ''
    return
  }

  checkInsPending.value = true
  checkInsError.value = ''

  try {
    const results = await Promise.all(goalIdsToLoad.map(async (goalId) => {
      const goal = props.goals.find(item => item.id === goalId)
      const data = await $fetch<{ entries: DailyEntryWithLinks[] }>(
        `/api/goals/${goalId}/entries`,
        { query: range },
      )

      return data.entries.map(entry => ({
        id: entry.id,
        goalId,
        goalTitle: goal?.title ?? '',
        entryDate: entry.entryDate,
        status: entry.status,
        excerpt: markdownExcerpt(entry.reflection ?? ''),
      }) satisfies CheckInOption)
    }))

    checkIns.value = results
      .flat()
      .sort((left, right) => right.entryDate.localeCompare(left.entryDate))
      .slice(0, 80)
  } catch (caught) {
    checkIns.value = []
    checkInsError.value = getApiErrorMessage(caught)
  } finally {
    checkInsPending.value = false
  }
}

watch(goalIds, () => {
  if (!import.meta.client) return
  void loadCheckIns()
})

function discardDraft() {
  clearMemoDraft(props.draftKey)
  content.value = ''
  restored.value = false
  error.value = ''
}

async function save() {
  error.value = ''

  if (!content.value.trim()) {
    error.value = '笔记正文不能为空'
    return
  }

  saving.value = true

  try {
    const url = props.mode === 'create' ? '/api/memos' : `/api/memos/${props.memoId}`
    const { memo } = await $fetch<{ memo: Memo }>(url, {
      method: props.mode === 'create' ? 'POST' : 'PATCH',
      body: {
        content: content.value,
        goalIds: goalIds.value,
        entryIds: entryIds.value,
      },
    })

    clearMemoDraft(props.draftKey)
    restored.value = false
    emit('saved', memo)

    if (props.mode === 'create') {
      content.value = ''
      entryIds.value = []
      viewMode.value = 'write'
      flushDraft()
    }
  } catch (caught) {
    error.value = getApiErrorMessage(caught)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  const stored = readMemoDraft(props.draftKey)
  if (stored && stored.trim() && stored !== content.value) {
    content.value = stored
    restored.value = true
  }

  if (props.autofocus) {
    void nextTick(() => textarea.value?.focus())
  }

  void loadCheckIns()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="showHeading" class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="font-serif text-2xl leading-tight text-ink">
          现在想到什么？
        </h2>
        <p class="mt-1 text-xs leading-5 text-ink-soft">
          无标题也可以写。习惯关联是选填。
        </p>
      </div>
      <span class="text-xs tabular-nums" :class="remaining < 500 ? 'text-miss' : 'text-ink-faint'">
        {{ content.length }}/{{ MEMO_CONTENT_MAX_LENGTH }}
      </span>
    </div>

    <div
      v-if="restored"
      class="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-brass/40 bg-brass-soft/50 px-3 py-2 text-xs text-brass-ink"
      role="status"
    >
      <span class="flex items-center gap-1.5">
        <UIcon name="i-lucide-history" class="size-3.5" aria-hidden="true" />
        已恢复上次未保存的草稿。
      </span>
      <button
        type="button"
        class="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
        @click="discardDraft"
      >
        丢弃草稿
      </button>
    </div>

    <div>
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-0.5 rounded-md border border-rule p-0.5" role="group" aria-label="正文显示方式">
          <button
            type="button"
            class="rounded-sm px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done motion-reduce:transition-none"
            :class="viewMode === 'write' ? 'bg-paper text-ink' : 'text-ink-faint hover:text-ink'"
            :aria-pressed="viewMode === 'write'"
            :disabled="saving"
            @click="viewMode = 'write'"
          >
            写作
          </button>
          <button
            type="button"
            class="rounded-sm px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done motion-reduce:transition-none"
            :class="viewMode === 'preview' ? 'bg-paper text-ink' : 'text-ink-faint hover:text-ink'"
            :aria-pressed="viewMode === 'preview'"
            :disabled="saving"
            @click="viewMode = 'preview'"
          >
            预览
          </button>
        </div>
        <span class="text-xs text-ink-faint">支持 Markdown</span>
      </div>

      <textarea
        v-if="viewMode === 'write'"
        ref="textarea"
        v-model="content"
        class="mt-2 min-h-40 w-full resize-y rounded-md border border-rule bg-sheet px-3.5 py-3 font-serif text-[15px] leading-7 text-ink transition-colors placeholder:text-ink-faint focus:border-done focus:outline-none focus:ring-2 focus:ring-done/15 disabled:opacity-60"
        :rows="7"
        :maxlength="MEMO_CONTENT_MAX_LENGTH"
        :disabled="saving"
        aria-label="笔记正文"
        placeholder="写下此刻的想法。比如：今天在地铁上想到，习惯不是坚持，而是把环境改到不需要坚持。"
        @keydown.meta.enter.prevent="save"
        @keydown.ctrl.enter.prevent="save"
      />
      <div
        v-else
        class="mt-2 min-h-40 rounded-md border border-rule bg-sheet px-3.5 py-3"
        role="region"
        aria-label="笔记预览"
      >
        <div v-if="content.trim()" class="essay-markdown" v-html="renderedContent" />
        <p v-else class="text-sm text-ink-faint">
          还没有内容。
        </p>
      </div>
    </div>

    <MemoLinkPicker
      v-model:goal-ids="goalIds"
      v-model:entry-ids="entryIds"
      :goals="goals"
      :linked-goal-refs="linkedRefs"
      :check-ins="checkIns"
      :check-ins-pending="checkInsPending"
      :check-ins-error="checkInsError"
      :busy="saving"
    />

    <p v-if="hasPreservedGoals" class="text-xs leading-5 text-ink-faint">
      已删除习惯的关联会留在这则笔记上，方便日后核对。
    </p>

    <p v-if="error" class="text-sm text-miss" role="alert">
      {{ error }}
    </p>

    <div class="flex flex-col-reverse gap-2 border-t border-rule/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs leading-5 text-ink-faint">
        <span class="hidden sm:inline">⌘/Ctrl + Enter 保存 · </span>草稿保存在这台设备上
      </p>
      <div class="flex justify-end gap-2">
        <UButton
          v-if="mode === 'edit'"
          label="取消"
          color="neutral"
          variant="ghost"
          :disabled="saving"
          @click="emit('cancel')"
        />
        <UButton
          :label="submitLabel"
          icon="i-lucide-feather"
          :loading="saving"
          :disabled="!canSave"
          @click="save"
        />
      </div>
    </div>
  </div>
</template>
