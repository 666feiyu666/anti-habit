<script setup lang="ts">
import type { Goal } from '#shared/types'
import { ESSAY_TITLE_MAX_LENGTH, GOAL_TITLE_MAX_LENGTH } from '#shared/schemas'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'edit'
  goal?: { id: string, title: string, essayTitle: string | null } | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [goal: Goal]
}>()

const toast = useToast()
const title = ref('')
const essayTitle = ref('')
const error = ref('')
const saving = ref(false)

watch(() => props.open, (open) => {
  if (!open) return
  title.value = props.mode === 'edit' ? props.goal?.title ?? '' : ''
  essayTitle.value = props.mode === 'edit' ? props.goal?.essayTitle ?? '' : ''
  error.value = ''
})

const normalizedTitle = computed(() => title.value.trim())
const normalizedEssayTitle = computed(() => essayTitle.value.trim())
const heading = computed(() => props.mode === 'create' ? '新增目标' : '编辑目标')
const submitLabel = computed(() => props.mode === 'create' ? '创建目标' : '保存修改')

async function submit() {
  if (saving.value) return

  if (!normalizedTitle.value) {
    error.value = '请输入目标名称'
    return
  }
  if (normalizedTitle.value.length > GOAL_TITLE_MAX_LENGTH) {
    error.value = `目标名称不能超过 ${GOAL_TITLE_MAX_LENGTH} 个字符`
    return
  }
  if (normalizedEssayTitle.value.length > ESSAY_TITLE_MAX_LENGTH) {
    error.value = `Essay 题目不能超过 ${ESSAY_TITLE_MAX_LENGTH} 个字符`
    return
  }

  saving.value = true
  error.value = ''

  try {
    const body = {
      title: normalizedTitle.value,
      essayTitle: normalizedEssayTitle.value || null,
    }

    const saved = props.mode === 'create'
      ? await $fetch<{ goal: Goal }>('/api/goals', { method: 'POST', body })
      : props.goal
        ? await $fetch<{ goal: Goal }>(`/api/goals/${props.goal.id}`, { method: 'PATCH', body })
        : null

    if (!saved) return

    emit('update:open', false)
    emit('saved', saved.goal)
    toast.add({
      title: props.mode === 'create' ? '目标已创建' : '目标已保存',
      color: 'neutral',
    })
  } catch (caught) {
    error.value = getApiErrorMessage(caught)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="heading"
    :dismissible="!saving"
    :transition="false"
    :ui="{ content: 'modal-panel bg-sheet', header: 'border-b border-rule', footer: 'border-t border-rule' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form id="goal-form" class="flex flex-col gap-5" novalidate @submit.prevent="submit">
        <div>
          <div class="flex items-center justify-between gap-3">
            <label for="goal-title" class="text-sm font-medium text-ink">
              目标名称
            </label>
            <span class="text-xs tabular-nums text-ink-faint">
              {{ title.length }}/{{ GOAL_TITLE_MAX_LENGTH }}
            </span>
          </div>
          <UInput
            id="goal-title"
            v-model="title"
            class="mt-2 w-full"
            :maxlength="GOAL_TITLE_MAX_LENGTH"
            placeholder="例如：每天散步二十分钟"
            autofocus
            autocomplete="off"
            :disabled="saving"
          />
        </div>

        <div>
          <div class="flex items-center justify-between gap-3">
            <label for="essay-title" class="text-sm font-medium text-ink">
              Essay 题目
              <span class="font-normal text-ink-faint">选填</span>
            </label>
            <span class="text-xs tabular-nums text-ink-faint">
              {{ essayTitle.length }}/{{ ESSAY_TITLE_MAX_LENGTH }}
            </span>
          </div>
          <p class="mt-1 text-xs leading-5 text-ink-soft">
            留空时，这本书就叫“随笔”。
          </p>
          <UInput
            id="essay-title"
            v-model="essayTitle"
            class="mt-2 w-full"
            :maxlength="ESSAY_TITLE_MAX_LENGTH"
            placeholder="例如：论散步"
            autocomplete="off"
            :disabled="saving"
          />
        </div>

        <p v-if="error" class="text-sm text-miss" role="alert">
          {{ error }}
        </p>
      </form>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          :disabled="saving"
          @click="emit('update:open', false)"
        />
        <UButton
          type="submit"
          form="goal-form"
          :label="submitLabel"
          :loading="saving"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
