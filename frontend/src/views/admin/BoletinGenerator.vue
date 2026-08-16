<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Generador de Boletines</h1>
        <p class="mt-2 text-slate-500 dark:text-slate-400">Configura y exporta los boletines académicos del periodo cerrado.</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Colegios (si se requiere) o Periodo -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Periodo Académico</label>
          <select v-model="selectedPeriodo" class="w-full h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow">
            <option value="">Seleccione un periodo cerrado</option>
            <option v-for="periodo in periodos" :key="periodo.id_periodo" :value="periodo.id_periodo">
              {{ periodo.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Nivel</label>
          <select v-model="selectedLevel" class="w-full h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow">
            <option value="">Seleccione nivel</option>
            <option v-for="level in levels" :key="level.id_nivel" :value="level.id_nivel">
              {{ level.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Grupo</label>
          <select v-model="selectedGroup" @change="fetchStudentsForGroup" :disabled="!selectedLevel" class="w-full h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow disabled:bg-slate-50 dark:disabled:bg-slate-950/40 disabled:text-slate-400 dark:disabled:text-slate-600">
            <option value="">Seleccione grupo</option>
            <option v-for="grupo in filteredGroups" :key="grupo.id_grupo" :value="grupo.id_grupo">
              {{ getCourseDisplayName({ tipo_grado_nombre: grupo.tipo_grado_nombre, seccion_nombre: grupo.seccion_nombre }) }} ({{ grupo.jornada_nombre }})
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Estudiante Opcional</label>
          <select v-model="selectedStudent" :disabled="!selectedGroup" class="w-full h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow disabled:bg-slate-50 dark:disabled:bg-slate-950/40 disabled:text-slate-400 dark:disabled:text-slate-600">
            <option value="">Todos los estudiantes (Generación masiva)</option>
            <option v-for="student in students" :key="student.id_estudiante" :value="student.id_estudiante">
              {{ student.nombre }} {{ student.apellido }}
            </option>
          </select>
        </div>
      </div>
      
      <div class="mt-6 flex justify-end">
        <button 
          @click="fetchBoletinData" 
          :disabled="!selectedPeriodo || !selectedGroup || isLoading"
          class="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:ring-offset-slate-950"
        >
          <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isLoading ? 'Cargando datos...' : 'Visualizar Boletines' }}
        </button>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="error" class="bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/30 border-l-4 dark:border-l-red-500 p-4 rounded-r-xl shadow-sm">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-red-700 dark:text-red-400 font-medium">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Results Overview & Download PDF -->
    <div v-if="boletinesData.length > 0" class="bg-indigo-50 dark:bg-indigo-950/15 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between shadow-inner">
      <div class="flex items-center mb-4 sm:mb-0">
        <div class="p-3 bg-indigo-100 dark:bg-indigo-900/35 rounded-full mr-4 text-indigo-600 dark:text-indigo-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-bold text-indigo-900 dark:text-indigo-300">Listos para Generar</h3>
          <p class="text-sm text-indigo-700 dark:text-indigo-400">{{ boletinesData.length }} boletines cargados exitosamente.</p>
        </div>
      </div>
      <button 
        @click="exportToPDF"
        :disabled="isExporting"
        class="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl shadow-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <svg v-if="isExporting" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <svg v-else class="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {{ isExporting ? 'Generando PDFs...' : 'Descargar en PDF' }}
      </button>
    </div>

    <!-- Previews -->
    <div class="space-y-12">
      <div v-for="(b, idx) in boletinesData" :key="idx" class="relative">
        <!-- Render preview component, we pass the ref to an array -->
        <BoletinPreview :data="b" :ref="el => collectPreviewRefs(el, idx)" />
        <div class="absolute -top-4 -right-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-full h-8 w-8 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 text-sm">
          {{ idx + 1 }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useAcademicYearStore } from '../../stores/academicYear'
import { API_BASE_URL } from '../../config/api'
import BoletinPreview from '../../components/boletines/BoletinPreview.vue'
import html2pdf from 'html2pdf.js'
import { getCourseDisplayName } from '../../utils/courseHelper'

const auth = useAuthStore()
const yearStore = useAcademicYearStore()

const periodos = ref<any[]>([])
const levels = ref<any[]>([])
const groups = ref<any[]>([])
const students = ref<any[]>([])

const selectedPeriodo = ref('')
const selectedLevel = ref('')
const selectedGroup = ref('')
const selectedStudent = ref('')

const isLoading = ref(false)
const isExporting = ref(false)
const error = ref('')

const boletinesData = ref<any[]>([])
const previewRefs = ref<any[]>([])

const filteredGroups = computed(() => {
  if (!selectedLevel.value) return []
  return groups.value.filter(g => g.id_nivel === selectedLevel.value && groupsWithStudents.value.has(g.id_grupo))
})

// Set of group IDs that have at least one enrolled student
const groupsWithStudents = ref<Set<number>>(new Set())
const allStudents = ref<any[]>([])

const fetchInitialData = async () => {
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    
    const schoolId = auth.user?.schoolId || 1
    const yearIdParam = yearStore.selectedYearId ? `?id_anio=${yearStore.selectedYearId}&keys=periods,scales` : '?keys=periods,scales'
    const studentYearParam = yearStore.selectedYearId ? `?estado=ACTIVO&yearId=${yearStore.selectedYearId}` : '?estado=ACTIVO'
    const [settingsRes, gradesRes, studentsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/academic-admin/settings/${schoolId}${yearIdParam}`, { headers }),
      fetch(`${API_BASE_URL}/api/academic-admin/grades/${schoolId}${yearIdParam}`, { headers }),
      fetch(`${API_BASE_URL}/api/student/colegio/${schoolId}${studentYearParam}`, { headers })
    ])
    
    if (settingsRes.ok && gradesRes.ok) {
      const settingsData = await settingsRes.json()
      const gradesData = await gradesRes.json()
      
      // Use closed periods strictly for selected year
      let allP = settingsData.periods.filter((p: any) => p.estado === 'CERRADO')
      if (yearStore.selectedYearId) {
        allP = allP.filter((p: any) => p.id_anio === yearStore.selectedYearId)
      }
      periodos.value = allP
      levels.value = gradesData.niveles
      groups.value = gradesData.grupos
    }

    // Build set of groups that have enrolled active students
    if (studentsRes.ok) {
      allStudents.value = await studentsRes.json()
      const gSet = new Set<number>()
      for (const s of allStudents.value) {
        if (
          s.id_grupo &&
          s.matricula_estado !== 'TRASLADADA' &&
          (s.matricula_estado === 'ACTIVA' || s.estado_vigente === 'ACTIVO' || s.estado === 'ACTIVO')
        ) {
          gSet.add(s.id_grupo)
        }
      }
      groupsWithStudents.value = gSet
    }
  } catch (err) {
    console.error("Error al cargar datos iniciales:", err)
    error.value = "Hubo un problema de conexión para obtener listas."
  }
}

onMounted(() => {
  fetchInitialData()
})

watch(() => yearStore.selectedYearId, () => {
  selectedPeriodo.value = ''
  selectedGroup.value = ''
  selectedStudent.value = ''
  students.value = []
  fetchInitialData()
})

const fetchStudentsForGroup = async () => {
  if (!selectedGroup.value) {
    students.value = []
    return
  }
  // Filter from already-loaded students, ensuring only active students in the selected group
  students.value = allStudents.value.filter(
    (s: any) =>
      s.id_grupo === selectedGroup.value &&
      s.matricula_estado !== 'TRASLADADA' &&
      (s.matricula_estado === 'ACTIVA' || s.estado_vigente === 'ACTIVO' || s.estado === 'ACTIVO')
  )
}

const collectPreviewRefs = (el: any, index: number) => {
  if (el) {
    previewRefs.value[index] = el
  }
}

const fetchBoletinData = async () => {
  console.log('[fetchBoletinData] Start fetching boletines:', {
    selectedPeriodo: selectedPeriodo.value,
    selectedLevel: selectedLevel.value,
    selectedGroup: selectedGroup.value,
    selectedStudent: selectedStudent.value
  })
  error.value = ''
  isLoading.value = true
  boletinesData.value = []
  previewRefs.value = []

  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    
    // Si hay un estudiante específico, trae solo ese.
    if (selectedStudent.value) {
      const url = `${API_BASE_URL}/api/boletines/student/${selectedStudent.value}/${selectedPeriodo.value}`
      console.log('[fetchBoletinData] Fetching student bulletin:', url)
      const res = await fetch(url, { headers })
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok) {
        let errStr = `Error HTTP ${res.status}`
        if (contentType.includes('application/json')) {
          const d = await res.json()
          errStr = d.error || errStr
        } else {
          console.error('[fetchBoletinData] Non-JSON error:', await res.text())
          errStr = `El servidor backend devolvió un error (HTTP ${res.status}).`
        }
        throw new Error(errStr)
      }
      const data = await res.json()
      console.log('[fetchBoletinData] Student bulletin loaded successfully:', data)
      boletinesData.value.push(data)
    } else {
      const url = `${API_BASE_URL}/api/boletines/grade/${selectedGroup.value}/${selectedPeriodo.value}`
      console.log('[fetchBoletinData] Fetching mass group bulletins:', url)
      const groupRes = await fetch(url, { headers })
      const contentType = groupRes.headers.get('content-type') || ''
      if (!groupRes.ok) {
         let errStr = `Error HTTP ${groupRes.status}`
         if (contentType.includes('application/json')) {
           const d = await groupRes.json()
           errStr = d.error || errStr
         } else {
           console.error('[fetchBoletinData] Non-JSON group error:', await groupRes.text())
           errStr = `El servidor backend devolvió un error (HTTP ${groupRes.status}).`
         }
         throw new Error(errStr)
      }
      const groupData = await groupRes.json()
      const ids = groupData.students || []
      console.log('[fetchBoletinData] Student IDs to generate:', ids)
      
      for (const id of ids) {
        const sUrl = `${API_BASE_URL}/api/boletines/student/${id}/${selectedPeriodo.value}`
        console.log('[fetchBoletinData] Fetching individual student in loop:', sUrl)
        const sRes = await fetch(sUrl, { headers })
        if (sRes.ok) {
          const sData = await sRes.json()
          console.log(`[fetchBoletinData] Loaded student ${id} success:`, sData)
          boletinesData.value.push(sData)
        } else {
          console.error(`[fetchBoletinData] Failed to load student ${id}:`, sRes.status)
        }
      }
    }
  } catch (err: any) {
    console.error('[fetchBoletinData] Caught error:', err)
    error.value = err.message || 'Error al conectar con el servidor'
  } finally {
    isLoading.value = false
  }
}

const exportToPDF = async () => {
  isExporting.value = true
  try {
    // Generate each PDF, wait for nextTick to ensure they are rendered
    await nextTick()
    
    for (let i = 0; i < previewRefs.value.length; i++) {
        const preview = previewRefs.value[i]
        const element = preview.boletinRef

        const opt = {
            margin:       0.5,
            filename:     `boletin_${boletinesData.value[i]?.estudiante?.codigo}_${boletinesData.value[i]?.periodo}.pdf`,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const }
        }

        // We run a small timeout to allow sequential download if mass generation
        await new Promise(resolve => setTimeout(resolve, 500))
        await html2pdf().set(opt).from(element).save()
    }
  } catch (err: any) {
      console.error(err)
      error.value = "Error convirtiendo a PDF"
  } finally {
      isExporting.value = false
  }
}

</script>
