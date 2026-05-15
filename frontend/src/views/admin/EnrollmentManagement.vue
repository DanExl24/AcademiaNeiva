<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { 
  Search, 
  Eye,
  Inbox,
  Clock,
  ShieldCheck,
  AlertTriangle,
  AlertCircle
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
const enrollments = ref<any[]>([])
const loading = ref(true)
const filterStatus = ref('PENDIENTE')
const searchQuery = ref('')

const fetchEnrollments = async () => {
  loading.value = true
  try {
    const idColegio = auth.user?.schoolId || 1
    const response = await axios.get(`http://localhost:3000/api/matriculas/filtered/${idColegio}`, {
      params: { estado: 'ALL' }
    })
    enrollments.value = response.data
  } catch (error) {
    console.error('Error fetching enrollments:', error)
  } finally {
    loading.value = false
  }
}

onMounted(fetchEnrollments)

const getStatusClass = (status: string) => {
  if (status === 'PENDIENTE') return 'bg-amber-100 text-amber-700'
  if (status === 'ACTIVA') return 'bg-emerald-100 text-emerald-700'
  return 'bg-red-100 text-red-700'
}

const stats = computed(() => {
  return {
    pending: enrollments.value.filter(e => e.estado === 'PENDIENTE').length,
    rejected: enrollments.value.filter(e => e.estado === 'RECHAZADA').length,
    active: enrollments.value.filter(e => e.estado === 'ACTIVA').length
  }
})

const getFilteredEnrollments = () => {
  let filtered = enrollments.value.filter(en => en.estado === filterStatus.value)
  
  if (searchQuery.value) {
    filtered = filtered.filter(en => 
      en.correo_padre.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      String(en.id_matricula).includes(searchQuery.value)
    )
  }
  return filtered
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Gestión de Matrículas</h1>
        <p class="text-gray-500 mt-1">Supervisa y valida las solicitudes de ingreso a la institución.</p>
      </div>
      
      <!-- Filter Tabs -->
      <div class="bg-gray-100 p-1.5 rounded-2xl flex gap-1 self-start">
        <button 
          v-for="status in ['PENDIENTE', 'RECHAZADA', 'ACTIVA']" 
          :key="status"
          @click="filterStatus = status"
          :class="[
            filterStatus === status 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700',
            'px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap'
          ]"
        >
          {{ status === 'PENDIENTE' ? 'Por Revisar' : status === 'RECHAZADA' ? 'En Corrección' : 'Aprobadas' }}
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div class="p-4 bg-amber-50 text-amber-600 rounded-2xl">
          <Clock :size="24" />
        </div>
        <div>
          <p class="text-gray-500 text-xs font-bold uppercase tracking-wider">Por Revisar</p>
          <p class="text-2xl font-bold text-gray-900 mt-0.5">{{ stats.pending }}</p>
        </div>
      </div>
      <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div class="p-4 bg-red-50 text-red-600 rounded-2xl">
          <AlertCircle :size="24" />
        </div>
        <div>
          <p class="text-gray-500 text-xs font-bold uppercase tracking-wider">En Corrección</p>
          <p class="text-2xl font-bold text-gray-900 mt-0.5">{{ stats.rejected }}</p>
        </div>
      </div>
      <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
        <div class="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
          <ShieldCheck :size="24" />
        </div>
        <div>
          <p class="text-gray-500 text-xs font-bold uppercase tracking-wider">Aprobadas</p>
          <p class="text-2xl font-bold text-gray-900 mt-0.5">{{ stats.active }}</p>
        </div>
      </div>
    </div>

    <!-- Search & Table -->
    <div class="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div class="p-6 border-b border-gray-50 flex items-center gap-4">
        <div class="relative flex-1">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" :size="20" />
          <input v-model="searchQuery" type="text" placeholder="Buscar por correo o ID..." class="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all">
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
              <th class="px-8 py-4">Matrícula</th>
              <th class="px-8 py-4">Correo Padre</th>
              <th class="px-8 py-4">Nivel/Grado</th>
              <th class="px-8 py-4">Estado</th>
              <th class="px-8 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            <tr v-for="en in getFilteredEnrollments()" :key="en.id_matricula" class="hover:bg-gray-50/50 transition-colors group">
              <td class="px-8 py-5">
                <div class="font-bold text-gray-900">#{{ en.id_matricula }}</div>
                <div class="text-[10px] text-gray-400 font-mono">{{ en.token_seguimiento.substring(0, 8) }}...</div>
              </td>
              <td class="px-8 py-5 text-gray-600">{{ en.correo_padre }}</td>
              <td class="px-8 py-5">
                <span class="text-sm font-medium text-gray-700">ID Grado: {{ en.id_grado }}</span>
              </td>
              <td class="px-8 py-5">
                <div class="flex flex-col gap-1.5">
                  <span :class="[getStatusClass(en.estado), 'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit']">
                    {{ en.estado === 'PENDIENTE' ? 'POR REVISAR' : en.estado === 'RECHAZADA' ? 'EN CORRECCIÓN' : en.estado }}
                  </span>
                  <div v-if="en.has_pending_docs && en.estado === 'PENDIENTE'" 
                       class="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100 w-fit">
                    <AlertTriangle :size="12" />
                    <span class="text-[10px] font-bold">Diferido: Docs Pendientes</span>
                  </div>
                </div>
              </td>
              <td class="px-8 py-5 text-right">
                <div class="flex items-center justify-end gap-2">
                  <router-link :to="`/dashboard/gestion-matriculas/${en.id_matricula}`" 
                     class="p-2.5 bg-gray-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all flex" title="Gestionar Documentos">
                    <Eye :size="20" />
                  </router-link>
                </div>
              </td>
            </tr>
            <tr v-if="getFilteredEnrollments().length === 0 && !loading">
              <td colspan="5" class="px-8 py-20 text-center text-gray-400">
                <Inbox :size="48" class="mx-auto mb-4 opacity-20" />
                <p class="font-medium">No se encontraron matrículas en esta categoría.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
