<script setup lang="ts">
import { onMounted } from 'vue'
import NotificationToast from './components/NotificationToast.vue'
import { useThemeStore } from './stores/theme'

const theme = useThemeStore()

onMounted(() => {
  theme.applyTheme()
})
</script>

<template>
  <NotificationToast />
  <router-view />
</template>
