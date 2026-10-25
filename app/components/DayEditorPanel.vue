<script setup lang="ts">
import type { DailyEntry } from '#shared/types'
import { formatFullDayLabel } from '~/utils/date-display'

const props = defineProps<{
  goalId: string
  date: string
  entry: DailyEntry | null
  isToday: boolean
}>()

const emit = defineEmits<{
  changed: []
}>()

const {
  status,
  reflection,
  error,
  saving,
  clearing,
  busy,
  save,
  clear,
} = useDayEditor({
  goalId: () => props.goalId,
  date: () => props.date,
  entry: () => props.entry,
  changed: () => emit('changed'),
})

const dateLabel = computed(() => formatFullDayLabel(props.date))
</script>

<template>
  <section class="lg:border-l lg:border-rule lg:pl-8" aria-labelledby="day-panel-heading">
    <div class="flex items-baseline justify-between gap-3">
      <h2 id="day-panel-heading" class="font-serif text-2xl text-ink">
        {{ dateLabel }}
      </h2>
      <span v-if="isToday" class="shrink-0 text-xs text-done">今天</span>
    </div>

    <div class="mt-6">
      <DayEditorFields
        id-prefix="panel"
        v-model:status="status"
        v-model:reflection="reflection"
        :error="error"
        :busy="busy"
      />
    </div>

    <div class="mt-5 flex items-center justify-between gap-2">
      <button
        v-if="entry"
        type="button"
        class="text-sm text-miss hover:underline disabled:opacity-60"
        :disabled="busy"
        @click="clear"
      >
        清除这一天
      </button>
      <span v-else />
      <UButton
        label="保存"
        :loading="saving"
        :disabled="clearing"
        @click="save"
      />
    </div>
  </section>
</template>
