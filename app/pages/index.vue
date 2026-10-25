<script setup lang="ts">
import type { GoalSummary } from '#shared/types'
import { todayDateOnly } from '#shared/utils/date'
import { formatDayNumber, formatMonthName, formatWeekday } from '~/utils/date-display'

useHead({ title: 'Anti-Habit' })

const today = ref(todayDateOnly())
onMounted(() => {
  today.value = todayDateOnly()
})

const { data, pending, error, refresh } = await useFetch<{ goals: GoalSummary[] }>('/api/goals', {
  key: 'goals-home',
  query: computed(() => ({ date: today.value })),
  default: () => ({ goals: [] }),
})

const goals = computed(() => data.value?.goals ?? [])
const dayNumber = computed(() => formatDayNumber(today.value))
const monthName = computed(() => formatMonthName(today.value))
const weekday = computed(() => formatWeekday(today.value))

const unrecordedToday = computed(() => goals.value.filter(goal => !goal.todayEntry).length)
const todayLine = computed(() => {
  if (!unrecordedToday.value) return '今天都记过了。'
  return `今天还有 ${unrecordedToday.value} 个目标没有记录。`
})

const isCreateOpen = ref(false)
const renameTarget = ref<GoalSummary | null>(null)
const deleteTarget = ref<GoalSummary | null>(null)

const renameOpen = computed({
  get: () => renameTarget.value !== null,
  set: (open: boolean) => {
    if (!open) renameTarget.value = null
  },
})

const deleteOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (open: boolean) => {
    if (!open) deleteTarget.value = null
  },
})

async function handleSaved() {
  await refresh()
}
</script>

<template>
  <div class="min-h-dvh">
    <main class="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-8 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16 lg:px-10 lg:py-16">
      <aside class="lg:sticky lg:top-16 lg:self-start">
        <div class="flex flex-wrap items-start justify-between gap-4 lg:block lg:gap-0">
          <div>
            <p class="font-serif text-2xl tracking-tight text-ink">
              Anti-Habit
            </p>
            <div class="mt-6 flex items-baseline gap-3 lg:mt-10 lg:block">
              <p class="font-serif text-6xl leading-[0.9] tracking-tight text-ink lg:text-7xl">
                {{ dayNumber }}
              </p>
              <p class="text-sm text-ink-soft lg:mt-3">
                {{ monthName }}，{{ weekday }}
              </p>
            </div>
          </div>

          <UButton
            class="shrink-0 lg:hidden"
            icon="i-lucide-plus"
            label="新增目标"
            size="sm"
            @click="isCreateOpen = true"
          />
        </div>

        <p class="mt-5 max-w-60 text-sm leading-6 text-ink-soft">
          点一天，记下完成或未完成。没完成的日子，可以补一段记录。
        </p>
        <p v-if="goals.length" class="mt-2 text-sm leading-6 text-ink">
          {{ todayLine }}
        </p>

        <UButton
          class="mt-6 hidden w-full justify-center lg:flex"
          icon="i-lucide-plus"
          label="新增目标"
          size="lg"
          @click="isCreateOpen = true"
        />

        <p class="mt-10 hidden text-pretty text-xs leading-5 text-ink-faint lg:block">
          没有记录的日子，不算失败。
        </p>
      </aside>

      <section aria-labelledby="goals-heading">
        <div class="flex items-baseline justify-between border-b border-rule pb-3">
          <h1 id="goals-heading" class="font-serif text-2xl text-ink">
            目标
          </h1>
          <span v-if="goals.length" class="text-xs text-ink-faint">今天</span>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          title="没能读到目标"
          :description="getApiErrorMessage(error)"
          class="mt-6"
        />

        <div
          v-if="pending && !goals.length"
          class="divide-y divide-rule"
          aria-busy="true"
          aria-label="正在读取目标"
        >
          <div v-for="index in 3" :key="index" class="py-6">
            <div class="h-6 w-48 animate-pulse rounded-sm bg-rule/50 motion-reduce:animate-none" />
          </div>
        </div>

        <ul v-else-if="goals.length" class="divide-y divide-rule" aria-label="目标列表">
          <li v-for="goal in goals" :key="goal.id">
            <GoalRow
              :goal="goal"
              @rename="renameTarget = goal"
              @delete="deleteTarget = goal"
            />
          </li>
        </ul>

        <div v-else-if="!error" class="py-16 sm:py-24">
          <p class="font-serif text-2xl text-ink">
            还没有目标
          </p>
          <p class="mt-3 max-w-md text-sm leading-6 text-ink-soft">
            写下一个想持续观察的目标。比如，晚上十一点后不看手机。
          </p>
          <UButton
            class="mt-6"
            icon="i-lucide-plus"
            label="新增目标"
            @click="isCreateOpen = true"
          />
        </div>
      </section>
    </main>

    <GoalFormModal
      v-model:open="isCreateOpen"
      mode="create"
      @saved="handleSaved"
    />
    <GoalFormModal
      v-model:open="renameOpen"
      mode="rename"
      :goal="renameTarget"
      @saved="handleSaved"
    />
    <GoalDeleteModal
      v-model:open="deleteOpen"
      :goal="deleteTarget"
      @deleted="handleSaved"
    />
  </div>
</template>
