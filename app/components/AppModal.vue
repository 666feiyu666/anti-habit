<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  size?: 'md' | 'lg' | 'xl'
  dismissible?: boolean
  elevated?: boolean
}>(), {
  title: undefined,
  description: undefined,
  size: 'md',
  dismissible: true,
  elevated: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const sizeClass = computed(() => ({
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-3xl',
}[props.size]))

const layerClass = computed(() => props.elevated ? 'z-[70]' : 'z-50')

const ui = computed(() => ({
  overlay: `${layerClass.value} bg-ink/25 backdrop-blur-[1px]`,
  content: `modal-panel flex flex-col divide-y divide-rule rounded-md bg-sheet shadow-[0_24px_60px_-32px_rgba(30,36,31,0.45)] ring-rule ${layerClass.value} focus:outline-none ${sizeClass.value}`,
  wrapper: 'min-w-0 flex-1',
  header: 'flex items-start gap-1.5 border-b border-rule px-5 pb-4 pt-5 sm:px-6',
  title: 'font-serif text-2xl leading-tight tracking-tight text-ink',
  description: 'mt-1.5 text-sm leading-6 text-ink-soft',
  body: 'flex-1 px-5 py-5 sm:px-6',
  footer: 'flex items-center gap-1.5 border-t border-rule px-5 py-4 sm:px-6',
  close: 'absolute end-4 top-4 text-ink-faint hover:text-ink',
}))
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="description"
    :dismissible="dismissible"
    :transition="false"
    scrollable
    :ui="ui"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <slot />
    </template>

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UModal>
</template>
