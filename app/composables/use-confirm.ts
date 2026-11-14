export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
}

interface ConfirmState {
  open: boolean
  options: ConfirmOptions | null
}

let resolver: ((value: boolean) => void) | null = null

export function useConfirm() {
  const state = useState<ConfirmState>('confirm-dialog', () => ({
    open: false,
    options: null,
  }))

  function confirm(options: ConfirmOptions): Promise<boolean> {
    resolver?.(false)

    state.value = { open: true, options }

    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function settle(value: boolean) {
    const pending = resolver
    resolver = null
    state.value = { ...state.value, open: false }
    pending?.(value)
  }

  return { state, confirm, settle }
}
