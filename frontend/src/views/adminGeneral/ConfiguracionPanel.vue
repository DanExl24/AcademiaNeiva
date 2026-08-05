<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'
import axios from 'axios'
import { 
  Settings, User, Shield, Server, Info, Save, Loader2, CheckCircle, AlertTriangle
} from 'lucide-vue-next'

const auth = useAuthStore()

const profile = ref({
  nombre: auth.user?.name || 'Administrador General',
  email: auth.user?.email || 'admin.general@academianeiva.edu.co',
  rol: 'Super Administrador (admin_general)'
})

const supervisionSettings = ref({
  minDuration: 5,
  maxDuration: 300
})

// Guardar valores originales para detectar cambios
const originalSettings = ref({
  minDuration: 5,
  maxDuration: 300
})

const platformDiagnostics = ref({
  env: 'Development (Local)',
  dbVersion: 'PostgreSQL 15',
  nodeVersion: 'Node.js v18.16.0',
  port: 3000
})

const loading = ref(false)
const saving = ref(false)
const feedbackMessage = ref('')
const feedbackType = ref<'success' | 'error' | ''>('')
const lastUpdated = ref<string | null>(null)

const hasChanges = computed(() => {
  return supervisionSettings.value.minDuration !== originalSettings.value.minDuration ||
         supervisionSettings.value.maxDuration !== originalSettings.value.maxDuration
})

const validationError = computed(() => {
  const min = supervisionSettings.value.minDuration
  const max = supervisionSettings.value.maxDuration

  if (!Number.isInteger(min) || !Number.isInteger(max)) return 'Los valores deben ser números enteros'
  if (min < 1 || min > 60) return 'La duración mínima debe estar entre 1 y 60 minutos'
  if (max < 30 || max > 1440) return 'La duración máxima debe estar entre 30 y 1440 minutos (24 horas)'
  if (min >= max) return 'La duración mínima debe ser menor que la duración máxima'
  return ''
})

const fetchConfig = async () => {
  try {
    loading.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get('/api/admin/configuracion', { headers })

    const data = res.data
    if (data.supervision_duracion_minima_minutos) {
      supervisionSettings.value.minDuration = Number(data.supervision_duracion_minima_minutos.valor)
      originalSettings.value.minDuration = Number(data.supervision_duracion_minima_minutos.valor)
    }
    if (data.supervision_duracion_maxima_minutos) {
      supervisionSettings.value.maxDuration = Number(data.supervision_duracion_maxima_minutos.valor)
      originalSettings.value.maxDuration = Number(data.supervision_duracion_maxima_minutos.valor)
      // Tomar la última fecha de actualización
      lastUpdated.value = data.supervision_duracion_maxima_minutos.fecha_actualizacion
    }
  } catch (error) {
    console.error('Error fetching configuration:', error)
    showFeedback('error', 'Error al cargar la configuración')
  } finally {
    loading.value = false
  }
}

const saveConfig = async () => {
  if (validationError.value || !hasChanges.value) return

  try {
    saving.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.put('/api/admin/configuracion', {
      supervision_duracion_minima_minutos: supervisionSettings.value.minDuration,
      supervision_duracion_maxima_minutos: supervisionSettings.value.maxDuration
    }, { headers })

    originalSettings.value.minDuration = supervisionSettings.value.minDuration
    originalSettings.value.maxDuration = supervisionSettings.value.maxDuration
    lastUpdated.value = new Date().toISOString()
    showFeedback('success', 'Configuración guardada correctamente')
  } catch (error: any) {
    showFeedback('error', error.response?.data?.error || 'Error al guardar la configuración')
  } finally {
    saving.value = false
  }
}

const resetConfig = () => {
  supervisionSettings.value.minDuration = originalSettings.value.minDuration
  supervisionSettings.value.maxDuration = originalSettings.value.maxDuration
  feedbackMessage.value = ''
  feedbackType.value = ''
}

const showFeedback = (type: 'success' | 'error', message: string) => {
  feedbackType.value = type
  feedbackMessage.value = message
  setTimeout(() => {
    feedbackMessage.value = ''
    feedbackType.value = ''
  }, 4000)
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'Nunca'
  return new Date(dateStr).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

onMounted(() => {
  fetchConfig()
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
            <p class="text-slate-500 dark:text-slate-400 font-medium">Gestiona tu perfil, ajusta las políticas de supervisión y visualiza diagnósticos de la plataforma.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Feedback Toast -->
    <Transition name="slide-fade">
      <div v-if="feedbackMessage" :class="[
        'flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-lg text-sm font-bold transition-all duration-300',
        feedbackType === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : '',
        feedbackType === 'error' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' : ''
      ]">
        <CheckCircle v-if="feedbackType === 'success'" :size="18" />
        <AlertTriangle v-if="feedbackType === 'error'" :size="18" />
        {{ feedbackMessage }}
      </div>
    </Transition>

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

      <!-- Supervision Policies (Editable) -->
      <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5 md:col-span-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Shield :size="16" />
            Políticas de Supervisión
          </h3>
          <span v-if="lastUpdated" class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Última modificación: {{ formatDate(lastUpdated) }}
          </span>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-12 text-slate-400">
          <Loader2 :size="24" class="animate-spin" />
          <span class="ml-2 text-sm font-bold">Cargando configuración...</span>
        </div>

        <template v-else>
          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Duración Mínima -->
              <div class="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 space-y-2">
                <label class="text-xs font-black text-slate-400 uppercase tracking-wider block">Duración Mínima (Minutos)</label>
                <input 
                  v-model.number="supervisionSettings.minDuration" 
                  type="number" 
                  min="1" 
                  max="60"
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-slate-800 dark:text-white font-mono outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all duration-200"
                />
                <p class="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Rango permitido: 1 – 60 minutos</p>
              </div>

              <!-- Duración Máxima -->
              <div class="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 space-y-2">
                <label class="text-xs font-black text-slate-400 uppercase tracking-wider block">Duración Máxima (Minutos)</label>
                <input 
                  v-model.number="supervisionSettings.maxDuration" 
                  type="number" 
                  min="30" 
                  max="1440"
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-slate-800 dark:text-white font-mono outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all duration-200"
                />
                <p class="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Rango permitido: 30 – 1440 minutos (24h)</p>
              </div>
            </div>

            <!-- Validation Error -->
            <div v-if="validationError" class="flex items-center gap-2.5 bg-red-50/60 dark:bg-red-950/20 p-3.5 rounded-2xl border border-red-100/60 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 font-bold">
              <AlertTriangle :size="16" class="shrink-0" />
              <span>{{ validationError }}</span>
            </div>

            <!-- Info banner -->
            <div class="flex items-center gap-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/50 text-xs text-indigo-700/80 dark:text-indigo-400/80 font-medium">
              <Info :size="16" class="shrink-0 text-indigo-500" />
              <span>Estos límites definen el rango de duración que puedes solicitar al crear una supervisión. Al solicitar la supervisión se mostrará este rango como restricción.</span>
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-3 pt-2">
              <button 
                @click="saveConfig" 
                :disabled="!hasChanges || saving || !!validationError" 
                :class="[
                  'flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all duration-200 shadow-sm',
                  hasChanges && !validationError
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md cursor-pointer' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                ]"
              >
                <Loader2 v-if="saving" :size="16" class="animate-spin" />
                <Save v-else :size="16" />
                {{ saving ? 'Guardando...' : 'Guardar Configuración' }}
              </button>
              <button 
                v-if="hasChanges"
                @click="resetConfig"
                class="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 cursor-pointer"
              >
                Descartar
              </button>
            </div>
          </div>
        </template>
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
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}
.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}
.slide-fade-leave-to {
  transform: translateY(-5px);
  opacity: 0;
}
</style>
