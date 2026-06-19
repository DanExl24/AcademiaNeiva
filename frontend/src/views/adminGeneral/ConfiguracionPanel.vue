<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { 
  Settings, User, Shield, Server, Info
} from 'lucide-vue-next'

const auth = useAuthStore()

const profile = ref({
  nombre: auth.user?.name || 'Administrador General',
  email: auth.user?.email || 'admin.general@academianeiva.edu.co',
  rol: 'Super Administrador (admin_general)'
})

const supervisionSettings = ref({
  defaultDuration: 60,
  maxDuration: 180,
  requireReason: true
})

const platformDiagnostics = ref({
  env: 'Development (Local)',
  dbVersion: 'PostgreSQL 15',
  nodeVersion: 'Node.js v18.16.0',
  port: 3000
})
</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Settings :size="32" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Configuración del Sistema</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Gestiona tu perfil, visualiza diagnósticos y ajusta políticas de la plataforma.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      <!-- Profile Card -->
      <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
        <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <User :size="16" />
          Mi Perfil
        </h3>
        
        <div class="flex flex-col items-center py-4 space-y-3">
          <div class="w-20 h-20 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 rounded-full flex items-center justify-center text-3xl font-black shadow-inner border border-indigo-100 dark:border-indigo-900/40">
            {{ profile.nombre.charAt(0) }}
          </div>
          <div class="text-center">
            <h4 class="font-black text-slate-900 dark:text-white text-lg leading-tight">{{ profile.nombre }}</h4>
            <span class="text-xs text-indigo-500 font-bold uppercase tracking-wider block mt-1">{{ profile.rol }}</span>
          </div>
        </div>

        <div class="space-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-800 pt-4">
          <p>Correo: <span class="font-bold text-slate-900 dark:text-white">{{ profile.email }}</span></p>
          <p>Permisos: <span class="font-bold text-slate-900 dark:text-white">Acceso total de plataforma</span></p>
        </div>
      </div>

      <!-- Supervision Policies -->
      <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 md:col-span-2">
        <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Shield :size="16" />
          Políticas de Supervisión
        </h3>

        <div class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 space-y-1">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Duración Defecto</span>
              <p class="text-xl font-black text-slate-800 dark:text-white font-mono">{{ supervisionSettings.defaultDuration }} Minutos</p>
            </div>
            <div class="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 space-y-1">
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Duración Máxima</span>
              <p class="text-xl font-black text-slate-800 dark:text-white font-mono">{{ supervisionSettings.maxDuration }} Minutos</p>
            </div>
          </div>

          <div class="flex items-center gap-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/50 text-xs text-indigo-700/80 dark:text-indigo-400/80 font-medium">
            <Info :size="16" class="shrink-0 text-indigo-500" />
            <span>Estas políticas están definidas por defecto en el servidor y aseguran la protección y mitigación de acceso prolongado para auditorías de supervisión activa.</span>
          </div>
        </div>
      </div>

      <!-- Platform Diagnostics -->
      <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 md:col-span-3">
        <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Server :size="16" />
          Diagnósticos de Servidor
        </h3>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div class="space-y-1 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100/50">
            <span class="text-[10px] font-black text-slate-400 uppercase">Entorno</span>
            <p class="font-bold text-slate-900 dark:text-white text-sm">{{ platformDiagnostics.env }}</p>
          </div>
          <div class="space-y-1 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100/50">
            <span class="text-[10px] font-black text-slate-400 uppercase">Base de Datos</span>
            <p class="font-bold text-slate-900 dark:text-white text-sm">{{ platformDiagnostics.dbVersion }}</p>
          </div>
          <div class="space-y-1 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100/50">
            <span class="text-[10px] font-black text-slate-400 uppercase">Motor Backend</span>
            <p class="font-bold text-slate-900 dark:text-white text-sm">{{ platformDiagnostics.nodeVersion }}</p>
          </div>
          <div class="space-y-1 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100/50">
            <span class="text-[10px] font-black text-slate-400 uppercase">Puerto de Escucha</span>
            <p class="font-bold text-slate-900 dark:text-white text-sm">Port {{ platformDiagnostics.port }}</p>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
</style>
