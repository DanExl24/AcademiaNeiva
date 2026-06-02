<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Generador de Boletines</h1>
        <p class="mt-2 text-slate-500">Configura y exporta los boletines académicos del periodo cerrado.</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Colegios (si se requiere) o Periodo -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Periodo Académico</label>
          <select v-model="selectedPeriodo" class="w-full h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow">
            <option value="">Seleccione un periodo cerrado</option>
            <option v-for="periodo in periodos" :key="periodo.id_periodo" :value="periodo.id_periodo">
              {{ periodo.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Nivel</label>
          <select v-model="selectedLevel" class="w-full h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow">
            <option value="">Seleccione nivel</option>
            <option v-for="level in levels" :key="level.id_nivel" :value="level.id_nivel">
              {{ level.nombre }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Grupo</label>
          <select v-model="selectedGroup" @change="fetchStudentsForGroup" :disabled="!selectedLevel" class="w-full h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow disabled:bg-slate-50 disabled:text-slate-400">
            <option value="">Seleccione grupo</option>
            <option v-for="grupo in filteredGroups" :key="grupo.id_grupo" :value="grupo.id_grupo">
              {{ grupo.tipo_grado_nombre }} - Grupo {{ grupo.seccion_nombre }} ({{ grupo.jornada_nombre }})
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Estudiante Opcional</label>
          <select v-model="selectedStudent" :disabled="!selectedGroup" class="w-full h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500 shadow-sm transition-shadow disabled:bg-slate-50 disabled:text-slate-400">
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
          class="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
    <div v-if="error" class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-red-700 font-medium">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Results Overview & Download PDF -->
    <div v-if="boletinesData.length > 0" class="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between shadow-inner">
      <div class="flex items-center mb-4 sm:mb-0">
        <div class="p-3 bg-indigo-100 rounded-full mr-4 text-indigo-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h3 class="text-lg font-bold text-indigo-900">Listos para Generar</h3>
          <p class="text-sm text-indigo-700">{{ boletinesData.length }} boletines cargados exitosamente.</p>
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
        <div class="absolute -top-4 -right-4 bg-white border border-slate-200 shadow-sm rounded-full h-8 w-8 flex items-center justify-center font-bold text-slate-500 text-sm">
          {{ idx + 1 }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '../../stores/auth'
import BoletinPreview from '../../components/boletines/BoletinPreview.vue'
import html2pdf from 'html2pdf.js'

const auth = useAuthStore()

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
  return groups.value.filter(g => g.id_nivel === selectedLevel.value)
})

const fetchInitialData = async () => {
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    
    const schoolId = auth.user?.schoolId || 1
    const [settingsRes, gradesRes] = await Promise.all([
      fetch(`http://localhost:3000/api/academic-admin/settings/${schoolId}`, { headers }),
      fetch(`http://localhost:3000/api/academic-admin/grades/${schoolId}`, { headers })
    ])
    
    if (settingsRes.ok && gradesRes.ok) {
      const settingsData = await settingsRes.json()
      const gradesData = await gradesRes.json()
      
      // Use closed periods strictly
      periodos.value = settingsData.periods.filter((p: any) => p.estado === 'CERRADO')
      levels.value = gradesData.niveles
      groups.value = gradesData.grupos
    }
  } catch (err) {
    console.error("Error al cargar datos iniciales:", err)
    error.value = "Hubo un problema de conexión para obtener listas."
  }
}

onMounted(() => {
  fetchInitialData()
})

const fetchStudentsForGroup = async () => {
  if (!selectedGroup.value) return
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await fetch(`http://localhost:3000/api/matriculas/colegio`, { headers })
    if (res.ok) {
      const data = await res.json()
      // Filter the ones in the group manually if backend doesn't provide direct group endpoint
      // Adjust according to existing backend
      students.value = data.filter((m: any) => m.id_grupo === selectedGroup.value).map((m:any) => m.estudiante || m) 
    }
  } catch (err) {
    console.error(err)
  }
}

const collectPreviewRefs = (el: any, index: number) => {
  if (el) {
    previewRefs.value[index] = el
  }
}

const fetchBoletinData = async () => {
  error.value = ''
  isLoading.value = true
  boletinesData.value = []
  previewRefs.value = []

  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    
    // Si hay un estudiante específico, trae solo ese.
    if (selectedStudent.value) {
      const res = await fetch(`http://localhost:3000/api/boletines/student/${selectedStudent.value}/${selectedPeriodo.value}`, { headers })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error fetching boletin individual')
      }
      const data = await res.json()
      boletinesData.value.push(data)
    } else {
      // Masivo (todo el grupo)
      const groupRes = await fetch(`http://localhost:3000/api/boletines/grade/${selectedGroup.value}/${selectedPeriodo.value}`, { headers })
      if (!groupRes.ok) {
         const d = await groupRes.json()
         throw new Error(d.error || 'Error fetching boletines masivos')
      }
      const groupData = await groupRes.json()
      const ids = groupData.students || []
      
      for (const id of ids) {
        const sRes = await fetch(`http://localhost:3000/api/boletines/student/${id}/${selectedPeriodo.value}`, { headers })
        if (sRes.ok) {
          boletinesData.value.push(await sRes.json())
        }
      }
    }
  } catch (err: any) {
    console.error(err)
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
