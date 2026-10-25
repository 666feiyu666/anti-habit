<script setup lang="ts">
import type { EssayEntry, GoalSummary, ImportedEssayEntry } from '#shared/types'
import { parseEssayMarkdown, serializeEssayMarkdown } from '#shared/utils/markdown-essay'
import { formatDayLabel, formatFullDayLabel } from '~/utils/date-display'
import { renderMarkdown } from '~/utils/markdown'

const props = defineProps<{
  open: boolean
  goal: GoalSummary | null
  entries: EssayEntry[]
  pending: boolean
  error: string
  fallbackDate: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  selectDate: [date: string]
  imported: []
}>()

const toast = useToast()
const fileInput = ref<HTMLInputElement | null>(null)
const pendingImport = ref<ImportedEssayEntry[] | null>(null)
const importMode = ref<'dated' | 'single'>('dated')
const importFileName = ref('')
const importError = ref('')
const importing = ref(false)

const essayTitle = computed(() => props.goal?.essayTitle || '随笔')

const importDateSummary = computed(() => {
  const entries = pendingImport.value
  if (!entries) return ''
  const labels = entries.map(entry => formatDayLabel(entry.entryDate))
  if (labels.length <= 6) return labels.join('、')
  return `${labels.slice(0, 6).join('、')} 等 ${labels.length} 天`
})

const statusLabel = {
  completed: '完成',
  missed: '未完成',
} as const

const statusDot = {
  completed: 'bg-done',
  missed: 'bg-mist ring-1 ring-inset ring-[#b7cfb6]',
} as const

function pickFile() {
  fileInput.value?.click()
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  pendingImport.value = null
  importError.value = ''
  importFileName.value = file?.name ?? ''
  if (!file) return

  if (file.size > 2_000_000) {
    importError.value = '文件超过 2 MB，暂时不能导入。'
    return
  }

  try {
    const parsed = parseEssayMarkdown(await file.text(), props.fallbackDate)
    pendingImport.value = parsed.entries
    importMode.value = parsed.mode
  } catch (caught) {
    importError.value = caught instanceof Error ? caught.message : '没能读取这个文件。'
  }
}

function cancelImport() {
  pendingImport.value = null
  importFileName.value = ''
  importError.value = ''
}

async function confirmImport() {
  if (!props.goal || !pendingImport.value) return

  importing.value = true
  importError.value = ''

  try {
    const result = await $fetch<{ imported: number }>(
      `/api/goals/${props.goal.id}/essays/import`,
      {
        method: 'POST',
        body: { entries: pendingImport.value },
      },
    )
    toast.add({
      title: `已导入 ${result.imported} 天`,
      color: 'neutral',
    })
    pendingImport.value = null
    importFileName.value = ''
    emit('imported')
  } catch (caught) {
    importError.value = getApiErrorMessage(caught)
  } finally {
    importing.value = false
  }
}

function exportMarkdown() {
  if (!props.goal || !props.entries.length) return

  const markdown = serializeEssayMarkdown({
    essayTitle: props.goal.essayTitle,
    goalTitle: props.goal.title,
    entries: props.entries,
  })
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const filename = (props.goal.essayTitle || props.goal.title || '随笔')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim() || '随笔'

  link.href = url
  link.download = `${filename}.md`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <UModal
    :open="open"
    :title="essayTitle"
    :description="goal?.title"
    :transition="false"
    scrollable
    :ui="{
      content: 'bg-sheet sm:max-w-3xl',
      header: 'border-b border-rule',
      title: 'font-serif text-2xl text-ink',
      description: 'text-sm text-ink-soft',
      body: 'py-5',
      footer: 'border-t border-rule',
    }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs leading-5 text-ink-faint">
          点日期或回应链接，可以回到那一天。
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <input
            ref="fileInput"
            type="file"
            accept=".md,.markdown,text/markdown"
            class="sr-only"
            :disabled="!goal || importing"
            @change="handleFile"
          >
          <UButton
            label="导入 Markdown"
            icon="i-lucide-upload"
            size="sm"
            color="neutral"
            variant="outline"
            :disabled="!goal || importing"
            @click="pickFile"
          />
          <UButton
            label="导出 Markdown"
            icon="i-lucide-download"
            size="sm"
            color="neutral"
            variant="outline"
            :disabled="!goal || !entries.length"
            @click="exportMarkdown"
          />
        </div>
      </div>

      <div v-if="pendingImport" class="mt-4 border border-rule bg-paper/60 p-4">
        <p class="text-sm font-medium text-ink">
          准备导入 {{ pendingImport.length }} 天
          <span v-if="importFileName" class="font-normal text-ink-faint">来自 {{ importFileName }}</span>
        </p>
        <p class="mt-1 text-xs leading-5 text-ink-soft">
          {{ importMode === 'single'
            ? `整篇导入到 ${formatDayLabel(pendingImport[0]!.entryDate)}`
            : importDateSummary }}
        </p>
        <p class="mt-1 text-xs leading-5 text-ink-faint">
          同一天的记录会被覆盖；文件里没有的日期不受影响。
        </p>
        <div class="mt-3 flex justify-end gap-2">
          <UButton
            label="取消"
            color="neutral"
            variant="ghost"
            :disabled="importing"
            @click="cancelImport"
          />
          <UButton
            label="导入"
            :loading="importing"
            @click="confirmImport"
          />
        </div>
      </div>

      <UAlert
        v-if="importError"
        color="error"
        variant="soft"
        title="没能导入 Markdown"
        :description="importError"
        class="mt-4"
      />

      <div v-if="pending" class="mt-6 space-y-6" aria-busy="true" aria-label="正在读取随笔">
        <div v-for="index in 3" :key="index" class="border-t border-rule pt-5">
          <div class="h-5 w-40 animate-pulse rounded-sm bg-rule/50 motion-reduce:animate-none" />
          <div class="mt-3 h-3 w-full animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
          <div class="mt-2 h-3 w-4/5 animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
        </div>
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="soft"
        title="没能读到这本随笔"
        :description="error"
        class="mt-6"
      />

      <div v-else-if="!entries.length" class="py-16">
        <p class="font-serif text-xl text-ink">
          还没有正文
        </p>
        <p class="mt-2 text-sm leading-6 text-ink-soft">
          下一次打卡时，可以从一句话开始。
        </p>
      </div>

      <ol v-else class="mt-2">
        <li
          v-for="item in entries"
          :key="item.entry.id"
          class="border-t border-rule py-7 first:border-t-0 first:pt-4"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <button
              type="button"
              class="font-serif text-xl text-ink hover:text-done hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-done"
              @click="emit('selectDate', item.entry.entryDate)"
            >
              {{ formatFullDayLabel(item.entry.entryDate) }}
            </button>
            <span class="flex items-center gap-2 text-xs text-ink-soft">
              <span
                class="size-2 rounded-[2px]"
                :class="statusDot[item.entry.status]"
                aria-hidden="true"
              />
              {{ statusLabel[item.entry.status] }}
            </span>
          </div>

          <div
            class="essay-markdown mt-3"
            v-html="renderMarkdown(item.entry.reflection ?? '')"
          />

          <div
            v-if="item.outgoing.length"
            class="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-ink-soft"
          >
            <span>回应</span>
            <template v-for="(reference, index) in item.outgoing" :key="reference.entryId">
              <button
                type="button"
                class="text-done hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
                @click="emit('selectDate', reference.entryDate)"
              >
                {{ formatDayLabel(reference.entryDate) }}
              </button>
              <span v-if="index < item.outgoing.length - 1" aria-hidden="true">、</span>
            </template>
          </div>

          <div
            v-if="item.incoming.length"
            class="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs text-ink-soft"
          >
            <span>后来被</span>
            <template v-for="(reference, index) in item.incoming" :key="reference.entryId">
              <button
                type="button"
                class="text-done hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-done"
                @click="emit('selectDate', reference.entryDate)"
              >
                {{ formatDayLabel(reference.entryDate) }}
              </button>
              <span v-if="index < item.incoming.length - 1" aria-hidden="true">、</span>
            </template>
            <span>继续</span>
          </div>
        </li>
      </ol>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton
          label="关闭"
          color="neutral"
          variant="ghost"
          @click="emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>
