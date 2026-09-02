<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { enrollmentService } from '../../services/enrollmentService'
import { useNotificationStore } from '../../stores/notifications'
import { isValidEmail } from '../../utils/validationHelper'
import { 
  School, 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  CalendarDays, 
  ShieldCheck, 
  Timer, 
  RefreshCw, 
  Phone,
  Sparkles,
  Check
} from 'lucide-vue-next'

const route = useRoute()
const step = ref(1)
const schoolId = ref('')
const level = ref('')
const selectedTipoGrado = ref('')
const grade = ref('') // Este guardará el id_grado final

const formData = ref({
  parentEmail: '',
  parentPhone: '',
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
    const data = await enrollmentService.getAllSchools()
    schools.value = data
  } catch (error) {
    console.error('Error fetching schools:', error)
  }
}

const fetchGrados = async () => {
  if (!schoolId.value) return
  loadingGrados.value = true
  try {
    const data = await enrollmentService.getAvailableGrades(schoolId.value)
    allGrados.value = data
  } catch (error) {
    console.error('Error fetching grades:', error)
  } finally {
    loadingGrados.value = false
  }
}

const isExtraordinaryToken = ref(false)
const extraordinaryTokenValue = ref<string | null>(null)
const extraordinaryInfo = ref<any>(null)

onMounted(async () => {
  await fetchInitialData()
  const urlParams = new URLSearchParams(window.location.search)
  const tokenFromUrl = (route.query.token || route.params.token || urlParams.get('token')) as string
  
  // Buscar token en la URL entrante o en la bóveda de sesión de sessionStorage
  let token = tokenFromUrl || sessionStorage.getItem('extraordinary_enrollment_token') || ''

  if (token) {
    try {
      const res = await enrollmentService.getByToken(token)
      if (res && (res.tipo === 'EXTRAORDINARIA' || res.token_seguimiento)) {
        isExtraordinaryToken.value = res.tipo === 'EXTRAORDINARIA'
        extraordinaryTokenValue.value = token
        extraordinaryInfo.value = res
        isEmailVerified.value = true // Token directivo valida el correo
        
        // Guardar token en bóveda de sesión segura para soportar recargas (F5)
        sessionStorage.setItem('extraordinary_enrollment_token', token)

        // Enmascarar y sanitizar inmediatamente la URL en la barra de direcciones del navegador
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, '/matricula')
        }

        if (res.id_colegio) {
          schoolId.value = String(res.id_colegio)
        }
        if (res.correo_padre) {
          formData.value.parentEmail = res.correo_padre
        }
        if (res.tiene_discapacidad !== undefined && res.tiene_discapacidad !== null) {
          formData.value.hasDisability = Boolean(res.tiene_discapacidad)
        }
        if (res.es_extranjero !== undefined && res.es_extranjero !== null) {
          formData.value.isForeigner = Boolean(res.es_extranjero)
        }
        
        await fetchGrados()
        await fetchEnrollmentConfig()
      }
    } catch (e) {
      console.error('Error al consultar token de matrícula:', e)
      sessionStorage.removeItem('extraordinary_enrollment_token')
    }
  }
})

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
    const res = await enrollmentService.getSchoolEnrollmentConfig(schoolId.value)
    enrollmentConfig.value = res.config
    yearLabel.value = res.yearLabel
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
  if (isExtraordinaryToken.value) return true
  if (!schoolId.value) return true
  if (!enrollmentConfig.value) return false
  if (!enrollmentConfig.value.habilitada) return false
  if (!enrollmentConfig.value.fecha_inicio || !enrollmentConfig.value.fecha_cierre) return false
  
  const now = new Date()
  const start = new Date(enrollmentConfig.value.fecha_inicio)
  const end = new Date(enrollmentConfig.value.fecha_cierre)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false
  return now >= start && now <= end
})

const isFutureYear = computed(() => {
  if (!yearLabel.value) return false
  const match = yearLabel.value.match(/\d{4}/)
  if (!match) return false
  const targetYear = Number(match[0])
  const currentCalendarYear = new Date().getFullYear()
  return targetYear > currentCalendarYear
})

const enrollmentBannerTitle = computed(() => {
  if (isExtraordinaryToken.value) {
    return 'Autorización de Matrícula Extraordinaria'
  }
  if (isFutureYear.value) {
    return `Convocatoria de Admisiones — Ingreso Año Escolar ${yearLabel.value || ''}`
  }
  return `Inscripciones — Año Escolar ${yearLabel.value || ''} (En Curso)`
})

const enrollmentContextSubtitle = computed(() => {
  if (isExtraordinaryToken.value) return ''
  if (isFutureYear.value) {
    return `Estás solicitando cupo para iniciar clases en el periodo lectivo ${yearLabel.value || ''} en esta institución.`
  }
  return `Estás solicitando cupo para el año escolar ${yearLabel.value || ''} actualmente en curso.`
})

const enrollmentStatusMessage = computed(() => {
  if (isExtraordinaryToken.value) {
    return '⚡ Acceso preferencial habilitado por autorización directiva institucional.'
  }
  if (!schoolId.value) return ''
  if (!enrollmentConfig.value) {
    return 'Las inscripciones para esta institución aún no han sido configuradas por las directivas.'
  }
  if (!enrollmentConfig.value.habilitada) {
    return 'Las inscripciones están deshabilitadas temporalmente por la institución.'
  }
  if (!enrollmentConfig.value.fecha_inicio || !enrollmentConfig.value.fecha_cierre) {
    return `Las fechas de inscripción para el año lectivo ${yearLabel.value || ''} aún no han sido programadas por la institución.`
  }
  
  const now = new Date()
  const start = new Date(enrollmentConfig.value.fecha_inicio)
  const end = new Date(enrollmentConfig.value.fecha_cierre)
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return `Las fechas de inscripción para el año lectivo ${yearLabel.value || ''} aún no han sido programadas por la institución.`
  }

  if (now < start) {
    return `Las inscripciones para el año lectivo ${yearLabel.value || ''} aún no han comenzado. Iniciarán el ${start.toLocaleString('es-CO')}.`
  }
  if (now > end) {
    return `Las inscripciones para el año lectivo ${yearLabel.value || ''} ya cerraron el día ${end.toLocaleString('es-CO')}.`
  }
  
  return `Inscripciones abiertas para el año lectivo ${yearLabel.value || ''} desde el ${start.toLocaleDateString('es-CO')} hasta el ${end.toLocaleDateString('es-CO')}.`
})

watch(schoolId, () => {
  if (!isExtraordinaryToken.value) {
    level.value = ''
    selectedTipoGrado.value = ''
    grade.value = ''
  }
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
  
  const grouped: Record<string, any> = {}
  filtered.forEach(g => {
    const name = g.jornada || 'ÚNICA'
    if (!grouped[name]) {
      grouped[name] = {
        id: g.id_grado,
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
    if (file.size > 5 * 1024 * 1024) {
      notify.addNotification('El archivo no puede superar los 5MB', 'warning')
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

const isEmailVerified = ref(false)
const isVerifyingScreen = ref(false)
const sendingCode = ref(false)
const verifyingCode = ref(false)
const otpCodeInput = ref('')
const codeSent = ref(false)
const countdownSeconds = ref(0)
let timerInterval: any = null

const formattedCountdown = computed(() => {
  const mins = Math.floor(countdownSeconds.value / 60)
  const secs = countdownSeconds.value % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
})

const startTimer = () => {
  if (timerInterval) clearInterval(timerInterval)
  countdownSeconds.value = 900
  timerInterval = setInterval(() => {
    if (countdownSeconds.value > 0) {
      countdownSeconds.value--
    } else {
      clearInterval(timerInterval)
    }
  }, 1000)
}

const sendVerificationCode = async () => {
  if (!formData.value.parentEmail || !isValidEmail(formData.value.parentEmail)) {
    notify.addNotification('Por favor ingresa un correo electrónico válido.', 'warning')
    return
  }
  sendingCode.value = true
  try {
    const res = await enrollmentService.sendEmailCode({
      email: formData.value.parentEmail,
      schoolId: schoolId.value
    })
    codeSent.value = true
    startTimer()
    notify.addNotification(res.message || 'Código de 6 dígitos enviado a tu correo.', 'success')
  } catch (error: any) {
    const msg = error.response?.data?.error || 'Error al enviar el código de verificación.'
    notify.addNotification(msg, 'error')
  } finally {
    sendingCode.value = false
  }
}

const isPhoneStep = ref(false)

const proceedToVerification = async () => {
  if (!formData.value.parentEmail || !isValidEmail(formData.value.parentEmail)) {
    notify.addNotification('Por favor ingresa un correo electrónico válido.', 'warning')
    return
  }
  isVerifyingScreen.value = true
  if (isExtraordinaryToken.value || isEmailVerified.value) {
    isPhoneStep.value = true
  } else {
    isPhoneStep.value = false
    await sendVerificationCode()
  }
}

const verifyAndSubmit = async () => {
  if (!otpCodeInput.value || otpCodeInput.value.trim().length !== 6) {
    notify.addNotification('Ingresa el código completo de 6 dígitos.', 'warning')
    return
  }
  verifyingCode.value = true
  try {
    const res = await enrollmentService.verifyEmailCode({
      email: formData.value.parentEmail,
      code: otpCodeInput.value.trim(),
      schoolId: schoolId.value
    })
    if (res.verified) {
      isEmailVerified.value = true
      if (timerInterval) clearInterval(timerInterval)
      isPhoneStep.value = true
      notify.addNotification('¡Correo verificado con éxito! Por favor ingresa tu número telefónico para completar la solicitud.', 'success')
    }
  } catch (error: any) {
    const msg = error.response?.data?.error || 'Código incorrecto o expirado.'
    notify.addNotification(msg, 'error')
  } finally {
    verifyingCode.value = false
  }
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

    if (isExtraordinaryToken.value || isEmailVerified.value) {
      isVerifyingScreen.value = true
      isPhoneStep.value = true
    }
  }

  step.value++
}

const prevStep = () => {
  isVerifyingScreen.value = false
  isPhoneStep.value = false
  step.value--
}

const submitting = ref(false)

const submitEnrollment = async () => {
  const cleanPhone = (formData.value.parentPhone || '').trim()
  if (!cleanPhone || cleanPhone.length < 7) {
    notify.addNotification('Por favor ingresa un número de teléfono de contacto válido (mínimo 7 dígitos).', 'warning')
    return
  }
  if (submitting.value) return
  submitting.value = true
  try {
    const formDataPayload = new FormData()
    
    formDataPayload.append('id_colegio', schoolId.value)
    formDataPayload.append('parentEmail', formData.value.parentEmail)
    formDataPayload.append('parentPhone', cleanPhone)
    formDataPayload.append('telefono', cleanPhone)
    formDataPayload.append('level', level.value)
    formDataPayload.append('grade', grade.value)
    formDataPayload.append('hasDisability', String(formData.value.hasDisability))
    formDataPayload.append('isForeigner', String(formData.value.isForeigner))

    if (extraordinaryTokenValue.value) {
      formDataPayload.append('token', extraordinaryTokenValue.value)
    }

    for (const [key, file] of Object.entries(files.value)) {
      if (file) {
        formDataPayload.append(key, file)
      }
    }

    await enrollmentService.submitEnrollment(formDataPayload)

    sessionStorage.removeItem('extraordinary_enrollment_token')

    notify.addNotification(
      isExtraordinaryToken.value
        ? '¡Documentación de matrícula extraordinaria radicada exitosamente! Tu expediente se encuentra en revisión institucional.'
        : '¡Matrícula radicada exitosamente! Los datos personales se solicitarán una vez validados estos documentos.',
      'success'
    )
    
    setTimeout(() => {
      window.location.href = isExtraordinaryToken.value 
        ? `/matricula/seguimiento?token=${extraordinaryTokenValue.value}`
        : '/'
    }, 1800)
  } catch (error: any) {
    console.error('Error al enviar:', error)
    const errMessage = error.response?.data?.error || 'Hubo un error al enviar el formulario. Por favor intenta de nuevo.'
    notify.addNotification(errMessage, 'error')
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50/50 py-6 sm:py-12 px-3.5 sm:px-6 lg:px-8 font-sans">
    <div class="max-w-5xl mx-auto">
      <!-- Navbar -->
      <div class="mb-8 sm:mb-12 flex items-center justify-between">
        <router-link to="/" class="flex items-center gap-2 text-xs sm:text-sm text-slate-500 hover:text-indigo-600 transition-all font-medium">
          <ArrowLeft :size="18" />
          <span>Volver al Inicio</span>
        </router-link>
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="p-1.5 sm:p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-100">
            <School :size="20" class="sm:w-6 sm:h-6" />
          </div>
          <span class="text-base sm:text-xl font-black tracking-tight text-slate-900">Academia<span class="text-indigo-600">Neiva</span></span>
        </div>
      </div>

      <!-- Stepper -->
      <div class="mb-10 sm:mb-12">
        <div class="flex items-center justify-between max-w-xl mx-auto relative px-4 sm:px-0">
          <div class="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10"></div>
          <div v-for="i in 3" :key="i" 
            :class="[
              step >= i ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 ring-4 ring-indigo-50' : 'bg-white text-slate-400 border border-slate-200',
              'h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-xs sm:text-sm font-black transition-all duration-500 relative z-10'
            ]"
          >
            {{ i }}
            <span :class="[step >= i ? 'text-indigo-600 font-black' : 'text-slate-400 font-bold', 'absolute -bottom-6 sm:-bottom-8 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs whitespace-nowrap text-center']">
              {{ i === 1 ? 'Institución' : i === 2 ? 'Documentos' : 'Finalizar' }}
            </span>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-xl sm:shadow-2xl shadow-slate-200/50 overflow-hidden mt-10 sm:mt-16 text-left">
        <div class="p-4 sm:p-8 md:p-12">
          
          <!-- PASO 1: Selección de Cupo -->
          <div v-if="step === 1" class="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="border-b border-slate-100 pb-5 sm:pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <h3 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Solicitud de Matrícula</h3>
                <p class="text-slate-500 text-xs sm:text-sm mt-1">Carga inicial de documentos y reserva de cupo escolar.</p>
              </div>
              <span v-if="isExtraordinaryToken" class="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-wider self-start">
                <Sparkles :size="14" class="text-amber-600" />
                <span>Matrícula Extraordinaria</span>
              </span>
            </div>

            <!-- BANNER ESPECIAL DE MATRÍCULA EXTRAORDINARIA -->
            <div v-if="isExtraordinaryToken" class="rounded-2xl sm:rounded-3xl border border-amber-300/80 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 p-4 sm:p-8 space-y-3 sm:space-y-4 shadow-sm">
              <div class="flex items-start gap-3 sm:gap-4">
                <div class="p-2 sm:p-3 bg-amber-500/20 text-amber-700 rounded-xl sm:rounded-2xl border border-amber-500/30 shrink-0 mt-0.5">
                  <Sparkles :size="20" class="sm:w-6 sm:h-6" />
                </div>
                <div class="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-amber-700">Autorización Especial Vigente</span>
                    <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9px] sm:text-[10px] font-black border border-amber-300">
                      Bypass de Calendario
                    </span>
                  </div>
                  <h4 class="text-lg font-black text-slate-900">
                    ¡Bienvenido(a)! Cuentas con autorización para matrícula extraordinaria
                  </h4>
                  <p class="text-xs font-medium text-slate-700 leading-relaxed">
                    Las inscripciones ordinarias de la institución pueden encontrarse cerradas, pero la dirección académica ha emitido una <strong>excepción formal</strong> a tu nombre. Puedes seleccionar el nivel, grado y jornada que deseas postular y adjuntar los documentos solicitados para completar tu solicitud.
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-amber-500/20 text-xs font-bold text-amber-900">
                <div class="flex items-center gap-2">
                  <CheckCircle2 :size="16" class="text-emerald-600" />
                  <span>Correo verificado y vinculado: <strong>{{ formData.parentEmail }}</strong></span>
                </div>
                <span class="text-[11px] text-amber-700 font-medium">No se generará duplicado: se actualizará tu registro autorizado.</span>
              </div>
            </div>

            <!-- Banner Estándar de Fechas de Inscripción (Solo para flujo regular) -->
            <div v-else-if="schoolId && !loadingConfig && enrollmentConfig" 
              class="rounded-3xl border p-6 space-y-4 shadow-sm transition-all"
              :class="[
                isEnrollmentOpen 
                  ? 'bg-gradient-to-br from-emerald-50/90 to-teal-50/60 border-emerald-200 text-emerald-950' 
                  : 'bg-gradient-to-br from-rose-50/90 to-amber-50/60 border-rose-200 text-rose-950'
              ]"
            >
              <div class="flex items-start gap-3">
                <component :is="isEnrollmentOpen ? CheckCircle2 : AlertCircle" class="h-6 w-6 shrink-0 mt-0.5" :class="isEnrollmentOpen ? 'text-emerald-600' : 'text-rose-600'" />
                <div class="space-y-1.5">
                  <h4 class="text-base font-extrabold flex flex-wrap items-center gap-2">
                    <span>{{ enrollmentBannerTitle }}</span>
                    <span :class="[
                      isEnrollmentOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
                      'px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider'
                    ]">
                      {{ isEnrollmentOpen ? 'Abiertas' : (enrollmentConfig?.fecha_inicio && enrollmentConfig?.fecha_cierre ? 'Cerradas / Inactivas' : 'Sin Programar') }}
                    </span>
                  </h4>
                  <p v-if="enrollmentContextSubtitle" class="text-xs font-bold opacity-80 leading-relaxed">
                    {{ enrollmentContextSubtitle }}
                  </p>
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
                    <span class="block text-[11px] font-black uppercase tracking-wider text-slate-400">Apertura de Inscripciones</span>
                    <span class="text-sm font-bold text-slate-800">
                      {{ formattedFechaInicio }}
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-3 bg-white/80 backdrop-blur-sm p-3.5 rounded-2xl border border-black/5 shadow-xs">
                  <div class="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                    <CalendarDays :size="18" />
                  </div>
                  <div>
                    <span class="block text-[11px] font-black uppercase tracking-wider text-slate-400">Cierre de Inscripciones</span>
                    <span class="text-sm font-bold text-slate-800">
                      {{ formattedFechaCierre }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Form Fields Grid -->
            <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-bold text-slate-700">Institución Educativa</label>
                  <span v-if="isExtraordinaryToken" class="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-300 uppercase">
                    🔒 Asignada
                  </span>
                </div>
                <select 
                  v-model="schoolId" 
                  :disabled="isExtraordinaryToken"
                  class="w-full rounded-2xl p-4 transition-all font-bold text-slate-900 border"
                  :class="[
                    isExtraordinaryToken 
                      ? 'bg-slate-100/90 border-slate-300 text-slate-600 cursor-not-allowed opacity-90 select-none shadow-inner' 
                      : 'border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                  ]"
                >
                  <option value="" disabled>Selecciona el colegio</option>
                  <option v-for="s in schools" :key="s.id_colegio" :value="s.id_colegio">{{ s.nombre }}</option>
                </select>
                <p v-if="isExtraordinaryToken" class="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                  <span>🔒 Institución fijada por la autorización de matrícula extraordinaria.</span>
                </p>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-bold text-slate-700">Correo Electrónico del Acudiente</label>
                  <span v-if="isExtraordinaryToken" class="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300 uppercase">
                    <Check :size="12" /> Autorizado
                  </span>
                </div>
                <input 
                  v-model="formData.parentEmail" 
                  type="email" 
                  :disabled="isExtraordinaryToken"
                  :readonly="isExtraordinaryToken"
                  class="w-full rounded-2xl p-4 transition-all font-bold text-slate-900 border" 
                  :class="[
                    isExtraordinaryToken 
                      ? 'bg-slate-100/90 border-slate-300 text-slate-600 cursor-not-allowed opacity-90 select-none shadow-inner' 
                      : 'border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
                  ]"
                  placeholder="ejemplo@correo.com"
                >
                <p v-if="isExtraordinaryToken" class="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                  <span>✓ Correo verificado y vinculado a tu cupo de matrícula.</span>
                </p>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-bold text-slate-700">Nivel Escolar</label>
                <select v-model="level" class="w-full rounded-2xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent p-4 transition-all font-medium text-slate-900">
                  <option value="" disabled>Selecciona nivel</option>
                  <option v-for="l in levels" :key="l.id" :value="l.id">{{ l.name }}</option>
                </select>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-bold text-slate-700">Grado Solicitado</label>
                <select v-model="selectedTipoGrado" :disabled="!level || loadingGrados" class="w-full rounded-2xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent p-4 transition-all disabled:opacity-50 font-medium text-slate-900">
                  <option value="" disabled>{{ level ? 'Selecciona grado' : 'Primero elige un nivel' }}</option>
                  <option v-for="gt in availableTipoGrados" :key="gt" :value="gt">{{ gt }}</option>
                </select>
              </div>

              <div class="space-y-2 md:col-span-2">
                <label class="text-sm font-bold text-slate-700">Jornada y Modalidad</label>
                <select v-model="grade" :disabled="!selectedTipoGrado" class="w-full rounded-2xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent p-4 transition-all disabled:opacity-50 font-medium text-slate-900">
                  <option value="" disabled>{{ selectedTipoGrado ? 'Selecciona jornada' : 'Elige un grado primero' }}</option>
                  <option v-for="j in availableJornadas" :key="j.id" :value="j.id" :disabled="!isExtraordinaryToken && j.cupos <= 0">
                    {{ j.name }} {{ isExtraordinaryToken ? '(Cupo autorizado por secretaría)' : `(${j.cupos} cupos disponibles)` }}
                  </option>
                </select>
                <p v-if="selectedTipoGrado && availableJornadas.every(j => j.cupos <= 0) && !isExtraordinaryToken" class="text-xs text-amber-600 flex items-center gap-1 mt-1 font-bold">
                  <AlertCircle :size="12" /> No hay cupos disponibles en el calendario regular.
                </p>
              </div>
            </div>

            <!-- Checkboxes de condiciones especiales -->
            <div class="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <p class="text-xs font-black uppercase tracking-wider text-slate-500">Condiciones Especiales del Aspirante</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label class="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" v-model="formData.hasDisability" class="w-5 h-5 rounded-lg text-indigo-600 border-slate-300 focus:ring-indigo-500">
                  <span class="text-sm font-bold text-slate-700">Presenta diagnóstico médico o discapacidad</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" v-model="formData.isForeigner" class="w-5 h-5 rounded-lg text-indigo-600 border-slate-300 focus:ring-indigo-500">
                  <span class="text-sm font-bold text-slate-700">Es estudiante de nacionalidad extranjera</span>
                </label>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row sm:justify-end pt-4">
              <button 
                type="button" 
                @click="nextStep"
                :disabled="!isEnrollmentOpen"
                class="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 sm:py-4 px-6 sm:px-8 rounded-xl sm:rounded-2xl text-xs sm:text-sm shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Siguiente: Cargar Documentos</span>
                <ArrowLeft :size="16" class="rotate-180" />
              </button>
            </div>
          </div>

          <!-- PASO 2: Documentación Requerida -->
          <div v-else-if="step === 2" class="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div class="border-b border-slate-100 pb-5 sm:pb-6 flex items-center justify-between">
              <div>
                <h3 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Documentación Requerida</h3>
                <p class="text-slate-500 text-xs sm:text-sm mt-1">Adjunta archivos claros en formato PDF o imagen (máximo 5MB por archivo).</p>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <template v-for="(label, key) in docLabels" :key="key">
                <div v-if="showDoc(key as string)" class="p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 bg-slate-50/50 space-y-2.5 sm:space-y-3 hover:border-indigo-200 transition-all">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700">{{ label }}</span>
                    <span v-if="files[key]" class="text-emerald-600 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 :size="14" /> Listo
                    </span>
                  </div>

                  <div class="relative">
                    <input 
                      type="file" 
                      @change="(e) => handleFileUpload(e, key as string)"
                      accept=".pdf,.png,.jpg,.jpeg"
                      class="block w-full text-xs text-slate-500 file:mr-3 sm:file:mr-4 file:py-2 sm:file:py-2.5 file:px-3 sm:file:px-4 file:rounded-xl file:border-0 file:text-[11px] sm:file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    >
                  </div>
                </div>
              </template>
            </div>

            <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-slate-100">
              <button 
                type="button" 
                @click="prevStep"
                class="w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs sm:text-sm hover:bg-slate-50 transition-all cursor-pointer text-center"
              >
                ← Volver al Paso 1
              </button>
              <button 
                type="button" 
                @click="nextStep"
                class="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 sm:py-4 px-6 sm:px-8 rounded-xl sm:rounded-2xl text-xs sm:text-sm shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Siguiente: Finalizar Solicitud</span>
                <ArrowLeft :size="16" class="rotate-180" />
              </button>
            </div>
          </div>

          <!-- PASO 3: Finalización y Confirmación -->
          <div v-else-if="step === 3" class="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <!-- SUB-PASO: Formulario de Verificación OTP o Teléfono Directo -->
            <div v-if="isVerifyingScreen" class="py-4 max-w-md mx-auto text-center space-y-5 sm:space-y-6">
              
              <!-- Si NO es extraordinaria y aún no ha validado OTP -->
              <div v-if="!isPhoneStep" class="space-y-5 sm:space-y-6">
                <div class="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 mb-4 sm:mb-6">
                  <div class="absolute inset-0 bg-indigo-100 rounded-3xl animate-ping opacity-30"></div>
                  <div class="relative h-16 w-16 sm:h-20 sm:w-20 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-200">
                    <ShieldCheck :size="32" class="sm:w-10 sm:h-10" />
                  </div>
                </div>

                <h3 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Verificación de Correo</h3>
                <p class="text-slate-500 text-xs sm:text-sm">
                  Ingresa el código de 6 dígitos enviado a:
                </p>
                <div class="inline-block px-3.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-black rounded-full text-xs truncate max-w-xs">
                  {{ formData.parentEmail }}
                </div>

                <div class="space-y-5 sm:space-y-6 pt-2 text-left">
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                      <span>Código de 6 dígitos</span>
                      <span v-if="countdownSeconds > 0" class="text-indigo-600 font-mono flex items-center gap-1">
                        <Timer :size="13" /> Expira en {{ formattedCountdown }}
                      </span>
                    </div>

                    <input 
                      v-model="otpCodeInput" 
                      type="text" 
                      maxlength="6"
                      placeholder="000000" 
                      class="w-full text-center font-mono text-2xl sm:text-3xl font-black tracking-[0.2em] sm:tracking-[0.35em] rounded-xl sm:rounded-2xl border-2 border-indigo-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 p-3 sm:p-4 transition-all shadow-inner outline-none text-slate-900"
                      @keyup.enter="verifyAndSubmit"
                    >
                  </div>

                  <div class="flex items-center justify-center gap-2 text-xs">
                    <span class="text-slate-400">¿No recibiste el código?</span>
                    <button 
                      type="button" 
                      @click="sendVerificationCode"
                      :disabled="sendingCode || countdownSeconds > 840"
                      class="font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw v-if="sendingCode" class="animate-spin" :size="12" />
                      <span>{{ sendingCode ? 'Reenviando...' : 'Reenviar código' }}</span>
                    </button>
                  </div>

                  <div class="pt-2 space-y-3">
                    <button
                      type="button"
                      @click="verifyAndSubmit"
                      :disabled="verifyingCode || otpCodeInput.trim().length !== 6"
                      class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-8 rounded-2xl font-black text-base shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <span v-if="verifyingCode" class="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>{{ verifyingCode ? 'Verificando Código...' : 'Validar Código' }}</span>
                    </button>
                    <div>
                      <button 
                        type="button" 
                        @click="prevStep" 
                        class="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        ← Volver a Documentos
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Ingreso de Teléfono y Confirmación Final (Directo para Matrículas Extraordinarias) -->
              <div v-else class="space-y-6 text-left animate-in fade-in slide-in-from-right-4 duration-300">
                <div class="text-center space-y-2">
                  <div class="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 mb-2">
                    <CheckCircle2 :size="32" />
                  </div>
                  <h3 class="text-2xl font-black text-slate-900 tracking-tight">
                    {{ isExtraordinaryToken ? 'Confirmación de Matrícula Extraordinaria' : '¡Correo Verificado con Éxito!' }}
                  </h3>
                  <p class="text-slate-500 text-xs font-medium">
                    Ingresa tu número telefónico para registrar la solicitud y coordinar la validación.
                  </p>
                  <div class="inline-block px-3 py-1 bg-emerald-50 text-emerald-800 font-bold rounded-full text-xs">
                    ✓ {{ formData.parentEmail }}
                  </div>
                </div>

                <div class="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                  <div class="space-y-2">
                    <label class="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Phone :size="14" class="text-indigo-600" />
                      <span>Teléfono / Celular de Contacto *</span>
                    </label>
                    <input 
                      v-model="formData.parentPhone"
                      type="tel"
                      required
                      placeholder="Ej. 300 123 4567"
                      class="w-full bg-white border border-slate-200 rounded-2xl p-4 text-base font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-xs"
                      @keyup.enter="submitEnrollment"
                    />
                    <p class="text-[11px] text-slate-500 font-medium">
                      El colegio se comunicará a este número para notificar la aprobación final de la matrícula.
                    </p>
                  </div>
                </div>

                <div class="space-y-3 pt-2">
                  <button
                    type="button"
                    @click="submitEnrollment"
                    :disabled="submitting || !formData.parentPhone || formData.parentPhone.trim().length < 7"
                    class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 px-8 rounded-2xl font-black text-base shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span v-if="submitting" class="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>{{ submitting ? 'Radicando Matrícula...' : 'Confirmar y Radicar Matrícula' }}</span>
                  </button>

                  <div class="text-center">
                    <button 
                      type="button" 
                      @click="prevStep" 
                      :disabled="submitting"
                      class="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      ← Volver a Documentos
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <div v-else class="py-12 max-w-md mx-auto text-center space-y-6">
              <div class="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto">
                <Send :size="36" />
              </div>
              <h3 class="text-2xl font-black text-slate-900">Listo para Enviar</h3>
              <p class="text-slate-500 text-sm">
                Presiona a continuación para confirmar tus datos y radicar tu solicitud de matrícula.
              </p>
              <button 
                type="button" 
                @click="proceedToVerification"
                class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-indigo-100 transition-all cursor-pointer"
              >
                Continuar a Verificación y Envío
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  </div>
</template>
