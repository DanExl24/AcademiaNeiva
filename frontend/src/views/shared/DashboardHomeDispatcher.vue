<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import DashboardHome from './DashboardHome.vue'
import TeacherDashboard from '../teacher/TeacherDashboard.vue'
import ParentDashboard from '../parent/ParentDashboard.vue'
import StudentDashboard from '../student/StudentDashboard.vue'
import AdminGeneralDashboard from '../adminGeneral/AdminGeneralDashboard.vue'

const auth = useAuthStore()
</script>

<template>
  <AdminGeneralDashboard v-if="auth.activeRole === 'admin_general'" />
  <TeacherDashboard v-else-if="auth.activeRole === 'docente'" />
  <ParentDashboard v-else-if="auth.activeRole === 'padre'" />
  <StudentDashboard v-else-if="auth.activeRole === 'estudiante'" />
  <DashboardHome v-else />
</template>
