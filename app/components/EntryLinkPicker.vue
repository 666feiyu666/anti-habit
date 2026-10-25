<script setup lang="ts">
import type { EssayEntry } from '#shared/types'
import { formatDayLabel } from '~/utils/date-display'

const props = defineProps<{
  candidates: EssayEntry[]
  pending: boolean
  error: string
  busy: boolean
}>()

const selected = defineModel<string[]>('selected', { required: true })

const visibleSelectedCount = computed(() => {
  const candidateIds = new Set(props.candidates.map(item => item.entry.id))
  return selected.value.filter(id => candidateIds.has(id)).length
})

const hiddenSelectedCount = computed(() => selected.value.length - visibleSelectedCount.value)

function toggle(entryId: string, checked: boolean) {
  if (checked) {
    if (!selected.value.includes(entryId)) {
      selected.value = [...selected.value, entryId]
    }
    return
  }

  selected.value = selected.value.filter(id => id !== entryId)
}
</script>

<template>
  <section aria-labelledby="link-picker-heading">
    <div class="flex items-baseline justify-between gap-3">
      <h3 id="link-picker-heading" class="text-sm font-medium text-ink">
        回应以前的一天
      </h3>
      <span class="text-xs text-ink-faint">
        {{ visibleSelectedCount ? `已选 ${visibleSelectedCount} 天` : '选填' }}
      </span>
    </div>
    <p class="mt-1 text-xs leading-5 text-ink-soft">
      选中以前写下的日子，这一天会接在它们后面。
    </p>
    <p v-if="hiddenSelectedCount" class="mt-1 text-xs leading-5 text-ink-faint">
      有 {{ hiddenSelectedCount }} 个关联的日期暂时看不到，保存时会保留。
    </p>

    <p v-if="error" class="mt-2 text-xs leading-5 text-miss" role="alert">
      {{ error }}
    </p>
    <p v-else-if="pending" class="mt-2 text-xs leading-5 text-ink-faint">
      正在读取以前的记录…
    </p>
    <p v-else-if="!candidates.length" class="mt-2 text-xs leading-5 text-ink-faint">
      还没有更早的正文。先写下这一次，之后可以回来回应它。
    </p>

    <ul v-else class="mt-2 max-h-64 divide-y divide-rule overflow-y-auto border-y border-rule">
      <li v-for="item in candidates" :key="item.entry.id">
        <label class="flex cursor-pointer gap-3 py-3">
          <input
            type="checkbox"
            class="mt-1 size-4 shrink-0 accent-done"
            :checked="selected.includes(item.entry.id)"
            :disabled="busy"
            @change="toggle(item.entry.id, ($event.target as HTMLInputElement).checked)"
          >
          <span class="min-w-0">
            <span class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span class="text-sm text-ink">{{ formatDayLabel(item.entry.entryDate) }}</span>
              <span class="flex items-center gap-1.5 text-xs text-ink-soft">
                <span
                  class="size-2 rounded-[2px]"
                  :class="item.entry.status === 'completed' ? 'bg-done' : 'bg-miss'"
                  aria-hidden="true"
                />
                {{ item.entry.status === 'completed' ? '完成' : '未完成' }}
              </span>
            </span>
            <span class="mt-1 line-clamp-2 block font-serif text-sm leading-6 text-ink-soft">
              {{ item.entry.reflection }}
            </span>
          </span>
        </label>
      </li>
    </ul>
  </section>
</template>
