<script setup lang="ts">
import type { EssayEntry, GoalSummary } from '#shared/types'
import { formatDayLabel, formatFullDayLabel } from '~/utils/date-display'

const props = defineProps<{
  open: boolean
  goal: GoalSummary | null
  entries: EssayEntry[]
  pending: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  selectDate: [date: string]
}>()

const essayTitle = computed(() => props.goal?.essayTitle || '随笔')

const statusLabel = {
  completed: '完成',
  missed: '未完成',
} as const

const statusDot = {
  completed: 'bg-done',
  missed: 'bg-mist ring-1 ring-inset ring-[#b7cfb6]',
} as const
</script>

<template>
  <UModal
    :open="open"
    :title="essayTitle"
    :description="goal?.title"
    :transition="false"
    scrollable
    :ui="{
      content: 'bg-sheet sm:max-w-3xl',
      header: 'border-b border-rule',
      title: 'font-serif text-2xl text-ink',
      description: 'text-sm text-ink-soft',
      body: 'py-5',
      footer: 'border-t border-rule',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <p class="text-xs leading-5 text-ink-faint">
        点日期或回应链接，可以回到那一天。
      </p>

      <div v-if="pending" class="mt-6 space-y-6" aria-busy="true" aria-label="正在读取随笔">
        <div v-for="index in 3" :key="index" class="border-t border-rule pt-5">
          <div class="h-5 w-40 animate-pulse rounded-sm bg-rule/50 motion-reduce:animate-none" />
          <div class="mt-3 h-3 w-full animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
          <div class="mt-2 h-3 w-4/5 animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
        </div>
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="soft"
        title="没能读到这本随笔"
        :description="error"
        class="mt-6"
      />

      <div v-else-if="!entries.length" class="py-16">
        <p class="font-serif text-xl text-ink">
          还没有正文
        </p>
        <p class="mt-2 text-sm leading-6 text-ink-soft">
          下一次打卡时，可以从一句话开始。
        </p>
      </div>

      <ol v-else class="mt-2">
        <li
          v-for="item in entries"
          :key="item.entry.id"
          class="border-t border-rule py-7 first:border-t-0 first:pt-4"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <button
              type="button"
              class="font-serif text-xl text-ink hover:text-done hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-done"
              @click="emit('selectDate', item.entry.entryDate)"
            >
              {{ formatFullDayLabel(item.entry.entryDate) }}
            </button>
            <span class="flex items-center gap-2 text-xs text-ink-soft">
              <span
                class="size-2 rounded-[2px]"
                :class="statusDot[item.entry.status]"
                aria-hidden="true"
              />
              {{ statusLabel[item.entry.status] }}
            </span>
          </div>

          <p class="mt-3 whitespace-pre-wrap font-serif text-[15px] leading-8 text-ink">
            {{ item.entry.reflection }}
          </p>

          <div
            v-if="item.outgoing.length"
            class="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-ink-soft"
          >
            <span>回应</span>
            <template v-for="(reference, index) in item.outgoing" :key="reference.entryId">
              <button
                type="button"
                class="text-done hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
                @click="emit('selectDate', reference.entryDate)"
              >
                {{ formatDayLabel(reference.entryDate) }}
              </button>
              <span v-if="index < item.outgoing.length - 1" aria-hidden="true">、</span>
            </template>
          </div>

          <div
            v-if="item.incoming.length"
            class="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-ink-soft"
          >
            <span>后来被</span>
            <template v-for="(reference, index) in item.incoming" :key="reference.entryId">
              <button
                type="button"
                class="text-done hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
                @click="emit('selectDate', reference.entryDate)"
              >
                {{ formatDayLabel(reference.entryDate) }}
              </button>
              <span v-if="index < item.incoming.length - 1" aria-hidden="true">、</span>
            </template>
            <span>继续</span>
          </div>
        </li>
      </ol>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton
          label="关闭"
          color="neutral"
          variant="ghost"
          @click="emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>
