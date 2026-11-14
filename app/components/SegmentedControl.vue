<script setup lang="ts">
withDefaults(defineProps<{
  options: Array<{ value: string, label: string, count?: number }>
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
}>(), {
  disabled: false,
  size: 'md',
})

const model = defineModel<string>({ required: true })
</script>

<template>
  <div
    class="inline-flex items-center gap-0.5 rounded-md border border-rule bg-paper/50 p-0.5"
    role="group"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="rounded-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      :class="[
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs',
        model === option.value ? 'bg-sheet text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
      ]"
      :aria-pressed="model === option.value"
      :disabled="disabled"
      @click="model = option.value"
    >
      {{ option.label }}
      <span v-if="option.count" class="ml-0.5 tabular-nums text-ink-faint">{{ option.count }}</span>
    </button>
  </div>
</template>
