<script setup lang="ts">
import type { EntryStatus, EssayEntry } from '#shared/types'
import { REFLECTION_MAX_LENGTH } from '#shared/schemas'

const props = defineProps<{
  idPrefix: string
  error: string
  busy: boolean
  candidates: EssayEntry[]
  candidatesPending: boolean
  candidatesError: string
}>()

const status = defineModel<EntryStatus | null>('status', { required: true })
const reflection = defineModel<string>('reflection', { required: true })
const linkedEntryIds = defineModel<string[]>('linkedEntryIds', { required: true })

const reflectionId = computed(() => `reflection-${props.idPrefix}`)
const reflectionHelpId = computed(() => `reflection-help-${props.idPrefix}`)

function statusClasses(value: EntryStatus): string {
  if (status.value === value) {
    return value === 'completed'
      ? 'border-done bg-done text-white'
      : 'border-miss bg-miss text-white'
  }
  return 'border-rule bg-transparent text-ink-soft hover:border-rule-strong hover:text-ink'
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div>
      <p :id="`day-status-label-${idPrefix}`" class="text-sm font-medium text-ink">
        这一天
      </p>
      <div
        class="mt-2 grid grid-cols-2 gap-2"
        role="group"
        :aria-labelledby="`day-status-label-${idPrefix}`"
      >
        <button
          type="button"
          class="flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done disabled:cursor-not-allowed disabled:opacity-60"
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
          class="flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done disabled:cursor-not-allowed disabled:opacity-60"
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
        <label :for="reflectionId" class="text-sm font-medium text-ink">
          这一天想到什么？
          <span class="font-normal text-ink-faint">选填</span>
        </label>
        <span class="text-xs tabular-nums text-ink-faint">
          {{ reflection.length }}/{{ REFLECTION_MAX_LENGTH }}
        </span>
      </div>
      <p :id="reflectionHelpId" class="mt-1 text-xs leading-5 text-ink-soft">
        可以记下当时发生的事，也可以继续以前的想法。
      </p>
      <textarea
        :id="reflectionId"
        v-model="reflection"
        class="mt-2 min-h-32 w-full resize-y rounded-md border border-rule bg-sheet px-3 py-2.5 font-serif text-[15px] leading-7 text-ink placeholder:text-ink-faint focus:border-done focus:outline-none focus:ring-2 focus:ring-done/15 disabled:opacity-60"
        :rows="6"
        :maxlength="REFLECTION_MAX_LENGTH"
        :disabled="busy"
        :aria-describedby="reflectionHelpId"
        placeholder="可以留空。"
      />
    </div>

    <EntryLinkPicker
      v-model:selected="linkedEntryIds"
      :candidates="candidates"
      :pending="candidatesPending"
      :error="candidatesError"
      :busy="busy"
    />

    <p v-if="error" class="text-sm text-miss" role="alert">
      {{ error }}
    </p>
  </div>
</template>
