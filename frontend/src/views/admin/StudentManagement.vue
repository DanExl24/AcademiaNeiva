<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import {
  Users,
  Search,
  ShieldAlert,
  UserCheck,
  UserX,
  ArrowRight,
  GraduationCap,
  Edit2,
  AlertCircle
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notifications'

const auth = useAuthStore()
const notify = useNotificationStore()

// --- State ---
const students = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const filterStatus = ref('TODOS')
const filterGrado = ref('')

const levels = ref<any[]>([])
const groups = ref<any[]>([])

const studentModalOpen = ref(false)
const isEditing = ref(false)
const selectedStudent = ref<any>(null)

const statusModalOpen = ref(false)
const newStatus = ref('')

const changeGradeModalOpen = ref(false)
const selectedGroup = ref('')
const motivoTraslado = ref('')

// Form State
const studentForm = ref({
  nombre: '',
  apellido: '',
  documento: '',
  id_tipodocumento: 1,
  codigo: '',
})

const fetchStudents = async () => {
  loading.value = true
  try {
    const idColegio = auth.user?.schoolId || 1
    const response = await axios.get(`http://localhost:3000/api/student/colegio/${idColegio}`, {
      params: {
        estado: filterStatus.value,
        grado: filterGrado.value,
        busqueda: searchQuery.value
      }
    })
    students.value = response.data
  } catch (error) {
    console.error('Error fetching students:', error)
    notify.addNotification('Error al cargar estudiantes', 'error')
  } finally {
    loading.value = false
  }
}

const fetchMetadata = async () => {
  try {
    const idColegio = auth.user?.schoolId || 1
    const response = await axios.get(`http://localhost:3000/api/academic-admin/grades/${idColegio}`)
    levels.value = response.data.niveles
    groups.value = response.data.grupos
  } catch (error) {
    console.warn('Metadata fetch failed:', error)
  }
}

onMounted(() => {
  fetchStudents()
  fetchMetadata()
})


// Stats
const stats = computed(() => ({
  total: students.value.length,
  active: students.value.filter(s => s.estado === 'ACTIVO').length,
  sanctioned: students.value.filter(s => s.estado === 'SANCIONADO').length,
  expelled: students.value.filter(s => s.estado === 'EXPULSADO').length,
}))

// --- Actions ---


const openEditModal = (student: any) => {
  isEditing.value = true
  selectedStudent.value = student
  studentForm.value = { ...student }
  studentModalOpen.value = true
}

const saveStudent = async () => {
  try {
    if (isEditing.value) {
      await axios.put(`http://localhost:3000/api/student/${selectedStudent.value.id_estudiante}`, studentForm.value)
      notify.addNotification('Estudiante actualizado exitosamente', 'success')
    } else {
      // Create student is usually done via Enrollment - but we could add a direct one if needed
      // For now, let's just focus on Update/Status/Grade
    }
    studentModalOpen.value = false
    fetchStudents()
  } catch (error) {
    notify.addNotification('Error al guardar estudiante', 'error')
  }
}

const openStatusModal = (student: any, status: string) => {
  selectedStudent.value = student
  newStatus.value = status
  statusModalOpen.value = true
}

const confirmStatusChange = async () => {
  try {
    await axios.patch(`http://localhost:3000/api/student/${selectedStudent.value.id_estudiante}/status`, {
      estado: newStatus.value
    })
    notify.addNotification(`Estado actualizado a ${newStatus.value}`, 'success')
    statusModalOpen.value = false
    fetchStudents()
  } catch (error) {
    notify.addNotification('Error al cambiar el estado', 'error')
  }
}

const openChangeGradeModal = (student: any) => {
  selectedStudent.value = student
  selectedGroup.value = student.id_grupo || ''
  motivoTraslado.value = ''
  changeGradeModalOpen.value = true
}

const confirmGradeChange = async () => {
  try {
    const group = groups.value.find(g => g.id_grupo === Number(selectedGroup.value))
    if (!group) return

    await axios.patch(`http://localhost:3000/api/student/${selectedStudent.value.id_estudiante}/change-grade`, {
      id_grupo: group.id_grupo,
      id_nivel: group.id_nivel,
      motivo: motivoTraslado.value
    })
    notify.addNotification('Grado cambiado exitosamente', 'success')
    changeGradeModalOpen.value = false
    fetchStudents()
  } catch (error) {
    notify.addNotification('Error al cambiar de grado', 'error')
  }
}

const getStatusClass = (estado: string) => {
  if (estado === 'ACTIVO') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
  if (estado === 'SANCIONADO') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
  if (estado === 'EXPULSADO') return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
  return 'bg-slate-100 text-slate-700'
}

</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 shadow-sm px-8 py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
      <div class="flex items-center gap-4">
        <div class="p-3.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
          <GraduationCap :size="28" />
        </div>
        <div>
          <h1 class="text-xl font-black text-slate-900 dark:text-white">Gestión de Estudiantes</h1>
          <p class="text-slate-400 dark:text-slate-500 text-sm font-medium">Administra matrículas, estados y asignaciones escolares.</p>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4">
        <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 dark:text-indigo-400"><Users :size="20" /></div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">{{ stats.total }}</p>
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Alumnos</p>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4">
        <div class="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 dark:text-emerald-400"><UserCheck :size="20" /></div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">{{ stats.active }}</p>
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Activos</p>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4">
        <div class="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600 dark:text-amber-400"><ShieldAlert :size="20" /></div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">{{ stats.sanctioned }}</p>
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Sancionados</p>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4">
        <div class="p-2.5 bg-red-50 dark:bg-red-950/30 rounded-xl text-red-600 dark:text-red-400"><UserX :size="20" /></div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">{{ stats.expelled }}</p>
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Expulsados</p>
        </div>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="flex flex-col md:flex-row gap-4">
      <div class="relative flex-1">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" :size="18" />
        <input
          v-model="searchQuery"
          @input="fetchStudents"
          type="text"
          placeholder="Buscar por nombre, documento o código..."
          class="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold outline-none text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500/10 transition-all"
        />
      </div>
      <div class="flex gap-3">
        <select v-model="filterStatus" @change="fetchStudents" class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white">
          <option value="TODOS">Todos los Estados</option>
          <option value="ACTIVO">Activos</option>
          <option value="SANCIONADO">Sancionados</option>
          <option value="EXPULSADO">Expulsados</option>
          <option value="RETIRADO">Retirados</option>
        </select>
        <select v-model="filterGrado" @change="fetchStudents" class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white">
          <option value="">Todos los Grados</option>
          <option v-for="level in levels" :key="level.id_nivel" :value="level.id_nivel">{{ level.nombre }}</option>
        </select>
      </div>
    </div>

    <!-- List -->
    <div v-if="loading" class="h-64 flex items-center justify-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
      <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>

    <div v-else class="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
      <table class="w-full text-left">
        <thead class="bg-slate-50 dark:bg-slate-800/50">
          <tr class="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
            <th class="px-8 py-4">Estudiante</th>
            <th class="px-8 py-4">Identificación</th>
            <th class="px-8 py-4">Curso / Grupo</th>
            <th class="px-8 py-4">Estado</th>
            <th class="px-8 py-4 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50 dark:divide-slate-800">
          <tr v-for="s in students" :key="s.id_estudiante" class="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
            <td class="px-8 py-5">
              <div class="flex items-center gap-4">
                <div class="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm">
                  {{ s.nombre.charAt(0) }}{{ s.apellido.charAt(0) }}
                </div>
                <div>
                  <p class="font-black text-slate-900 dark:text-white text-sm uppercase">{{ s.nombre }} {{ s.apellido }}</p>
                  <p class="text-[10px] font-bold text-slate-400 uppercase leading-none mt-0.5">CÓD: {{ s.codigo }}</p>
                </div>
              </div>
            </td>
            <td class="px-8 py-5">
              <p class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase leading-none">{{ s.tipo_documento_nombre || 'DOC' }}</p>
              <p class="text-sm font-black text-slate-900 dark:text-white mt-1">{{ s.documento }}</p>
            </td>
            <td class="px-8 py-5">
              <div v-if="s.grado_nombre" class="flex flex-col">
                <p class="text-sm font-black text-slate-900 dark:text-white">
                  {{ s.grado_nombre }} - {{ s.seccion_nombre }}
                </p>
                <p class="text-[10px] font-bold text-indigo-500 uppercase">{{ s.nivel_nombre }}</p>
              </div>
              <span v-else class="text-[10px] font-bold text-red-400 uppercase tracking-widest italic">Sin grupo asignado</span>
            </td>
            <td class="px-8 py-5">
              <span :class="[getStatusClass(s.estado), 'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest']">
                {{ s.estado }}
              </span>
            </td>
            <td class="px-8 py-5 text-right">
              <div class="flex items-center justify-end gap-2">
                <button @click="openEditModal(s)" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all" title="Editar datos">
                  <Edit2 :size="16" />
                </button>
                <button @click="openChangeGradeModal(s)" class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-all" title="Cambiar Grado">
                  <ArrowRight :size="16" />
                </button>
                <button v-if="s.estado === 'ACTIVO'" @click="openStatusModal(s, 'SANCIONADO')" class="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-all" title="Sancionar">
                  <ShieldAlert :size="16" />
                </button>
                <button v-if="s.estado !== 'EXPULSADO'" @click="openStatusModal(s, 'EXPULSADO')" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all" title="Expulsar">
                  <UserX :size="16" />
                </button>
                <button v-if="s.estado !== 'ACTIVO' && s.estado !== 'RETIRADO'" @click="openStatusModal(s, 'ACTIVO')" class="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-all" title="Reactivar">
                  <UserCheck :size="16" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modals -->
    
    <!-- Edit Student -->
    <div v-if="studentModalOpen" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" @click="studentModalOpen = false"></div>
      <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl">
        <div class="p-8 border-b border-slate-50 dark:border-slate-800">
          <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase">{{ isEditing ? 'Editar Estudiante' : 'Nuevo Estudiante' }}</h2>
          <p class="text-slate-400 text-sm font-medium mt-1">Actualiza la información básica de la ficha del alumno.</p>
        </div>
        <div class="p-8 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombres</label>
              <input v-model="studentForm.nombre" type="text" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Apellidos</label>
              <input v-model="studentForm.apellido" type="text" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
             <div class="space-y-1">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento</label>
              <input v-model="studentForm.documento" type="text" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código</label>
              <input v-model="studentForm.codigo" type="text" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>
          <div class="flex gap-3 pt-4">
             <button @click="studentModalOpen = false" class="flex-1 py-3.5 rounded-2xl font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm uppercase tracking-widest">Cancelar</button>
             <button @click="saveStudent" class="flex-2 bg-indigo-600 text-white py-3.5 rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all text-sm uppercase tracking-widest">Guardar Cambios</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Change -->
    <div v-if="statusModalOpen" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="statusModalOpen = false"></div>
      <div class="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[28px] overflow-hidden shadow-2xl">
        <div class="p-8 text-center bg-slate-50 dark:bg-slate-800/50">
          <div :class="[newStatus === 'ACTIVO' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500', 'h-16 w-16 rounded-3xl mx-auto flex items-center justify-center mb-4']">
             <AlertCircle :size="32" />
          </div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirmar Acción</h2>
          <p class="text-slate-500 text-sm font-medium mt-2">
            ¿Estás seguro de que deseas cambiar el estado de <span class="font-black text-slate-900 dark:text-white">{{ selectedStudent.nombre }}</span> a <span class="font-black uppercase" :class="newStatus === 'ACTIVO' ? 'text-emerald-600' : 'text-red-500'">{{ newStatus }}</span>?
          </p>
        </div>
        <div class="p-8 flex gap-3">
          <button @click="statusModalOpen = false" class="flex-1 py-3 font-black text-slate-400 uppercase text-xs">Atrás</button>
          <button @click="confirmStatusChange" class="flex-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-black px-6 py-3 uppercase text-xs shadow-xl">Confirmar</button>
        </div>
      </div>
    </div>

    <!-- Change Grade -->
    <div v-if="changeGradeModalOpen" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
       <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" @click="changeGradeModalOpen = false"></div>
       <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden">
          <div class="p-8 border-b border-slate-50 dark:border-slate-800">
             <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase">Trasladar de Grado</h2>
             <p class="text-slate-400 text-sm font-medium mt-1">Mueve al estudiante a una nueva sección o nivel escolar.</p>
          </div>
          <div class="p-8 space-y-6 text-center">
            <div class="bg-indigo-50 dark:bg-indigo-950/30 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900">
               <p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Curso Actual</p>
               <p class="text-lg font-black text-indigo-900 dark:text-white">{{ selectedStudent.grado_nombre || 'SIN ASIGNAR' }} - {{ selectedStudent.seccion_nombre }}</p>
            </div>

            <div class="space-y-1 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seleccionar Nuevo Grupo</label>
              <select v-model="selectedGroup" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">Selecciona un grupo...</option>
                <option v-for="g in groups" :key="g.id_grupo" :value="g.id_grupo">
                  {{ g.tipo_grado_nombre }} {{ g.seccion_nombre }} ({{ g.jornada_nombre }}) 
                  - Cupos: {{ g.cupos_totales - g.matriculas_count }} disponibles
                </option>
              </select>
            </div>

            <div class="space-y-1 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo del Traslado (Obligatorio para notificar al padre)</label>
              <textarea 
                v-model="motivoTraslado" 
                rows="3"
                placeholder="Explica brevemente la razón del traslado..."
                class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
              ></textarea>
            </div>

            <div class="flex gap-3 pt-4">
               <button @click="changeGradeModalOpen = false" class="flex-1 py-3.5 rounded-2xl font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm uppercase tracking-widest">Cancelar</button>
               <button @click="confirmGradeChange" :disabled="!selectedGroup || !motivoTraslado.trim()" class="flex-2 bg-indigo-600 text-white py-3.5 rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition-all text-sm uppercase tracking-widest disabled:opacity-30">Aplicar Traslado</button>
            </div>
          </div>
       </div>
    </div>

  </div>
</template>
