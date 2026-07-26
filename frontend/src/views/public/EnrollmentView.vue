<script setup lang="ts">
import { ref, computed } from 'vue'
import axios from 'axios'
import { useNotificationStore } from '../../stores/notifications'
import { isValidEmail } from '../../utils/validationHelper'
import { 
  School, 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  FileText,
  Camera,
  AlertCircle,
  Calendar,
  CalendarDays
} from 'lucide-vue-next'

const step = ref(1)
const schoolId = ref('')
const level = ref('')
const selectedTipoGrado = ref('')
const grade = ref('') // Este guardará el id_grado final

const formData = ref({
  parentEmail: '',
  hasDisability: false,
  isForeigner: false
})

const files = ref<Record<string, File | null>>({
  registroCivil: null,
  documentoIdentidad: null,
  documentoPadre: null,
  vacunas: null,
  salud: null,
  foto: null,
  visa: null,
  reciboPublico: null,
  certificadoDiscapacidad: null,
  certificadosEscolaridad: null
})

const schools = ref<any[]>([])
const allGrados = ref<any[]>([])
const loadingGrados = ref(false)

const fetchInitialData = async () => {
  try {
    const resSchools = await axios.get('http://localhost:3000/api/matriculas')
    schools.value = resSchools.data
  } catch (error) {
    console.error('Error fetching schools:', error)
  }
}

const fetchGrados = async () => {
  if (!schoolId.value) return
  loadingGrados.value = true
  try {
    const response = await axios.get(`http://localhost:3000/api/grados/available/${schoolId.value}`)
    allGrados.value = response.data
  } catch (error) {
    console.error('Error fetching grades:', error)
  } finally {
    loadingGrados.value = false
  }
}

import { onMounted, watch } from 'vue'
onMounted(fetchInitialData)

const enrollmentConfig = ref<any>(null)
const yearLabel = ref<string | null>(null)
const loadingConfig = ref(false)

const fetchEnrollmentConfig = async () => {
  if (!schoolId.value) {
    enrollmentConfig.value = null
    yearLabel.value = null
    return
  }
  loadingConfig.value = true
  try {
    const res = await axios.get(`http://localhost:3000/api/matriculas/school/${schoolId.value}/enrollment-config`)
    enrollmentConfig.value = res.data.config
    yearLabel.value = res.data.yearLabel
  } catch (error) {
    console.error('Error fetching public enrollment config:', error)
    enrollmentConfig.value = null
    yearLabel.value = null
  } finally {
    loadingConfig.value = false
  }
}

const formattedFechaInicio = computed(() => {
  if (!enrollmentConfig.value?.fecha_inicio) return 'No configurada'
  const d = new Date(enrollmentConfig.value.fecha_inicio)
  if (isNaN(d.getTime())) return 'No configurada'
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
})

const formattedFechaCierre = computed(() => {
  if (!enrollmentConfig.value?.fecha_cierre) return 'No configurada'
  const d = new Date(enrollmentConfig.value.fecha_cierre)
  if (isNaN(d.getTime())) return 'No configurada'
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
})

const isEnrollmentOpen = computed(() => {
  if (!schoolId.value) return true
  if (!enrollmentConfig.value) return false
  if (!enrollmentConfig.value.habilitada) return false
  if (enrollmentConfig.value.hasApproved) return false
  
  const now = new Date()
  const start = new Date(enrollmentConfig.value.fecha_inicio)
  const end = new Date(enrollmentConfig.value.fecha_cierre)
  return now >= start && now <= end
})

const submitButtonText = computed(() => {
  if (schoolId.value && enrollmentConfig.value && !enrollmentConfig.value.habilitada) {
    return 'DESHABILITADO'
  }
  return 'Cargar Documentos'
})

const enrollmentStatusMessage = computed(() => {
  if (!schoolId.value) return ''
  if (!enrollmentConfig.value) {
    return 'Las inscripciones para esta institución aún no han sido configuradas por las directivas.'
  }
  if (enrollmentConfig.value.hasApproved) {
    return `Las inscripciones para el año lectivo ${yearLabel.value || ''} ya han finalizado.`
  }
  if (!enrollmentConfig.value.habilitada) {
    return 'Las inscripciones están deshabilitadas temporalmente por la institución.'
  }
  
  const now = new Date()
  const start = new Date(enrollmentConfig.value.fecha_inicio)
  const end = new Date(enrollmentConfig.value.fecha_cierre)
  
  if (now < start) {
    return `Las inscripciones para el año lectivo ${yearLabel.value || ''} aún no han comenzado. Iniciarán el ${start.toLocaleString('es-CO')}.`
  }
  if (now > end) {
    return `Las inscripciones para el año lectivo ${yearLabel.value || ''} ya cerraron el día ${end.toLocaleString('es-CO')}.`
  }
  
  return `Inscripciones abiertas para el año lectivo ${yearLabel.value || ''} desde el ${start.toLocaleDateString('es-CO')} hasta el ${end.toLocaleDateString('es-CO')}.`
})

watch(schoolId, () => {
  level.value = ''
  selectedTipoGrado.value = ''
  grade.value = ''
  fetchGrados()
  fetchEnrollmentConfig()
})

watch(level, () => {
  selectedTipoGrado.value = ''
  grade.value = ''
})

watch(selectedTipoGrado, () => {
  grade.value = ''
})

const levels = computed(() => {
  const uniqueLevels = [...new Set(allGrados.value.map(g => g.nivel))]
  return uniqueLevels.map(l => ({ id: l, name: l }))
})

const availableTipoGrados = computed(() => {
  if (!level.value) return []
  const filtered = allGrados.value.filter(g => g.nivel === level.value)
  const uniqueTypes = [...new Set(filtered.map(g => g.tipo_grado))]
  return uniqueTypes.sort()
})

const availableJornadas = computed(() => {
  if (!selectedTipoGrado.value) return []
  const filtered = allGrados.value.filter(g => g.nivel === level.value && g.tipo_grado === selectedTipoGrado.value)
  
  // Agrupar por nombre de jornada
  const grouped: Record<string, any> = {}
  filtered.forEach(g => {
    const name = g.jornada || 'ÚNICA'
    if (!grouped[name]) {
      grouped[name] = {
        id: g.id_grado, // Tomamos el primero como referencia
        name: name,
        cupos: 0
      }
    }
    grouped[name].cupos += Number(g.cupos_restantes)
  })
  
  return Object.values(grouped)
})

const showDoc = (docType: string) => {
  const isHigher = level.value === 'SECUNDARIA' || level.value === 'MEDIA'
  const isPre = level.value === 'PREESCOLAR'

  if (docType === 'registroCivil') return !isHigher
  if (docType === 'documentoIdentidad') return !isPre
  if (docType === 'vacunas') return !isHigher
  if (docType === 'certificadosEscolaridad') return !isPre
  if (docType === 'visa') return formData.value.isForeigner
  if (docType === 'certificadoDiscapacidad') return formData.value.hasDisability
  
  return true
}

const handleFileUpload = (event: Event, key: string) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (file.size > 2 * 1024 * 1024) {
      alert('El archivo no puede superar los 2MB')
      target.value = ''
      return
    }
    files.value[key] = file
  }
}

const notify = useNotificationStore()

const docLabels: Record<string, string> = {
  registroCivil: 'Registro Civil',
  documentoIdentidad: 'Doc. Identidad Estudiante',
  documentoPadre: 'Doc. Identidad Acudiente',
  vacunas: 'Carné de Vacunas',
  salud: 'Certificado Salud',
  foto: 'Foto 3x4',
  reciboPublico: 'Recibo Servicio Público',
  visa: 'Visa / PPT',
  certificadoDiscapacidad: 'Diagnóstico Médico',
  certificadosEscolaridad: 'Certificados de Escolaridad'
}

const nextStep = () => {
  if (step.value === 1) {
    if (!schoolId.value || !level.value || !grade.value || !formData.value.parentEmail) {
      notify.addNotification('Por favor completa todos los campos obligatorios.', 'warning')
      return
    }
    if (!isValidEmail(formData.value.parentEmail)) {
      notify.addNotification('Por favor ingresa un correo electrónico válido (ejemplo: usuario@correo.com).', 'warning')
      return
    }
    if (!isEnrollmentOpen.value) {
      notify.addNotification('Las inscripciones para este colegio están cerradas o deshabilitadas.', 'error')
      return
    }
  }

  if (step.value === 2) {
    // Verificar que todos los docs visibles estén cargados
    const missingDocs: string[] = []
    for (const key of Object.keys(files.value)) {
      if (showDoc(key) && !files.value[key]) {
        missingDocs.push(docLabels[key] || key)
      }
    }
    if (missingDocs.length > 0) {
      notify.addNotification(`Documentos faltantes: ${missingDocs.join(', ')}`, 'warning')
      return
    }
  }

  step.value++
}
const prevStep = () => step.value--

const submitEnrollment = async () => {
  try {
    const formDataPayload = new FormData()
    
    // Datos básicos
    formDataPayload.append('id_colegio', schoolId.value)
    formDataPayload.append('parentEmail', formData.value.parentEmail)
    formDataPayload.append('level', level.value)
    formDataPayload.append('grade', grade.value)
    formDataPayload.append('hasDisability', String(formData.value.hasDisability))
    formDataPayload.append('isForeigner', String(formData.value.isForeigner))

    // Archivos
    for (const [key, file] of Object.entries(files.value)) {
      if (file) {
        formDataPayload.append(key, file)
      }
    }

    await axios.post('http://localhost:3000/api/matriculas/submit', formDataPayload, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    notify.addNotification('Matrícula enviada exitosamente. Los datos personales se solicitarán una vez validados estos documentos.', 'success')
    setTimeout(() => {
      window.location.href = '/'
    }, 1500)
  } catch (error) {
    console.error('Error al enviar:', error)
    notify.addNotification('Hubo un error al enviar el formulario. Por favor intenta de nuevo.', 'error')
  }
}
</script>

<template>
  <div class="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8 font-sans">
    <div class="max-w-5xl mx-auto">
      <!-- Navbar -->
      <div class="mb-12 flex items-center justify-between">
        <router-link to="/" class="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-all font-medium">
          <ArrowLeft :size="20" />
          <span>Volver</span>
        </router-link>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-indigo-600 rounded-lg text-white">
            <School :size="24" />
          </div>
          <span class="text-xl font-bold tracking-tight">Academia<span class="text-indigo-600">Neiva</span></span>
        </div>
      </div>

      <!-- Stepper -->
      <div class="mb-12">
        <div class="flex items-center justify-between max-w-2xl mx-auto relative">
          <div class="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -z-10"></div>
          <div v-for="i in 3" :key="i" 
            :class="[
              step >= i ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-gray-400 border border-gray-200',
              'h-10 w-10 rounded-full flex items-center justify-center font-bold transition-all duration-500 relative z-10'
            ]"
          >
            {{ i }}
            <span :class="[step >= i ? 'text-indigo-600 font-bold' : 'text-gray-400 font-medium', 'absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap']">
              {{ i === 1 ? 'Institución' : i === 2 ? 'Documentos' : 'Finalizar' }}
            </span>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-[2rem] border border-gray-100 shadow-2xl shadow-indigo-50/50 overflow-hidden mt-16">
        <div class="p-8 sm:p-12">
          
          <!-- PASO 1: Selección de Cupo -->
          <div v-if="step === 1" class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="border-b border-gray-100 pb-6">
              <h3 class="text-3xl font-bold text-gray-900">Solicitud de Matrícula</h3>
              <p class="text-gray-500 mt-2">Este formulario es para la carga inicial de documentos y reserva de cupo.</p>
            </div>

            <!-- Banner y Tarjeta Informativa de Fechas de Inscripción -->
            <div v-if="schoolId && !loadingConfig && enrollmentConfig" 
              class="rounded-3xl border p-6 space-y-4 shadow-sm transition-all"
              :class="[
                isEnrollmentOpen 
                  ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/60 border-emerald-200 text-emerald-950' 
                  : 'bg-gradient-to-br from-rose-50/90 to-amber-50/60 border-rose-200 text-rose-950'
              ]"
            >
              <div class="flex items-start gap-3">
                <component :is="isEnrollmentOpen ? CheckCircle2 : AlertCircle" class="h-6 w-6 shrink-0 mt-0.5" :class="isEnrollmentOpen ? 'text-emerald-600' : 'text-rose-600'" />
                <div class="space-y-1">
                  <h4 class="text-base font-extrabold flex flex-wrap items-center gap-2">
                    <span>Estado de Inscripciones — Año Lectivo {{ yearLabel || '' }}</span>
                    <span :class="[
                      isEnrollmentOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
                      'px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider'
                    ]">
                      {{ isEnrollmentOpen ? 'Abiertas' : 'Cerradas / Inactivas' }}
                    </span>
                  </h4>
                  <p class="text-sm font-medium opacity-90 leading-relaxed">
                    {{ enrollmentStatusMessage }}
                  </p>
                </div>
              </div>

              <!-- Fechas de Inicio y Cierre -->
              <div v-if="enrollmentConfig.fecha_inicio && enrollmentConfig.fecha_cierre" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-black/5">
                <div class="flex items-center gap-3 bg-white/80 backdrop-blur-sm p-3.5 rounded-2xl border border-black/5 shadow-xs">
                  <div class="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                    <Calendar :size="18" />
                  </div>
                  <div>
                    <span class="block text-[11px] font-black uppercase tracking-wider text-gray-400">Apertura de Inscripciones</span>
                    <span class="text-sm font-bold text-gray-800">
                      {{ formattedFechaInicio }}
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-3 bg-white/80 backdrop-blur-sm p-3.5 rounded-2xl border border-black/5 shadow-xs">
                  <div class="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                    <CalendarDays :size="18" />
                  </div>
                  <div>
                    <span class="block text-[11px] font-black uppercase tracking-wider text-gray-400">Cierre de Inscripciones</span>
                    <span class="text-sm font-bold text-gray-800">
                      {{ formattedFechaCierre }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-sm font-bold text-gray-700">Selecciona tu Colegio</label>
                <select v-model="schoolId" class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent p-4 transition-all">
                  <option value="" disabled>Selecciona el colegio</option>
                  <option v-for="s in schools" :key="s.id_colegio" :value="s.id_colegio">{{ s.nombre }}</option>
                </select>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-bold text-gray-700">Correo del Padre de Familia</label>
                <input v-model="formData.parentEmail" type="email" class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent p-4 transition-all" placeholder="ejemplo@correo.com">
              </div>

              <div class="space-y-2">
                <label class="text-sm font-bold text-gray-700">Nivel Escolar</label>
                <select v-model="level" class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent p-4 transition-all">
                  <option value="" disabled>Selecciona nivel</option>
                  <option v-for="l in levels" :key="l.id" :value="l.id">{{ l.name }}</option>
                </select>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-bold text-gray-700">Grado Solicitado</label>
                <select v-model="selectedTipoGrado" :disabled="!level || loadingGrados" class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent p-4 transition-all disabled:opacity-50">
                  <option value="" disabled>{{ level ? 'Selecciona grado' : 'Primero elige un nivel' }}</option>
                  <option v-for="gt in availableTipoGrados" :key="gt" :value="gt">{{ gt }}</option>
                </select>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-bold text-gray-700">Jornada</label>
                <select v-model="grade" :disabled="!selectedTipoGrado" class="w-full rounded-2xl border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent p-4 transition-all disabled:opacity-50">
                  <option value="" disabled>{{ selectedTipoGrado ? 'Selecciona jornada' : 'Elige un grado primero' }}</option>
                  <option v-for="j in availableJornadas" :key="j.id" :value="j.id" :disabled="j.cupos <= 0">
                    {{ j.name }} ({{ j.cupos }} cupos disponibles)
                  </option>
                </select>
                <p v-if="selectedTipoGrado && availableJornadas.every(j => j.cupos <= 0)" class="text-xs text-amber-600 flex items-center gap-1 mt-1">
                  <AlertCircle :size="12" /> No hay cupos disponibles en ninguna jornada para este grado.
                </p>
              </div>

              <div class="md:col-span-2 flex flex-wrap gap-6 bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100/50">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="formData.hasDisability" type="checkbox" class="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500">
                  <span class="text-sm font-medium text-gray-700">¿Posee alguna discapacidad o trastorno?</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="formData.isForeigner" type="checkbox" class="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500">
                  <span class="text-sm font-medium text-gray-700">¿Es estudiante extranjero?</span>
                </label>
              </div>
            </div>

            <div class="pt-8 flex justify-end">
              <button 
                @click="nextStep" 
                :disabled="submitButtonText === 'DESHABILITADO'"
                :class="[
                  submitButtonText === 'DESHABILITADO' 
                    ? 'bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed opacity-50' 
                    : 'bg-gray-900 hover:bg-indigo-600 text-white active:scale-95 shadow-xl',
                  'px-10 py-4 rounded-2xl font-bold transition-all flex items-center gap-2'
                ]"
              >
                {{ submitButtonText }}
                <ArrowLeft v-if="submitButtonText !== 'DESHABILITADO'" :size="20" class="rotate-180" />
              </button>
            </div>
          </div>

          <!-- PASO 2: Carga de Documentos -->
          <div v-if="step === 2" class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="border-b border-gray-100 pb-6">
              <h3 class="text-3xl font-bold text-gray-900">Documentación</h3>
              <p class="text-gray-500 mt-2">Sube los archivos requeridos para el nivel {{ levels.find(l => l.id === level)?.name }}.</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <template v-for="(label, key) in {
                registroCivil: 'Registro Civil (Si aplica)',
                documentoIdentidad: 'Doc. Identidad Estudiante',
                documentoPadre: 'Doc. Identidad Acudiente',
                vacunas: 'Carné de Vacunas / PAI',
                salud: 'Certificado Salud (SGSSS)',
                foto: 'Foto 3x4 (Fondo blanco)',
                reciboPublico: 'Recibo Servicio Público',
                visa: 'Visa / PPT / Extranjería',
                certificadoDiscapacidad: 'Diagnóstico Médico',
                certificadosEscolaridad: 'Certificados Grados Anteriores'
              }" :key="key">
                
                <div v-if="showDoc(key as string)" class="relative">
                  <label class="block p-6 rounded-3xl border-2 border-dashed transition-all cursor-pointer group h-full"
                    :class="[files[key] ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 hover:border-indigo-400 bg-gray-50/50 hover:bg-white shadow-sm']"
                  >
                    <input type="file" class="hidden" @change="e => handleFileUpload(e, key as string)" accept=".pdf,image/*">
                    
                    <div class="flex flex-col items-center text-center">
                      <div :class="[files[key] ? 'text-emerald-600 bg-emerald-100' : 'text-gray-400 bg-gray-100 group-hover:text-indigo-600 transition-colors', 'p-3 rounded-2xl mb-4']">
                        <component :is="key === 'foto' ? Camera : (files[key] ? CheckCircle2 : FileText)" :size="28" />
                      </div>
                      <span class="text-sm font-bold text-gray-800 leading-tight">{{ label }}</span>
                      
                      <!-- Regla específica de certificados escolaridad -->
                      <span v-if="key === 'certificadosEscolaridad'" class="mt-2 text-[10px] text-gray-400 leading-none">
                        Grado 5° (Primaria) o 9° (Secundaria) o año anterior.
                      </span>

                      <span class="mt-auto pt-4 text-xs truncate w-full px-2" :class="files[key] ? 'text-emerald-600 font-bold' : 'text-gray-400'">
                        {{ files[key] ? files[key]?.name : 'Subir archivo (PDF/IMG)' }}
                      </span>
                    </div>
                  </label>
                </div>
              </template>

            </div>

            <div class="pt-8 flex justify-between">
              <button @click="prevStep" class="text-gray-500 font-bold px-4 py-2">Volver</button>
              <button @click="nextStep" class="bg-gray-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-xl active:scale-95">
                Continuar
              </button>
            </div>
          </div>

          <!-- PASO 3: Finalizar -->
          <div v-if="step === 3" class="text-center py-12 animate-in zoom-in duration-500">
            <div class="h-24 w-24 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-indigo-200 mb-8">
              <Send :size="40" />
            </div>
            <h3 class="text-4xl font-extrabold text-gray-900">Confirmación de Envío</h3>
            <p class="text-gray-500 mt-6 max-w-lg mx-auto">
              Al enviar el formulario, los documentos pasarán a validación por un Directivo. Una vez aprobados, se te solicitarán los datos personales detallados del estudiante.
            </p>
            
            <div class="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button @click="prevStep" class="w-full sm:w-auto text-gray-500 font-bold px-12 py-4">Revisar</button>
              <button @click="submitEnrollment" class="w-full sm:w-auto bg-indigo-600 text-white px-16 py-5 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-2xl active:scale-95 text-lg">
                Enviar Solicitud
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
