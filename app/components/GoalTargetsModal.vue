<script setup lang="ts">
import type { GoalSummary, GoalTarget, GoalTargetType } from '#shared/types'
import { GOAL_TARGET_COUNT_MAX, GOAL_TARGET_COUNT_MIN } from '#shared/schemas'

const props = defineProps<{
  open: boolean
  goal: GoalSummary | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const toast = useToast()
const targets = ref<GoalTarget[]>([])
const pending = ref(false)
const error = ref('')
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const formType = ref<GoalTargetType>('streak')
const formCount = ref(30)
const saving = ref(false)
const deletingId = ref<string | null>(null)

const formHint = computed(() => formType.value === 'streak'
  ? '按历史最长连续天数判定达成；今天还没记录时，当前连续不会立刻清零。'
  : '按从目标创建日起累计的完成天数判定；任何一天完成都计入。')

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T00:00:00`))
}

function typeLabel(type: GoalTargetType): string {
  return type === 'streak' ? '连续' : '累积'
}

function metricOf(target: GoalTarget): number {
  return target.type === 'streak'
    ? target.progress.longestStreak
    : target.progress.completedDays
}

function percentOf(target: GoalTarget): number {
  return Math.min(100, Math.round((metricOf(target) / target.count) * 100))
}

function progressSummary(target: GoalTarget): string {
  if (target.type === 'streak') {
    return `历史最长 ${target.progress.longestStreak} 天 · 当前连续 ${target.progress.currentStreak} 天`
  }
  return `已累积 ${target.progress.completedDays} 天`
}

async function load() {
  const goal = props.goal
  if (!goal) return

  pending.value = true
  error.value = ''

  try {
    const result = await $fetch<{ targets: GoalTarget[] }>(
      `/api/goals/${goal.id}/targets`,
    )
    if (goal.id !== props.goal?.id) return
    targets.value = result.targets
  } catch (caught) {
    error.value = getApiErrorMessage(caught)
  } finally {
    pending.value = false
  }
}

watch(
  () => [props.open, props.goal?.id] as const,
  ([open]) => {
    if (!open) return
    targets.value = []
    error.value = ''
    formOpen.value = false
    editingId.value = null
    void load()
  },
  { immediate: true },
)

function openCreate() {
  editingId.value = null
  formType.value = 'streak'
  formCount.value = 30
  error.value = ''
  formOpen.value = true
}

function openEdit(target: GoalTarget) {
  editingId.value = target.id
  formType.value = target.type
  formCount.value = target.count
  error.value = ''
  formOpen.value = true
}

function cancelForm() {
  if (saving.value) return
  formOpen.value = false
  editingId.value = null
  error.value = ''
}

async function saveTarget() {
  const goal = props.goal
  if (!goal || saving.value) return

  const count = Number(formCount.value)
  if (!Number.isInteger(count) || count < GOAL_TARGET_COUNT_MIN || count > GOAL_TARGET_COUNT_MAX) {
    error.value = `目标天数需要是 ${GOAL_TARGET_COUNT_MIN} 到 ${GOAL_TARGET_COUNT_MAX} 之间的整数`
    return
  }

  saving.value = true
  error.value = ''

  try {
    const body = { type: formType.value, count }
    if (editingId.value) {
      await $fetch(`/api/goals/${goal.id}/targets/${editingId.value}`, {
        method: 'PUT',
        body,
      })
      toast.add({ title: '目标设定已保存', color: 'neutral' })
    } else {
      await $fetch(`/api/goals/${goal.id}/targets`, {
        method: 'POST',
        body,
      })
      toast.add({ title: '已新增目标设定', color: 'neutral' })
    }

    formOpen.value = false
    editingId.value = null
    await load()
  } catch (caught) {
    error.value = getApiErrorMessage(caught)
  } finally {
    saving.value = false
  }
}

async function deleteTarget(target: GoalTarget) {
  const goal = props.goal
  if (!goal) return
  if (!window.confirm(`删除“${typeLabel(target.type)} ${target.count} 天”这个目标设定？`)) return

  deletingId.value = target.id
  error.value = ''

  try {
    await $fetch(`/api/goals/${goal.id}/targets/${target.id}`, { method: 'DELETE' })
    toast.add({ title: '目标设定已删除', color: 'neutral' })
    if (editingId.value === target.id) {
      formOpen.value = false
      editingId.value = null
    }
    await load()
  } catch (caught) {
    error.value = getApiErrorMessage(caught)
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <UModal
    :open="open"
    title="目标完成情况"
    :description="goal?.title"
    :transition="false"
    scrollable
    :ui="{
      content: 'bg-sheet sm:max-w-2xl',
      header: 'border-b border-rule',
      title: 'font-serif text-2xl text-ink',
      description: 'text-sm text-ink-soft',
      body: 'py-5',
      footer: 'border-t border-rule',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="max-w-md text-xs leading-5 text-ink-faint">
          给这个议题设定要达成的事，可以同时设多个。目标从议题创建当天开始计算。
        </p>
        <UButton
          label="新增目标设定"
          icon="i-lucide-plus"
          size="sm"
          :disabled="!goal || saving"
          @click="openCreate"
        />
      </div>

      <div v-if="formOpen" class="mt-4 border border-rule bg-paper/60 p-4">
        <p class="text-sm font-medium text-ink">
          {{ editingId ? '编辑目标设定' : '新增目标设定' }}
        </p>

        <div class="mt-3">
          <p class="text-xs font-medium text-ink-soft">计算方式</p>
          <div class="mt-1.5 flex items-center gap-0.5 rounded-md border border-rule p-0.5" role="group" aria-label="计算方式">
            <button
              type="button"
              class="flex-1 rounded-sm px-3 py-1.5 text-xs transition-colors motion-reduce:transition-none"
              :class="formType === 'streak' ? 'bg-sheet text-ink' : 'text-ink-faint hover:text-ink'"
              :aria-pressed="formType === 'streak'"
              :disabled="saving"
              @click="formType = 'streak'"
            >
              连续
            </button>
            <button
              type="button"
              class="flex-1 rounded-sm px-3 py-1.5 text-xs transition-colors motion-reduce:transition-none"
              :class="formType === 'cumulative' ? 'bg-sheet text-ink' : 'text-ink-faint hover:text-ink'"
              :aria-pressed="formType === 'cumulative'"
              :disabled="saving"
              @click="formType = 'cumulative'"
            >
              累积
            </button>
          </div>
        </div>

        <div class="mt-3">
          <label for="goal-target-count" class="text-xs font-medium text-ink-soft">
            目标天数
          </label>
          <div class="mt-1.5 flex items-center gap-2">
            <UInput
              id="goal-target-count"
              v-model.number="formCount"
              type="number"
              :min="GOAL_TARGET_COUNT_MIN"
              :max="GOAL_TARGET_COUNT_MAX"
              :disabled="saving"
              class="w-32"
            />
            <span class="text-sm text-ink-soft">天</span>
          </div>
        </div>

        <p class="mt-3 text-xs leading-5 text-ink-faint">
          {{ formHint }}
        </p>

        <div class="mt-3 flex justify-end gap-2">
          <UButton
            label="取消"
            color="neutral"
            variant="ghost"
            :disabled="saving"
            @click="cancelForm"
          />
          <UButton
            :label="editingId ? '保存' : '添加'"
            :loading="saving"
            @click="saveTarget"
          />
        </div>
      </div>

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        title="目标设定操作失败"
        :description="error"
        class="mt-4"
      />

      <div v-if="pending" class="mt-6 space-y-5" aria-busy="true" aria-label="正在读取目标设定">
        <div v-for="index in 2" :key="index" class="border-t border-rule pt-5">
          <div class="h-6 w-32 animate-pulse rounded-sm bg-rule/50 motion-reduce:animate-none" />
          <div class="mt-3 h-2 w-full animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
        </div>
      </div>

      <div v-else-if="!targets.length" class="py-14">
        <p class="font-serif text-xl text-ink">
          还没有目标设定
        </p>
        <p class="mt-2 text-sm leading-6 text-ink-soft">
          可以设一个“连续 30 天”，也可以再设一个“累积 100 天”。
        </p>
      </div>

      <ul v-else class="mt-2">
        <li
          v-for="target in targets"
          :key="target.id"
          class="border-t border-rule py-5 first:border-t-0 first:pt-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p class="text-xs text-ink-soft">
                {{ typeLabel(target.type) }}目标
              </p>
              <p class="mt-0.5 font-serif text-2xl leading-8 text-ink">
                {{ target.count }} 天
              </p>
            </div>
            <span
              v-if="target.progress.achieved"
              class="rounded-sm bg-mist px-2 py-1 text-xs text-mist-ink"
            >
              已达成
            </span>
          </div>

          <div
            class="mt-3 h-2 overflow-hidden rounded-sm bg-rule/50"
            role="progressbar"
            :aria-valuenow="percentOf(target)"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`${typeLabel(target.type)} ${target.count} 天进度`"
          >
            <div
              class="h-full bg-done transition-[width] motion-reduce:transition-none"
              :style="{ width: `${percentOf(target)}%` }"
            />
          </div>

          <div class="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs text-ink-soft">
            <span>{{ progressSummary(target) }}</span>
            <span class="tabular-nums">{{ percentOf(target) }}%</span>
          </div>

          <p class="mt-1 text-xs text-ink-faint">
            从 {{ formatDate(target.progress.startDate) }} 起算
            <span v-if="target.progress.achievedOn">
              · 达成于 {{ formatDate(target.progress.achievedOn) }}
            </span>
          </p>

          <div class="mt-3 flex justify-end gap-1">
            <UButton
              label="编辑"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="saving || deletingId === target.id"
              @click="openEdit(target)"
            />
            <UButton
              label="删除"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              :loading="deletingId === target.id"
              @click="deleteTarget(target)"
            />
          </div>
        </li>
      </ul>
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
