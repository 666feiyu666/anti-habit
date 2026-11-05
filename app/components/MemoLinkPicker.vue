<script setup lang="ts">
import type { CheckInOption, GoalSummary, MemoGoalRef } from '#shared/types'
import { formatDayLabel } from '~/utils/date-display'

const props = defineProps<{
  goals: GoalSummary[]
  linkedGoalRefs: MemoGoalRef[]
  checkIns: CheckInOption[]
  checkInsPending: boolean
  checkInsError: string
  busy: boolean
}>()

const goalIds = defineModel<string[]>('goalIds', { required: true })
const entryIds = defineModel<string[]>('entryIds', { required: true })

const deletedGoals = computed(() => props.linkedGoalRefs.filter(goal => goal.deletedAt !== null))
const selectedGoalIds = computed(() => new Set(goalIds.value))
const selectedEntryIds = computed(() => new Set(entryIds.value))
const visibleEntryIds = computed(() => new Set(props.checkIns.map(item => item.id)))
const preservedCount = computed(
  () => entryIds.value.filter(id => !visibleEntryIds.value.has(id)).length,
)
const goalTitleById = computed(() => {
  const map = new Map<string, string>()
  for (const goal of props.goals) map.set(goal.id, goal.title)
  for (const goal of deletedGoals.value) map.set(goal.id, goal.title)
  return map
})

function toggleGoal(goalId: string) {
  const next = new Set(goalIds.value)
  if (next.has(goalId)) {
    next.delete(goalId)
  } else {
    next.add(goalId)
  }
  goalIds.value = [...next]
}

function toggleEntry(entryId: string, checked: boolean) {
  const next = new Set(entryIds.value)
  if (checked) next.add(entryId)
  else next.delete(entryId)
  entryIds.value = [...next]
}
</script>

<template>
  <section class="space-y-5" aria-labelledby="memo-link-heading">
    <div>
      <div class="flex items-baseline justify-between gap-3">
        <h3 id="memo-link-heading" class="text-sm font-medium text-ink">
          关联习惯
          <span class="font-normal text-ink-faint">选填</span>
        </h3>
        <span class="text-xs text-ink-faint">
          {{ goalIds.length ? `已选 ${goalIds.length} 个` : '可以不选' }}
        </span>
      </div>
      <p class="mt-1 text-xs leading-5 text-ink-soft">
        一则笔记可以关联多个习惯，也可以不关联。之后可以从习惯页找回它。
      </p>

      <div v-if="goals.length" class="mt-2.5 flex flex-wrap gap-2">
        <button
          v-for="goal in goals"
          :key="goal.id"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          :class="selectedGoalIds.has(goal.id)
            ? 'border-done bg-done-soft/60 text-done'
            : 'border-rule bg-sheet text-ink-soft hover:border-rule-strong hover:text-ink'"
          :aria-pressed="selectedGoalIds.has(goal.id)"
          :disabled="busy"
          @click="toggleGoal(goal.id)"
        >
          <UIcon
            :name="selectedGoalIds.has(goal.id) ? 'i-lucide-check' : 'i-lucide-plus'"
            class="size-3.5"
            aria-hidden="true"
          />
          {{ goal.title }}
        </button>

        <span
          v-for="goal in deletedGoals"
          :key="goal.id"
          class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-rule-strong bg-paper/60 px-3 py-1.5 text-xs text-ink-faint"
          :title="`关联的习惯「${goal.title}」已删除，保存时会保留这层关系。`"
        >
          <UIcon name="i-lucide-archive" class="size-3.5" aria-hidden="true" />
          {{ goal.title }} · 已删除
        </span>
      </div>
      <p v-else class="mt-2 text-xs leading-5 text-ink-faint">
        还没有习惯。笔记可以先写，习惯以后创建也不影响它。
      </p>
    </div>

    <div>
      <div class="flex items-baseline justify-between gap-3">
        <h3 class="text-sm font-medium text-ink">
          关联某次打卡
          <span class="font-normal text-ink-faint">选填</span>
        </h3>
        <span class="text-xs text-ink-faint">
          {{ entryIds.length ? `已选 ${entryIds.length} 条` : '不改变完成状态' }}
        </span>
      </div>
      <p class="mt-1 text-xs leading-5 text-ink-soft">
        把笔记接到某一天的记录上，保存笔记不会修改那天的完成状态。
      </p>

      <p v-if="checkInsError" class="mt-2 text-xs leading-5 text-miss" role="alert">
        {{ checkInsError }}
      </p>
      <p v-else-if="!goalIds.length" class="mt-2 text-xs leading-5 text-ink-faint">
        先选择习惯，就能看到最近的打卡记录。
      </p>
      <p v-else-if="checkInsPending" class="mt-2 text-xs leading-5 text-ink-faint">
        正在读取最近的打卡…
      </p>
      <p v-else-if="!checkIns.length" class="mt-2 text-xs leading-5 text-ink-faint">
        这些习惯还没有可关联的打卡。也可以只关联习惯。
      </p>

      <ul
        v-else
        class="mt-2 max-h-56 divide-y divide-rule overflow-y-auto border-y border-rule"
      >
        <li v-for="item in checkIns" :key="item.id">
          <label
            class="flex cursor-pointer gap-3 px-2 py-2.5 transition-colors hover:bg-paper/60"
            :class="selectedEntryIds.has(item.id) ? 'bg-done-soft/30' : ''"
          >
            <input
              type="checkbox"
              class="mt-1 size-4 shrink-0 accent-done"
              :checked="selectedEntryIds.has(item.id)"
              :disabled="busy"
              @change="toggleEntry(item.id, ($event.target as HTMLInputElement).checked)"
            >
            <span class="min-w-0">
              <span class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span class="text-sm text-ink">{{ formatDayLabel(item.entryDate) }}</span>
                <span class="flex items-center gap-1.5 text-xs text-ink-soft">
                  <span
                    class="size-2 rounded-[2px]"
                    :class="item.status === 'completed' ? 'bg-done' : 'bg-miss'"
                    aria-hidden="true"
                  />
                  {{ item.status === 'completed' ? '完成' : '未完成' }}
                </span>
                <span class="truncate text-xs text-ink-faint">
                  {{ goalTitleById.get(item.goalId) }}
                </span>
              </span>
              <span
                v-if="item.excerpt"
                class="mt-0.5 line-clamp-1 block font-serif text-sm leading-6 text-ink-soft"
              >
                {{ item.excerpt }}
              </span>
            </span>
          </label>
        </li>
      </ul>

      <p v-if="preservedCount" class="mt-1.5 text-xs leading-5 text-ink-faint">
        另有 {{ preservedCount }} 个已关联的打卡不在最近记录中，保存时会保留。
      </p>
    </div>
  </section>
</template>
