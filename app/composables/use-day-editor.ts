import type { DailyEntry, EntryStatus } from '#shared/types'

interface DayEditorOptions {
  goalId: () => string
  date: () => string
  entry: () => DailyEntry | null
  changed: () => void
}

export function useDayEditor(options: DayEditorOptions) {
  const toast = useToast()
  const status = ref<EntryStatus | null>(null)
  const reflection = ref('')
  const error = ref('')
  const saving = ref(false)
  const clearing = ref(false)

  const busy = computed(() => saving.value || clearing.value)

  function reset() {
    status.value = options.entry()?.status ?? null
    reflection.value = options.entry()?.reflection ?? ''
    error.value = ''
  }

  watch([options.date, options.entry], reset, { immediate: true })

  async function save(): Promise<boolean> {
    if (!status.value) {
      error.value = '请选择完成或未完成'
      return false
    }

    saving.value = true
    error.value = ''

    try {
      await $fetch(`/api/goals/${options.goalId()}/entries/${options.date()}`, {
        method: 'PUT',
        body: {
          status: status.value,
          reflection: reflection.value,
        },
      })
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

  async function restore(entry: DailyEntry) {
    try {
      await $fetch(`/api/goals/${options.goalId()}/entries/${entry.entryDate}`, {
        method: 'PUT',
        body: {
          status: entry.status,
          reflection: entry.reflection,
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

  return {
    status,
    reflection,
    error,
    saving,
    clearing,
    busy,
    reset,
    save,
    clear,
  }
}
