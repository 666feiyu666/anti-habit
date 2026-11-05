<script setup lang="ts">
import type { FeedMemoItem, GoalSummary, Memo } from '#shared/types'

const props = defineProps<{
  memo: FeedMemoItem | null
  goals: GoalSummary[]
}>()

const emit = defineEmits<{
  'update:memo': [memo: FeedMemoItem | null]
  saved: [memo: Memo]
  cancel: []
}>()

const open = computed({
  get: () => props.memo !== null,
  set: (value: boolean) => {
    if (!value) emit('update:memo', null)
  },
})

const title = computed(() => props.memo ? '编辑笔记' : '笔记')

function handleSaved(memo: Memo) {
  emit('saved', memo)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    description="正文和关联一起保存；只要有一处无效，整次修改都不会生效。"
    :transition="false"
    scrollable
    :ui="{ content: 'modal-panel bg-sheet', header: 'border-b border-rule', footer: 'border-t border-rule' }"
  >
    <template #body>
      <MemoForm
        v-if="memo"
        :key="memo.id"
        mode="edit"
        :memo-id="memo.id"
        :goals="goals"
        :initial-content="memo.content"
        :initial-goal-ids="memo.goals.map(goal => goal.id)"
        :initial-entry-ids="[...memo.entries.map(entry => entry.id), ...memo.hiddenEntryIds]"
        :linked-goal-refs="memo.goals"
        :draft-key="`memo:${memo.id}`"
        submit-label="保存修改"
        :show-heading="false"
        @saved="handleSaved"
        @cancel="emit('cancel')"
      />
    </template>
  </UModal>
</template>
