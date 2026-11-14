<script setup lang="ts">
const { state, settle } = useConfirm()

function handleOpenChange(value: boolean) {
  if (!value) settle(false)
}
</script>

<template>
  <AppModal
    :open="state.open"
    :title="state.options?.title ?? '请确认'"
    :description="state.options?.description"
    size="md"
    elevated
    @update:open="handleOpenChange"
  >
    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton
          :label="state.options?.cancelLabel ?? '取消'"
          color="neutral"
          variant="ghost"
          @click="settle(false)"
        />
        <UButton
          :label="state.options?.confirmLabel ?? '确定'"
          :color="state.options?.tone === 'danger' ? 'error' : 'primary'"
          @click="settle(true)"
        />
      </div>
    </template>
  </AppModal>
</template>
