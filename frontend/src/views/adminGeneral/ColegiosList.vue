<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { adminGeneralService } from '../../services/adminGeneralService'
import { API_BASE_URL } from '../../config/api'
import { 
  School, Plus, Search, Trash2, Edit3, CheckCircle, XCircle, AlertTriangle, 
  Mail, Phone, MapPin, Calendar, Hash, Users, Eye
} from 'lucide-vue-next'
import { useConfirm } from '../../composables/useConfirm'
import { useToast } from '../../composables/useToast'
import StatCard from '../../components/ui/StatCard.vue'
import EmptyState from '../../components/feedback/EmptyState.vue'

const getShieldUrl = (url: string) => {
  if (!url || url === 'undefined' || url.includes('undefined')) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

const route = useRoute()
const { confirm } = useConfirm()
const toast = useToast()




interface Colegio {
  id_colegio: number
  nombre: string
  tipo_colegio: string
  sede: string
  contacto: number | string
  correo: string
  dane: string
  tipo_calendario: string
  estado: 'PENDIENTE' | 'ACTIVO' | 'SUSPENDIDO' | 'RECHAZADO' | 'ELIMINADO'
  fecha_registro: string
  motivo_rechazo?: string
  fecha_cambio_estado?: string
  directivos_count?: number
  docentes_count?: number
  padres_count?: number
  estudiantes_count?: number
  usuarios_totales?: number
  escudo_url?: string
  colores?: string
  color_primario?: string
  color_secundario?: string
}


const loading = ref(true)
const colleges = ref<Colegio[]>([])
const search = ref('')
const selectedEstado = ref(route.query.estado as string || '')

// KPIs
const stats = ref({
  total: 0,
  activos: 0,
  pendientes: 0,
  suspendidos: 0
})

// Modals
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showDetailsModal = ref(false)
const showRejectModal = ref(false)
const saving = ref(false)

const selectedCollege = ref<Colegio | null>(null)
const rejectReason = ref('')

const form = ref({
  nombre: '',
  tipo_colegio: 'OFICIAL',
  sede: '',
  contacto: '',
  correo: '',
  dane: '',
  tipo_calendario: 'A',
  escudo_url: '',
  colores: ''
})



const fetchColleges = async () => {
  try {
    loading.value = true
    const params = {
      estado: selectedEstado.value || undefined,
      search: search.value || undefined
    }
    const data = await adminGeneralService.getColegios(params)
    colleges.value = data || []

    // Refresh KPI counts
    stats.value = {
      total: colleges.value.length,
      activos: colleges.value.filter(c => c.estado === 'ACTIVO').length,
      pendientes: colleges.value.filter(c => c.estado === 'PENDIENTE').length,
      suspendidos: colleges.value.filter(c => c.estado === 'SUSPENDIDO').length
    }
  } catch (error) {
    console.error('Error fetching colleges:', error)
  } finally {
    loading.value = false
  }
}

watch([selectedEstado, search], () => {
  fetchColleges()
})

watch(() => route.query.estado, (newVal) => {
  selectedEstado.value = (newVal as string) || ''
})

onMounted(() => {
  fetchColleges()
})

const openCreate = () => {
  form.value = {
    nombre: '',
    tipo_colegio: 'OFICIAL',
    sede: '',
    contacto: '',
    correo: '',
    dane: '',
    tipo_calendario: 'A',
    escudo_url: '',
    colores: ''
  }
  showCreateModal.value = true
}

const handleCreate = async () => {
  if (!form.value.nombre || !form.value.dane || !form.value.correo) {
    alert('Por favor complete los campos obligatorios.')
    return
  }
  try {
    saving.value = true
    await adminGeneralService.createColegio(form.value)
    showCreateModal.value = false
    await fetchColleges()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al registrar colegio')
  } finally {
    saving.value = false
  }
}

const normalizeTipoColegio = (tipo?: string | null): string => {
  if (!tipo) return 'OFICIAL'
  const t = String(tipo).trim().toUpperCase()
  if (t.includes('PRIVAD') || t.includes('NO OFICIAL') || t.includes('NO_OFICIAL')) {
    return 'NO OFICIAL'
  }
  return 'OFICIAL'
}

const openEdit = (college: Colegio) => {
  selectedCollege.value = college
  form.value = {
    nombre: college.nombre,
    tipo_colegio: normalizeTipoColegio(college.tipo_colegio),
    sede: college.sede,
    contacto: String(college.contacto || ''),
    correo: college.correo,
    dane: college.dane,
    tipo_calendario: college.tipo_calendario || 'A',
    escudo_url: college.escudo_url || '',
    colores: college.colores || ''
  }
  showEditModal.value = true
}

const handleEdit = async () => {
  if (!selectedCollege.value) return
  if (!form.value.nombre || !form.value.dane || !form.value.correo) {
    alert('Por favor complete los campos obligatorios.')
    return
  }
  try {
    saving.value = true
    await adminGeneralService.updateColegio(selectedCollege.value.id_colegio, form.value)
    showEditModal.value = false
    await fetchColleges()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al actualizar colegio')
  } finally {
    saving.value = false
  }
}

const openDetails = async (college: Colegio) => {
  selectedCollege.value = college
  showDetailsModal.value = true
  try {
    const data = await adminGeneralService.getColegio(college.id_colegio)
    selectedCollege.value = { ...college, ...data }
  } catch (error) {
    console.error('Error fetching college details:', error)
  }
}

const updateStatus = async (college: Colegio, estado: string, motivo?: string) => {
  const ok = await confirm({
    title: 'Cambiar Estado de Colegio',
    message: `¿Confirmas el cambio de estado de ${college.nombre} a ${estado}?`,
    confirmText: 'Confirmar Cambio',
    type: estado === 'SUSPENDIDO' || estado === 'RECHAZADO' ? 'danger' : 'primary'
  })
  if (!ok) return
  try {
    await adminGeneralService.updateColegioEstado(college.id_colegio, {
      estado,
      motivo
    })
    toast.success(`Estado de ${college.nombre} actualizado a ${estado}`)
    await fetchColleges()
    if (selectedCollege.value?.id_colegio === college.id_colegio) {
      selectedCollege.value.estado = estado as any
    }
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al cambiar estado')
  }
}

const openReject = (college: Colegio) => {
  selectedCollege.value = college
  rejectReason.value = ''
  showRejectModal.value = true
}

const handleReject = async () => {
  if (!selectedCollege.value) return
  if (!rejectReason.value.trim()) {
    toast.warning('Por favor indica un motivo para el rechazo.')
    return
  }
  await updateStatus(selectedCollege.value, 'RECHAZADO', rejectReason.value)
  showRejectModal.value = false
}

const handleDelete = async (college: Colegio) => {
  const ok = await confirm({
    title: 'Eliminar Colegio',
    message: `¿Estás seguro de que deseas eliminar permanentemente a ${college.nombre}? Todos los directivos y usuarios serán desvinculados.`,
    confirmText: 'Eliminar Permanentemente',
    type: 'danger'
  })
  if (!ok) return

  try {
    await adminGeneralService.deleteColegio(college.id_colegio)
    toast.success(`Colegio ${college.nombre} eliminado exitosamente`)
    await fetchColleges()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al eliminar colegio')
  }
}


</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <School :size="32" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Colegios Registrados</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Administra e incorpora colegios al sistema global.</p>
          </div>
        </div>
        
        <button @click="openCreate" class="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 dark:shadow-none">
          <Plus :size="18" />
          Registrar Colegio
        </button>
      </div>
    </div>

    <!-- KPIs Row -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard title="Total Instituciones" :value="stats.total">
        <template #icon>
          <School :size="20" class="text-indigo-600 dark:text-indigo-400" />
        </template>
      </StatCard>

      <StatCard title="Activas" :value="stats.activos">
        <template #icon>
          <CheckCircle :size="20" class="text-emerald-600 dark:text-emerald-400" />
        </template>
      </StatCard>

      <StatCard title="Pendientes" :value="stats.pendientes">
        <template #icon>
          <AlertTriangle :size="20" class="text-amber-600 dark:text-amber-400" />
        </template>
      </StatCard>

      <StatCard title="Suspendidas" :value="stats.suspendidos">
        <template #icon>
          <XCircle :size="20" class="text-red-600 dark:text-red-400" />
        </template>
      </StatCard>
    </div>


    <!-- Filters and Grid -->
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div class="relative flex-1">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
          <input 
            v-model="search" 
            type="text" 
            placeholder="Buscar por nombre, DANE, correo..."
            class="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none text-slate-900 dark:text-white"
          />
        </div>
        <select v-model="selectedEstado" class="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none text-slate-700 dark:text-slate-200 cursor-pointer min-w-[150px]">
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="ACTIVO">Activos</option>
          <option value="SUSPENDIDO">Suspendidos</option>
          <option value="RECHAZADO">Rechazados</option>
          <option value="ELIMINADO">Eliminados</option>
        </select>
      </div>

      <!-- College Grid -->
      <div v-if="loading" class="h-64 flex items-center justify-center text-slate-400">
        <span class="animate-pulse font-bold">Cargando instituciones...</span>
      </div>

      <EmptyState 
        v-else-if="colleges.length === 0"
        title="No se encontraron colegios registrados"
        description="No hay instituciones educativas que coincidan con la búsqueda o el estado seleccionado."
      >
        <template #icon>
          <School class="w-8 h-8 text-indigo-500" />
        </template>
      </EmptyState>


      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          v-for="college in colleges" 
          :key="college.id_colegio"
          class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div class="space-y-4">
            <!-- Title & Status -->
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-black text-slate-800 dark:text-white text-lg leading-snug">{{ college.nombre }}</h3>
                <p class="text-xs text-indigo-500 font-bold uppercase mt-0.5 tracking-wider">{{ college.tipo_colegio }}</p>
              </div>
              <span 
                :class="[
                  college.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400' : '',
                  college.estado === 'PENDIENTE' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400' : '',
                  college.estado === 'SUSPENDIDO' ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400' : '',
                  college.estado === 'RECHAZADO' ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400' : '',
                  college.estado === 'ELIMINADO' ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' : '',
                  'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider'
                ]"
              >
                {{ college.estado }}
              </span>
            </div>

            <!-- Meta info -->
            <div class="space-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-800/50 pt-4">
              <div class="flex items-center gap-2">
                <Hash :size="14" class="text-slate-400" />
                <span>DANE: <span class="font-mono">{{ college.dane }}</span></span>
              </div>
              <div class="flex items-center gap-2">
                <MapPin :size="14" class="text-slate-400" />
                <span class="truncate">Sede: {{ college.sede }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Mail :size="14" class="text-slate-400" />
                <span class="truncate">{{ college.correo }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Phone :size="14" class="text-slate-400" />
                <span>Contacto: {{ college.contacto }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Calendar :size="14" class="text-slate-400" />
                <span>Calendario: <span class="font-bold">{{ college.tipo_calendario }}</span></span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between border-t border-slate-50 dark:border-slate-800/50 pt-4 mt-6">
            <button @click="openDetails(college)" class="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all">
              <Eye :size="14" />
              Detalles
            </button>

            <div class="flex items-center gap-1.5">
              <!-- Edit -->
              <button 
                v-if="college.estado !== 'ELIMINADO'"
                @click="openEdit(college)" 
                class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-xl transition-all"
                title="Editar"
              >
                <Edit3 :size="16" />
              </button>

              <!-- State-based Admin Actions -->
              <template v-if="college.estado === 'PENDIENTE'">
                <button 
                  @click="updateStatus(college, 'ACTIVO')" 
                  class="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl transition-all"
                  title="Aprobar e Incorporar"
                >
                  <CheckCircle :size="16" />
                </button>
                <button 
                  @click="openReject(college)" 
                  class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                  title="Rechazar incorporación"
                >
                  <XCircle :size="16" />
                </button>
              </template>

              <template v-if="college.estado === 'ACTIVO'">
                <button 
                  @click="updateStatus(college, 'SUSPENDIDO')" 
                  class="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 rounded-xl transition-all"
                  title="Suspender Colegio"
                >
                  <AlertTriangle :size="16" />
                </button>
              </template>

              <template v-if="college.estado === 'SUSPENDIDO'">
                <button 
                  @click="updateStatus(college, 'ACTIVO')" 
                  class="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl transition-all"
                  title="Re-activar Colegio"
                >
                  <CheckCircle :size="16" />
                </button>
              </template>

              <!-- Permanent delete (soft-delete on backend but final state) -->
              <button 
                v-if="college.estado !== 'ELIMINADO'"
                @click="handleDelete(college)"
                class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                title="Eliminar"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <Teleport to="body">
      <!-- Create/Edit Modals -->
      <div v-if="showCreateModal || showEditModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showCreateModal = showEditModal = false"></div>
        <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
          <div class="px-8 pt-8 pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <h2 class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <School :size="24" class="text-indigo-600" />
              {{ showCreateModal ? 'Registrar Nueva Institución' : 'Editar Información del Colegio' }}
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Completa los campos de registro primario.</p>
          </div>

          <div class="p-8 space-y-4 overflow-y-auto flex-1">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2 space-y-1">
                <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre del Colegio *</label>
                <input v-model="form.nombre" type="text" placeholder="Ej. Colegio San José" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold outline-none text-slate-900 dark:text-white" />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Código DANE *</label>
                <input v-model="form.dane" type="text" placeholder="Ej. 14100100123" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold outline-none text-slate-900 dark:text-white font-mono" />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo Colegio</label>
                <select v-model="form.tipo_colegio" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold outline-none text-slate-900 dark:text-white cursor-pointer">
                  <option value="OFICIAL">OFICIAL (Público)</option>
                  <option value="NO OFICIAL">NO OFICIAL (Privado)</option>
                </select>
              </div>

              <div class="col-span-2 space-y-1">
                <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sede Principal</label>
                <input v-model="form.sede" type="text" placeholder="Ej. Sede Central - Neiva" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold outline-none text-slate-900 dark:text-white" />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contacto Telefónico</label>
                <input v-model="form.contacto" type="number" placeholder="Ej. 3123456789" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold outline-none text-slate-900 dark:text-white" />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Correo Electrónico *</label>
                <input v-model="form.correo" type="email" placeholder="Ej. rectoria@colegio.edu.co" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold outline-none text-slate-900 dark:text-white" />
              </div>

              <div class="space-y-1">
                <label class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo Calendario</label>
                <select v-model="form.tipo_calendario" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold outline-none text-slate-900 dark:text-white cursor-pointer">
                  <option value="A">Calendario A</option>
                  <option value="B">Calendario B</option>
                </select>
              </div>
            </div>
          </div>

          <div class="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex gap-3 shrink-0">
            <button @click="showCreateModal = showEditModal = false" class="flex-1 px-4 py-3.5 rounded-2xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button @click="showCreateModal ? handleCreate() : handleEdit()" :disabled="saving" class="flex-[2] bg-indigo-600 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-100 dark:shadow-none">
              {{ saving ? 'Guardando...' : 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Details Modal -->
      <div v-if="showDetailsModal && selectedCollege" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showDetailsModal = false"></div>
        <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div class="p-8 space-y-6">
            <div class="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 class="text-2xl font-black text-slate-900 dark:text-white">{{ selectedCollege.nombre }}</h2>
                <span class="text-xs text-indigo-500 font-extrabold uppercase mt-1 tracking-wider block">ID: {{ selectedCollege.id_colegio }} · {{ selectedCollege.tipo_colegio }}</span>
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 uppercase tracking-widest">{{ selectedCollege.estado }}</span>
            </div>

            <!-- Profile Info Grid -->
            <div class="grid grid-cols-2 gap-6 text-sm">
              <div class="space-y-3">
                <h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Identificación y Ubicación</h4>
                <p class="font-bold text-slate-700 dark:text-slate-300">DANE: <span class="font-mono text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded">{{ selectedCollege.dane }}</span></p>
                <p class="font-bold text-slate-700 dark:text-slate-300">Sede: <span class="font-medium">{{ selectedCollege.sede }}</span></p>
                <p class="font-bold text-slate-700 dark:text-slate-300">Calendario: <span class="font-bold">{{ selectedCollege.tipo_calendario }}</span></p>
              </div>

              <div class="space-y-3">
                <h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Contacto</h4>
                <p class="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Mail :size="14" class="text-slate-400" /> <span class="font-medium">{{ selectedCollege.correo }}</span></p>
                <p class="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Phone :size="14" class="text-slate-400" /> <span class="font-medium">{{ selectedCollege.contacto }}</span></p>
                <p class="font-bold text-slate-700 dark:text-slate-300">Registro: <span class="font-medium">{{ new Date(selectedCollege.fecha_registro).toLocaleString() }}</span></p>
              </div>
            </div>

            <!-- Audit details if state changes occurred -->
            <div v-if="selectedCollege.motivo_rechazo || selectedCollege.fecha_cambio_estado" class="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-4 rounded-2xl text-xs space-y-2">
              <h4 class="font-black text-red-600 dark:text-red-400 uppercase tracking-wider">Historial de Cambio de Estado</h4>
              <p v-if="selectedCollege.fecha_cambio_estado" class="text-slate-600 dark:text-slate-400 font-bold">Fecha del último cambio: <span class="font-medium text-slate-900 dark:text-white">{{ new Date(selectedCollege.fecha_cambio_estado).toLocaleString() }}</span></p>
              <p v-if="selectedCollege.motivo_rechazo" class="text-slate-600 dark:text-slate-400 font-bold">Motivo registrado: <span class="font-medium text-red-800 dark:text-red-300 block mt-1 bg-red-100/50 dark:bg-red-950/40 p-2 rounded-xl">{{ selectedCollege.motivo_rechazo }}</span></p>
            </div>

            <!-- Identidad Visual -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6 grid grid-cols-2 gap-6 text-sm">
              <div class="space-y-2">
                <h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Escudo Institucional</h4>
                <div class="w-24 h-24 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-2 flex items-center justify-center overflow-hidden">
                  <img v-if="selectedCollege.escudo_url" :src="getShieldUrl(selectedCollege.escudo_url)" alt="Escudo" class="w-full h-full object-contain" />
                  <span v-else class="text-xs text-slate-400 italic font-medium">Sin Escudo</span>
                </div>
              </div>
              
              <div class="space-y-2">
                <h4 class="text-xs font-black text-slate-400 uppercase tracking-wider">Colores Corporativos</h4>
                <div v-if="selectedCollege.color_primario || selectedCollege.color_secundario" class="flex flex-wrap gap-3 mt-2">
                  <div v-if="selectedCollege.color_primario" class="flex items-center gap-1.5">
                    <div class="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm" :style="{ backgroundColor: selectedCollege.color_primario }" :title="selectedCollege.color_primario"></div>
                    <span class="text-[10px] font-bold text-slate-500">Primario ({{ selectedCollege.color_primario }})</span>
                  </div>
                  <div v-if="selectedCollege.color_secundario" class="flex items-center gap-1.5">
                    <div class="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm" :style="{ backgroundColor: selectedCollege.color_secundario }" :title="selectedCollege.color_secundario"></div>
                    <span class="text-[10px] font-bold text-slate-500">Secundario ({{ selectedCollege.color_secundario }})</span>
                  </div>
                </div>
                <span v-else class="text-xs text-slate-400 italic font-medium block mt-2">Sin Colores Definidos</span>
              </div>
            </div>


            <!-- Statistics Box -->
            <div class="border-t border-slate-100 dark:border-slate-800 pt-6">
              <h4 class="text-xs font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5"><Users :size="16" /> Estadísticas de Cuentas</h4>
              <div class="grid grid-cols-4 gap-3 text-center">
                <div class="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                  <span class="text-[10px] font-black text-slate-400 uppercase block">Directivos</span>
                  <span class="text-lg font-black text-slate-800 dark:text-white mt-1 block font-mono">{{ selectedCollege.directivos_count ?? '...' }}</span>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                  <span class="text-[10px] font-black text-slate-400 uppercase block">Docentes</span>
                  <span class="text-lg font-black text-slate-800 dark:text-white mt-1 block font-mono">{{ selectedCollege.docentes_count ?? '...' }}</span>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                  <span class="text-[10px] font-black text-slate-400 uppercase block">Padres</span>
                  <span class="text-lg font-black text-slate-800 dark:text-white mt-1 block font-mono">{{ selectedCollege.padres_count ?? '...' }}</span>
                </div>
                <div class="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100/50 dark:border-slate-800/50">
                  <span class="text-[10px] font-black text-slate-400 uppercase block">Alumnos</span>
                  <span class="text-lg font-black text-slate-800 dark:text-white mt-1 block font-mono">{{ selectedCollege.estudiantes_count ?? '...' }}</span>
                </div>
              </div>
            </div>

            <!-- Footer actions -->
            <div class="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
              <button @click="showDetailsModal = false" class="px-6 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-bold text-sm hover:translate-y-[-2px] transition-all">Cerrar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Reject Confirmation Modal -->
      <div v-if="showRejectModal && selectedCollege" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-red-950/30 backdrop-blur-md" @click="showRejectModal = false"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl">
          <div class="p-8 space-y-4">
            <div class="w-16 h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <XCircle :size="32" />
            </div>
            <div class="text-center">
              <h2 class="text-xl font-black text-slate-900 dark:text-white">Rechazar Incorporación</h2>
              <p class="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">Por favor escribe la justificación del rechazo para {{ selectedCollege.nombre }}.</p>
            </div>
            <textarea 
              v-model="rejectReason"
              placeholder="Indica detalladamente los motivos del rechazo..."
              rows="4"
              class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-bold outline-none text-slate-900 dark:text-white resize-none"
            ></textarea>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-6 flex gap-3 border-t border-slate-100 dark:border-slate-800">
            <button @click="showRejectModal = false" class="flex-1 px-6 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs">Cancelar</button>
            <button 
              @click="handleReject"
              class="flex-1 bg-red-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-600 transition-all text-xs shadow-lg shadow-red-100 dark:shadow-none"
            >
              Confirmar Rechazo
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
</style>
