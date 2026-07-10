<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
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
  AlertCircle,
  X,
  Eye,
  Mail,
  BookOpen,
  Activity,
  Award
} from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useNotificationStore } from '../../stores/notifications'
import { getCourseDisplayName } from '../../utils/courseHelper'

const router = useRouter()

const auth = useAuthStore()
const notify = useNotificationStore()

// --- State ---
const students = ref<any[]>([])
const loading = ref(true)
const searchQuery = ref('')
const filterStatus = ref('TODOS')
const filterNivel = ref('')
const filterGrado = ref('')
const filterJornada = ref('')

const levels = ref<any[]>([])
const groups = ref<any[]>([])
const jornadas = ref<any[]>([])
const grades = ref<any[]>([])

const filteredGrades = computed(() => {
  if (!filterNivel.value) return grades.value
  return grades.value.filter((g: any) => g.id_nivel === Number(filterNivel.value))
})

const studentModalOpen = ref(false)
const isEditing = ref(false)
const selectedStudent = ref<any>(null)

const statusModalOpen = ref(false)
const newStatus = ref('')
const statusMotivo = ref('')

const changeGradeModalOpen = ref(false)
const selectedGroup = ref('')
const motivoTraslado = ref('')

// --- Student Summary Drawer State ---
const drawerOpen = ref(false)
const selectedStudentId = ref<number | null>(null)
const studentSummary = ref<any>(null)
const loadingSummary = ref(false)

const openDrawer = async (studentId: number) => {
  selectedStudentId.value = studentId
  drawerOpen.value = true
  loadingSummary.value = true
  studentSummary.value = null
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get(`http://localhost:3000/api/student/${studentId}/summary`, { headers })
    studentSummary.value = res.data
  } catch (error) {
    console.error('Error fetching student summary:', error)
    notify.addNotification('Error al cargar el resumen del estudiante', 'error')
  } finally {
    loadingSummary.value = false
  }
}

const closeDrawer = () => {
  drawerOpen.value = false
}

const goToStudentMonitoring = () => {
  if (!studentSummary.value) return
  
  if (!studentSummary.value.id_usuario) {
    notify.addNotification('Este estudiante no tiene un usuario activo registrado, no es posible monitorear su panel.', 'error')
    return
  }

  auth.startStudentMonitoring({
    id: studentSummary.value.id_usuario,
    nombre: studentSummary.value.nombre,
    apellido: studentSummary.value.apellido,
    email: studentSummary.value.student_email || `${studentSummary.value.codigo}@academia.edu`
  })
  closeDrawer()
  router.push('/dashboard')
}

// --- Graduation State ---
const graduationModalOpen = ref(false)
const targetStudent = ref<any>(null)
const graduationDate = ref(new Date().toISOString().substring(0, 10))
const graduationObservations = ref('')
const loadingEligibility = ref(false)
const eligibilityInfo = ref<{
  gpa: number;
  failedSubjectsCount: number;
  failedSubjects: any[];
  gradeValid: boolean;
  eligible: boolean;
} | null>(null)

const openGraduationModal = async (student: any) => {
  targetStudent.value = student
  graduationDate.value = new Date().toISOString().substring(0, 10)
  graduationObservations.value = ''
  graduationModalOpen.value = true
  loadingEligibility.value = true
  eligibilityInfo.value = null
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get(`http://localhost:3000/api/student/${student.id_estudiante}/summary`, { headers })
    const summary = res.data
    const gpa = summary.gpa || 0.0
    const failedCount = summary.failed_subjects_count || 0
    const failedSubjects = summary.failed_subjects || []
    const gradeValid = student.grado_nombre === 'ONCE'
    const eligible = gradeValid && gpa >= 3.0 && failedCount === 0

    eligibilityInfo.value = {
      gpa,
      failedSubjectsCount: failedCount,
      failedSubjects,
      gradeValid,
      eligible
    }
  } catch (error) {
    console.error('Error fetching graduation eligibility:', error)
    notify.addNotification('Error al verificar requisitos de graduación', 'error')
    graduationModalOpen.value = false
  } finally {
    loadingEligibility.value = false
  }
}

const confirmGraduation = async () => {
  if (!eligibilityInfo.value?.eligible) {
    notify.addNotification('El estudiante no cumple con los requisitos para graduarse', 'warning')
    return
  }
  try {
    const directivoUserId = auth.user?.id || null
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.post(`http://localhost:3000/api/student/${targetStudent.value.id_estudiante}/graduate`, {
      fecha_graduacion: graduationDate.value,
      observaciones: graduationObservations.value,
      registrar_por: directivoUserId
    }, { headers })
    notify.addNotification(`Estudiante ${targetStudent.value.nombre} graduado exitosamente`, 'success')
    graduationModalOpen.value = false
    fetchStudents()
  } catch (error: any) {
    notify.addNotification(error.response?.data?.error || 'Error al procesar la graduación', 'error')
  }
}

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
    const headers = { Authorization: `Bearer ${auth.token}` }
    const response = await axios.get(`http://localhost:3000/api/student/colegio/${idColegio}`, {
      headers,
      params: {
        estado: filterStatus.value,
        id_nivel: filterNivel.value,
        id_tipo_grado: filterGrado.value,
        id_jornada: filterJornada.value,
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
    const headers = { Authorization: `Bearer ${auth.token}` }
    const response = await axios.get(`http://localhost:3000/api/academic-admin/grades/${idColegio}`, { headers })
    levels.value = response.data.niveles
    groups.value = response.data.grupos
    jornadas.value = response.data.jornadas || []
    grades.value = response.data.tiposGrado || []
  } catch (error) {
    console.warn('Metadata fetch failed:', error)
  }
}

const onNivelChange = () => {
  filterGrado.value = ''
  fetchStudents()
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
  graduated: students.value.filter(s => s.estado === 'GRADUADO').length,
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
      const headers = { Authorization: `Bearer ${auth.token}` }
      await axios.put(`http://localhost:3000/api/student/${selectedStudent.value.id_estudiante}`, studentForm.value, { headers })
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
  statusMotivo.value = ''
  statusModalOpen.value = true
}

const confirmStatusChange = async () => {
  if ((newStatus.value === 'SANCIONADO' || newStatus.value === 'EXPULSADO') && statusMotivo.value.trim().length < 10) {
    notify.addNotification('Debe ingresar un motivo de al menos 10 caracteres', 'error')
    return
  }

  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.patch(`http://localhost:3000/api/student/${selectedStudent.value.id_estudiante}/status`, {
      estado: newStatus.value,
      motivo: statusMotivo.value
    }, { headers })
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

    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.patch(`http://localhost:3000/api/student/${selectedStudent.value.id_estudiante}/change-grade`, {
      id_grupo: group.id_grupo,
      id_nivel: group.id_nivel,
      motivo: motivoTraslado.value
    }, { headers })
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
  if (estado === 'GRADUADO') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
  return 'bg-slate-100 text-slate-700'
}

const exportToSIMAT = () => {
  if (students.value.length === 0) return

  const headers = [
    'ID Estudiante',
    'Codigo',
    'Nombres',
    'Apellidos',
    'Tipo Documento',
    'Documento',
    'Nivel Escolar',
    'Grado',
    'Seccion',
    'Jornada',
    'Correo Estudiante',
    'Acudiente',
    'Documento Acudiente',
    'Estado'
  ]

  const rows = students.value.map(s => {
    const acudienteFull = s.acudiente_nombre 
      ? `${s.acudiente_nombre} ${s.acudiente_apellido || ''}`.trim()
      : 'No registrado'

    return [
      s.id_estudiante,
      s.codigo,
      `"${s.nombre.replace(/"/g, '""')}"`,
      `"${s.apellido.replace(/"/g, '""')}"`,
      `"${(s.tipo_documento_nombre || '').replace(/"/g, '""')}"`,
      s.documento || '',
      `"${(s.nivel_nombre || '').replace(/"/g, '""')}"`,
      `"${(s.grado_nombre || 'Sin Grado').replace(/"/g, '""')}"`,
      `"${(s.seccion_nombre || 'A').replace(/"/g, '""')}"`,
      `"${(s.jornada_nombre || 'ÚNICA').replace(/"/g, '""')}"`,
      s.email || 'Sin correo',
      `"${acudienteFull.replace(/"/g, '""')}"`,
      s.acudiente_documento || '',
      s.estado
    ]
  })

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(e => e.join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `simat_roster_colegio_${new Date().toLocaleDateString()}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
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
      <button 
        v-if="students.length > 0"
        @click="exportToSIMAT"
        class="bg-indigo-650 dark:bg-indigo-600 hover:bg-indigo-750 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-md transition-all active:scale-95 text-sm shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Exportar SIMAT (CSV)
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
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
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex items-center gap-4">
        <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-650 dark:text-indigo-400"><Award :size="20" /></div>
        <div>
          <p class="text-2xl font-black text-slate-900 dark:text-white">{{ stats.graduated }}</p>
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-widest">Graduados</p>
        </div>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="flex flex-col lg:flex-row gap-4">
      <div class="relative flex-1">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" :size="18" />
        <input
          v-model="searchQuery"
          @input="fetchStudents"
          type="text"
          placeholder="Buscar por nombre, documento, código o grado (ej. 6-A)..."
          class="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold outline-none text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-indigo-500/10 transition-all"
        />
      </div>
      <div class="flex flex-wrap gap-3">
        <select v-model="filterStatus" @change="fetchStudents" class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white">
          <option value="TODOS">Todos los Estados</option>
          <option value="ACTIVO">Activos</option>
          <option value="SANCIONADO">Sancionados</option>
          <option value="EXPULSADO">Expulsados</option>
          <option value="RETIRADO">Retirados</option>
          <option value="GRADUADO">Graduados</option>
        </select>
        <select v-model="filterNivel" @change="onNivelChange" class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white">
          <option value="">Todos los Niveles</option>
          <option v-for="level in levels" :key="level.id_nivel" :value="level.id_nivel">{{ level.nombre }}</option>
        </select>
        <select v-model="filterGrado" @change="fetchStudents" class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white">
          <option value="">Todos los Grados</option>
          <option v-for="g in filteredGrades" :key="g.id_tipo_grado" :value="g.id_tipo_grado">{{ g.nombre }}</option>
        </select>
        <select v-model="filterJornada" @change="fetchStudents" class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-5 py-2 text-sm font-bold outline-none text-slate-900 dark:text-white">
          <option value="">Todas las Jornadas</option>
          <option v-for="j in jornadas" :key="j.id_jornada" :value="j.id_jornada">{{ j.nombre }}</option>
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
            <td class="px-8 py-5 cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 rounded-l-2xl transition-all" @click="openDrawer(s.id_estudiante)">
              <div class="flex items-center gap-4">
                <div class="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm">
                  {{ s.nombre.charAt(0) }}{{ s.apellido.charAt(0) }}
                </div>
                <div>
                  <p class="font-black text-slate-900 dark:text-white text-sm uppercase group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{{ s.nombre }} {{ s.apellido }}</p>
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
                  {{ getCourseDisplayName({ grado_nombre: s.grado_nombre, seccion_nombre: s.seccion_nombre || '' }) }}
                </p>
                <p class="text-[10px] font-bold text-indigo-500 uppercase">{{ s.nivel_nombre }}</p>
              </div>
              <span v-else class="text-[10px] font-bold text-red-400 uppercase tracking-widest italic">Sin grupo asignado</span>
            </td>
            <td class="px-8 py-5">
              <span :class="[getStatusClass(s.estado), 'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest block w-fit']">
                {{ s.estado }}
              </span>
              <p v-if="s.motivo_estado" class="text-[10px] text-red-500 dark:text-red-400 font-semibold italic mt-1 max-w-[200px] leading-tight" :title="s.motivo_estado">
                {{ s.motivo_estado }}
              </p>
            </td>
            <td class="px-8 py-5 text-right">
              <div class="flex items-center justify-end gap-2">
                <button @click="openEditModal(s)" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all" title="Editar datos">
                  <Edit2 :size="16" />
                </button>
                <button v-if="s.estado !== 'GRADUADO'" @click="openChangeGradeModal(s)" class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-all" title="Cambiar Grado">
                  <ArrowRight :size="16" />
                </button>
                <button v-if="s.estado === 'ACTIVO' && s.grado_nombre === 'ONCE'" @click="openGraduationModal(s)" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all" title="Graduar Estudiante">
                  <Award :size="16" />
                </button>
                <button v-if="s.estado === 'ACTIVO'" @click="openStatusModal(s, 'SANCIONADO')" class="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-all" title="Sancionar">
                  <ShieldAlert :size="16" />
                </button>
                <button v-if="s.estado !== 'EXPULSADO' && s.estado !== 'GRADUADO'" @click="openStatusModal(s, 'EXPULSADO')" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all" title="Expulsar">
                  <UserX :size="16" />
                </button>
                <button v-if="s.estado !== 'ACTIVO' && s.estado !== 'RETIRADO' && s.estado !== 'GRADUADO'" @click="openStatusModal(s, 'ACTIVO')" class="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-all" title="Reactivar">
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
      <div class="relative w-full bg-white dark:bg-slate-900 rounded-[28px] overflow-hidden shadow-2xl transition-all" :class="newStatus === 'SANCIONADO' || newStatus === 'EXPULSADO' ? 'max-w-md' : 'max-w-sm'">
        <div class="p-8 text-center bg-slate-50 dark:bg-slate-800/50">
          <div :class="[newStatus === 'ACTIVO' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500', 'h-16 w-16 rounded-3xl mx-auto flex items-center justify-center mb-4']">
             <AlertCircle :size="32" />
          </div>
          <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Confirmar Acción</h2>
          <p class="text-slate-500 text-sm font-medium mt-2">
            ¿Estás seguro de que deseas cambiar el estado de <span class="font-black text-slate-900 dark:text-white">{{ selectedStudent.nombre }}</span> a <span class="font-black uppercase" :class="newStatus === 'ACTIVO' ? 'text-emerald-600' : 'text-red-500'">{{ newStatus }}</span>?
          </p>

          <!-- Reason Input for Sanction/Expulsion -->
          <div v-if="newStatus === 'SANCIONADO' || newStatus === 'EXPULSADO'" class="mt-5 text-left">
            <label class="block text-slate-500 text-xs font-black uppercase tracking-wider mb-2">Motivo del Cambio de Estado <span class="text-red-500">*</span></label>
            <textarea 
              v-model="statusMotivo" 
              rows="3" 
              placeholder="Describa el motivo detalladamente (mínimo 10 caracteres)..."
              class="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm font-medium outline-none text-slate-900 dark:text-white focus:border-indigo-500 transition-all resize-none"
            ></textarea>
            <div class="flex justify-between items-center mt-1">
              <span class="text-[10px] text-slate-400 font-bold">Mínimo 10 caracteres</span>
              <span class="text-[10px] font-black" :class="statusMotivo.trim().length >= 10 ? 'text-emerald-500' : 'text-slate-400'">{{ statusMotivo.trim().length }}/10</span>
            </div>
          </div>
        </div>
        <div class="p-8 flex gap-3">
          <button @click="statusModalOpen = false" class="flex-1 py-3 font-black text-slate-400 uppercase text-xs">Atrás</button>
          <button 
            @click="confirmStatusChange" 
            :disabled="(newStatus === 'SANCIONADO' || newStatus === 'EXPULSADO') && statusMotivo.trim().length < 10"
            :class="[(newStatus === 'SANCIONADO' || newStatus === 'EXPULSADO') && statusMotivo.trim().length < 10 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800 dark:hover:bg-indigo-750']"
            class="flex-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-black px-6 py-3 uppercase text-xs shadow-xl transition-all"
          >Confirmar</button>
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
               <p class="text-lg font-black text-indigo-900 dark:text-white">{{ selectedStudent.grado_nombre ? getCourseDisplayName({ grado_nombre: selectedStudent.grado_nombre, seccion_nombre: selectedStudent.seccion_nombre || '' }) : 'SIN ASIGNAR' }}</p>
            </div>

            <div class="space-y-1 text-left">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seleccionar Nuevo Grupo</label>
              <select v-model="selectedGroup" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">Selecciona un grupo...</option>
                <option v-for="g in groups" :key="g.id_grupo" :value="g.id_grupo">
                  {{ getCourseDisplayName({ tipo_grado_nombre: g.tipo_grado_nombre, seccion_nombre: g.seccion_nombre }) }} ({{ g.jornada_nombre }}) 
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

    <!-- Graduation Modal -->
    <div v-if="graduationModalOpen" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" @click="graduationModalOpen = false"></div>
      <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center gap-3 shrink-0">
          <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Award :size="24" />
          </div>
          <div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase">Registrar Graduación</h2>
            <p class="text-slate-400 text-sm font-medium mt-1">Verifica requisitos y registra la graduación del alumno.</p>
          </div>
        </div>

        <!-- Loading eligibility -->
        <div v-if="loadingEligibility" class="p-8 flex flex-col items-center justify-center gap-3 shrink-0">
          <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Verificando requisitos académicos...</p>
        </div>

        <template v-else-if="eligibilityInfo">
          <!-- Scrollable body -->
          <div class="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6">
            <!-- Student Banner -->
            <div class="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estudiante</p>
              <p class="text-lg font-black text-slate-900 dark:text-white uppercase">{{ targetStudent.nombre }} {{ targetStudent.apellido }}</p>
              <p class="text-xs text-indigo-500 font-bold mt-1">CÓDIGO: {{ targetStudent.codigo }}</p>
            </div>

            <!-- Requirements Checklist -->
            <div class="space-y-3">
              <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Requisitos Institucionales</h3>
              
              <div class="space-y-2">
                <!-- Check 1: Grade Once -->
                <div class="flex items-center justify-between p-3.5 rounded-xl border" :class="eligibilityInfo.gradeValid ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-400' : 'bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/50 text-red-900 dark:text-red-400'">
                  <span class="text-sm font-bold">Grado Undécimo (ONCE)</span>
                  <span class="text-xs font-black uppercase tracking-wider">{{ eligibilityInfo.gradeValid ? 'SÍ (ONCE)' : 'NO (' + (targetStudent.grado_nombre || 'Sin Grado') + ')' }}</span>
                </div>

                <!-- Check 2: GPA >= 3.0 -->
                <div class="flex items-center justify-between p-3.5 rounded-xl border" :class="eligibilityInfo.gpa >= 3.0 ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-400' : 'bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/50 text-red-900 dark:text-red-400'">
                  <span class="text-sm font-bold">Promedio General (GPA &ge; 3.0)</span>
                  <span class="text-xs font-black uppercase tracking-wider">PROMEDIO: {{ eligibilityInfo.gpa.toFixed(2) }}</span>
                </div>

                <!-- Check 3: Failed subjects === 0 -->
                <div class="flex items-center justify-between p-3.5 rounded-xl border" :class="eligibilityInfo.failedSubjectsCount === 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-400' : 'bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/50 text-red-900 dark:text-red-400'">
                  <span class="text-sm font-bold">Materias Reprobadas (0)</span>
                  <span class="text-xs font-black uppercase tracking-wider">{{ eligibilityInfo.failedSubjectsCount }} REPROBADAS</span>
                </div>
              </div>

              <!-- List of failed subjects if any -->
              <div v-if="eligibilityInfo.failedSubjectsCount > 0" class="p-4 bg-red-50 dark:bg-red-950/10 border border-red-100 dark:border-red-950/40 rounded-2xl space-y-1.5">
                <p class="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">Materias por Aprobar:</p>
                <div class="text-xs font-bold text-red-700 dark:text-red-300 max-h-24 overflow-y-auto custom-scrollbar">
                  <div v-for="sub in eligibilityInfo.failedSubjects" :key="sub.id_materia">
                    • {{ sub.materia }} (Nota: {{ sub.calificacion }})
                  </div>
                </div>
              </div>
            </div>

            <!-- Eligibility Warning / Graduation Fields -->
            <div v-if="!eligibilityInfo.eligible" class="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-2xl flex items-start gap-2.5">
              <AlertCircle :size="20" class="text-amber-500 shrink-0 mt-0.5" />
              <p class="text-xs text-amber-700 dark:text-amber-400 font-bold leading-relaxed">
                El estudiante no cumple con las condiciones para graduarse. Asegúrate de que pertenezca al grado undécimo y no tenga materias reprobadas en el periodo actual.
              </p>
            </div>

            <div v-else class="space-y-4 pt-2">
              <div class="grid grid-cols-1 gap-4">
                <div class="space-y-1">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Graduación</label>
                  <input v-model="graduationDate" type="date" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones / Mención (Opcional)</label>
                  <textarea v-model="graduationObservations" rows="3" placeholder="Ej. Graduado con mención de honor por excelencia académica..." class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"></textarea>
                </div>
              </div>
            </div>
          </div>

          <!-- Fixed Footer -->
          <div class="p-6 border-t border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-3 shrink-0">
            <button @click="graduationModalOpen = false" class="flex-1 py-3.5 rounded-2xl font-black text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm uppercase tracking-widest">Atrás</button>
            <button @click="confirmGraduation" :disabled="!eligibilityInfo.eligible" class="flex-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-500 text-white py-3.5 rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none transition-all text-sm uppercase tracking-widest disabled:shadow-none disabled:cursor-not-allowed">Confirmar Graduación</button>
          </div>
        </template>
      </div>
    </div>

  </div>

  <!-- Student Summary Slide-Over Drawer -->
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="drawerOpen" class="fixed inset-0 z-[400] bg-slate-950/40 backdrop-blur-sm" @click="closeDrawer"></div>
    </Transition>

    <Transition name="drawer-slide">
      <div v-if="drawerOpen" class="fixed inset-y-0 right-0 z-[450] w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-100 dark:border-slate-800/60 overflow-hidden">
        <!-- Drawer Header -->
        <div class="p-6 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users :size="20" />
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Ficha Resumen</h3>
              <p class="text-xs text-slate-400 font-medium">Información y seguimiento académico consolidado.</p>
            </div>
          </div>
          <button @click="closeDrawer" class="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all">
            <X :size="20" />
          </button>
        </div>

        <!-- Drawer Content -->
        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <!-- Loading Indicator -->
          <div v-if="loadingSummary" class="h-64 flex flex-col items-center justify-center gap-3">
            <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando datos...</p>
          </div>

          <!-- Summary Data -->
          <div v-else-if="studentSummary" class="space-y-6">
            
            <!-- Student Profile Card -->
            <div class="bg-gradient-to-br from-indigo-50/50 to-white dark:from-slate-800/30 dark:to-slate-900 border border-indigo-100/50 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden">
              <div class="absolute -right-6 -bottom-6 text-indigo-100 dark:text-slate-800 opacity-20 pointer-events-none">
                <GraduationCap :size="120" />
              </div>
              <div class="flex items-start gap-4">
                <div class="h-14 w-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200 dark:shadow-none">
                  {{ studentSummary.nombre.charAt(0) }}{{ studentSummary.apellido.charAt(0) }}
                </div>
                <div class="space-y-1">
                  <h4 class="text-base font-black text-slate-900 dark:text-white uppercase leading-tight">
                    {{ studentSummary.nombre_completo }}
                  </h4>
                  <p class="text-xs font-bold text-slate-400">CÓDIGO: {{ studentSummary.codigo }}</p>
                  <p class="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-1 uppercase tracking-wide">
                    Curso: {{ studentSummary.curso }}
                  </p>
                </div>
              </div>

              <div class="mt-6 flex flex-wrap gap-2">
                <!-- Status Badge -->
                <span :class="[
                  studentSummary.estado_estudiante === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 
                  studentSummary.estado_estudiante === 'GRADUADO' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400' : 
                  'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
                  'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider'
                ]">
                  Ficha: {{ studentSummary.estado_estudiante }}
                </span>

                <!-- Academic State Badge -->
                <span :class="[
                  studentSummary.estado_academico === 'Normal' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 
                  studentSummary.estado_academico === 'En riesgo' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 
                  'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
                  'px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider'
                ]">
                  Académico: {{ studentSummary.estado_academico }}
                </span>
              </div>
            </div>

            <!-- Graduation Info Card -->
            <div v-if="studentSummary.estado_estudiante === 'GRADUADO' && studentSummary.graduation" class="bg-gradient-to-br from-indigo-50 to-indigo-100/30 dark:from-slate-900 dark:to-indigo-950/20 border-2 border-indigo-200/50 dark:border-indigo-950/60 rounded-3xl p-5 space-y-3 relative overflow-hidden">
              <div class="absolute -right-4 -bottom-4 text-indigo-200 dark:text-indigo-900 opacity-20 pointer-events-none">
                <Award :size="80" />
              </div>
              <h4 class="text-[10px] font-black text-indigo-600 dark:text-indigo-450 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <Award :size="16" />
                Información de Graduación
              </h4>
              <div class="space-y-1">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Fecha de Grado</span>
                <p class="text-sm font-black text-slate-850 dark:text-slate-200">
                  {{ new Date(studentSummary.graduation.fecha_graduacion).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) }}
                </p>
              </div>
              <div v-if="studentSummary.graduation.observaciones" class="space-y-1 pt-1.5 border-t border-indigo-200/20">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Observaciones / Distinción</span>
                <p class="text-xs font-bold text-slate-750 dark:text-slate-350 italic leading-relaxed">
                  "{{ studentSummary.graduation.observaciones }}"
                </p>
              </div>
            </div>

            <!-- Sanction/Expulsion Info Card -->
            <div v-if="(studentSummary.estado_estudiante === 'SANCIONADO' || studentSummary.estado_estudiante === 'EXPULSADO') && studentSummary.motivo_estado" class="bg-gradient-to-br from-red-50 to-red-100/30 dark:from-slate-900 dark:to-red-950/20 border-2 border-red-200/50 dark:border-red-950/60 rounded-3xl p-5 space-y-3 relative overflow-hidden">
              <div class="absolute -right-4 -bottom-4 text-red-200 dark:text-red-900 opacity-20 pointer-events-none">
                <AlertCircle :size="80" />
              </div>
              <h4 class="text-[10px] font-black text-red-600 dark:text-red-450 uppercase tracking-widest flex items-center gap-1.5 leading-none">
                <AlertCircle :size="16" />
                Motivo de {{ studentSummary.estado_estudiante === 'SANCIONADO' ? 'Sanción' : 'Expulsión' }}
              </h4>
              <div class="space-y-1">
                <p class="text-xs font-semibold text-slate-750 dark:text-slate-350 italic leading-relaxed">
                  "{{ studentSummary.motivo_estado }}"
                </p>
              </div>
            </div>

            <!-- Key Metrics Grid -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Promedio General</span>
                <span class="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
                  {{ studentSummary.gpa || '0.0' }}
                </span>
              </div>
              <div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Materias Reprobadas</span>
                <span class="text-2xl font-black mt-1 block" :class="studentSummary.failed_subjects_count > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'">
                  {{ studentSummary.failed_subjects_count }}
                </span>
              </div>
              <div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Inasistencias</span>
                <span class="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                  {{ studentSummary.total_inasistencias }}
                </span>
              </div>
              <div class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Observaciones Conv.</span>
                <span class="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                  {{ studentSummary.total_disciplinarias }}
                </span>
              </div>
            </div>

            <!-- Failed Subjects List -->
            <div v-if="studentSummary.failed_subjects && studentSummary.failed_subjects.length > 0" class="space-y-3">
              <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <BookOpen :size="14" class="text-red-400" />
                Materias Reprobadas ({{ studentSummary.failed_subjects.length }})
              </h4>
              <div class="space-y-2">
                <div v-for="sub in studentSummary.failed_subjects" :key="sub.id_materia" class="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-950/40 rounded-2xl p-3.5 flex justify-between items-center">
                  <span class="text-sm font-black text-red-900 dark:text-red-300">
                    ❌ {{ sub.materia }}
                  </span>
                  <span class="text-sm font-black text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-950/40 px-2.5 py-0.5 rounded-lg">
                    {{ sub.calificacion }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Parent Info -->
            <div class="space-y-3">
              <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contacto de Acudiente</h4>
              <div v-if="studentSummary.parent" class="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/80 space-y-2">
                <p class="text-sm font-black text-slate-900 dark:text-white uppercase leading-none">
                  {{ studentSummary.parent.nombre }}
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-2">
                  <Mail :size="14" /> {{ studentSummary.parent.email }}
                </p>
              </div>
              <div v-else class="text-xs italic text-slate-400 p-4 border border-dashed rounded-3xl text-center">
                Sin información de acudiente asociada.
              </div>
            </div>

            <!-- System Activity -->
            <div class="space-y-3">
              <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actividad en el Sistema</h4>
              <div class="bg-slate-50 dark:bg-slate-800/40 rounded-3xl p-5 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Activity :size="14" /> Última actividad
                </span>
                <span class="text-xs font-black text-slate-900 dark:text-white uppercase">
                  {{ studentSummary.ultima_actividad }}
                </span>
              </div>
            </div>

          </div>
        </div>

        <!-- Drawer Footer (Deep Tracking Button) -->
        <div v-if="studentSummary && !loadingSummary" class="p-6 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900">
          <button 
            @click="goToStudentMonitoring"
            class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
          >
            <Eye :size="16" />
            Ver Seguimiento Completo
          </button>
          <p class="text-[10px] text-center text-slate-400 font-bold mt-2">
            Ingresa al panel del estudiante en modo de solo lectura.
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}

.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
</style>
