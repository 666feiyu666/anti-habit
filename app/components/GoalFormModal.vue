<script setup lang="ts">
import { GOAL_TITLE_MAX_LENGTH } from '#shared/schemas'

const props = defineProps<{
  open: boolean
  mode: 'create' | 'rename'
  goal?: { id: string; title: string } | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: []
}>()

const toast = useToast()
const title = ref('')
const error = ref('')
const saving = ref(false)

watch(() => props.open, (open) => {
  if (!open) return
  title.value = props.mode === 'rename' ? props.goal?.title ?? '' : ''
  error.value = ''
})

const normalizedTitle = computed(() => title.value.trim())
const heading = computed(() => props.mode === 'create' ? '新增目标' : '重命名目标')
const submitLabel = computed(() => props.mode === 'create' ? '创建' : '保存')

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

  saving.value = true
  error.value = ''

  try {
    if (props.mode === 'create') {
      await $fetch('/api/goals', {
        method: 'POST',
        body: { title: normalizedTitle.value },
      })
    } else if (props.goal) {
      await $fetch(`/api/goals/${props.goal.id}`, {
        method: 'PATCH',
        body: { title: normalizedTitle.value },
      })
    }

    emit('update:open', false)
    emit('saved')
    toast.add({
      title: props.mode === 'create' ? '已新增目标' : '已重命名',
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
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form id="goal-form" novalidate @submit.prevent="submit">
        <div class="flex items-center justify-between gap-3">
          <label for="goal-title" class="text-sm font-medium text-neutral-800">
            目标名称
          </label>
          <span class="text-xs tabular-nums text-neutral-500">
            {{ title.length }}/{{ GOAL_TITLE_MAX_LENGTH }}
          </span>
        </div>
        <UInput
          id="goal-title"
          v-model="title"
          class="mt-2 w-full"
          :maxlength="GOAL_TITLE_MAX_LENGTH"
          placeholder="例如：No Pornography"
          autofocus
          autocomplete="off"
          :disabled="saving"
        />
        <p v-if="error" class="mt-2 text-sm text-red-600" role="alert">
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
