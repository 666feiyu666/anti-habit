<script setup lang="ts">
import type { DailyEntryWithLinks } from '#shared/types'
import { formatFullDayLabel } from '~/utils/date-display'

const props = defineProps<{
  open: boolean
  goalId: string
  date: string
  entry: DailyEntryWithLinks | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  changed: []
}>()

const {
  status,
  reflection,
  linkedEntryIds,
  candidates,
  candidatesPending,
  candidatesError,
  error,
  saving,
  clearing,
  busy,
  dirty,
  reset,
  loadCandidates,
  save,
  clear,
  requestClose,
} = useDayEditor({
  goalId: () => props.goalId,
  date: () => props.date,
  entry: () => props.entry,
  changed: () => emit('changed'),
})

watch(() => props.open, (open) => {
  if (!open) return
  reset()
  void loadCandidates()
})

const dateLabel = computed(() => props.date ? formatFullDayLabel(props.date) : '')

function handleOpenChange(value: boolean) {
  if (value) return
  if (requestClose()) emit('update:open', false)
}

async function handleSave() {
  if (await save()) emit('update:open', false)
}

async function handleClear() {
  if (await clear()) emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    :title="dateLabel"
    description="记下完成或未完成，也可以写点当时的情形。"
    :dismissible="!busy"
    :transition="false"
    scrollable
    :ui="{ content: 'bg-sheet', header: 'border-b border-rule', footer: 'border-t border-rule' }"
    @update:open="handleOpenChange"
  >
    <template #body>
      <DayEditorFields
        id-prefix="modal"
        v-model:status="status"
        v-model:reflection="reflection"
        v-model:linked-entry-ids="linkedEntryIds"
        :candidates="candidates"
        :candidates-pending="candidatesPending"
        :candidates-error="candidatesError"
        :error="error"
        :busy="busy"
      />
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3">
          <UButton
            v-if="entry"
            label="清除这一天"
            icon="i-lucide-eraser"
            color="error"
            variant="ghost"
            :loading="clearing"
            :disabled="saving"
            @click="handleClear"
          />
          <span v-if="dirty" class="text-xs text-ink-faint">有未保存的修改</span>
        </div>
        <div class="flex justify-end gap-2">
          <UButton
            label="取消"
            color="neutral"
            variant="ghost"
            :disabled="busy"
            @click="handleOpenChange(false)"
          />
          <UButton
            label="保存"
            :loading="saving"
            :disabled="clearing"
            @click="handleSave"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
