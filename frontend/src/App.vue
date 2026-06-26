<script setup lang="ts">
import { onMounted, watch, onUnmounted } from 'vue'
import NotificationToast from './components/NotificationToast.vue'
import { useThemeStore } from './stores/theme'
import { useAuthStore } from './stores/auth'
import { socketService } from './services/socketService'

const theme = useThemeStore()
const auth = useAuthStore()

onMounted(() => {
  theme.applyTheme()

  // Conectar socket si ya hay sesión activa al cargar la app
  if (auth.token) {
    socketService.connect(auth.token)
  }
})

// Observar cambios en el token (login/logout)
watch(() => auth.token, (newToken, oldToken) => {
  if (newToken && newToken !== oldToken) {
    socketService.connect(newToken)
  } else if (!newToken) {
    socketService.disconnect()
  }
})

onUnmounted(() => {
  socketService.disconnect()
})
</script>

<template>
  <NotificationToast />
  <router-view />
</template>
