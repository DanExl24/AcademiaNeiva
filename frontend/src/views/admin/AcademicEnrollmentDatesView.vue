<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import { 
  ArrowLeft, 
  CalendarDays, 
  Save, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Calendar,
  Lock,
  Unlock
} from 'lucide-vue-next'

interface AcademicYear {
  id_año: number
  calendario: string | null
  estado?: string
}

interface EnrollmentConfig {
  id_configuracion: number | null
  id_colegio: number
  id_año: number
  fecha_inicio: string | null
  fecha_cierre: string | null
  habilitada: boolean
  hasApproved: boolean
}

const auth = useAuthStore()
const schoolId = computed(() => Number(auth.user?.schoolId || auth.supervision?.id_colegio || 0))
const isSupervision = computed(() => auth.activeRole === 'admin_general')

const loading = ref(true)
const loadingConfig = ref(false)
const saving = ref(false)

const academicYears = ref<AcademicYear[]>([])
const selectedYearId = ref<number | null>(null)

const config = ref<EnrollmentConfig>({
  id_configuracion: null,
  id_colegio: 0,
  id_año: 0,
  fecha_inicio: null,
  fecha_cierre: null,
  habilitada: true,
  hasApproved: false
})

const localFechaInicio = ref('')
const localFechaCierre = ref('')
const localHabilitada = ref(true)
const justification = ref('')

const message = ref<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null)

const isPastCloseDate = computed(() => {
  if (!config.value.fecha_cierre) return false
  return new Date() > new Date(config.value.fecha_cierre)
})

const loadYears = async () => {
  if (!schoolId.value) return
  try {
    loading.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const response = await axios.get(`http://localhost:3000/api/academic-admin/settings/${schoolId.value}`, { headers })
    academicYears.value = response.data.academicYears || []
    
    // Set default to current year
    if (response.data.currentYear) {
      selectedYearId.value = response.data.currentYear.id_año
    } else if (academicYears.value.length > 0) {
      selectedYearId.value = academicYears.value[0].id_año
    }
  } catch (error) {
    console.error('Error loading academic years:', error)
    showMessage('Error al cargar los años lectivos del colegio.', 'error')
  } finally {
    loading.value = false
  }
}

const formatForInput = (dateStr: string | null) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const loadConfig = async () => {
  if (!schoolId.value || !selectedYearId.value) return
  try {
    loadingConfig.value = true
    message.value = null
    const headers = { Authorization: `Bearer ${auth.token}` }
    const response = await axios.get(
      `http://localhost:3000/api/academic-admin/settings/enrollment-config/${schoolId.value}/${selectedYearId.value}`,
      { headers }
    )
    
    if (response.data) {
      config.value = response.data
      localFechaInicio.value = formatForInput(response.data.fecha_inicio)
      localFechaCierre.value = formatForInput(response.data.fecha_cierre)
      localHabilitada.value = response.data.habilitada
    } else {
      config.value = {
        id_configuracion: null,
        id_colegio: schoolId.value,
        id_año: selectedYearId.value,
        fecha_inicio: null,
        fecha_cierre: null,
        habilitada: true,
        hasApproved: false
      }
      localFechaInicio.value = ''
      localFechaCierre.value = ''
      localHabilitada.value = true
    }
  } catch (error) {
    console.error('Error loading enrollment configuration:', error)
    showMessage('Error al cargar la configuración de inscripciones.', 'error')
  } finally {
    loadingConfig.value = false
  }
}

watch(selectedYearId, () => {
  loadConfig()
})

const showMessage = (text: string, type: 'success' | 'error' | 'warning') => {
  message.value = { text, type }
  if (type === 'success') {
    setTimeout(() => {
      if (message.value?.text === text) message.value = null
    }, 4000)
  }
}

const handleSave = async () => {
  if (!selectedYearId.value) {
    showMessage('Por favor selecciona un año lectivo.', 'error')
    return
  }
  if (!localFechaInicio.value || !localFechaCierre.value) {
    showMessage('Debes configurar ambas fechas (inicio y cierre).', 'error')
    return
  }

  const start = new Date(localFechaInicio.value)
  const end = new Date(localFechaCierre.value)

  if (end <= start) {
    showMessage('La fecha de cierre debe ser posterior a la fecha de inicio.', 'error')
    return
  }

  if (isSupervision.value && !justification.value.trim()) {
    showMessage('Por favor escribe la justificación para registrar esta modificación en la auditoría.', 'warning')
    return
  }

  try {
    saving.value = true
    message.value = null
    const headers = { Authorization: `Bearer ${auth.token}` }
    const payload = {
      id_colegio: schoolId.value,
      id_año: selectedYearId.value,
      fecha_inicio: start.toISOString(),
      fecha_cierre: end.toISOString(),
      habilitada: localHabilitada.value,
      motivo_cambio: isSupervision.value ? justification.value : undefined
    }

    const response = await axios.post(
      'http://localhost:3000/api/academic-admin/settings/enrollment-config',
      payload,
      { headers }
    )

    showMessage(response.data.message || 'Configuración guardada exitosamente.', 'success')
    justification.value = ''
    loadConfig()
  } catch (error: any) {
    console.error('Error saving enrollment config:', error)
    showMessage(error.response?.data?.error || 'Error al guardar la configuración.', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadYears()
})
</script>

<template>
  <div class="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <!-- Header visual -->
    <div class="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm md:p-10 dark:bg-slate-900 dark:border-slate-800 transition-colors">
      <div class="flex flex-col gap-6 md:flex-row md:items-center justify-between">
        <div class="space-y-2">
          <router-link to="/dashboard/configuracion-academica" class="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors">
            <ArrowLeft :size="18" />
            <span>Volver a Configuración</span>
          </router-link>
          <h1 class="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <CalendarDays class="text-violet-600" :size="32" />
            Gestión de Fechas de Inscripción
          </h1>
          <p class="text-slate-500 dark:text-slate-400">
            Configura el rango de fechas en el que los acudientes podrán reservar cupos para matrículas públicas.
          </p>
        </div>

        <div v-if="selectedYearId" class="flex flex-col gap-2 min-w-[200px]">
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest">Seleccionar Año Lectivo</label>
          <select 
            v-model="selectedYearId" 
            class="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500 transition-all cursor-pointer"
          >
            <option v-for="y in academicYears" :key="y.id_año" :value="y.id_año">
              Año: {{ y.calendario || y.id_año }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Alert Message -->
    <div v-if="message" 
      :class="[
        message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400' :
        message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400' :
        'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400',
        'p-5 border rounded-2xl flex items-start gap-3 shadow-sm'
      ]"
    >
      <component 
        :is="message.type === 'success' ? CheckCircle2 : AlertTriangle" 
        class="h-5 w-5 shrink-0 mt-0.5" 
      />
      <span class="text-sm font-semibold">{{ message.text }}</span>
    </div>

    <!-- Warnings: Approved enrollments restrict editing dates -->
    <div v-if="config.hasApproved" class="bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400 p-6 rounded-3xl flex items-start gap-4 shadow-sm">
      <div class="p-3 bg-rose-100 dark:bg-rose-900/40 rounded-2xl text-rose-600 dark:text-rose-400">
        <Lock :size="24" />
      </div>
      <div>
        <h3 class="text-base font-black">Rango de Fechas Bloqueado</h3>
        <p class="mt-1 text-sm font-semibold opacity-90 leading-relaxed">
          Ya existen solicitudes de matrícula **aprobadas** para este año lectivo. No está permitido cambiar las fechas de inicio y cierre.
          Aún puedes habilitar o deshabilitar manualmente el módulo para el registro de nuevas solicitudes.
        </p>
      </div>
    </div>

    <!-- Main Config Card -->
    <div class="rounded-3xl border border-slate-100 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 transition-colors overflow-hidden">
      <div class="p-8 sm:p-10 space-y-8">
        
        <div v-if="loadingConfig" class="text-center py-12 text-slate-400 font-bold dark:text-slate-500">
          Cargando configuración...
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Fecha Inicio -->
          <div class="space-y-3">
            <label class="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calendar :size="16" class="text-violet-500" />
              Fecha de Inicio de Inscripciones
            </label>
            <div class="relative">
              <input 
                type="datetime-local" 
                v-model="localFechaInicio"
                :disabled="config.hasApproved"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500 transition-all disabled:opacity-50"
              />
              <Lock v-if="config.hasApproved" :size="16" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <p class="text-xs text-slate-400 dark:text-slate-500 leading-normal">
              A partir de este día y hora, los acudientes podrán acceder al formulario público y registrarse.
            </p>
          </div>

          <!-- Fecha Cierre -->
          <div class="space-y-3">
            <label class="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calendar :size="16" class="text-violet-500" />
              Fecha de Cierre de Inscripciones
            </label>
            <div class="relative">
              <input 
                type="datetime-local" 
                v-model="localFechaCierre"
                :disabled="config.hasApproved"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500 transition-all disabled:opacity-50"
              />
              <Lock v-if="config.hasApproved" :size="16" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <p class="text-xs text-slate-400 dark:text-slate-500 leading-normal">
              Una vez alcanzada esta fecha, el formulario público se cerrará automáticamente bloqueando nuevas solicitudes.
            </p>
          </div>

          <!-- Manual Toggle Habilitada -->
          <div v-if="!(config.fecha_cierre && isPastCloseDate)" class="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 p-6 rounded-3xl flex items-center justify-between">
            <div class="space-y-1">
              <h3 class="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <component :is="localHabilitada ? Unlock : Lock" :size="18" :class="localHabilitada ? 'text-emerald-500' : 'text-rose-500'" />
                Estado Manual de las Inscripciones
              </h3>
              <p class="text-xs text-slate-400 dark:text-slate-500 max-w-xl leading-normal">
                Permite habilitar o deshabilitar el formulario de matrícula en cualquier momento. Si se deshabilita, se impedirá la creación de nuevas solicitudes independientemente de las fechas configuradas.
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="localHabilitada" class="sr-only peer">
              <div class="w-12 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          <!-- Justificación Auditoría (Supervisión) -->
          <div v-if="isSupervision" class="md:col-span-2 space-y-3 bg-amber-50/50 dark:bg-amber-950/10 p-6 border border-amber-200/50 dark:border-amber-900/30 rounded-3xl">
            <h3 class="text-sm font-black text-amber-800 dark:text-amber-400 flex items-center gap-2">
              <ShieldAlert :size="18" />
              Justificación de Modificación (Auditoría de Supervisión)
            </h3>
            <p class="text-xs text-amber-700 dark:text-amber-500 font-medium">
              Te encuentras en modo de supervisión como Administrador General. Debes justificar el motivo de este cambio para registrarlo en el log de auditoría.
            </p>
            <textarea 
              v-model="justification" 
              rows="3" 
              class="w-full bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              placeholder="Explica por qué estás modificando la configuración de inscripciones..."
            ></textarea>
          </div>

          <!-- Save Button -->
          <div class="md:col-span-2 flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <button 
              @click="handleSave"
              :disabled="saving"
              class="bg-violet-600 hover:bg-violet-700 text-white font-bold py-4 px-8 rounded-2xl flex items-center gap-2 shadow-lg shadow-violet-500/10 active:scale-95 disabled:opacity-50 transition-all"
            >
              <Save :size="18" />
              <span>{{ saving ? 'Guardando...' : 'Guardar Configuración' }}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  </div>
</template>
