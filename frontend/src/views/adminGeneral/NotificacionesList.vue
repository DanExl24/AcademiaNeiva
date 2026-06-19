<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import { 
  Bell, Clock, School, ShieldCheck, Search
} from 'lucide-vue-next'

const auth = useAuthStore()

interface Notificacion {
  id_notificacion: number
  tipo: string
  mensaje: string
  fecha: string
  origen: 'SUPERVISION' | 'COLEGIO'
  colegio_nombre: string
  directivo_nombre: string
}

const loading = ref(true)
const notifications = ref<Notificacion[]>([])
const filterOrigen = ref('')
const search = ref('')

const fetchNotifications = async () => {
  try {
    loading.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get('http://localhost:3000/api/admin/notificaciones', { headers })
    notifications.value = res.data
  } catch (error) {
    console.error('Error fetching system notifications:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchNotifications()
})

const filteredNotifications = computed(() => {
  return notifications.value.filter(n => {
    const matchesOrigen = !filterOrigen.value || n.origen === filterOrigen.value
    const matchesSearch = !search.value || 
      n.mensaje.toLowerCase().includes(search.value.toLowerCase()) ||
      n.colegio_nombre.toLowerCase().includes(search.value.toLowerCase())
    return matchesOrigen && matchesSearch
  })
})
</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Bell :size="32" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Notificaciones del Sistema</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Historial consolidado de notificaciones enviadas a los directivos.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
      <div class="relative flex-1">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
        <input 
          v-model="search" 
          type="text" 
          placeholder="Buscar en mensajes o colegios..."
          class="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none text-slate-900 dark:text-white"
        />
      </div>

      <!-- School selector -->
      <select v-model="filterOrigen" class="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none text-slate-700 dark:text-slate-200 cursor-pointer min-w-[180px]">
        <option value="">Todos los orígenes</option>
        <option value="SUPERVISION">Supervisión</option>
        <option value="COLEGIO">Ciclo del Colegio</option>
      </select>
    </div>

    <!-- Notification Feed -->
    <div class="space-y-4">
      <div v-if="loading" class="h-64 flex items-center justify-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
        <span class="animate-pulse font-bold">Cargando notificaciones...</span>
      </div>

      <div v-else-if="filteredNotifications.length === 0" class="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-800">
        <Bell class="mx-auto mb-4 text-slate-300 dark:text-slate-700" :size="48" />
        <p class="font-bold text-slate-500">No hay notificaciones registradas</p>
      </div>

      <div v-else class="space-y-4">
        <div 
          v-for="notif in filteredNotifications" 
          :key="notif.id_notificacion"
          class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-start gap-4 hover:shadow-md transition-all border-l-4"
          :class="notif.origen === 'SUPERVISION' ? 'border-l-indigo-500' : 'border-l-amber-500'"
        >
          <!-- Left Icon -->
          <div 
            :class="[
              notif.origen === 'SUPERVISION' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
              'p-3 rounded-2xl shrink-0'
            ]"
          >
            <component :is="notif.origen === 'SUPERVISION' ? ShieldCheck : School" :size="20" />
          </div>

          <!-- Message details -->
          <div class="flex-1 space-y-2 min-w-0">
            <div class="flex justify-between items-start gap-3">
              <div>
                <h4 class="font-bold text-slate-900 dark:text-white text-base leading-snug">{{ notif.colegio_nombre }}</h4>
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono mt-0.5">{{ notif.origen }} · Destinatario: {{ notif.directivo_nombre }} (Directivo)</p>
              </div>
              <div class="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono shrink-0">
                <Clock :size="13" />
                {{ new Date(notif.fecha).toLocaleString() }}
              </div>
            </div>

            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800/50 leading-relaxed">
              {{ notif.mensaje }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
