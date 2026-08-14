import { ref } from 'vue'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info' | 'success'
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean
  resolve: (value: boolean) => void
}

const state = ref<ConfirmState>({
  isOpen: false,
  title: 'Confirmar Acción',
  message: '',
  confirmText: 'Confirmar',
  cancelText: 'Cancelar',
  type: 'danger',
  resolve: () => {}
})

export function useConfirm() {
  const confirm = (options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options
      state.value = {
        isOpen: true,
        title: opts.title || (opts.type === 'danger' ? '¿Estás seguro?' : 'Confirmación'),
        message: opts.message,
        confirmText: opts.confirmText || (opts.type === 'danger' ? 'Sí, continuar' : 'Aceptar'),
        cancelText: opts.cancelText || 'Cancelar',
        type: opts.type || 'danger',
        resolve
      }
    })
  }

  const handleConfirm = () => {
    state.value.isOpen = false
    state.value.resolve(true)
  }

  const handleCancel = () => {
    state.value.isOpen = false
    state.value.resolve(false)
  }

  return {
    confirmState: state,
    confirm,
    handleConfirm,
    handleCancel
  }
}
