<script setup lang="ts">
import type { EssayEntry, GoalMaterial, GoalMaterialSummary, GoalSummary } from '#shared/types'
import {
  MATERIAL_CONTENT_MAX_LENGTH,
  MATERIAL_TITLE_MAX_LENGTH,
  materialTitleFromSourceName,
} from '#shared/schemas'
import { serializeEssayMarkdown } from '#shared/utils/markdown-essay'
import { formatDayLabel, formatFullDayLabel } from '~/utils/date-display'
import { renderMarkdown } from '~/utils/markdown'

const props = defineProps<{
  open: boolean
  goal: GoalSummary | null
  entries: EssayEntry[]
  pending: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  selectDate: [date: string]
}>()

const toast = useToast()
const view = ref<'essay' | 'materials'>('essay')

const fileInput = ref<HTMLInputElement | null>(null)
const materials = ref<GoalMaterialSummary[]>([])
const materialsPending = ref(false)
const materialsError = ref('')
const importing = ref(false)

const activeMaterial = ref<GoalMaterial | null>(null)
const materialPending = ref(false)
const materialError = ref('')
const materialEditing = ref(false)
const materialSaving = ref(false)
const materialDeleting = ref(false)
const draftTitle = ref('')
const draftContent = ref('')

const essayTitle = computed(() => props.goal?.essayTitle || '随笔')
const goalId = computed(() => props.goal?.id ?? null)

const materialDirty = computed(() => {
  const material = activeMaterial.value
  if (!material || !materialEditing.value) return false
  return draftTitle.value !== material.title || draftContent.value !== material.content
})

const statusLabel = {
  completed: '完成',
  missed: '未完成',
} as const

const statusDot = {
  completed: 'bg-done',
  missed: 'bg-mist ring-1 ring-inset ring-[#b7cfb6]',
} as const

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
const numberFormatter = new Intl.NumberFormat('zh-CN')

function formatTimestamp(seconds: number): string {
  return dateFormatter.format(new Date(seconds * 1000))
}

function formatCount(count: number): string {
  return `${numberFormatter.format(count)} 字`
}

async function loadMaterials() {
  const id = goalId.value
  if (!id) return

  materialsPending.value = true
  materialsError.value = ''

  try {
    const result = await $fetch<{ materials: GoalMaterialSummary[] }>(
      `/api/goals/${id}/materials`,
    )
    if (id !== goalId.value) return
    materials.value = result.materials
  } catch (caught) {
    materialsError.value = getApiErrorMessage(caught)
  } finally {
    if (id === goalId.value) materialsPending.value = false
  }
}

function resetMaterialView() {
  view.value = 'essay'
  activeMaterial.value = null
  materialEditing.value = false
  materialError.value = ''
  materialsError.value = ''
}

watch(
  () => [props.open, goalId.value] as const,
  ([open]) => {
    if (!open) return
    resetMaterialView()
    void loadMaterials()
  },
  { immediate: true },
)

function setView(next: 'essay' | 'materials') {
  if (next === view.value) return
  if (next === 'essay' && materialDirty.value && !window.confirm('材料还有未保存的修改，确定离开吗？')) {
    return
  }
  if (next === 'essay') {
    activeMaterial.value = null
    materialEditing.value = false
    materialError.value = ''
  }
  view.value = next
}

function pickFile() {
  fileInput.value?.click()
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  const id = goalId.value
  if (!file || !id) return

  materialsError.value = ''
  if (file.size > 2_000_000) {
    materialsError.value = '文件超过 2 MB，暂时不能导入。'
    return
  }

  importing.value = true

  try {
    const content = (await file.text()).replace(/^\uFEFF/, '')
    const result = await $fetch<{ material: GoalMaterial }>(
      `/api/goals/${id}/materials`,
      {
        method: 'POST',
        body: {
          title: materialTitleFromSourceName(file.name),
          content,
          sourceName: file.name,
        },
      },
    )
    toast.add({ title: '材料已导入', color: 'neutral' })
    view.value = 'materials'
    activeMaterial.value = result.material
    materialEditing.value = false
    await loadMaterials()
  } catch (caught) {
    materialsError.value = getApiErrorMessage(caught)
  } finally {
    importing.value = false
  }
}

async function openMaterial(material: GoalMaterialSummary) {
  const id = goalId.value
  if (!id) return

  materialPending.value = true
  materialError.value = ''
  materialsError.value = ''
  materialEditing.value = false

  try {
    const result = await $fetch<{ material: GoalMaterial }>(
      `/api/goals/${id}/materials/${material.id}`,
    )
    activeMaterial.value = result.material
  } catch (caught) {
    materialsError.value = getApiErrorMessage(caught)
  } finally {
    materialPending.value = false
  }
}

function backToMaterials() {
  if (materialDirty.value && !window.confirm('材料还有未保存的修改，确定返回吗？')) return
  activeMaterial.value = null
  materialEditing.value = false
  materialError.value = ''
}

function startEditing() {
  if (!activeMaterial.value) return
  draftTitle.value = activeMaterial.value.title
  draftContent.value = activeMaterial.value.content
  materialEditing.value = true
  materialError.value = ''
}

function cancelEditing() {
  if (materialDirty.value && !window.confirm('放弃这些修改吗？')) return
  materialEditing.value = false
  materialError.value = ''
}

async function saveMaterial() {
  const material = activeMaterial.value
  const id = goalId.value
  if (!material || !id) return

  if (!draftTitle.value.trim()) {
    materialError.value = '材料标题不能为空'
    return
  }
  if (!draftContent.value.trim()) {
    materialError.value = '材料正文不能为空'
    return
  }

  materialSaving.value = true
  materialError.value = ''

  try {
    const result = await $fetch<{ material: GoalMaterial }>(
      `/api/goals/${id}/materials/${material.id}`,
      {
        method: 'PUT',
        body: {
          title: draftTitle.value,
          content: draftContent.value,
        },
      },
    )
    activeMaterial.value = result.material
    materialEditing.value = false
    toast.add({ title: '材料已保存', color: 'neutral' })
    await loadMaterials()
  } catch (caught) {
    materialError.value = getApiErrorMessage(caught)
  } finally {
    materialSaving.value = false
  }
}

async function deleteMaterial(material: GoalMaterialSummary | GoalMaterial) {
  const id = goalId.value
  if (!id) return
  if (!window.confirm(`删除材料《${material.title}》？`)) return

  materialDeleting.value = true
  materialError.value = ''
  materialsError.value = ''

  try {
    await $fetch(`/api/goals/${id}/materials/${material.id}`, { method: 'DELETE' })
    toast.add({ title: '材料已删除', color: 'neutral' })
    activeMaterial.value = null
    materialEditing.value = false
    await loadMaterials()
  } catch (caught) {
    materialsError.value = getApiErrorMessage(caught)
  } finally {
    materialDeleting.value = false
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

function handleOpenChange(value: boolean) {
  if (!value && materialDirty.value && !window.confirm('材料还有未保存的修改，确定关闭吗？')) {
    return
  }
  emit('update:open', value)
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
    @update:open="handleOpenChange"
  >
    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div
          class="flex items-center gap-0.5 rounded-md border border-rule p-0.5"
          role="tablist"
          aria-label="阅读视图"
        >
          <button
            type="button"
            role="tab"
            class="rounded-sm px-3 py-1.5 text-xs transition-colors motion-reduce:transition-none"
            :class="view === 'essay' ? 'bg-paper text-ink' : 'text-ink-faint hover:text-ink'"
            :aria-selected="view === 'essay'"
            @click="setView('essay')"
          >
            随笔
          </button>
          <button
            type="button"
            role="tab"
            class="rounded-sm px-3 py-1.5 text-xs transition-colors motion-reduce:transition-none"
            :class="view === 'materials' ? 'bg-paper text-ink' : 'text-ink-faint hover:text-ink'"
            :aria-selected="view === 'materials'"
            @click="setView('materials')"
          >
            材料
            <span v-if="materials.length" class="text-ink-faint">{{ materials.length }}</span>
          </button>
        </div>

        <div v-if="view === 'essay'" class="flex items-center gap-2">
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

        <div v-else class="flex items-center gap-2">
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
            :loading="importing"
            :disabled="!goal || importing"
            @click="pickFile"
          />
        </div>
      </div>

      <template v-if="view === 'essay'">
        <p class="mt-3 text-xs leading-5 text-ink-faint">
          点日期或回应链接，可以回到那一天。
        </p>

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

      <template v-else>
        <p class="mt-3 text-xs leading-5 text-ink-faint">
          导入的 Markdown 保存在这个议题下，作为写作材料，不会改动每日记录。
        </p>

        <UAlert
          v-if="materialsError"
          color="error"
          variant="soft"
          title="材料操作失败"
          :description="materialsError"
          class="mt-4"
        />

        <div v-if="activeMaterial" class="mt-5">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-3">
            <UButton
              label="返回材料"
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="backToMaterials"
            />
            <div v-if="!materialEditing" class="flex items-center gap-1">
              <UButton
                label="编辑"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="startEditing"
              />
              <UButton
                label="删除"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                :loading="materialDeleting"
                @click="deleteMaterial(activeMaterial)"
              />
            </div>
          </div>

          <div v-if="materialEditing" class="mt-4">
            <label for="material-title" class="text-sm font-medium text-ink">材料标题</label>
            <input
              id="material-title"
              v-model="draftTitle"
              type="text"
              :maxlength="MATERIAL_TITLE_MAX_LENGTH"
              :disabled="materialSaving"
              class="mt-2 w-full rounded-md border border-rule bg-sheet px-3 py-2 font-serif text-lg text-ink focus:border-done focus:outline-none focus:ring-2 focus:ring-done/15 disabled:opacity-60"
            >

            <div class="mt-4 flex items-baseline justify-between gap-3">
              <label for="material-content" class="text-sm font-medium text-ink">正文</label>
              <span class="text-xs tabular-nums text-ink-faint">
                {{ draftContent.length }}/{{ MATERIAL_CONTENT_MAX_LENGTH }}
              </span>
            </div>
            <textarea
              id="material-content"
              v-model="draftContent"
              :maxlength="MATERIAL_CONTENT_MAX_LENGTH"
              :disabled="materialSaving"
              rows="18"
              class="mt-2 min-h-96 w-full resize-y rounded-md border border-rule bg-sheet px-3 py-2.5 font-mono text-sm leading-6 text-ink focus:border-done focus:outline-none focus:ring-2 focus:ring-done/15 disabled:opacity-60"
            />

            <div class="mt-3 flex items-center justify-between gap-3">
              <span class="text-xs text-ink-faint">
                {{ materialDirty ? '有未保存的修改' : '没有修改' }}
              </span>
              <div class="flex gap-2">
                <UButton
                  label="取消"
                  color="neutral"
                  variant="ghost"
                  :disabled="materialSaving"
                  @click="cancelEditing"
                />
                <UButton
                  label="保存"
                  :loading="materialSaving"
                  :disabled="!materialDirty"
                  @click="saveMaterial"
                />
              </div>
            </div>

            <UAlert
              v-if="materialError"
              color="error"
              variant="soft"
              title="没能保存材料"
              :description="materialError"
              class="mt-4"
            />
          </div>

          <div v-else class="mt-5">
            <h3 class="font-serif text-2xl leading-8 text-ink">
              {{ activeMaterial.title }}
            </h3>
            <p class="mt-1 text-xs text-ink-faint">
              {{ activeMaterial.sourceName || '未记录文件名' }}
              · {{ formatCount(activeMaterial.content.length) }}
              · 更新于 {{ formatTimestamp(activeMaterial.updatedAt) }}
            </p>
            <div
              class="essay-markdown mt-5"
              v-html="renderMarkdown(activeMaterial.content)"
            />
          </div>
        </div>

        <div v-else-if="materialPending" class="mt-6" aria-busy="true" aria-label="正在读取材料">
          <div class="h-6 w-48 animate-pulse rounded-sm bg-rule/50 motion-reduce:animate-none" />
          <div class="mt-4 h-3 w-full animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
          <div class="mt-2 h-3 w-5/6 animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
        </div>

        <div v-else-if="materialsPending" class="mt-6" aria-busy="true" aria-label="正在读取材料列表">
          <div v-for="index in 3" :key="index" class="border-t border-rule py-4 first:border-t-0">
            <div class="h-5 w-52 animate-pulse rounded-sm bg-rule/50 motion-reduce:animate-none" />
            <div class="mt-2 h-3 w-32 animate-pulse rounded-sm bg-rule/40 motion-reduce:animate-none" />
          </div>
        </div>

        <div v-else-if="!materials.length" class="py-16">
          <p class="font-serif text-xl text-ink">
            还没有材料
          </p>
          <p class="mt-2 text-sm leading-6 text-ink-soft">
            导入一份 Markdown，作为这篇随笔的写作材料。
          </p>
        </div>

        <ul v-else class="mt-2">
          <li
            v-for="material in materials"
            :key="material.id"
            class="border-t border-rule py-4 first:border-t-0"
          >
            <div class="flex items-start justify-between gap-3">
              <button
                type="button"
                class="min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-done"
                @click="openMaterial(material)"
              >
                <span class="block truncate font-serif text-lg text-ink hover:text-done hover:underline hover:underline-offset-4">
                  {{ material.title }}
                </span>
                <span class="mt-1 block truncate text-xs text-ink-faint">
                  {{ material.sourceName || '未记录文件名' }}
                  · {{ formatCount(material.characterCount) }}
                  · 导入于 {{ formatTimestamp(material.createdAt) }}
                </span>
              </button>
              <UButton
                label="删除"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                :disabled="importing"
                @click="deleteMaterial(material)"
              />
            </div>
          </li>
        </ul>
      </template>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton
          label="关闭"
          color="neutral"
          variant="ghost"
          @click="handleOpenChange(false)"
        />
      </div>
    </template>
  </UModal>
</template>
