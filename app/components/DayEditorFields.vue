<script setup lang="ts">
import type { EntryStatus, EssayEntry } from '#shared/types'
import { REFLECTION_MAX_LENGTH } from '#shared/schemas'
import { renderMarkdown } from '~/utils/markdown'

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
const mode = ref<'write' | 'preview'>('write')
const renderedReflection = computed(() => renderMarkdown(reflection.value))

function statusClasses(value: EntryStatus): string {
  if (status.value === value) {
    return value === 'completed'
      ? 'border-done bg-done text-white shadow-[0_8px_20px_-14px_rgba(29,90,65,.9)]'
      : 'border-miss bg-miss text-white shadow-[0_8px_20px_-14px_rgba(168,58,46,.9)]'
  }
  return 'border-rule bg-paper/40 text-ink-soft hover:-translate-y-0.5 hover:border-rule-strong hover:bg-paper hover:text-ink active:translate-y-0'
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
          class="flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
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
          class="flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
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
        <label :for="mode === 'write' ? reflectionId : undefined" class="text-sm font-medium text-ink">
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

      <div class="mt-2 flex items-center justify-between gap-3">
        <div class="flex items-center gap-0.5 rounded-md border border-rule p-0.5" role="group" aria-label="正文显示方式">
          <button
            type="button"
            class="rounded-sm px-2.5 py-1 text-xs transition-colors motion-reduce:transition-none"
            :class="mode === 'write' ? 'bg-paper text-ink' : 'text-ink-faint hover:text-ink'"
            :aria-pressed="mode === 'write'"
            :disabled="busy"
            @click="mode = 'write'"
          >
            写作
          </button>
          <button
            type="button"
            class="rounded-sm px-2.5 py-1 text-xs transition-colors motion-reduce:transition-none"
            :class="mode === 'preview' ? 'bg-paper text-ink' : 'text-ink-faint hover:text-ink'"
            :aria-pressed="mode === 'preview'"
            :disabled="busy"
            @click="mode = 'preview'"
          >
            预览
          </button>
        </div>
        <span class="text-xs text-ink-faint">支持 Markdown</span>
      </div>

      <textarea
        v-if="mode === 'write'"
        :id="reflectionId"
        v-model="reflection"
        class="mt-2 min-h-32 w-full resize-y rounded-md border border-rule bg-sheet px-3 py-2.5 font-serif text-[15px] leading-7 text-ink transition-colors placeholder:text-ink-faint focus:border-done focus:outline-none focus:ring-2 focus:ring-done/15 disabled:opacity-60"
        :rows="6"
        :maxlength="REFLECTION_MAX_LENGTH"
        :disabled="busy"
        :aria-describedby="reflectionHelpId"
        placeholder="可以留空。"
      />
      <div
        v-else
        class="mt-2 min-h-32 rounded-md border border-rule bg-sheet px-3 py-2.5"
        role="region"
        aria-label="正文预览"
      >
        <div v-if="reflection.trim()" class="essay-markdown" v-html="renderedReflection" />
        <p v-else class="text-sm text-ink-faint">
          还没有内容。
        </p>
      </div>
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
