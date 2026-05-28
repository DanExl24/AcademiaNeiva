<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import DashboardHome from './DashboardHome.vue'
import TeacherDashboard from '../teacher/TeacherDashboard.vue'
import ParentDashboard from '../parent/ParentDashboard.vue'

const auth = useAuthStore()
</script>

<template>
  <TeacherDashboard v-if="auth.activeRole === 'docente'" />
  <ParentDashboard v-else-if="auth.activeRole === 'padre'" />
  <DashboardHome v-else />
</template>
