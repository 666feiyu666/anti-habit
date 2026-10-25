<script setup lang="ts">
import type { GoalSummary } from '#shared/types'

const props = defineProps<{
  open: boolean
  goal: GoalSummary | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  deleted: []
}>()

const toast = useToast()
const deleting = ref(false)
const error = ref('')

watch(() => props.open, (open) => {
  if (open) error.value = ''
})

async function confirmDelete() {
  if (!props.goal) return

  deleting.value = true
  error.value = ''

  try {
    await $fetch(`/api/goals/${props.goal.id}`, { method: 'DELETE' })
    emit('update:open', false)
    emit('deleted')
    toast.add({
      title: `已删除「${props.goal.title}」`,
      color: 'neutral',
    })
  } catch (caught) {
    error.value = getApiErrorMessage(caught)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    title="删除目标"
    :dismissible="!deleting"
    :transition="false"
    :ui="{ content: 'bg-sheet', header: 'border-b border-rule', footer: 'border-t border-rule' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <p class="text-sm leading-6 text-ink-soft">
        确定要删除「<span class="font-medium text-ink">{{ goal?.title }}</span>」吗？它会从当前目标列表中移除。
      </p>
      <p class="mt-2 text-sm leading-6 text-ink-soft">
        记录会留着，但暂时不能恢复。
      </p>
      <p v-if="error" class="mt-3 text-sm text-miss" role="alert">
        {{ error }}
      </p>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="取消"
          color="neutral"
          variant="ghost"
          :disabled="deleting"
          @click="emit('update:open', false)"
        />
        <UButton
          label="删除目标"
          color="error"
          :loading="deleting"
          @click="confirmDelete"
        />
      </div>
    </template>
  </UModal>
</template>
