<script setup lang="ts">
import type { GoalSummary } from '#shared/types'
import { todayDateOnly } from '#shared/utils/date'
import { formatDayLabel } from '~/utils/date-display'

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
  <div class="min-h-screen">
    <main class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs font-medium uppercase tracking-[0.22em] text-emerald-700">
            Anti-Habit
          </p>
          <h1 class="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">
            目标
          </h1>
          <p class="mt-2 text-sm text-neutral-600">
            按天记录，看看一段时间里发生了什么。
          </p>
          <p class="mt-1 text-xs text-neutral-500">
            今天 · {{ formatDayLabel(today) }}
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          label="新增目标"
          size="lg"
          @click="isCreateOpen = true"
        />
      </header>

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        title="目标列表加载失败"
        :description="getApiErrorMessage(error)"
        class="mt-8"
      />

      <div v-if="pending && !goals.length" class="mt-8 space-y-3" aria-busy="true" aria-label="正在载入目标">
        <div v-for="index in 3" :key="index" class="h-24 animate-pulse rounded-2xl bg-neutral-100" />
      </div>

      <ul v-else-if="goals.length" class="mt-8 space-y-3" aria-label="目标列表">
        <li v-for="goal in goals" :key="goal.id">
          <GoalCard
            :goal="goal"
            @rename="renameTarget = goal"
            @delete="deleteTarget = goal"
          />
        </li>
      </ul>

      <section
        v-else-if="!error"
        class="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-12 text-center"
      >
        <UIcon name="i-lucide-calendar-days" class="mx-auto size-8 text-neutral-400" aria-hidden="true" />
        <p class="mt-4 text-base font-medium text-neutral-800">
          还没有目标
        </p>
        <p class="mt-1 text-sm text-neutral-500">
          建立一个目标后，就可以按天记录。
        </p>
        <UButton
          class="mt-6"
          icon="i-lucide-plus"
          label="新增目标"
          @click="isCreateOpen = true"
        />
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
