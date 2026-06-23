<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { BookOpen, Plus, Trash2, Search, Info, Layers, GraduationCap } from 'lucide-vue-next'
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
          class="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-900 transition-all flex flex-col justify-between"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center rounded-xl font-black text-sm">
                {{ item.nombre.charAt(0).toUpperCase() }}
              </div>
              <h4 class="font-black text-slate-800 dark:text-white text-lg truncate max-w-[150px]">{{ item.nombre }}</h4>
            </div>
            <button @click="deleteModal = item" class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all">
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
    </Teleport>
  </div>
</template>

<style scoped>
</style>
