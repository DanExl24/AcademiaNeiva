import { useNotificationStore } from '../stores/notifications'

export function useToast() {
  const store = useNotificationStore()
  return {
    success: (msg: string) => store.addNotification(msg, 'success'),
    error: (msg: string) => store.addNotification(msg, 'error'),
    warning: (msg: string) => store.addNotification(msg, 'warning'),
    info: (msg: string) => store.addNotification(msg, 'info'),
    showToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => store.addNotification(msg, type)
  }
}
