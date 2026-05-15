<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import DashboardHome from './DashboardHome.vue'
import TeacherDashboard from '../teacher/TeacherDashboard.vue'

const auth = useAuthStore()
</script>

<template>
  <TeacherDashboard v-if="auth.user?.role === 'docente'" />
  <DashboardHome v-else />
</template>
