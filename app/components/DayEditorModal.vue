<script setup lang="ts">
import type { DailyEntry, EntryStatus } from '#shared/types'
import { REFLECTION_MAX_LENGTH } from '#shared/schemas'
import { formatFullDayLabel } from '~/utils/date-display'

const props = defineProps<{
  open: boolean
  goalId: string
  date: string
  entry: DailyEntry | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  changed: []
}>()

const toast = useToast()
const status = ref<EntryStatus | null>(null)
const reflection = ref('')
const error = ref('')
const saving = ref(false)
const clearing = ref(false)

watch(() => props.open, (open) => {
  if (!open) return
  status.value = props.entry?.status ?? null
  reflection.value = props.entry?.reflection ?? ''
  error.value = ''
})

const dateLabel = computed(() => props.date ? formatFullDayLabel(props.date) : '')
const busy = computed(() => saving.value || clearing.value)

function statusClasses(value: EntryStatus): string {
  if (status.value === value) {
    return value === 'completed'
      ? 'border-emerald-700 bg-emerald-700 text-white ring-2 ring-emerald-600 ring-offset-2'
      : 'border-red-600 bg-red-600 text-white ring-2 ring-red-500 ring-offset-2'
  }
  return 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
}

async function save() {
  if (!status.value) {
    error.value = '请选择完成或未完成'
    return
  }

  saving.value = true
  error.value = ''

  try {
    await $fetch(`/api/goals/${props.goalId}/entries/${props.date}`, {
      method: 'PUT',
      body: {
        status: status.value,
        reflection: reflection.value,
      },
    })
    emit('update:open', false)
    emit('changed')
    toast.add({ title: '已保存', color: 'neutral' })
  } catch (caught) {
    error.value = getApiErrorMessage(caught)
  } finally {
    saving.value = false
  }
}

async function restore(entry: DailyEntry) {
  try {
    await $fetch(`/api/goals/${props.goalId}/entries/${entry.entryDate}`, {
      method: 'PUT',
      body: {
        status: entry.status,
        reflection: entry.reflection,
      },
    })
    emit('changed')
    toast.add({ title: '已恢复记录', color: 'neutral' })
  } catch (caught) {
    toast.add({
      title: getApiErrorMessage(caught),
      color: 'error',
    })
  }
}

async function clear() {
  const previous = props.entry
  if (!previous) return

  clearing.value = true
  error.value = ''

  try {
    await $fetch(`/api/goals/${props.goalId}/entries/${props.date}`, {
      method: 'DELETE',
    })
    emit('update:open', false)
    emit('changed')
    toast.add({
      title: '已清除这一天的记录',
      color: 'neutral',
      duration: 8000,
      actions: [{
        label: '撤销',
        onClick: () => {
          void restore(previous)
        },
      }],
    })
  } catch (caught) {
    error.value = getApiErrorMessage(caught)
  } finally {
    clearing.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="dateLabel"
    description="选择这一天的状态，reflection 可选。"
    :dismissible="!busy"
    :transition="false"
    scrollable
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-col gap-5">
        <div>
          <p id="day-status-label" class="text-sm font-medium text-neutral-800">
            这一天的状态
          </p>
          <div class="mt-2 grid grid-cols-2 gap-3" role="group" aria-labelledby="day-status-label">
            <button
              type="button"
              class="flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              :class="statusClasses('completed')"
              :aria-pressed="status === 'completed'"
              :disabled="busy"
              @click="status = 'completed'"
            >
              <UIcon name="i-lucide-check" class="size-4" aria-hidden="true" />
              完成
            </button>
            <button
              type="button"
              class="flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              :class="statusClasses('missed')"
              :aria-pressed="status === 'missed'"
              :disabled="busy"
              @click="status = 'missed'"
            >
              <UIcon name="i-lucide-x" class="size-4" aria-hidden="true" />
              未完成
            </button>
          </div>
        </div>

        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label for="reflection" class="text-sm font-medium text-neutral-800">
              Reflection <span class="font-normal text-neutral-500">（可选）</span>
            </label>
            <span class="text-xs tabular-nums text-neutral-400">
              {{ reflection.length }}/{{ REFLECTION_MAX_LENGTH }}
            </span>
          </div>
          <p id="reflection-help" class="mt-1 text-xs leading-5 text-neutral-500">
            记录当天发生了什么、当时的状态，或之后产生的新理解。
          </p>
          <UTextarea
            id="reflection"
            v-model="reflection"
            class="mt-2 w-full"
            :rows="5"
            :maxlength="REFLECTION_MAX_LENGTH"
            :disabled="busy"
            aria-describedby="reflection-help"
            placeholder="写一点什么，或者留空。"
          />
        </div>

        <p v-if="error" class="text-sm text-red-600" role="alert">
          {{ error }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <UButton
          v-if="entry"
          label="清除这一天"
          icon="i-lucide-eraser"
          color="error"
          variant="ghost"
          :loading="clearing"
          :disabled="saving"
          @click="clear"
        />
        <div class="flex justify-end gap-2">
          <UButton
            label="取消"
            color="neutral"
            variant="ghost"
            :disabled="busy"
            @click="emit('update:open', false)"
          />
          <UButton
            label="保存"
            :loading="saving"
            :disabled="clearing"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
