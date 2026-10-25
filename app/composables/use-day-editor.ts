import type { DailyEntryWithLinks, EntryStatus, EssayEntry } from '#shared/types'

interface DayEditorOptions {
  goalId: () => string
  date: () => string
  entry: () => DailyEntryWithLinks | null
  changed: () => void
}

interface EditorSnapshot {
  status: EntryStatus | null
  reflection: string
  linkedEntryIds: string[]
}

function snapshotOf(entry: DailyEntryWithLinks | null): EditorSnapshot {
  return {
    status: entry?.status ?? null,
    reflection: entry?.reflection ?? '',
    linkedEntryIds: [...(entry?.linkedEntryIds ?? [])],
  }
}

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  const ids = new Set(left)
  return right.every(id => ids.has(id))
}

export function useDayEditor(options: DayEditorOptions) {
  const toast = useToast()
  const status = ref<EntryStatus | null>(null)
  const reflection = ref('')
  const linkedEntryIds = ref<string[]>([])
  const snapshot = ref<EditorSnapshot | null>(null)
  const error = ref('')
  const saving = ref(false)
  const clearing = ref(false)
  const candidates = ref<EssayEntry[]>([])
  const candidatesPending = ref(false)
  const candidatesError = ref('')

  const busy = computed(() => saving.value || clearing.value)
  const dirty = computed(() => {
    if (!snapshot.value) return false
    return status.value !== snapshot.value.status
      || reflection.value !== snapshot.value.reflection
      || !sameIds(linkedEntryIds.value, snapshot.value.linkedEntryIds)
  })

  function load(entry: DailyEntryWithLinks | null) {
    const next = snapshotOf(entry)
    status.value = next.status
    reflection.value = next.reflection
    linkedEntryIds.value = [...next.linkedEntryIds]
    snapshot.value = next
  }

  function reset() {
    load(options.entry())
  }

  watch(options.entry, (entry) => {
    if (dirty.value) return
    load(entry)
  }, { immediate: true })

  async function loadCandidates() {
    candidatesPending.value = true
    candidatesError.value = ''

    try {
      const data = await $fetch<{ entries: EssayEntry[] }>(
        `/api/goals/${options.goalId()}/essays`,
      )
      candidates.value = data.entries.filter(
        item => item.entry.entryDate < options.date(),
      )
    } catch (caught) {
      candidates.value = []
      candidatesError.value = getApiErrorMessage(caught)
    } finally {
      candidatesPending.value = false
    }
  }

  async function save(): Promise<boolean> {
    if (!status.value) {
      error.value = '请选择完成或未完成'
      return false
    }

    saving.value = true
    error.value = ''

    try {
      const result = await $fetch<{ entry: DailyEntryWithLinks }>(
        `/api/goals/${options.goalId()}/entries/${options.date()}`,
        {
          method: 'PUT',
          body: {
            status: status.value,
            reflection: reflection.value,
            linkedEntryIds: linkedEntryIds.value,
          },
        },
      )
      load(result.entry)
      toast.add({ title: '已保存', color: 'neutral' })
      options.changed()
      return true
    } catch (caught) {
      error.value = getApiErrorMessage(caught)
      return false
    } finally {
      saving.value = false
    }
  }

  async function restore(entry: DailyEntryWithLinks) {
    try {
      await $fetch(`/api/goals/${options.goalId()}/entries/${entry.entryDate}`, {
        method: 'PUT',
        body: {
          status: entry.status,
          reflection: entry.reflection,
          linkedEntryIds: entry.linkedEntryIds,
        },
      })
      options.changed()
      toast.add({ title: '已恢复记录', color: 'neutral' })
    } catch (caught) {
      toast.add({
        title: getApiErrorMessage(caught),
        color: 'error',
      })
    }
  }

  async function clear(): Promise<boolean> {
    const previous = options.entry()
    if (!previous) return false

    clearing.value = true
    error.value = ''

    try {
      await $fetch(`/api/goals/${options.goalId()}/entries/${options.date()}`, {
        method: 'DELETE',
      })
      load(null)
      toast.add({
        title: '已清除这一天的记录',
        color: 'neutral',
        duration: 8000,
        actions: [{
          label: '撤销',
          onClick: () => {
            void restore(previous)
          },
        }],
      })
      options.changed()
      return true
    } catch (caught) {
      error.value = getApiErrorMessage(caught)
      return false
    } finally {
      clearing.value = false
    }
  }

  function requestClose(): boolean {
    if (busy.value) return false
    if (!dirty.value) return true
    return window.confirm('这一天还有未保存的内容，确定关闭吗？')
  }

  return {
    status,
    reflection,
    linkedEntryIds,
    candidates,
    candidatesPending,
    candidatesError,
    error,
    saving,
    clearing,
    busy,
    dirty,
    reset,
    loadCandidates,
    save,
    clear,
    requestClose,
  }
}
