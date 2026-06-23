<script setup lang="ts">
import { useNotificationStore } from '../stores/notifications'
import { 
  CheckCircle, 
  XCircle, 
  Info, 
  AlertTriangle,
  X
} from 'lucide-vue-next'

const store = useNotificationStore()

const getIcon = (type: string) => {
  if (type === 'success') return CheckCircle
  if (type === 'error') return XCircle
  if (type === 'warning') return AlertTriangle
  return Info
}

const getStyles = (type: string) => {
  if (type === 'success') return 'bg-green-50 border-green-100 text-green-800'
  if (type === 'error') return 'bg-red-50 border-red-100 text-red-800'
  if (type === 'warning') return 'bg-amber-50 border-amber-100 text-amber-800'
  return 'bg-blue-50 border-blue-100 text-blue-800'
}
</script>

<template>
  <div class="fixed top-6 right-6 z-[200] flex flex-col gap-3 w-80">
    <TransitionGroup 
      enter-active-class="transform transition ease-out duration-300"
      enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-4"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-100"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-for="notification in store.notifications" 
        :key="notification.id"
        :class="[getStyles(notification.type), 'p-4 rounded-2xl border shadow-lg flex items-start gap-3 backdrop-blur-sm bg-opacity-90']"
      >
        <component :is="getIcon(notification.type)" class="flex-shrink-0 mt-0.5" :size="20" />
        <div class="flex-1 text-sm font-semibold">
          {{ notification.message }}
        </div>
        <button @click="store.removeNotification(notification.id)" class="text-gray-400 hover:text-gray-600">
          <X :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
