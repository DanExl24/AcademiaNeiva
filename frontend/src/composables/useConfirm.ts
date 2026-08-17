import { ref } from 'vue'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info' | 'primary'
}

const isVisible = ref(false)
const options = ref<ConfirmOptions>({
  title: '¿Confirmar acción?',
  message: '',
  confirmText: 'Aceptar',
  cancelText: 'Cancelar',
  type: 'danger'
})
let resolvePromise: ((value: boolean) => void) | null = null

export function useConfirm() {
  const confirm = (opts: ConfirmOptions | string): Promise<boolean> => {
    if (typeof opts === 'string') {
      options.value = {
        title: '¿Confirmar acción?',
        message: opts,
        confirmText: 'Aceptar',
        cancelText: 'Cancelar',
        type: 'danger'
      }
    } else {
      options.value = {
        title: opts.title || '¿Confirmar acción?',
        message: opts.message,
        confirmText: opts.confirmText || 'Aceptar',
        cancelText: opts.cancelText || 'Cancelar',
        type: opts.type || 'danger'
      }
    }

    isVisible.value = true

    return new Promise<boolean>((resolve) => {
      resolvePromise = resolve
    })
  }

  const handleConfirm = () => {
    isVisible.value = false
    if (resolvePromise) resolvePromise(true)
  }

  const handleCancel = () => {
    isVisible.value = false
    if (resolvePromise) resolvePromise(false)
  }

  return {
    isVisible,
    options,
    confirm,
    handleConfirm,
    handleCancel
  }
}
