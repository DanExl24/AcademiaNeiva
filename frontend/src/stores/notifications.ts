import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Notification {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([])
  let nextId = 0

  function addNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    const id = nextId++
    notifications.value.push({ id, message, type })
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeNotification(id)
    }, 5000)
  }

  function removeNotification(id: number) {
    notifications.value = notifications.value.filter(n => n.id !== id)
  }

  return {
    notifications,
    addNotification,
    removeNotification
  }
})
