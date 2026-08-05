<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { 
  Mail, 
  Lock, 
  Send, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Phone
} from 'lucide-vue-next'
import axios from 'axios'

const auth = useAuthStore()
const router = useRouter()

// Comprobar rol activo
const activeRole = computed(() => auth.activeRole?.toUpperCase() || '')
const isDirectivo = computed(() => activeRole.value === 'DIRECTIVO')
const isAdmin = computed(() => activeRole.value === 'ADMIN_GENERAL')
const isStudent = computed(() => activeRole.value === 'ESTUDIANTE')
const isParentOrTeacher = computed(() => activeRole.value === 'PADRE' || activeRole.value === 'DOCENTE')

// State
const profileData = ref<any>(null)
const loadingProfile = ref(true)
const submittingEmail = ref(false)
const submittingPhone = ref(false)
const submittingPassword = ref(false)
const submittingDirectivoMessage = ref(false)
const submittingRequest = ref(false)

const emailForm = ref({
  email: ''
})

// 2-Step Email Change State
const emailStep = ref<1 | 2>(1)
const pendingNewEmail = ref('')
const verificationCode = ref('')
const submittingCode = ref(false)

const phoneForm = ref({
  telefono: ''
})

const passwordForm = ref({
  password_actual: '',
  nueva_password: '',
  confirmar_password: ''
})

// Visibilidad de contraseñas
const showOldPass = ref(false)
const showNewPass = ref(false)
const showConfirmPass = ref(false)

// Mensajes de feedback
const emailSuccess = ref('')
const emailError = ref('')
const phoneSuccess = ref('')
const phoneError = ref('')
const passwordSuccess = ref('')
const passwordError = ref('')
const requestSuccess = ref('')
const requestError = ref('')

// Modal de Directivo "Contactar con Admin General"
const showDirectivoModal = ref(false)
const directivoForm = ref({
  asunto: '',
  descripcion: ''
})

// Panel de Admin General: Cambiar contraseña de otro usuario
const usersList = ref<any[]>([])
const searchUserQuery = ref('')
const loadingUsers = ref(false)
const selectedUserToReset = ref<any>(null)
const adminResetPasswordVal = ref('')
const adminResetSuccess = ref('')
const adminResetError = ref('')
const resettingPasswordIndex = ref<number | null>(null)

const fetchProfile = async () => {
  try {
    loadingProfile.value = true
    const headers: Record<string, string> = { Authorization: `Bearer ${auth.token}` }
    const targetUserId = auth.isMonitoring && auth.monitoringUser ? (auth.monitoringUser.id || (auth.monitoringUser as any).id_usuario) : null
    const params: Record<string, any> = {}
    if (targetUserId) {
      params.userId = targetUserId
      headers['X-Monitoring-Mode'] = 'true'
    }
    const res = await axios.get('/api/auth/profile', { headers, params })
    profileData.value = res.data.user
    emailForm.value.email = res.data.user.email || ''
    phoneForm.value.telefono = res.data.user.telefono || ''
  } catch (error) {
    console.error('Error fetching profile:', error)
  } finally {
    loadingProfile.value = false
  }
}

const fetchAllUsers = async () => {
  if (!isAdmin.value) return
  try {
    loadingUsers.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get('/api/admin/usuarios', { headers })
    usersList.value = res.data || []
  } catch (error) {
    console.error('Error fetching users:', error)
  } finally {
    loadingUsers.value = false
  }
}

watch(() => auth.monitoringUser, () => {
  fetchProfile()
})

onMounted(() => {
  fetchProfile()
  if (isAdmin.value) {
    fetchAllUsers()
  }
})

const handleRequestEmailCode = async () => {
  if (!emailForm.value.email || emailForm.value.email === profileData.value?.email) {
    emailError.value = 'Ingresa un nuevo correo electrónico diferente al actual.'
    return
  }

  try {
    submittingEmail.value = true
    emailSuccess.value = ''
    emailError.value = ''
    
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.post('/api/auth/profile/request-email-change', {
      nuevo_email: emailForm.value.email
    }, { headers })

    pendingNewEmail.value = emailForm.value.email
    emailStep.value = 2
    verificationCode.value = ''
    emailSuccess.value = res.data.message || 'Código de 6 dígitos enviado al nuevo correo.'
  } catch (error: any) {
    emailError.value = error.response?.data?.error || 'Error al solicitar el código de verificación.'
  } finally {
    submittingEmail.value = false
  }
}

const handleVerifyEmailCode = async () => {
  if (!verificationCode.value || verificationCode.value.trim().length !== 6) {
    emailError.value = 'El código debe tener exactamente 6 dígitos numéricos.'
    return
  }

  try {
    submittingCode.value = true
    emailSuccess.value = ''
    emailError.value = ''

    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.post('/api/auth/profile/verify-email-change', {
      nuevo_email: pendingNewEmail.value,
      codigo: verificationCode.value.trim()
    }, { headers })

    emailSuccess.value = res.data.message || 'Correo actualizado exitosamente.'
    if (profileData.value) {
      profileData.value.email = pendingNewEmail.value
    }
    if (auth.user) {
      auth.user.email = pendingNewEmail.value
      localStorage.setItem('user', JSON.stringify(auth.user))
    }

    emailStep.value = 1
    verificationCode.value = ''
  } catch (error: any) {
    emailError.value = error.response?.data?.error || 'Error al verificar el código de confirmación.'
  } finally {
    submittingCode.value = false
  }
}

const cancelEmailChange = () => {
  emailStep.value = 1
  verificationCode.value = ''
  emailForm.value.email = profileData.value?.email || ''
  emailSuccess.value = ''
  emailError.value = ''
}

const handleUpdatePhone = async () => {
  try {
    submittingPhone.value = true
    phoneSuccess.value = ''
    phoneError.value = ''

    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.put('/api/auth/profile/phone', {
      telefono: phoneForm.value.telefono
    }, { headers })

    phoneSuccess.value = 'Teléfono de contacto actualizado con éxito.'
    if (profileData.value) {
      profileData.value.telefono = phoneForm.value.telefono
    }
  } catch (error: any) {
    phoneError.value = error.response?.data?.error || 'Error al actualizar el teléfono.'
  } finally {
    submittingPhone.value = false
  }
}

const handleUpdatePassword = async () => {
  if (passwordForm.value.nueva_password !== passwordForm.value.confirmar_password) {
    passwordError.value = 'Las contraseñas no coinciden.'
    return
  }

  try {
    submittingPassword.value = true
    passwordSuccess.value = ''
    passwordError.value = ''

    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.put('/api/auth/profile/password', {
      password_actual: passwordForm.value.password_actual,
      nueva_password: passwordForm.value.nueva_password
    }, { headers })

    passwordSuccess.value = 'Contraseña actualizada con éxito.'
    
    // Resetear formulario
    passwordForm.value.password_actual = ''
    passwordForm.value.nueva_password = ''
    passwordForm.value.confirmar_password = ''
  } catch (error: any) {
    passwordError.value = error.response?.data?.error || 'La contraseña actual es incorrecta.'
  } finally {
    submittingPassword.value = false
  }
}

// Redireccionar al formulario de soporte con plantilla predefinida para cambiar nombres/documentos
const handleRequestCredentialsChange = () => {
  const defaultDescription = `Estimada administración / soporte técnico, solicito la rectificación o actualización de mis datos personales de identificación en la plataforma.

Por favor, actualice los siguientes campos con la información correcta:

- Nombre: [ESCRIBA AQUÍ SU NOMBRE CORRECTO]
- Apellido: [ESCRIBA AQUÍ SU APELLIDO CORRECTO]
- Tipo de Documento: [ESCRIBA AQUÍ SU TIPO DE DOCUMENTO CORRECTO]
- Documento: [ESCRIBA AQUÍ SU NÚMERO DE DOCUMENTO CORRECTO]

Quedo atento a la validación de los soportes y documentos correspondientes.`;

  router.push({
    path: '/dashboard/soporte',
    query: {
      tipo_incidencia: 'SOPORTE',
      asunto: 'Solicitud de Cambio de Credenciales (Datos de Identificación)',
      descripcion: defaultDescription
    }
  });
}

// Enviar ticket escalado directo al Admin General
const handleContactAdminGeneral = async () => {
  if (!directivoForm.value.asunto.trim() || !directivoForm.value.descripcion.trim()) return

  try {
    submittingDirectivoMessage.value = true
    requestSuccess.value = ''
    requestError.value = ''

    const headers = { Authorization: `Bearer ${auth.token}` }
    const payload = {
      tipo_incidencia: 'SOPORTE',
      asunto: directivoForm.value.asunto,
      descripcion: directivoForm.value.descripcion,
      estado: 'ESCALADO' // <--- Se inserta con estado ESCALADO para el Admin General
    }

    const res = await axios.post('/api/support/tickets', payload, { headers })
    requestSuccess.value = `Mensaje enviado al Administrador General con éxito. Código de ticket escalado: ${res.data.ticketCode}`
    showDirectivoModal.value = false
    directivoForm.value.asunto = ''
    directivoForm.value.descripcion = ''
  } catch (error: any) {
    requestError.value = error.response?.data?.error || 'Error al enviar el mensaje.'
  } finally {
    submittingDirectivoMessage.value = false
  }
}

// Resetear contraseña de otro usuario (Solo Admin General)
const handleAdminResetPassword = async (targetUser: any) => {
  if (!adminResetPasswordVal.value.trim()) {
    adminResetError.value = 'Escribe la nueva contraseña.'
    return
  }

  try {
    resettingPasswordIndex.value = targetUser.id_usuario
    adminResetSuccess.value = ''
    adminResetError.value = ''

    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.post(
      `/api/admin/usuarios/${targetUser.id_usuario}/restablecer-password`, 
      { nueva_password: adminResetPasswordVal.value }, 
      { headers }
    )

    adminResetSuccess.value = `Contraseña del usuario ${targetUser.nombre} ${targetUser.apellido} cambiada a: ${adminResetPasswordVal.value}`
    adminResetPasswordVal.value = ''
    selectedUserToReset.value = null
  } catch (error: any) {
    adminResetError.value = error.response?.data?.error || 'Error al cambiar la contraseña del usuario.'
  } finally {
    resettingPasswordIndex.value = null
  }
}

const filteredUsers = computed(() => {
  if (!searchUserQuery.value.trim()) return []
  const q = searchUserQuery.value.toLowerCase()
  return usersList.value.filter(u => 
    (u.nombre && u.nombre.toLowerCase().includes(q)) ||
    (u.apellido && u.apellido.toLowerCase().includes(q)) ||
    (u.email && u.email.toLowerCase().includes(q)) ||
    (u.documento && u.documento.includes(q))
  ).slice(0, 5) // Mostramos un listado top de 5 coincidencias rápidas
})

const goBack = () => {
  router.push('/dashboard')
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 transition-colors duration-500 flex flex-col justify-center items-center">
    <div class="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-10 relative overflow-hidden transition-all duration-300">
      
      <!-- Back button -->
      <button 
        @click="goBack" 
        class="absolute top-8 left-8 flex items-center gap-2 text-xs font-black text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase tracking-widest"
      >
        <ArrowLeft :size="16" />
        Regresar
      </button>

      <!-- Loader -->
      <div v-if="loadingProfile" class="flex flex-col items-center justify-center p-20">
        <Loader2 class="w-10 h-10 text-indigo-650 animate-spin mb-4" />
        <p class="text-slate-550 font-bold text-sm">Cargando perfil de usuario...</p>
      </div>

      <!-- Main Profile panel -->
      <div v-else class="mt-8 space-y-8">
        
        <!-- Welcome banner -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/60">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 bg-indigo-55/60 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner">
              {{ profileData.nombre.charAt(0) }}{{ profileData.apellido.charAt(0) }}
            </div>
            <div>
              <h1 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{{ profileData.nombre }} {{ profileData.apellido }}</h1>
              <p class="text-xs text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">
                Rol activo: {{ activeRole }}
              </p>
            </div>
          </div>

          <!-- Action buttons based on Role -->
          <div class="flex flex-wrap gap-3">
            <button 
              v-if="isDirectivo && !auth.isMonitoring"
              @click="showDirectivoModal = true"
              class="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-100 dark:shadow-none"
            >
              Contactar con Admin General
            </button>

            <button 
              v-if="isParentOrTeacher && !auth.isMonitoring"
              @click="handleRequestCredentialsChange"
              :disabled="submittingRequest"
              class="px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <Loader2 v-if="submittingRequest" class="w-4 h-4 animate-spin inline mr-1" />
              Pedir Cambio de Credenciales
            </button>
          </div>
        </div>

        <!-- Monitoring Mode Read-Only Banner -->
        <div v-if="auth.isMonitoring" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex items-center gap-3">
          <ShieldAlert class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p class="text-xs font-bold text-amber-800 dark:text-amber-300">
            Modo Monitoreo — Visualizando información de la cuenta de {{ profileData?.nombre }} {{ profileData?.apellido }} en Solo Lectura.
          </p>
        </div>

        <!-- Success/Error global alerts -->
        <div v-if="requestSuccess" class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250/30 text-emerald-800 dark:text-emerald-400 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 class="w-5 h-5 text-emerald-600 shrink-0" />
          <p class="text-xs font-bold">{{ requestSuccess }}</p>
        </div>
        <div v-if="requestError" class="bg-red-50 dark:bg-red-950/20 border border-red-200 text-red-700 dark:text-red-400 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle class="w-5 h-5 text-red-600 shrink-0" />
          <p class="text-xs font-bold">{{ requestError }}</p>
        </div>

        <!-- Details Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <!-- Column 1: Info and email change -->
          <div class="space-y-6">
            <h2 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Datos de Identificación</h2>
            
            <div class="space-y-4">
              <!-- Document info -->
              <div class="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-850 rounded-2xl grid grid-cols-2 gap-4">
                <div>
                  <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tipo de Documento</span>
                  <p class="text-xs font-black text-slate-800 dark:text-slate-200 mt-1">{{ profileData.tipo_documento || 'No Registrado' }}</p>
                </div>
                <div>
                  <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Número de Documento</span>
                  <p class="text-xs font-black text-slate-800 dark:text-slate-200 mt-1">{{ profileData.documento || 'No Registrado' }}</p>
                </div>
              </div>

              <!-- Phone form -->
              <form @submit.prevent="handleUpdatePhone" class="space-y-3">
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Teléfono / Celular de Contacto</label>
                    <span v-if="isStudent" class="text-[10px] font-bold text-slate-400 italic">Opcional</span>
                  </div>
                  <div class="relative">
                    <input 
                      v-model="phoneForm.telefono"
                      type="text" 
                      placeholder="Ej. +57 300 123 4567"
                      :disabled="auth.isMonitoring"
                      class="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                    <Phone class="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                  </div>
                </div>

                <div v-if="phoneSuccess" class="text-emerald-600 dark:text-emerald-400 text-xs font-bold ml-1">{{ phoneSuccess }}</div>
                <div v-if="phoneError" class="text-rose-600 dark:text-rose-455 text-xs font-bold ml-1">{{ phoneError }}</div>

                <button 
                  v-if="!auth.isMonitoring"
                  type="submit" 
                  :disabled="submittingPhone || phoneForm.telefono === (profileData.telefono || '')"
                  class="px-5 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <Loader2 v-if="submittingPhone" class="w-3.5 h-3.5 animate-spin" />
                  Guardar Teléfono
                </button>
              </form>

              <!-- Email change form (2-Step Verification) -->
              <div class="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                
                <!-- STEP 1: Enter New Email & Request Code -->
                <form v-if="emailStep === 1" @submit.prevent="handleRequestEmailCode" class="space-y-3">
                  <div class="space-y-2">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                    <div class="relative">
                      <input 
                        v-model="emailForm.email"
                        type="email" 
                        required
                        :disabled="auth.isMonitoring"
                        class="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                      />
                      <Mail class="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                    </div>
                  </div>

                  <div v-if="emailSuccess" class="text-emerald-600 dark:text-emerald-400 text-xs font-bold ml-1">{{ emailSuccess }}</div>
                  <div v-if="emailError" class="text-rose-600 dark:text-rose-455 text-xs font-bold ml-1">{{ emailError }}</div>

                  <button 
                    v-if="!auth.isMonitoring"
                    type="submit" 
                    :disabled="submittingEmail || emailForm.email === profileData.email"
                    class="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Loader2 v-if="submittingEmail" class="w-3.5 h-3.5 animate-spin" />
                    <span>Enviar Código de Verificación</span>
                  </button>
                </form>

                <!-- STEP 2: Enter 6-Digit Code to Confirm -->
                <form v-else-if="!auth.isMonitoring" @submit.prevent="handleVerifyEmailCode" class="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50 rounded-2xl space-y-4 animate-in fade-in duration-200">
                  <div class="flex items-start gap-3">
                    <div class="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0 mt-0.5">
                      <ShieldCheck class="w-5 h-5" />
                    </div>
                    <div>
                      <h4 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Verificación de Seguridad</h4>
                      <p class="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-1">
                        Hemos enviado un código de 6 dígitos a <span class="font-extrabold text-indigo-600 dark:text-indigo-400">{{ pendingNewEmail }}</span>. Revisa tu bandeja de entrada.
                      </p>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Código de 6 dígitos</label>
                    <input 
                      v-model="verificationCode"
                      type="text" 
                      maxlength="6"
                      placeholder="000000"
                      required
                      class="w-full text-center tracking-[0.4em] font-black text-xl py-3.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div v-if="emailSuccess" class="text-emerald-700 dark:text-emerald-300 text-xs font-bold ml-1">{{ emailSuccess }}</div>
                  <div v-if="emailError" class="text-rose-600 dark:text-rose-400 text-xs font-bold ml-1">{{ emailError }}</div>

                  <div class="flex flex-wrap items-center gap-2 pt-1">
                    <button 
                      type="submit" 
                      :disabled="submittingCode || verificationCode.trim().length !== 6"
                      class="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Loader2 v-if="submittingCode" class="w-3.5 h-3.5 animate-spin" />
                      <span>Confirmar y Cambiar Correo</span>
                    </button>

                    <button 
                      @click="handleRequestEmailCode"
                      type="button"
                      :disabled="submittingEmail"
                      class="px-3.5 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                    >
                      Reenviar
                    </button>

                    <button 
                      @click="cancelEmailChange"
                      type="button"
                      class="px-3.5 py-3 text-rose-600 hover:underline text-xs font-bold cursor-pointer ml-auto"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>

              </div>
            </div>
          </div>

          <!-- Column 2: Password change -->
          <div class="space-y-6">
            <h2 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Cambiar Contraseña</h2>
            
            <div v-if="auth.isMonitoring" class="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-850 text-center space-y-2">
              <Lock class="w-8 h-8 text-slate-400 mx-auto" />
              <p class="text-xs font-bold text-slate-600 dark:text-slate-300">Cambio de contraseña bloqueado en Modo Monitoreo.</p>
              <p class="text-[10px] text-slate-400 font-semibold">Solo el usuario propietario puede actualizar sus credenciales de acceso.</p>
            </div>

            <form v-else @submit.prevent="handleUpdatePassword" class="space-y-4">
              <!-- Actual -->
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contraseña Actual</label>
                <div class="relative">
                  <input 
                    v-model="passwordForm.password_actual"
                    :type="showOldPass ? 'text' : 'password'" 
                    required
                    class="w-full pl-11 pr-12 py-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none"
                  />
                  <Lock class="w-5 h-5 text-slate-400 absolute left-4 top-4" />
                  <button 
                    type="button" 
                    @click="showOldPass = !showOldPass" 
                    class="absolute right-4 top-4 text-slate-400 hover:text-slate-655"
                  >
                    <Eye v-if="!showOldPass" :size="20" />
                    <EyeOff v-else :size="20" />
                  </button>
                </div>
              </div>

              <!-- Nueva -->
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nueva Contraseña (Mín. 6 caracteres)</label>
                <div class="relative">
                  <input 
                    v-model="passwordForm.nueva_password"
                    :type="showNewPass ? 'text' : 'password'" 
                    required
                    class="w-full pl-11 pr-12 py-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none"
                  />
                  <KeyRound class="w-5 h-5 text-slate-400 absolute left-4 top-4" />
                  <button 
                    type="button" 
                    @click="showNewPass = !showNewPass" 
                    class="absolute right-4 top-4 text-slate-400 hover:text-slate-655"
                  >
                    <Eye v-if="!showNewPass" :size="20" />
                    <EyeOff v-else :size="20" />
                  </button>
                </div>
              </div>

              <!-- Confirmación -->
              <div class="space-y-2">
                <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Confirmar Nueva Contraseña</label>
                <div class="relative">
                  <input 
                    v-model="passwordForm.confirmar_password"
                    :type="showConfirmPass ? 'text' : 'password'" 
                    required
                    class="w-full pl-11 pr-12 py-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 transition-all outline-none"
                  />
                  <KeyRound class="w-5 h-5 text-slate-400 absolute left-4 top-4" />
                  <button 
                    type="button" 
                    @click="showConfirmPass = !showConfirmPass" 
                    class="absolute right-4 top-4 text-slate-400 hover:text-slate-655"
                  >
                    <Eye v-if="!showConfirmPass" :size="20" />
                    <EyeOff v-else :size="20" />
                  </button>
                </div>
              </div>

              <div v-if="passwordSuccess" class="text-emerald-600 dark:text-emerald-400 text-xs font-bold ml-1">{{ passwordSuccess }}</div>
              <div v-if="passwordError" class="text-rose-600 dark:text-rose-455 text-xs font-bold ml-1">{{ passwordError }}</div>

              <button 
                type="submit" 
                :disabled="submittingPassword || !passwordForm.nueva_password || passwordForm.nueva_password.length < 6"
                class="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Loader2 v-if="submittingPassword" class="w-3.5 h-3.5 animate-spin" />
                Actualizar Contraseña
              </button>
            </form>
          </div>
        </div>

        <!-- 3. ADMIN PANEL: Change other user password -->
        <div v-if="isAdmin" class="pt-8 border-t border-slate-100 dark:border-slate-800/60 space-y-6">
          <h2 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider ml-1 flex items-center gap-2">
            <ShieldAlert class="text-amber-500" :size="18" />
            Cambiar Contraseña de Otro Usuario
          </h2>

          <div class="space-y-4">
            <!-- Search User -->
            <div class="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <Users class="text-slate-400 shrink-0" :size="18" />
              <input 
                v-model="searchUserQuery"
                type="text"
                placeholder="Escribe el nombre, correo o documento del usuario..."
                class="w-full bg-transparent border-none text-slate-850 dark:text-slate-200 placeholder-slate-400 focus:outline-none text-sm font-semibold"
              />
            </div>

            <!-- Users suggestion box -->
            <div v-if="filteredUsers.length > 0" class="border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-inner">
              <div 
                v-for="u in filteredUsers" 
                :key="u.id_usuario"
                @click="selectedUserToReset = u"
                class="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                :class="{'bg-indigo-50/30 dark:bg-indigo-950/20': selectedUserToReset?.id_usuario === u.id_usuario}"
              >
                <div>
                  <h4 class="text-xs font-black text-slate-800 dark:text-slate-200">{{ u.nombre }} {{ u.apellido }}</h4>
                  <p class="text-[10px] text-slate-500 dark:text-slate-450 font-bold mt-0.5">{{ u.email }} • Rol: {{ u.rol }}</p>
                </div>
                <button 
                  class="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-[10px] font-black uppercase tracking-wider"
                >
                  Seleccionar
                </button>
              </div>
            </div>

            <!-- Restructuring actions -->
            <div v-if="selectedUserToReset" class="p-6 bg-slate-50/40 dark:bg-slate-800/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 animate-in fade-in duration-300">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Usuario Seleccionado</span>
                  <h3 class="font-black text-slate-850 dark:text-slate-200 text-sm mt-0.5">
                    {{ selectedUserToReset.nombre }} {{ selectedUserToReset.apellido }}
                  </h3>
                </div>
                <button 
                  @click="selectedUserToReset = null"
                  class="text-xs font-bold text-slate-405 hover:text-slate-655"
                >
                  Cancelar
                </button>
              </div>

              <!-- Input password update -->
              <div class="flex flex-col sm:flex-row gap-3">
                <div class="relative flex-1">
                  <input 
                    v-model="adminResetPasswordVal"
                    type="text"
                    placeholder="Escribe la nueva contraseña..."
                    class="w-full pl-4 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl text-xs font-bold text-slate-850 dark:text-slate-200"
                  />
                </div>
                <button 
                  @click="handleAdminResetPassword(selectedUserToReset)"
                  :disabled="resettingPasswordIndex === selectedUserToReset.id_usuario"
                  class="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 justify-center"
                >
                  <Loader2 v-if="resettingPasswordIndex === selectedUserToReset.id_usuario" class="w-3.5 h-3.5 animate-spin" />
                  Cambiar Contraseña
                </button>
              </div>

              <div v-if="adminResetSuccess" class="text-emerald-600 dark:text-emerald-400 text-xs font-bold ml-1">{{ adminResetSuccess }}</div>
              <div v-if="adminResetError" class="text-rose-600 dark:text-rose-455 text-xs font-bold ml-1">{{ adminResetError }}</div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Directivo contact modal to Admin General -->
    <div 
      v-if="showDirectivoModal" 
      class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click.self="showDirectivoModal = false"
    >
      <div class="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-150 dark:border-slate-800 p-8 shadow-2xl relative space-y-6 animate-in zoom-in-95 duration-300">
        <div class="space-y-2 text-center max-w-xs mx-auto">
          <h3 class="text-lg font-black text-slate-850 dark:text-white tracking-tight">Contactar al Administrador</h3>
          <p class="text-xs text-slate-450 dark:text-slate-500 font-semibold leading-relaxed">
            Redacta un mensaje directo. Tu solicitud se enviará con prioridad en el estado de escalamiento.
          </p>
        </div>

        <form @submit.prevent="handleContactAdminGeneral" class="space-y-4">
          <!-- Asunto -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Asunto *</label>
            <input 
              v-model="directivoForm.asunto"
              type="text" 
              required
              placeholder="Ej. Incidencia general de matrícula"
              class="w-full pl-4 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:bg-white focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <!-- Descripción -->
          <div class="space-y-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mensaje Detallado *</label>
            <textarea 
              v-model="directivoForm.descripcion"
              required
              rows="4"
              placeholder="Explica la razón de tu contacto..."
              class="w-full p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:bg-white focus:border-indigo-500 outline-none resize-none transition-all"
            ></textarea>
          </div>

          <button 
            type="submit" 
            :disabled="submittingDirectivoMessage || !directivoForm.asunto.trim() || !directivoForm.descripcion.trim()"
            class="w-full py-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
          >
            <Loader2 v-if="submittingDirectivoMessage" class="w-4 h-4 animate-spin" />
            <Send v-else :size="14" />
            Enviar Mensaje
          </button>
        </form>
      </div>
    </div>

  </div>
</template>

<style scoped>
</style>
