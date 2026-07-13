<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { BookOpen, Plus, Trash2, Search, Info, Layers, GraduationCap, X, Edit, Calendar, PlusCircle } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { getCourseDisplayName } from '../../utils/courseHelper'

interface SubjectItem {
  id_materia: number
  nombre: string
  asignaciones_count: number
  competencias_count: number
}

interface TrashItem {
  id_papelera: number
  nombre_materia: string
  data_respaldo: any
  fecha_borrado: string
}

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))

const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const subjects = ref<SubjectItem[]>([])
const trashSubjects = ref<TrashItem[]>([])
const searchTerm = ref('')
const createModalOpen = ref(false)
const deleteModal = ref<SubjectItem | null>(null)
const showForceButton = ref(false)
const impactDetails = ref<any>(null)
const selectedTrashItem = ref<TrashItem | null>(null)
const reuseFromTrash = ref<TrashItem | null>(null)

const newSubject = ref({
  nombre: ''
})

const filteredSubjects = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return subjects.value
  return subjects.value.filter(s => s.nombre.toLowerCase().includes(term))
})

const loadSubjects = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const [subRes, trashRes] = await Promise.all([
      axios.get(`http://localhost:3000/api/academic-admin/subjects/${schoolId.value}`),
      axios.get(`http://localhost:3000/api/academic-admin/subjects/trash/${schoolId.value}`)
    ])
    subjects.value = subRes.data
    trashSubjects.value = trashRes.data
  } catch (error) {
    console.error('Error loading subjects:', error)
  } finally {
    loading.value = false
  }
}

const createSubject = async () => {
  if (saving.value) return
  if (!newSubject.value.nombre.trim()) {
    alert('Escribe el nombre de la materia antes de crearla.')
    return
  }

  try {
    saving.value = true
    await axios.post('http://localhost:3000/api/academic-admin/subjects', {
      schoolId: schoolId.value,
      nombre: newSubject.value.nombre,
      trashId: reuseFromTrash.value?.id_papelera || null
    })
    newSubject.value.nombre = ''
    reuseFromTrash.value = null
    createModalOpen.value = false
    await loadSubjects()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al crear la materia')
  } finally {
    saving.value = false
  }
}
const handleTrashSelection = () => {
  if (reuseFromTrash.value) {
    newSubject.value.nombre = reuseFromTrash.value.nombre_materia
  }
}

const generateAndDownloadReport = (data: any) => {
  const { subjectName, timestamp, details } = data
  let content = `# Reporte de Impacto: Eliminación de Materia\n\n`
  content += `- **Materia eliminada:** ${subjectName}\n`
  content += `- **Fecha y hora:** ${new Date(timestamp).toLocaleString()}\n\n`
  content += `--- \n\n`
  content += `## Resumen de Datos Eliminados\n\n`
  content += `- **Asignaciones docentes:** ${details.asignaciones?.length || 0}\n`
  content += `- **Competencias académicas:** ${details.competencias?.length || 0}\n`
  content += `- **Actividades evaluativas:** ${details.actividades_count || 0}\n`
  content += `- **Calificaciones registradas:** ${details.notas_count || 0}\n\n`

  if (details.asignaciones?.length > 0) {
    content += `### Detalle de Asignaciones\n\n`
    content += `| Docente | Curso | Jornada |\n`
    content += `| :--- | :--- | :--- |\n`
    details.asignaciones.forEach((a: any) => {
      content += `| ${a.docente_nombre} | ${a.grado} ${a.seccion} | ${a.jornada} |\n`
    })
    content += `\n`
  }

  if (details.competencias?.length > 0) {
    content += `### Detalle de Competencias\n\n`
    details.competencias.forEach((c: any) => {
      content += `- **${c.periodo} (${c.grado}):** ${c.descripcion}\n`
    })
    content += `\n`
  }

  content += `\n> Este documento sirve como respaldo de la información eliminada permanentemente del sistema.\n`

  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Reporte_Eliminacion_${subjectName.replace(/\s+/g, '_')}.md`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const confirmDelete = async (item: SubjectItem, force = false) => {
  try {
    deleting.value = true
    const response = await axios.delete(`http://localhost:3000/api/academic-admin/subjects/${item.id_materia}`, {
      params: { 
        schoolId: schoolId.value,
        force: force ? 'true' : 'false'
      },
    })
    
    if (force && response.data.report) {
      generateAndDownloadReport(response.data.report)
    }

    deleteModal.value = null
    showForceButton.value = false
    impactDetails.value = null
    await loadSubjects()
  } catch (error: any) {
    if (error.response?.status === 409) {
      showForceButton.value = true
      impactDetails.value = error.response.data.impact
    } else {
      alert(error.response?.data?.error || 'No fue posible eliminar la materia')
    }
  } finally {
    deleting.value = false
  }
}

// ─── Curriculum Detail State & Methods ───────────────────────────────────────
const detailDrawerOpen = ref(false)
const detailLoading = ref(false)
const selectedSubjectId = ref<number | null>(null)
const subjectDetails = ref<any>(null)
const activeTab = ref('curriculum') // 'curriculum' | 'teachers'

// Filters for curriculum
const selectedPeriodId = ref<number | null>(null)

const filteredCompetencies = computed(() => {
  if (!subjectDetails.value?.competencies || !selectedPeriodId.value) return []
  return subjectDetails.value.competencies.filter((c: any) => c.id_periodo === selectedPeriodId.value)
})

// Forms for adding/editing competencies and evidences
const showCompetencyModal = ref(false)
const competencyForm = ref({
  id_competencia: null as number | null,
  id_grupo: null as number | null,
  id_periodo: null as number | null,
  descripcion: ''
})
const savingCompetency = ref(false)

const showEvidenceModal = ref(false)
const evidenceForm = ref({
  id_evidencia: null as number | null,
  id_competencia: null as number | null,
  descripcion: ''
})
const savingEvidence = ref(false)

const openSubjectDetails = async (id: number) => {
  selectedSubjectId.value = id
  detailDrawerOpen.value = true
  await fetchSubjectDetails()
}

const fetchSubjectDetails = async () => {
  if (!selectedSubjectId.value || !schoolId.value) return
  try {
    detailLoading.value = true
    const response = await axios.get(`http://localhost:3000/api/academic-admin/subjects/${selectedSubjectId.value}/curriculum-details`, {
      params: { schoolId: schoolId.value }
    })
    subjectDetails.value = response.data
    
    // Set default filter period if not set
    if (response.data.periods?.length > 0 && !selectedPeriodId.value) {
      const openPeriod = response.data.periods.find((p: any) => p.estado === 'ABIERTO')
      selectedPeriodId.value = openPeriod ? openPeriod.id_periodo : response.data.periods[0].id_periodo
    }
  } catch (error) {
    console.error('Error fetching subject details:', error)
    alert('Error al cargar los detalles de la asignatura.')
    detailDrawerOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

// COMPETENCIES
const openAddCompetency = () => {
  competencyForm.value = {
    id_competencia: null,
    id_grupo: subjectDetails.value.groups?.[0]?.id_grupo || null,
    id_periodo: selectedPeriodId.value || subjectDetails.value.periods?.[0]?.id_periodo || null,
    descripcion: ''
  }
  showCompetencyModal.value = true
}

const openEditCompetency = (comp: any) => {
  competencyForm.value = {
    id_competencia: comp.id_competencia,
    id_grupo: comp.id_grupo,
    id_periodo: comp.id_periodo,
    descripcion: comp.descripcion
  }
  showCompetencyModal.value = true
}

const saveCompetency = async () => {
  if (!competencyForm.value.descripcion.trim()) {
    alert('Escribe la descripción de la competencia.')
    return
  }
  try {
    savingCompetency.value = true
    await axios.post('http://localhost:3000/api/academic-admin/settings/competencies', {
      schoolId: schoolId.value,
      groupId: competencyForm.value.id_grupo,
      subjectId: selectedSubjectId.value,
      periodId: competencyForm.value.id_periodo,
      descripcion: competencyForm.value.descripcion.trim()
    })
    showCompetencyModal.value = false
    await fetchSubjectDetails()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al guardar la competencia')
  } finally {
    savingCompetency.value = false
  }
}

const deleteCompetency = async (id: number) => {
  if (!confirm('¿Estás seguro de que deseas eliminar esta competencia? Se eliminarán todas sus evidencias y notas asociadas.')) return
  try {
    await axios.delete(`http://localhost:3000/api/academic-admin/settings/competencies/${id}`, {
      params: { schoolId: schoolId.value }
    })
    await fetchSubjectDetails()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al eliminar la competencia')
  }
}

// EVIDENCES
const openAddEvidence = (competenciaId: number) => {
  evidenceForm.value = {
    id_evidencia: null,
    id_competencia: competenciaId,
    descripcion: ''
  }
  showEvidenceModal.value = true
}

const openEditEvidence = (ev: any) => {
  evidenceForm.value = {
    id_evidencia: ev.id_evidencia,
    id_competencia: ev.id_competencia,
    descripcion: ev.descripcion
  }
  showEvidenceModal.value = true
}

const saveEvidence = async () => {
  if (!evidenceForm.value.descripcion.trim()) {
    alert('Escribe la descripción de la evidencia.')
    return
  }
  try {
    savingEvidence.value = true
    if (evidenceForm.value.id_evidencia) {
      await axios.put(`http://localhost:3000/api/academic-admin/settings/evidencias/${evidenceForm.value.id_evidencia}`, {
        schoolId: schoolId.value,
        descripcion: evidenceForm.value.descripcion.trim()
      })
    } else {
      await axios.post(`http://localhost:3000/api/academic-admin/settings/competencies/${evidenceForm.value.id_competencia}/evidencias`, {
        schoolId: schoolId.value,
        descripcion: evidenceForm.value.descripcion.trim()
      })
    }
    showEvidenceModal.value = false
    await fetchSubjectDetails()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al guardar la evidencia')
  } finally {
    savingEvidence.value = false
  }
}

const deleteEvidence = async (id: number) => {
  if (!confirm('¿Estás seguro de que deseas eliminar esta evidencia?')) return
  try {
    await axios.delete(`http://localhost:3000/api/academic-admin/settings/evidencias/${id}`, {
      params: { schoolId: schoolId.value }
    })
    await fetchSubjectDetails()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al eliminar la evidencia')
  }
}

onMounted(loadSubjects)
</script>

<template>
  <div class="max-w-[1200px] mx-auto space-y-6">
    <!-- Modern Header -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
            <BookOpen :size="32" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Gestión de Materias</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Administra el catálogo global de asignaturas institucionales.</p>
          </div>
        </div>
        
        <button @click="createModalOpen = true" class="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none whitespace-nowrap">
          <Plus :size="20" />
          Nueva Materia
        </button>
      </div>
    </div>

    <!-- Stats & Search Bar -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="md:col-span-3 relative">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" :size="18" />
        <input 
          v-model="searchTerm" 
          type="text" 
          placeholder="Buscar materia por nombre..."
          class="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold outline-none text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-emerald-500/10 transition-all"
        />
      </div>
      <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex items-center justify-between shadow-sm">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400">
            <Layers :size="16" />
          </div>
          <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Total</span>
        </div>
        <span class="text-xl font-black text-slate-900 dark:text-white">{{ subjects.length }}</span>
      </div>
    </div>

    <!-- Subjects Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-if="loading" class="col-span-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-16 text-center text-slate-400 font-bold">
        Cargando catálogo...
      </div>
      
      <template v-else>
        <div v-if="filteredSubjects.length === 0" class="col-span-full h-64 flex flex-col items-center justify-center text-slate-400">
          <Search :size="48" class="mb-4 opacity-20" />
          <p class="font-bold">No se encontraron materias</p>
        </div>

        <div 
          v-for="item in filteredSubjects" 
          :key="item.id_materia"
          class="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-900 cursor-pointer transition-all flex flex-col justify-between"
          @click="openSubjectDetails(item.id_materia)"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center rounded-xl font-black text-sm">
                {{ item.nombre.charAt(0).toUpperCase() }}
              </div>
              <h4 class="font-black text-slate-800 dark:text-white text-lg truncate max-w-[150px]">{{ item.nombre }}</h4>
            </div>
            <button @click.stop="deleteModal = item" class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all">
              <Trash2 :size="18" />
            </button>
          </div>

          <div class="flex items-center gap-4 mt-2">
            <div class="flex-1 flex flex-col">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Asignaciones</span>
              <div class="flex items-center gap-1.5 mt-1">
                <GraduationCap :size="14" class="text-indigo-400" />
                <span class="text-sm font-black text-slate-700 dark:text-slate-300">{{ item.asignaciones_count }}</span>
              </div>
            </div>
            <div class="flex-1 flex flex-col border-l border-slate-50 dark:border-slate-800 pl-4">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Competencias</span>
              <div class="flex items-center gap-1.5 mt-1">
                <Info :size="14" class="text-amber-400" />
                <span class="text-sm font-black text-slate-700 dark:text-slate-300">{{ item.competencias_count }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Subjects Trash (Phantom Subjects) -->
    <div v-if="trashSubjects.length > 0" class="mt-12 space-y-4">
      <div class="flex items-center justify-between px-2">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-red-100 dark:bg-red-950/30 text-red-600 rounded-xl">
            <Trash2 :size="20" />
          </div>
          <h3 class="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">Papelera de Materias (Materias Fantasma)</h3>
        </div>
        <span class="text-xs font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{{ trashSubjects.length }} BORRADAS</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div 
          v-for="item in trashSubjects" 
          :key="item.id_papelera"
          @click="selectedTrashItem = item"
          class="group bg-red-50/50 dark:bg-red-950/10 p-5 rounded-2xl border-2 border-dashed border-red-100 dark:border-red-900/30 hover:border-red-500/40 transition-all cursor-pointer flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center rounded-xl font-black text-sm">
              <Info :size="18" />
            </div>
            <div>
              <h4 class="font-black text-red-700 dark:text-red-400 text-lg leading-tight">{{ item.nombre_materia }}</h4>
              <p class="text-[10px] font-bold text-red-400 uppercase">Borrada el {{ new Date(item.fecha_borrado).toLocaleDateString() }}</p>
            </div>
          </div>
          <div class="p-2 text-red-300 group-hover:text-red-500">
            <Search :size="18" />
          </div>
        </div>
      </div>
    </div>

    <!-- Info Banner -->
    <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-3xl flex items-start gap-4 border border-emerald-100/50 dark:border-emerald-900/50">
      <div class="p-2 bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-xl">
        <Info :size="20" />
      </div>
      <p class="text-emerald-700/80 dark:text-emerald-400/80 text-sm font-medium leading-relaxed">
        Las materias creadas aquí forman el catálogo global de la escuela. Luego podrás asignarlas a diferentes cursos y docentes desde el módulo de "Docentes" o "Mis Cursos".
      </p>
    </div>

    <!-- Modals (Teleported) -->
    <Teleport to="body">
      <!-- Create Modal -->
      <div v-if="createModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="createModalOpen = false"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-white/20">
          <div class="px-8 pt-8 pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <Plus :size="24" class="text-emerald-600" />
              Nueva Materia
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Define el nombre de la asignatura para el catálogo.</p>
          </div>

          <div class="p-8 space-y-6">
            <div class="space-y-4">
              <div v-if="trashSubjects.length > 0" class="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100/50">
                <label class="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 block">¿Restaurar desde papelera?</label>
                <select 
                  v-model="reuseFromTrash" 
                  @change="handleTrashSelection"
                  class="w-full bg-white dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold outline-none"
                >
                  <option :value="null">-- Crear Nueva --</option>
                  <option v-for="t in trashSubjects" :key="t.id_papelera" :value="t">
                    {{ t.nombre_materia }} (Borrada {{ new Date(t.fecha_borrado).toLocaleDateString() }})
                  </option>
                </select>
                <p v-if="reuseFromTrash" class="text-[10px] font-bold text-amber-500 mt-2 italic">Esto heredará el nombre de la materia fantasma.</p>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nombre de la Materia</label>
                <input 
                  v-model="newSubject.nombre" 
                  type="text" 
                  placeholder="Ej. Física Teórica" 
                  class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400" 
                />
              </div>
            </div>

            <div class="flex gap-3 pt-2">
              <button @click="createModalOpen = false; reuseFromTrash = null" class="flex-1 px-6 py-4 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
              <button @click="createSubject" :disabled="saving" class="flex-[2] bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-slate-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-0 transition-all disabled:opacity-50">
                {{ saving ? (reuseFromTrash ? 'Restaurando...' : 'Registrando...') : (reuseFromTrash ? 'Restaurar Materia' : 'Confirmar Registro') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete Modal -->
      <div v-if="deleteModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-red-950/30 backdrop-blur-md" @click="deleteModal = null; showForceButton = false"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl">
          <div class="p-8 text-center">
            <div class="w-16 h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 :size="32" />
            </div>
            <h2 class="text-xl font-black text-slate-900 dark:text-white">
              {{ showForceButton ? '¿Forzar eliminación?' : '¿Eliminar esta materia?' }}
            </h2>
            <p class="text-slate-500 dark:text-slate-400 font-medium mt-3 leading-relaxed">
              Vas a eliminar <span class="font-black text-slate-800 dark:text-white">{{ deleteModal.nombre }}</span>. 
              <span v-if="!showForceButton">Esta acción puede fallar si existen asignaciones docentes o registros activos vinculados.</span>
              <span v-else class="text-red-500 block mt-2">Esta acción borrará permanentemente TODA la información relacionada (notas, actividades, competencias). Se generará un reporte de respaldo.</span>
            </p>
            
            <div v-if="impactDetails || deleteModal.asignaciones_count > 0" class="mt-4 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-bold ring-1 ring-amber-100 dark:ring-amber-900 text-left">
              <p class="uppercase tracking-widest text-[10px] mb-2 opacity-60">Impacto detectado:</p>
              <ul class="space-y-1">
                <li>• {{ impactDetails?.asignaciones_count ?? deleteModal.asignaciones_count }} Asignaciones</li>
                <li>• {{ impactDetails?.competencias_count ?? deleteModal.competencias_count }} Competencias</li>
                <li v-if="impactDetails">• {{ impactDetails.actividades_count }} Actividades</li>
                <li v-if="impactDetails">• {{ impactDetails.notas_count }} Notas/Calificaciones</li>
              </ul>
            </div>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-6 flex gap-3">
            <button @click="deleteModal = null; showForceButton = false" class="flex-1 px-6 py-3 rounded-xl font-black text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button 
              @click="confirmDelete(deleteModal, showForceButton)"
              :disabled="deleting"
              class="flex-1 text-white px-6 py-3 rounded-xl font-black shadow-lg transition-all disabled:opacity-50"
              :class="showForceButton ? 'bg-slate-900 hover:bg-black shadow-slate-200' : 'bg-red-500 hover:bg-red-600 shadow-red-100'"
            >
              {{ deleting ? (showForceButton ? 'Forzando...' : 'Eliminando...') : (showForceButton ? 'Forzar Eliminación' : 'Sí, Eliminar') }}
            </button>
          </div>
        </div>
      </div>
      <!-- Trash Detail Modal -->
      <div v-if="selectedTrashItem" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-md" @click="selectedTrashItem = null"></div>
        <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border border-white/10">
          <div class="p-8">
            <div class="flex items-center justify-between mb-8">
              <div class="flex items-center gap-4">
                <div class="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-3xl">
                  <Info :size="32" />
                </div>
                <div>
                  <h2 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Materia Fantasma: {{ selectedTrashItem.nombre_materia }}</h2>
                  <p class="text-sm font-medium text-slate-500">Respaldo histórico de la información eliminada.</p>
                </div>
              </div>
              <button @click="selectedTrashItem = null" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
                <Search :size="24" class="text-slate-400 rotate-45" />
              </button>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] font-black text-slate-400 uppercase block mb-1">Asignaciones</span>
                <span class="text-xl font-black text-slate-900 dark:text-white">{{ selectedTrashItem.data_respaldo.impact?.asignaciones_count || 0 }}</span>
              </div>
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] font-black text-slate-400 uppercase block mb-1">Competencias</span>
                <span class="text-xl font-black text-slate-900 dark:text-white">{{ selectedTrashItem.data_respaldo.impact?.competencias_count || 0 }}</span>
              </div>
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] font-black text-slate-400 uppercase block mb-1">Actividades</span>
                <span class="text-xl font-black text-slate-900 dark:text-white">{{ selectedTrashItem.data_respaldo.impact?.actividades_count || 0 }}</span>
              </div>
              <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] font-black text-slate-400 uppercase block mb-1">Calificaciones</span>
                <span class="text-xl font-black text-slate-900 dark:text-white">{{ selectedTrashItem.data_respaldo.impact?.notas_count || 0 }}</span>
              </div>
            </div>

            <div v-if="selectedTrashItem.data_respaldo.assignments?.length > 0" class="space-y-3 mb-8">
              <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Historial de Asignaciones</h3>
              <div class="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                <!-- Deduplicación en el frontend por seguridad -->
                <div v-for="a in ([...new Map((selectedTrashItem.data_respaldo.assignments || []).map((item: any) => [item.id_grupo, item])).values()] as any[])" 
                     :key="a.id_grupo" 
                     class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl"
                >
                  <div class="flex flex-col">
                    <p class="text-sm font-black text-slate-700 dark:text-slate-300">
                      {{ a.grado_nombre && a.seccion_nombre ? getCourseDisplayName({ grado_nombre: a.grado_nombre, seccion_nombre: a.seccion_nombre }) : 'Grupo ID: ' + a.id_grupo + ' (' + a.nivel_nombre + ')' }}
                    </p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">
                      Respaldo: {{ a.docente_nombre || 'Docente ID: ' + a.id_docente }}
                    </p>
                  </div>
                  <span class="text-[10px] font-black px-2 py-1 bg-white dark:bg-slate-700 rounded-lg text-slate-400">Restauración Lista</span>
                </div>
              </div>
            </div>

            <div class="bg-amber-50 dark:bg-amber-950/20 p-5 rounded-2xl border border-amber-100/50 dark:border-amber-900/30">
              <div class="flex gap-3 items-center mb-2">
                <Info :size="16" class="text-amber-600" />
                <p class="text-xs font-black text-amber-900 dark:text-amber-400 uppercase">Información de Respaldo</p>
              </div>
              <p class="text-xs font-medium text-amber-700/80 dark:text-amber-500/80 leading-relaxed">
                Esta materia fue eliminada permanentemente. La información mostrada aquí es estática y sirve como referencia histórica. Puedes usar el nombre de esta materia para restaurarla en el formulario de creación.
              </p>
            </div>
            
            <button @click="selectedTrashItem = null" class="w-full mt-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl transition-all hover:translate-y-[-1px]">
              Cerrar Visor
            </button>
          </div>
        </div>
      </div>

      <!-- Subject Curriculum Details Drawer -->
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="detailDrawerOpen" class="fixed inset-0 z-50 overflow-hidden font-sans">
          <!-- Backdrop overlay -->
          <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity" @click="detailDrawerOpen = false"></div>

          <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <Transition
              enter-active-class="transform transition duration-300 ease-out"
              enter-from-class="translate-x-full"
              enter-to-class="translate-x-0"
              leave-active-class="transform transition duration-200 ease-in"
              leave-from-class="translate-x-0"
              leave-to-class="translate-x-full"
            >
              <div class="w-screen max-w-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
                
                <!-- Drawer Header -->
                <div class="px-6 py-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <BookOpen :size="24" />
                    </div>
                    <div>
                      <h2 class="text-xl font-black text-slate-900 dark:text-white leading-tight">
                        {{ subjectDetails?.subject?.nombre || 'Detalles de la Materia' }}
                      </h2>
                      <p class="text-xs font-bold text-slate-400 uppercase mt-0.5 tracking-wider">
                        Año Lectivo {{ subjectDetails?.activeYear?.calendario || 'Activo' }}
                      </p>
                    </div>
                  </div>
                  <button @click="detailDrawerOpen = false" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                    <X :size="20" />
                  </button>
                </div>

                <!-- Tabs -->
                <div class="px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-4">
                  <button
                    @click="activeTab = 'curriculum'"
                    :class="[activeTab === 'curriculum' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-600', 'py-4 border-b-2 font-black text-xs uppercase tracking-widest transition-all']"
                  >
                    Estructura Curricular
                  </button>
                  <button
                    @click="activeTab = 'teachers'"
                    :class="[activeTab === 'teachers' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-600', 'py-4 border-b-2 font-black text-xs uppercase tracking-widest transition-all']"
                  >
                    Docentes y Cursos ({{ subjectDetails?.assignments?.length || 0 }})
                  </button>
                </div>

                <!-- Drawer Content -->
                <div class="flex-1 overflow-y-auto min-h-0 bg-slate-50/30 dark:bg-slate-900/10 custom-scrollbar">
                  <div v-if="detailLoading" class="p-8 text-center text-slate-400 font-bold">
                    Cargando estructura...
                  </div>

                  <div v-else class="p-6">
                    
                    <!-- TAB 1: Estructura Curricular -->
                    <div v-if="activeTab === 'curriculum'" class="space-y-6">
                      <!-- Period filter / Quick Actions -->
                      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div class="flex items-center gap-2">
                          <Calendar :size="16" class="text-slate-400" />
                          <select 
                            v-model="selectedPeriodId" 
                            class="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white outline-none"
                          >
                            <option v-for="p in subjectDetails?.periods" :key="p.id_periodo" :value="p.id_periodo">
                              {{ p.nombre }} ({{ p.porcentaje }}%)
                            </option>
                          </select>
                        </div>

                        <button @click="openAddCompetency" class="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 hover:bg-emerald-700 transition-all shadow-md">
                          <PlusCircle :size="14" />
                          Agregar Competencia
                        </button>
                      </div>

                      <!-- Competencies list -->
                      <div class="space-y-4">
                        <div v-if="!filteredCompetencies.length" class="text-center py-16 bg-white dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                          <BookOpen :size="32" class="mx-auto text-slate-350 dark:text-slate-600 mb-2" />
                          <p class="text-sm font-bold text-slate-400">No hay competencias definidas para este periodo.</p>
                        </div>

                        <div 
                          v-for="comp in filteredCompetencies" 
                          :key="comp.id_competencia"
                          class="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm"
                        >
                          <!-- Competency Header -->
                          <div class="p-4 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800/60 flex items-start justify-between gap-4">
                            <div class="flex-1 space-y-1.5 text-left">
                              <span class="inline-block px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-md text-[9px] font-black uppercase tracking-wider">
                                Curso: {{ comp.grado_nombre }} ({{ comp.seccion_nombre }})
                              </span>
                              <p class="text-sm font-bold text-slate-800 dark:text-slate-200">
                                {{ comp.descripcion }}
                              </p>
                            </div>
                            <!-- Actions -->
                            <div class="flex items-center gap-1.5 shrink-0">
                              <button @click="openEditCompetency(comp)" class="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-350 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 rounded-lg transition-colors">
                                <Edit :size="14" />
                              </button>
                              <button @click="deleteCompetency(comp.id_competencia)" class="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-350 hover:bg-red-55 hover:text-red-600 dark:hover:bg-red-950/40 rounded-lg transition-colors">
                                <Trash2 :size="14" />
                              </button>
                            </div>
                          </div>

                          <!-- Evidences List -->
                          <div class="p-4 bg-white dark:bg-slate-800/25 space-y-3">
                            <div class="flex items-center justify-between px-1">
                              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidencias de Aprendizaje</span>
                              <button @click="openAddEvidence(comp.id_competencia)" class="text-xs font-black text-emerald-600 dark:text-emerald-450 hover:underline flex items-center gap-1">
                                <Plus :size="12" /> Añadir
                              </button>
                            </div>

                            <div v-if="!comp.evidencias?.length" class="text-center py-6 bg-slate-50/20 dark:bg-slate-900/10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                              <p class="text-xs font-bold text-slate-400 italic">No hay evidencias definidas.</p>
                            </div>

                            <div v-else class="divide-y divide-slate-50 dark:divide-slate-800/40">
                              <div 
                                v-for="(ev, idx) in comp.evidencias" 
                                :key="ev.id_evidencia"
                                class="py-3 flex items-start justify-between gap-3 text-left group/ev"
                              >
                                <div class="flex items-start gap-2.5">
                                  <span class="mt-0.5 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500">
                                    {{ Number(idx) + 1 }}
                                  </span>
                                  <div>
                                    <p class="text-xs font-bold text-slate-650 dark:text-slate-300">
                                      {{ ev.descripcion }}
                                    </p>
                                    <span v-if="ev.dba_codigo" class="inline-block mt-1 text-[8px] font-black bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                      DBA: {{ ev.dba_codigo }}
                                    </span>
                                  </div>
                                </div>
                                <!-- Actions -->
                                <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover/ev:opacity-100 transition-opacity">
                                  <button @click="openEditEvidence(ev)" class="p-1 text-slate-400 hover:text-emerald-600 rounded">
                                    <Edit :size="12" />
                                  </button>
                                  <button @click="deleteEvidence(ev.id_evidencia)" class="p-1 text-slate-400 hover:text-red-600 rounded">
                                    <Trash2 :size="12" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- TAB 2: Docentes y Cursos (Asignaciones) -->
                    <div v-if="activeTab === 'teachers'" class="space-y-4">
                      <div v-if="!subjectDetails?.assignments?.length" class="text-center py-16 bg-white dark:bg-slate-850 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <GraduationCap :size="36" class="mx-auto text-slate-350 dark:text-slate-600 mb-2" />
                        <p class="text-sm font-bold text-slate-400">Esta asignatura no tiene docentes asignados en este año lectivo.</p>
                      </div>

                      <div 
                        v-for="asg in subjectDetails?.assignments" 
                        :key="asg.id_detallegrado"
                        class="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex items-center justify-between gap-4"
                      >
                        <div class="flex items-center gap-3">
                          <div class="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center rounded-xl font-black text-sm">
                            {{ asg.docente_nombre.charAt(0).toUpperCase() }}
                          </div>
                          <div class="text-left">
                            <h4 class="font-black text-slate-800 dark:text-white text-sm">{{ asg.docente_nombre }}</h4>
                            <p class="text-xs font-bold text-indigo-500 uppercase mt-0.5 tracking-wider">
                              {{ asg.grado_nombre }} ({{ asg.seccion_nombre }}) · {{ asg.jornada_nombre }}
                            </p>
                          </div>
                        </div>
                        <span class="px-2.5 py-1 bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-100 dark:border-slate-700">
                          Asignado
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button @click="detailDrawerOpen = false" class="px-6 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all">
                    Cerrar panel
                  </button>
                </div>

              </div>
            </Transition>
          </div>
        </div>
      </Transition>

      <!-- Competency Add/Edit Modal -->
      <div v-if="showCompetencyModal" class="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showCompetencyModal = false"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden border border-white/20 shadow-2xl animate-fade-in">
          <div class="px-8 pt-8 pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {{ competencyForm.id_competencia ? 'Editar Competencia' : 'Nueva Competencia' }}
            </h2>
            <p class="text-xs font-medium text-slate-500 mt-1">Ingresa los detalles académicos de la competencia para la materia.</p>
          </div>

          <div class="p-8 space-y-5">
            <!-- Group selection (Disabled if editing) -->
            <div class="space-y-1.5 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Curso / Grupo</label>
              <select 
                v-model="competencyForm.id_grupo" 
                :disabled="!!competencyForm.id_competencia"
                class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500/20 rounded-xl p-3 font-bold outline-none text-slate-900 dark:text-white"
              >
                <option v-for="g in subjectDetails?.groups" :key="g.id_grupo" :value="g.id_grupo">
                  {{ g.grado_nombre }} ({{ g.seccion_nombre }}) · {{ g.jornada_nombre }}
                </option>
              </select>
            </div>

            <!-- Description -->
            <div class="space-y-1.5 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Descripción de la Competencia</label>
              <textarea 
                v-model="competencyForm.descripcion" 
                rows="4"
                placeholder="Ej. Resuelve y formula problemas utilizando las propiedades de las funciones reales..." 
                class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
              ></textarea>
            </div>

            <div class="flex gap-3 pt-2">
              <button @click="showCompetencyModal = false" class="flex-1 px-6 py-3.5 rounded-xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs uppercase">Cancelar</button>
              <button @click="saveCompetency" :disabled="savingCompetency" class="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl font-black transition-all disabled:opacity-50 text-xs uppercase tracking-wide">
                {{ savingCompetency ? 'Guardando...' : 'Confirmar Guardado' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Learning Evidence Add/Edit Modal -->
      <div v-if="showEvidenceModal" class="fixed inset-0 z-[130] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showEvidenceModal = false"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden border border-white/20 shadow-2xl animate-fade-in">
          <div class="px-8 pt-8 pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
            <h2 class="text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {{ evidenceForm.id_evidencia ? 'Editar Evidencia' : 'Nueva Evidencia de Aprendizaje' }}
            </h2>
            <p class="text-xs font-medium text-slate-500 mt-1">Escribe la evidencia observable para comprobar el avance del estudiante.</p>
          </div>

          <div class="p-8 space-y-5">
            <!-- Description -->
            <div class="space-y-1.5 text-left">
              <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Descripción de la Evidencia</label>
              <textarea 
                v-model="evidenceForm.descripcion" 
                rows="4"
                placeholder="Ej. Identifica límites laterales a partir de la gráfica de una función..." 
                class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
              ></textarea>
            </div>

            <div class="flex gap-3 pt-2">
              <button @click="showEvidenceModal = false" class="flex-1 px-6 py-3.5 rounded-xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs uppercase">Cancelar</button>
              <button @click="saveEvidence" :disabled="savingEvidence" class="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl font-black transition-all disabled:opacity-50 text-xs uppercase tracking-wide">
                {{ savingEvidence ? 'Guardando...' : 'Confirmar Guardado' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
</style>
