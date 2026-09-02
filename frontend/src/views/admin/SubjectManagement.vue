<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { academicService } from '../../services/academicService'
import { BookOpen, Plus, Trash2, Search, Info, Layers, GraduationCap, X, Edit, Calendar, Lock, Sparkles, ArrowRight } from 'lucide-vue-next'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import { getCourseDisplayName } from '../../utils/courseHelper'
import { useConfirm } from '../../composables/useConfirm'
import { useToast } from '../../composables/useToast'
import HierarchicalAssignmentList from '../../components/academico/HierarchicalAssignmentList.vue'



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
const yearStore = useAcademicYearStore()
const { confirm } = useConfirm()
const toast = useToast()
const schoolId = computed(() => Number(auth.user?.schoolId || 0))
const isReadOnly = computed(() => Boolean(yearStore.isClosedYear))

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
    const params = yearStore.selectedYearId ? { yearId: yearStore.selectedYearId } : {}
    const [subRes, trashRes] = await Promise.all([
      academicService.getSubjects(schoolId.value, params),
      academicService.getTrashSubjects(schoolId.value)
    ])
    subjects.value = subRes
    trashSubjects.value = trashRes
  } catch (error) {
    console.error('Error loading subjects:', error)
    subjects.value = []
    trashSubjects.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await yearStore.loadYearsForSchool(schoolId.value, auth.token || undefined)
  await loadSubjects()
})

watch(() => yearStore.selectedYearId, async () => {
  await loadSubjects()
  if (detailDrawerOpen.value && selectedSubjectId.value) {
    selectedPeriodId.value = null
    await fetchSubjectDetails()
  }
})

const createSubject = async () => {
  if (isReadOnly.value) {
    alert('El año académico se encuentra cerrado. No es posible crear materias.')
    return
  }
  if (saving.value) return
  if (!newSubject.value.nombre.trim()) {
    alert('Escribe el nombre de la materia antes de crearla.')
    return
  }

  try {
    saving.value = true
    await academicService.createSubject({
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
  if (isReadOnly.value) {
    alert('El año académico se encuentra cerrado. No es posible eliminar materias.')
    return
  }
  try {
    deleting.value = true
    const response = await academicService.deleteSubject(item.id_materia, schoolId.value, force)
    
    if (force && response?.report) {
      generateAndDownloadReport(response.report)
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

// Period check helper
const isSelectedPeriodClosed = computed(() => {
  if (!subjectDetails.value?.periods || !selectedPeriodId.value) return false
  const period = subjectDetails.value.periods.find((p: any) => p.id_periodo === selectedPeriodId.value)
  return period ? period.estado === 'CERRADO' : false
})

// Filters for curriculum
const selectedPeriodId = ref<number | null>(null)
const selectedCurriculumGradeId = ref<number | null>(null)
const selectedCurriculumGroupId = ref<number | null>(null)
const curriculumSearchQuery = ref('')

const uniqueCurriculumGrades = computed(() => {
  if (!subjectDetails.value?.assignments && !subjectDetails.value?.competencies) return []
  const map = new Map()
  if (subjectDetails.value.assignments) {
    subjectDetails.value.assignments.forEach((a: any) => {
      if (a.id_tipo_grado && a.grado_nombre) {
        map.set(a.id_tipo_grado, a.grado_nombre)
      }
    })
  }
  if (subjectDetails.value.competencies) {
    subjectDetails.value.competencies.forEach((c: any) => {
      if (c.id_tipo_grado && c.grado_nombre) {
        map.set(c.id_tipo_grado, c.grado_nombre)
      }
    })
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id: id as number, name: name as string }))
})

const selectedCurriculumJornadaId = ref<string | null>(null)

const uniqueCurriculumJornadas = computed(() => {
  if (!subjectDetails.value?.competencies && !subjectDetails.value?.assignments) return []
  const map = new Map<string, string>()
  if (subjectDetails.value.assignments) {
    subjectDetails.value.assignments.forEach((a: any) => {
      if (a.jornada_nombre) {
        const name = String(a.jornada_nombre).trim()
        map.set(name.toUpperCase(), name)
      }
    })
  }
  if (subjectDetails.value.competencies) {
    subjectDetails.value.competencies.forEach((c: any) => {
      if (c.jornada_nombre) {
        const name = String(c.jornada_nombre).trim()
        map.set(name.toUpperCase(), name)
      }
    })
  }
  return Array.from(map.entries()).map(([key, name]) => ({ id: key, name }))
})

const uniqueCurriculumGroups = computed(() => {
  if (!subjectDetails.value?.competencies) return []
  let list = subjectDetails.value.competencies
  if (selectedCurriculumGradeId.value) {
    list = list.filter((c: any) => c.id_tipo_grado === selectedCurriculumGradeId.value)
  }
  if (selectedCurriculumJornadaId.value) {
    const selectedKey = String(selectedCurriculumJornadaId.value).trim().toUpperCase()
    list = list.filter((c: any) => c.jornada_nombre && String(c.jornada_nombre).trim().toUpperCase() === selectedKey)
  }
  const map = new Map()
  list.forEach((c: any) => {
    if (c.id_grupo) {
      const label = `${c.grado_nombre} (${c.seccion_nombre})${c.jornada_nombre ? ' · ' + c.jornada_nombre : ''}`
      map.set(c.id_grupo, label)
    }
  })
  return Array.from(map.entries()).map(([id, name]) => ({ id: id as number, name: name as string }))
})

const filteredCompetencies = computed(() => {
  if (!subjectDetails.value?.competencies || !selectedPeriodId.value) return []
  let list = subjectDetails.value.competencies.filter((c: any) => c.id_periodo === selectedPeriodId.value)
  
  if (selectedCurriculumGradeId.value) {
    list = list.filter((c: any) => c.id_tipo_grado === selectedCurriculumGradeId.value)
  }

  if (selectedCurriculumJornadaId.value) {
    const selectedKey = String(selectedCurriculumJornadaId.value).trim().toUpperCase()
    list = list.filter((c: any) => c.jornada_nombre && String(c.jornada_nombre).trim().toUpperCase() === selectedKey)
  }

  if (selectedCurriculumGroupId.value) {
    list = list.filter((c: any) => c.id_grupo === selectedCurriculumGroupId.value)
  }
  
  const q = curriculumSearchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((c: any) => 
      c.descripcion?.toLowerCase().includes(q) ||
      (c.evidencias && c.evidencias.some((e: any) => e.descripcion?.toLowerCase().includes(q)))
    )
  }

  // Deduplicate identical competencies for clean UI presentation, preferring entries with evidences
  const deduplicatedMap = new Map<string, any>()
  list.forEach((comp: any) => {
    const key = `${comp.id_grupo}_${comp.id_periodo}_${(comp.descripcion || '').trim()}`
    if (!deduplicatedMap.has(key)) {
      deduplicatedMap.set(key, comp)
    } else {
      const existing = deduplicatedMap.get(key)
      if ((!existing.evidencias || existing.evidencias.length === 0) && comp.evidencias && comp.evidencias.length > 0) {
        deduplicatedMap.set(key, comp)
      }
    }
  })

  return Array.from(deduplicatedMap.values())
})

// Filters for assignments (teachers & groups)
const selectedTeacherId = ref<number | null>(null)
const selectedAssignmentGroupId = ref<number | null>(null)
const selectedAssignmentGradeId = ref<number | null>(null)
const assignmentSearchQuery = ref('')

const filteredAssignments = computed(() => {
  if (!subjectDetails.value?.assignments) return []
  let list = subjectDetails.value.assignments
  
  if (selectedTeacherId.value) {
    list = list.filter((a: any) => a.id_docente === selectedTeacherId.value)
  }

  if (selectedAssignmentGradeId.value) {
    list = list.filter((a: any) => a.id_tipo_grado === selectedAssignmentGradeId.value)
  }
  
  if (selectedAssignmentGroupId.value) {
    list = list.filter((a: any) => a.id_grupo === selectedAssignmentGroupId.value)
  }
  
  const q = assignmentSearchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((a: any) => 
      a.docente_nombre.toLowerCase().includes(q) ||
      (a.grado_nombre + ' ' + (a.tipo_grado_nombre || '') + ' ' + a.seccion_nombre).toLowerCase().includes(q)
    )
  }
  return list
})

// Unique lists for assignments filters
const uniqueTeachers = computed(() => {
  if (!subjectDetails.value?.assignments) return []
  const map = new Map()
  subjectDetails.value.assignments.forEach((a: any) => {
    map.set(a.id_docente, a.docente_nombre)
  })
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
})

const uniqueAssignmentGrades = computed(() => {
  if (!subjectDetails.value?.assignments) return []
  const map = new Map()
  subjectDetails.value.assignments.forEach((a: any) => {
    if (a.id_tipo_grado && a.tipo_grado_nombre) {
      map.set(a.id_tipo_grado, a.tipo_grado_nombre)
    }
  })
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
})

const uniqueAssignmentGroups = computed(() => {
  if (!subjectDetails.value?.assignments) return []
  let source = subjectDetails.value.assignments
  // If a grade is selected, filter groups to only show groups of that grade
  if (selectedAssignmentGradeId.value) {
    source = source.filter((a: any) => a.id_tipo_grado === selectedAssignmentGradeId.value)
  }
  const map = new Map()
  source.forEach((a: any) => {
    const label = a.tipo_grado_nombre
      ? `${a.grado_nombre} - ${a.tipo_grado_nombre} (${a.seccion_nombre})`
      : `${a.grado_nombre} (${a.seccion_nombre})`
    map.set(a.id_grupo, label)
  })
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
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
  
  // Reset filters
  selectedPeriodId.value = null
  selectedCurriculumGradeId.value = null
  curriculumSearchQuery.value = ''
  selectedTeacherId.value = null
  selectedAssignmentGradeId.value = null
  selectedAssignmentGroupId.value = null
  assignmentSearchQuery.value = ''
  
  await fetchSubjectDetails()
}

const fetchSubjectDetails = async () => {
  if (!selectedSubjectId.value || !schoolId.value) return
  try {
    detailLoading.value = true
    const response = await academicService.getSubjectCurriculumDetails(
      selectedSubjectId.value,
      schoolId.value,
      yearStore.selectedYearId || undefined
    )
    subjectDetails.value = response
    
    // Set default filter period if not set
    if (response.periods?.length > 0 && !selectedPeriodId.value) {
      const openPeriod = response.periods.find((p: any) => p.estado === 'ABIERTO')
      selectedPeriodId.value = openPeriod ? openPeriod.id_periodo : response.periods[0].id_periodo
    }

    // Set default grade filter to first assigned grade to keep list clean
    if (uniqueCurriculumGrades.value.length > 0 && selectedCurriculumGradeId.value === null) {
      selectedCurriculumGradeId.value = uniqueCurriculumGrades.value[0].id
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
const openEditCompetency = (comp: any) => {
  if (isReadOnly.value) return
  competencyForm.value = {
    id_competencia: comp.id_competencia,
    id_grupo: comp.id_grupo,
    id_periodo: comp.id_periodo,
    descripcion: comp.descripcion
  }
  showCompetencyModal.value = true
}

const saveCompetency = async () => {
  if (isReadOnly.value) {
    alert('El año académico se encuentra cerrado. No es posible guardar competencias.')
    return
  }
  if (!competencyForm.value.descripcion.trim()) {
    alert('Escribe la descripción de la competencia.')
    return
  }
  try {
    savingCompetency.value = true
    await academicService.saveCompetency({
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
  if (isReadOnly.value) {
    toast.error('El año académico se encuentra cerrado. No es posible eliminar competencias.')
    return
  }
  const ok = await confirm({
    title: 'Eliminar Competencia',
    message: '¿Estás seguro de que deseas eliminar esta competencia? Se eliminarán todas sus evidencias y notas asociadas.',
    confirmText: 'Eliminar Competencia',
    type: 'danger'
  })
  if (!ok) return

  try {
    await academicService.deleteCompetency(id, schoolId.value)
    toast.success('Competencia eliminada exitosamente')
    await fetchSubjectDetails()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al eliminar la competencia')
  }
}

// EVIDENCES
const openAddEvidence = (competenciaId: number) => {
  if (isReadOnly.value) return
  evidenceForm.value = {
    id_evidencia: null,
    id_competencia: competenciaId,
    descripcion: ''
  }
  showEvidenceModal.value = true
}

const openEditEvidence = (ev: any) => {
  if (isReadOnly.value) return
  evidenceForm.value = {
    id_evidencia: ev.id_evidencia,
    id_competencia: ev.id_competencia,
    descripcion: ev.descripcion
  }
  showEvidenceModal.value = true
}

const saveEvidence = async () => {
  if (isReadOnly.value) {
    toast.error('El año académico se encuentra cerrado. No es posible guardar evidencias.')
    return
  }
  if (!evidenceForm.value.descripcion.trim()) {
    toast.warning('Escribe la descripción de la evidencia.')
    return
  }
  try {
    savingEvidence.value = true
    if (evidenceForm.value.id_evidencia) {
      await academicService.updateCurriculumEvidence(evidenceForm.value.id_evidencia, {
        schoolId: schoolId.value,
        descripcion: evidenceForm.value.descripcion.trim()
      })
    } else {
      await academicService.createCurriculumEvidence(evidenceForm.value.id_competencia!, {
        schoolId: schoolId.value,
        descripcion: evidenceForm.value.descripcion.trim()
      })
    }
    toast.success('Evidencia guardada exitosamente')
    showEvidenceModal.value = false
    await fetchSubjectDetails()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al guardar la evidencia')
  } finally {
    savingEvidence.value = false
  }
}

const deleteEvidence = async (id: number) => {
  if (isReadOnly.value) {
    toast.error('El año académico se encuentra cerrado. No es posible eliminar evidencias.')
    return
  }
  const ok = await confirm({
    title: 'Eliminar Evidencia',
    message: '¿Estás seguro de que deseas eliminar esta evidencia?',
    confirmText: 'Eliminar Evidencia',
    type: 'danger'
  })
  if (!ok) return

  try {
    await academicService.deleteCurriculumEvidence(id, schoolId.value)
    toast.success('Evidencia eliminada exitosamente')
    await fetchSubjectDetails()
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al eliminar la evidencia')
  }
}
</script>


<template>
  <div class="max-w-[1200px] mx-auto space-y-4 sm:space-y-6 px-3 sm:px-4 md:px-0">
    <!-- Modern Header -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xs overflow-hidden transition-all duration-300">
      <div class="p-5 sm:p-7 md:px-8 md:py-10 flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
        <div class="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div class="p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl sm:rounded-2xl text-emerald-600 dark:text-emerald-400 shrink-0">
            <BookOpen class="h-6 w-6 sm:h-8 sm:w-8" />
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight truncate">Gestión de Materias</h1>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 line-clamp-1 sm:line-clamp-none">Administra el catálogo global de asignaturas institucionales.</p>
          </div>
        </div>
        
        <button 
          v-if="!yearStore.isClosedYear"
          @click="createModalOpen = true" 
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-6 sm:py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-xs sm:text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus :size="18" />
          Nueva Materia
        </button>
        <div 
          v-else 
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 sm:px-5 sm:py-3.5 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-xl font-bold text-xs uppercase tracking-wider border border-amber-200 dark:border-amber-900/60 shadow-xs"
        >
          <Lock :size="16" />
          Año Cerrado (Solo Lectura)
        </div>
      </div>
    </div>

    <!-- Closed Year Warning Banner -->
    <div v-if="yearStore.isClosedYear" class="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 text-amber-950 dark:text-amber-200 shadow-xs animate-in fade-in duration-300">
      <div class="p-2.5 sm:p-3 bg-amber-500 text-white rounded-xl sm:rounded-2xl shrink-0 shadow-md">
        <Lock :size="20" class="sm:h-6 sm:w-6" />
      </div>
      <div class="flex-1 text-left min-w-0">
        <h3 class="text-xs sm:text-sm font-black uppercase tracking-wider">Año Lectivo {{ yearStore.selectedYear?.calendario }} — CERRADO (Solo Lectura)</h3>
        <p class="text-xs text-amber-800 dark:text-amber-300 font-medium mt-1 leading-relaxed">
          Este año académico se encuentra cerrado. El catálogo de asignaturas institucionales y la planeación curricular se presentan en modo de consulta histórica y no se pueden realizar modificaciones.
        </p>
      </div>
    </div>

    <!-- Stats & Search Bar -->
    <div class="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
      <div class="sm:col-span-2 md:col-span-3 relative">
        <Search class="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" :size="18" />
        <input 
          v-model="searchTerm" 
          type="text" 
          placeholder="Buscar materia por nombre..."
          class="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl sm:rounded-2xl py-3.5 sm:py-4 pl-10 sm:pl-12 pr-4 text-xs sm:text-sm font-semibold outline-none text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-emerald-500/10 transition-all"
        />
      </div>
      <div class="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800 p-3.5 sm:p-4 flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400">
            <Layers :size="16" />
          </div>
          <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Total</span>
        </div>
        <span class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{{ subjects.length }}</span>
      </div>
    </div>

    <!-- Subjects Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      <div v-if="loading" class="col-span-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-100 dark:border-slate-800 p-12 sm:p-16 text-center text-slate-400 font-bold">
        Cargando catálogo...
      </div>
      
      <template v-else>
        <div v-if="filteredSubjects.length === 0" class="col-span-full h-56 sm:h-64 flex flex-col items-center justify-center text-slate-400">
          <Search :size="40" class="mb-3 opacity-20 sm:size-12" />
          <p class="font-bold text-sm sm:text-base">No se encontraron materias</p>
        </div>

        <div 
          v-for="item in filteredSubjects" 
          :key="item.id_materia"
          class="group bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-900 cursor-pointer transition-all flex flex-col justify-between"
          @click="openSubjectDetails(item.id_materia)"
        >
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="h-10 w-10 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center rounded-xl font-black text-sm shrink-0">
                {{ item.nombre.charAt(0).toUpperCase() }}
              </div>
              <h4 class="font-black text-slate-800 dark:text-white text-base sm:text-lg truncate min-w-0 flex-1" :title="item.nombre">
                {{ item.nombre }}
              </h4>
            </div>
            <button 
              v-if="!yearStore.isClosedYear"
              @click.stop="deleteModal = item" 
              class="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all shrink-0 cursor-pointer"
              title="Eliminar materia"
            >
              <Trash2 :size="18" />
            </button>
          </div>

          <div class="flex items-center gap-3 sm:gap-4 mt-2">
            <div class="flex-1 min-w-0 flex flex-col">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">Asignaciones</span>
              <div class="flex items-center gap-1.5 mt-1">
                <GraduationCap :size="14" class="text-indigo-400 shrink-0" />
                <span class="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300">{{ item.asignaciones_count }}</span>
              </div>
            </div>
            <div class="flex-1 min-w-0 flex flex-col border-l border-slate-50 dark:border-slate-800 pl-3 sm:pl-4">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">Competencias</span>
              <div class="flex items-center gap-1.5 mt-1">
                <Info :size="14" class="text-amber-400 shrink-0" />
                <span class="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300">{{ item.competencias_count }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Subjects Trash (Phantom Subjects) -->
    <div v-if="trashSubjects.length > 0" class="mt-8 sm:mt-12 space-y-3 sm:space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 sm:px-2">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-2 bg-red-100 dark:bg-red-950/30 text-red-600 rounded-xl shrink-0">
            <Trash2 :size="18" />
          </div>
          <h3 class="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">Papelera de Materias (Materias Fantasma)</h3>
        </div>
        <span class="text-xs font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full self-start sm:self-auto">{{ trashSubjects.length }} BORRADAS</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div 
          v-for="item in trashSubjects" 
          :key="item.id_papelera"
          @click="selectedTrashItem = item"
          class="group bg-red-50/50 dark:bg-red-950/10 p-4 sm:p-5 rounded-2xl border-2 border-dashed border-red-100 dark:border-red-900/30 hover:border-red-500/40 transition-all cursor-pointer flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="h-10 w-10 bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center rounded-xl font-black text-sm shrink-0">
              <Info :size="18" />
            </div>
            <div class="min-w-0 flex-1">
              <h4 class="font-black text-red-700 dark:text-red-400 text-base sm:text-lg leading-tight truncate" :title="item.nombre_materia">{{ item.nombre_materia }}</h4>
              <p class="text-[10px] font-bold text-red-400 uppercase truncate">Borrada el {{ new Date(item.fecha_borrado).toLocaleDateString() }}</p>
            </div>
          </div>
          <div class="p-2 text-red-300 group-hover:text-red-500 shrink-0">
            <Search :size="18" />
          </div>
        </div>
      </div>
    </div>

    <!-- Info Banner -->
    <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 sm:p-5 rounded-2xl sm:rounded-3xl flex items-start gap-3 sm:gap-4 border border-emerald-100/50 dark:border-emerald-900/50">
      <div class="p-2 bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
        <Info :size="18" />
      </div>
      <p class="text-emerald-700/80 dark:text-emerald-400/80 text-xs sm:text-sm font-medium leading-relaxed">
        Las materias creadas aquí forman el catálogo global de la escuela. Luego podrás asignarlas a diferentes cursos y docentes desde el módulo de "Docentes" o "Mis Cursos".
      </p>
    </div>

    <!-- Modals (Teleported) -->
    <Teleport to="body">
      <!-- Create Modal -->
      <div v-if="createModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="createModalOpen = false"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden border border-white/20 max-h-[90dvh] flex flex-col">
          <div class="px-5 py-4 sm:px-8 sm:pt-8 sm:pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5 sm:gap-3">
              <Plus :size="22" class="text-emerald-600 shrink-0" />
              Nueva Materia
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-1">Define el nombre de la asignatura para el catálogo.</p>
          </div>

          <div class="p-5 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            <div class="space-y-4">
              <div v-if="trashSubjects.length > 0" class="p-3.5 sm:p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl sm:rounded-2xl border border-amber-100/50">
                <label class="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5 block">¿Restaurar desde papelera?</label>
                <select 
                  v-model="reuseFromTrash" 
                  @change="handleTrashSelection"
                  class="w-full bg-white dark:bg-slate-800 border border-amber-200/50 dark:border-slate-700 rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm font-bold outline-none cursor-pointer"
                >
                  <option :value="null">-- Crear Nueva --</option>
                  <option v-for="t in trashSubjects" :key="t.id_papelera" :value="t">
                    {{ t.nombre_materia }} (Borrada {{ new Date(t.fecha_borrado).toLocaleDateString() }})
                  </option>
                </select>
                <p v-if="reuseFromTrash" class="text-[10px] font-bold text-amber-500 mt-1.5 italic">Esto heredará el nombre de la materia fantasma.</p>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nombre de la Materia</label>
                <input 
                  v-model="newSubject.nombre" 
                  type="text" 
                  placeholder="Ej. Física Teórica" 
                  class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500/20 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 font-bold outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400 text-xs sm:text-sm" 
                />
              </div>
            </div>

            <div class="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2 shrink-0">
              <button @click="createModalOpen = false; reuseFromTrash = null" class="w-full sm:flex-1 px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer">Cancelar</button>
              <button @click="createSubject" :disabled="saving" class="w-full sm:flex-[2] bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-5 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm shadow-xl shadow-slate-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-0 transition-all disabled:opacity-50 cursor-pointer">
                {{ saving ? (reuseFromTrash ? 'Restaurando...' : 'Registrando...') : (reuseFromTrash ? 'Restaurar Materia' : 'Confirmar Registro') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete Modal -->
      <div v-if="deleteModal" class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
        <div class="absolute inset-0 bg-red-950/30 backdrop-blur-md" @click="deleteModal = null; showForceButton = false"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] overflow-hidden shadow-2xl max-h-[90dvh] flex flex-col">
          <div class="p-6 sm:p-8 text-center overflow-y-auto flex-1 custom-scrollbar">
            <div class="w-12 h-12 sm:w-16 sm:h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Trash2 :size="28" class="sm:size-8" />
            </div>
            <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {{ showForceButton ? '¿Forzar eliminación?' : '¿Eliminar esta materia?' }}
            </h2>
            <p class="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-2 sm:mt-3 leading-relaxed">
              Vas a eliminar <span class="font-black text-slate-800 dark:text-white">{{ deleteModal.nombre }}</span>. 
              <span v-if="!showForceButton">Esta acción puede fallar si existen asignaciones docentes o registros activos vinculados.</span>
              <span v-else class="text-red-500 block mt-2">Esta acción borrará permanentemente TODA la información relacionada (notas, actividades, competencias). Se generará un reporte de respaldo.</span>
            </p>
            
            <div v-if="impactDetails || deleteModal.asignaciones_count > 0" class="mt-4 px-3.5 py-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-700 dark:text-amber-400 text-xs font-bold ring-1 ring-amber-100 dark:ring-amber-900 text-left">
              <p class="uppercase tracking-widest text-[10px] mb-1.5 opacity-60">Impacto detectado:</p>
              <ul class="space-y-1 text-xs">
                <li>• {{ impactDetails?.asignaciones_count ?? deleteModal.asignaciones_count }} Asignaciones</li>
                <li>• {{ impactDetails?.competencias_count ?? deleteModal.competencias_count }} Competencias</li>
                <li v-if="impactDetails">• {{ impactDetails.actividades_count }} Actividades</li>
                <li v-if="impactDetails">• {{ impactDetails.notas_count }} Notas/Calificaciones</li>
              </ul>
            </div>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-6 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 shrink-0">
            <button @click="deleteModal = null; showForceButton = false" class="w-full sm:flex-1 px-5 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer">Cancelar</button>
            <button 
              @click="confirmDelete(deleteModal, showForceButton)"
              :disabled="deleting"
              class="w-full sm:flex-1 text-white px-5 py-2.5 sm:py-3 rounded-xl font-black text-xs sm:text-sm shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              :class="showForceButton ? 'bg-slate-900 hover:bg-black shadow-slate-200' : 'bg-red-500 hover:bg-red-600 shadow-red-100'"
            >
              {{ deleting ? (showForceButton ? 'Forzando...' : 'Eliminando...') : (showForceButton ? 'Forzar Eliminación' : 'Sí, Eliminar') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Trash Detail Modal -->
      <div v-if="selectedTrashItem" class="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4">
        <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-md" @click="selectedTrashItem = null"></div>
        <div class="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] overflow-hidden shadow-2xl border border-white/10 max-h-[90dvh] flex flex-col">
          <!-- Header -->
          <div class="p-5 sm:p-7 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div class="flex items-center gap-3 min-w-0 flex-1">
              <div class="p-2.5 sm:p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl shrink-0">
                <Info :size="24" />
              </div>
              <div class="min-w-0 flex-1">
                <h2 class="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight truncate">Materia Fantasma: {{ selectedTrashItem.nombre_materia }}</h2>
                <p class="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">Respaldo histórico de la información eliminada.</p>
              </div>
            </div>
            <button @click="selectedTrashItem = null" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all shrink-0 cursor-pointer">
              <X :size="20" class="text-slate-400" />
            </button>
          </div>

          <!-- Scrollable Body -->
          <div class="p-5 sm:p-8 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
              <div class="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] font-black text-slate-400 uppercase block mb-1">Asignaciones</span>
                <span class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{{ selectedTrashItem.data_respaldo.impact?.asignaciones_count || 0 }}</span>
              </div>
              <div class="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] font-black text-slate-400 uppercase block mb-1">Competencias</span>
                <span class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{{ selectedTrashItem.data_respaldo.impact?.competencias_count || 0 }}</span>
              </div>
              <div class="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] font-black text-slate-400 uppercase block mb-1">Actividades</span>
                <span class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{{ selectedTrashItem.data_respaldo.impact?.actividades_count || 0 }}</span>
              </div>
              <div class="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800">
                <span class="text-[10px] font-black text-slate-400 uppercase block mb-1">Calificaciones</span>
                <span class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{{ selectedTrashItem.data_respaldo.impact?.notas_count || 0 }}</span>
              </div>
            </div>

            <div v-if="selectedTrashItem.data_respaldo.assignments?.length > 0" class="space-y-3">
              <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Historial de Asignaciones</h3>
              <div class="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                <!-- Deduplicación en el frontend por seguridad -->
                <div v-for="a in ([...new Map((selectedTrashItem.data_respaldo.assignments || []).map((item: any) => [item.id_grupo, item])).values()] as any[])" 
                     :key="a.id_grupo" 
                     class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl gap-2"
                >
                  <div class="flex flex-col min-w-0">
                    <p class="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 truncate">
                      {{ a.grado_nombre && a.seccion_nombre ? getCourseDisplayName({ grado_nombre: a.grado_nombre, seccion_nombre: a.seccion_nombre }) : 'Grupo ID: ' + a.id_grupo + ' (' + a.nivel_nombre + ')' }}
                    </p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase truncate">
                      Respaldo: {{ a.docente_nombre || 'Docente ID: ' + a.id_docente }}
                    </p>
                  </div>
                  <span class="text-[10px] font-black px-2 py-1 bg-white dark:bg-slate-700 rounded-lg text-slate-400 self-start sm:self-auto shrink-0">Restauración Lista</span>
                </div>
              </div>
            </div>

            <div class="bg-amber-50 dark:bg-amber-950/20 p-4 sm:p-5 rounded-2xl border border-amber-100/50 dark:border-amber-900/30">
              <div class="flex gap-2.5 items-center mb-1.5">
                <Info :size="16" class="text-amber-600 shrink-0" />
                <p class="text-xs font-black text-amber-900 dark:text-amber-400 uppercase">Información de Respaldo</p>
              </div>
              <p class="text-xs font-medium text-amber-700/80 dark:text-amber-500/80 leading-relaxed">
                Esta materia fue eliminada permanentemente. La información mostrada aquí es estática y sirve como referencia histórica. Puedes usar el nombre de esta materia para restaurarla en el formulario de creación.
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="p-4 sm:p-6 pt-0 shrink-0">
            <button @click="selectedTrashItem = null" class="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl transition-all hover:translate-y-[-1px] cursor-pointer">
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

          <div class="absolute inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
            <Transition
              enter-active-class="transform transition duration-300 ease-out"
              enter-from-class="translate-x-full"
              enter-to-class="translate-x-0"
              leave-active-class="transform transition duration-200 ease-in"
              leave-from-class="translate-x-0"
              leave-to-class="translate-x-full"
            >
              <div class="w-full sm:w-screen sm:max-w-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full">
                
                <!-- Drawer Header -->
                <div class="px-4 py-4 sm:px-6 sm:py-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                  <div class="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div class="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                      <BookOpen :size="20" class="sm:size-6" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <h2 class="text-base sm:text-xl font-black text-slate-900 dark:text-white leading-tight truncate" :title="subjectDetails?.subject?.nombre">
                        {{ subjectDetails?.subject?.nombre || 'Detalles de la Materia' }}
                      </h2>
                      <p class="text-[10px] sm:text-xs font-bold text-slate-400 uppercase mt-0.5 tracking-wider truncate">
                        Año Lectivo {{ subjectDetails?.activeYear?.calendario || 'Activo' }}
                      </p>
                    </div>
                  </div>
                  <button @click="detailDrawerOpen = false" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all shrink-0 cursor-pointer">
                    <X :size="20" />
                  </button>
                </div>

                <!-- Tabs (Horizontal scroll on mobile) -->
                <div class="px-4 sm:px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2 sm:gap-4 overflow-x-auto no-scrollbar shrink-0">
                  <button
                    @click="activeTab = 'curriculum'"
                    :class="[activeTab === 'curriculum' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-600', 'py-3 sm:py-4 border-b-2 font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer shrink-0']"
                  >
                    Estructura Curricular
                  </button>
                  <button
                    @click="activeTab = 'teachers'"
                    :class="[activeTab === 'teachers' ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-600', 'py-3 sm:py-4 border-b-2 font-black text-[11px] sm:text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer shrink-0']"
                  >
                    Docentes y Cursos ({{ subjectDetails?.assignments?.length || 0 }})
                  </button>
                </div>

                <!-- Drawer Content -->
                <div class="flex-1 overflow-y-auto min-h-0 bg-slate-50/30 dark:bg-slate-900/10 custom-scrollbar">
                  <div v-if="detailLoading" class="p-8 text-center text-slate-400 font-bold text-sm sm:text-base">
                    Cargando estructura...
                  </div>

                  <div v-else class="p-3.5 sm:p-6">
                    
                    <!-- TAB 1: Estructura Curricular -->
                    <div v-if="activeTab === 'curriculum'" class="space-y-4 sm:space-y-6">
                      <!-- Period filter & Link to Centralized Competency Management -->
                      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                        <div class="flex items-center gap-2 w-full sm:w-auto">
                          <Calendar :size="16" class="text-slate-400 shrink-0" />
                          <select 
                            v-model="selectedPeriodId" 
                            class="flex-1 sm:flex-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 sm:p-2.5 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                          >
                            <option v-for="p in subjectDetails?.periods" :key="p.id_periodo" :value="p.id_periodo" class="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                              {{ p.nombre }} ({{ p.porcentaje }}%)
                            </option>
                          </select>
                        </div>

                        <!-- Botón enlace a Gestión de Competencias -->
                        <router-link 
                          to="/dashboard/configuracion-academica/competencias" 
                          class="w-full sm:w-auto px-3.5 py-2 sm:px-4 sm:py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 rounded-xl font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                          title="Ir al módulo centralizado de configuración de competencias"
                        >
                          <Sparkles :size="14" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>Gestionar Competencias</span>
                          <ArrowRight :size="13" class="shrink-0" />
                        </router-link>
                      </div>

                      <!-- Alerta Informativa para Directivos -->
                      <div class="p-3 sm:p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs text-indigo-900 dark:text-indigo-200">
                        <div class="flex items-start sm:items-center gap-2">
                          <Info :size="16" class="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 sm:mt-0" />
                          <span class="font-medium text-left leading-relaxed">
                            Para crear y asignar competencias a las materias, dirígete a: 
                            <strong class="font-black text-indigo-700 dark:text-indigo-300">Configuración Académica → Gestión de Competencias</strong>.
                          </span>
                        </div>
                        <router-link 
                          to="/dashboard/configuracion-academica/competencias" 
                          class="shrink-0 font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 self-end sm:self-auto text-xs"
                        >
                          <span>Ir a Competencias</span>
                          <ArrowRight :size="12" />
                        </router-link>
                      </div>

                      <!-- Curriculum Search & Group Filters (Optimized 2 cols max inside drawer) -->
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div class="space-y-1 text-left">
                          <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filtrar por Grado</label>
                          <select 
                            v-model="selectedCurriculumGradeId" 
                            @change="selectedCurriculumGroupId = null"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 sm:p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                          >
                            <option :value="null" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Todos los grados</option>
                            <option v-for="gr in uniqueCurriculumGrades" :key="gr.id" :value="gr.id" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                              {{ gr.name }}
                            </option>
                          </select>
                        </div>
                        <div class="space-y-1 text-left">
                          <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filtrar por Jornada</label>
                          <select 
                            v-model="selectedCurriculumJornadaId" 
                            @change="selectedCurriculumGroupId = null"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 sm:p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                          >
                            <option :value="null" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Todas las jornadas</option>
                            <option v-for="j in uniqueCurriculumJornadas" :key="j.id" :value="j.id" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                              {{ j.name }}
                            </option>
                          </select>
                        </div>
                        <div class="space-y-1 text-left">
                          <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filtrar por Curso</label>
                          <select 
                            v-model="selectedCurriculumGroupId" 
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 sm:p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                          >
                            <option :value="null" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Todos los cursos</option>
                            <option v-for="g in uniqueCurriculumGroups" :key="g.id" :value="g.id" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                              {{ g.name }}
                            </option>
                          </select>
                        </div>
                        <div class="space-y-1 text-left">
                          <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Buscar Competencia / Evidencia</label>
                          <input 
                            v-model="curriculumSearchQuery" 
                            type="text" 
                            placeholder="Buscar por texto..."
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 sm:p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      </div>

                      <!-- Competencies list -->
                      <div class="space-y-3.5 sm:space-y-4">
                        <div v-if="!filteredCompetencies.length" class="text-center py-10 sm:py-14 px-4 sm:px-6 bg-white dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                          <BookOpen :size="32" class="mx-auto text-slate-400 dark:text-slate-600 sm:size-9" />
                          <div>
                            <p class="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">No hay competencias definidas para este periodo.</p>
                            <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                              Para asignar competencias a esta materia, utiliza el módulo oficial en <strong>Configuración Académica → Gestión de Competencias</strong>.
                            </p>
                          </div>
                          <router-link 
                            to="/dashboard/configuracion-academica/competencias" 
                            class="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-100 transition-colors cursor-pointer"
                          >
                            <span>Ir a Gestión de Competencias</span>
                            <ArrowRight :size="14" />
                          </router-link>
                        </div>

                        <div 
                          v-for="comp in filteredCompetencies" 
                          :key="comp.id_competencia"
                          class="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800/80 rounded-xl sm:rounded-2xl overflow-hidden shadow-xs"
                        >
                          <!-- Competency Header -->
                          <div class="p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-4">
                            <div class="flex-1 space-y-1.5 text-left min-w-0">
                              <span class="inline-block px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-md text-[10px] sm:text-xs font-bold uppercase tracking-wider max-w-full truncate">
                                Curso: {{ comp.grado_nombre }} ({{ comp.seccion_nombre }}){{ comp.jornada_nombre ? ' · ' + comp.jornada_nombre : '' }}
                              </span>
                              <p class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                                {{ comp.descripcion }}
                              </p>
                            </div>
                            <!-- Actions -->
                            <div v-if="!isSelectedPeriodClosed && !isReadOnly" class="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                              <button @click="openEditCompetency(comp)" class="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer" title="Editar competencia">
                                <Edit :size="14" />
                              </button>
                              <button @click="deleteCompetency(comp.id_competencia)" class="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer" title="Eliminar competencia">
                                <Trash2 :size="14" />
                              </button>
                            </div>
                          </div>

                          <!-- Evidences List -->
                          <div class="p-3.5 sm:p-4 bg-white dark:bg-slate-800/25 space-y-3">
                            <div class="flex items-center justify-between px-1">
                              <span class="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Evidencias de Aprendizaje</span>
                              <button v-if="!isSelectedPeriodClosed && !isReadOnly" @click="openAddEvidence(comp.id_competencia)" class="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer">
                                <Plus :size="12" /> Añadir
                              </button>
                            </div>

                            <div v-if="!comp.evidencias?.length" class="text-center py-5 bg-slate-50/20 dark:bg-slate-900/10 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                              <p class="text-xs font-bold text-slate-400 italic">No hay evidencias definidas.</p>
                            </div>

                            <div v-else class="divide-y divide-slate-50 dark:divide-slate-800/40">
                              <div 
                                v-for="(ev, idx) in comp.evidencias" 
                                :key="ev.id_evidencia"
                                class="py-2.5 sm:py-3 flex items-start justify-between gap-2.5 sm:gap-3 text-left group/ev"
                              >
                                <div class="flex items-start gap-2.5 min-w-0 flex-1">
                                  <span class="mt-0.5 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-300 shrink-0">
                                    {{ Number(idx) + 1 }}
                                  </span>
                                  <div class="min-w-0 flex-1">
                                    <p class="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                                      {{ ev.descripcion }}
                                    </p>
                                    <span v-if="ev.dba_codigo" class="inline-block mt-1 text-[10px] sm:text-xs font-bold bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                      DBA: {{ ev.dba_codigo }}
                                    </span>
                                  </div>
                                </div>
                                <!-- Actions (Always visible on mobile/touch, hover on desktop) -->
                                <div v-if="!isSelectedPeriodClosed && !isReadOnly" class="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover/ev:opacity-100 transition-opacity">
                                  <button @click="openEditEvidence(ev)" class="p-1 text-slate-400 hover:text-emerald-600 rounded cursor-pointer" title="Editar evidencia">
                                    <Edit :size="13" />
                                  </button>
                                  <button @click="deleteEvidence(ev.id_evidencia)" class="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer" title="Eliminar evidencia">
                                    <Trash2 :size="13" />
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
                      <!-- Filters & Search for Assignments (Optimized 2 cols max inside drawer) -->
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div class="space-y-1 text-left">
                          <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filtrar por Docente</label>
                          <select 
                            v-model="selectedTeacherId" 
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 sm:p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                          >
                            <option :value="null" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Todos los docentes</option>
                            <option v-for="t in uniqueTeachers" :key="t.id" :value="t.id" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                              {{ t.name }}
                            </option>
                          </select>
                        </div>
                        <div class="space-y-1 text-left">
                          <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filtrar por Grado</label>
                          <select 
                            v-model="selectedAssignmentGradeId"
                            @change="selectedAssignmentGroupId = null"
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 sm:p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                          >
                            <option :value="null" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Todos los grados</option>
                            <option v-for="gr in uniqueAssignmentGrades" :key="gr.id" :value="gr.id" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                              {{ gr.name }}
                            </option>
                          </select>
                        </div>
                        <div class="space-y-1 text-left">
                          <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filtrar por Curso</label>
                          <select 
                            v-model="selectedAssignmentGroupId" 
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 sm:p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                          >
                            <option :value="null" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">Todos los cursos</option>
                            <option v-for="g in uniqueAssignmentGroups" :key="g.id" :value="g.id" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                              {{ g.name }}
                            </option>
                          </select>
                        </div>
                        <div class="space-y-1 text-left">
                          <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Buscador Rápido</label>
                          <input 
                            v-model="assignmentSearchQuery" 
                            type="text" 
                            placeholder="Buscar docente o curso..."
                            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 sm:p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 transition-all"
                          />
                        </div>
                      </div>

                      <!-- Hierarchical Assignment List Component -->
                      <HierarchicalAssignmentList 
                        :items="filteredAssignments" 
                        mode="subject" 
                        :read-only="true"
                        empty-title="Sin docentes asignados"
                        empty-message="No se encontraron asignaciones de docentes para esta materia con los filtros seleccionados."
                      />
                    </div>

                  </div>
                </div>

                <!-- Footer -->
                <div class="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
                  <button @click="detailDrawerOpen = false" class="w-full sm:w-auto px-5 py-2.5 sm:px-6 sm:py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all cursor-pointer">
                    Cerrar panel
                  </button>
                </div>

              </div>
            </Transition>
          </div>
        </div>
      </Transition>

      <!-- Competency Add/Edit Modal -->
      <div v-if="showCompetencyModal" class="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showCompetencyModal = false"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] overflow-hidden border border-white/20 shadow-2xl max-h-[90dvh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div class="px-5 py-4 sm:px-8 sm:pt-8 sm:pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {{ competencyForm.id_competencia ? 'Editar Competencia' : 'Nueva Competencia' }}
            </h2>
            <p class="text-xs font-medium text-slate-500 mt-1">Ingresa los detalles académicos de la competencia para la materia.</p>
          </div>

          <div class="p-5 sm:p-8 space-y-4 sm:space-y-5 overflow-y-auto flex-1 custom-scrollbar">
            <!-- Group selection (Disabled if editing) -->
            <div class="space-y-1.5 text-left">
              <label class="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Curso / Grupo</label>
              <select 
                v-model="competencyForm.id_grupo" 
                :disabled="!!competencyForm.id_competencia"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm font-bold outline-none text-slate-900 dark:text-white cursor-pointer disabled:opacity-60"
              >
                <option v-for="g in subjectDetails?.groups" :key="g.id_grupo" :value="g.id_grupo" class="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                  {{ g.grado_nombre }}{{ g.tipo_grado_nombre ? ' - ' + g.tipo_grado_nombre : '' }} ({{ g.seccion_nombre }}) · {{ g.jornada_nombre }}
                </option>
              </select>
            </div>

            <!-- Description -->
            <div class="space-y-1.5 text-left">
              <label class="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Descripción de la Competencia</label>
              <textarea 
                v-model="competencyForm.descripcion" 
                rows="4"
                placeholder="Ej. Resuelve y formula problemas utilizando las propiedades de las funciones reales..." 
                class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-xs sm:text-sm font-bold outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400 resize-none"
              ></textarea>
            </div>

            <div class="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2 shrink-0">
              <button @click="showCompetencyModal = false" class="w-full sm:flex-1 px-5 py-3 sm:py-3.5 rounded-xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs uppercase cursor-pointer">Cancelar</button>
              <button @click="saveCompetency" :disabled="savingCompetency" class="w-full sm:flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 sm:py-3.5 rounded-xl font-black transition-all disabled:opacity-50 text-xs uppercase tracking-wide cursor-pointer">
                {{ savingCompetency ? 'Guardando...' : 'Confirmar Guardado' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Learning Evidence Add/Edit Modal -->
      <div v-if="showEvidenceModal" class="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showEvidenceModal = false"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] overflow-hidden border border-white/20 shadow-2xl max-h-[90dvh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div class="px-5 py-4 sm:px-8 sm:pt-8 sm:pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {{ evidenceForm.id_evidencia ? 'Editar Evidencia' : 'Nueva Evidencia de Aprendizaje' }}
            </h2>
            <p class="text-xs font-medium text-slate-500 mt-1">Escribe la evidencia observable para comprobar el avance del estudiante.</p>
          </div>

          <div class="p-5 sm:p-8 space-y-4 sm:space-y-5 overflow-y-auto flex-1 custom-scrollbar">
            <!-- Description -->
            <div class="space-y-1.5 text-left">
              <label class="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Descripción de la Evidencia</label>
              <textarea 
                v-model="evidenceForm.descripcion" 
                rows="4"
                placeholder="Ej. Identifica límites laterales a partir de la gráfica de una función..." 
                class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-xs sm:text-sm font-bold outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400 resize-none"
              ></textarea>
            </div>

            <div class="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2 shrink-0">
              <button @click="showEvidenceModal = false" class="w-full sm:flex-1 px-5 py-3 sm:py-3.5 rounded-xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs uppercase cursor-pointer">Cancelar</button>
              <button @click="saveEvidence" :disabled="savingEvidence" class="w-full sm:flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 sm:py-3.5 rounded-xl font-black transition-all disabled:opacity-50 text-xs uppercase tracking-wide cursor-pointer">
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
