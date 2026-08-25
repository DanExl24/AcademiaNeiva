<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { adminGeneralService } from '../../services/adminGeneralService'
import { 
  Users, Search, UserCheck, ShieldAlert, Key, LogOut, Trash2, Eye, 
  Mail, School, Shield, Calendar, Lock, Clipboard, Check, Ban, Loader2,
  UserPlus, RefreshCw
} from 'lucide-vue-next'

import { useConfirm } from '../../composables/useConfirm'
import { useToast } from '../../composables/useToast'
import StatCard from '../../components/ui/StatCard.vue'
import DataTable from '../../components/ui/DataTable.vue'
import SkeletonTable from '../../components/feedback/SkeletonTable.vue'
import EmptyState from '../../components/feedback/EmptyState.vue'

const route = useRoute()
const { confirm } = useConfirm()
const toast = useToast()



interface Usuario {
  id_usuario: number
  email: string
  nombre: string
  apellido: string
  rol_nombre: string
  roles?: string[]
  colegio_nombre?: string
  id_colegio?: number
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'BANEADO' | 'ELIMINADO'
  fecha_creacion: string
  motivo_baneo?: string
  fecha_baneo?: string
  baneado_por_nombre?: string
  baneado_por_email?: string
  documento?: string
  tipo_documento?: string
}

interface ColegioBrief {
  id_colegio: number
  nombre: string
}

const loading = ref(true)
const users = ref<Usuario[]>([])
const schools = ref<ColegioBrief[]>([])
const search = ref('')
const selectedRole = ref(route.query.rol as string || '')
const selectedEstado = ref('')
const selectedSchool = ref('')

// KPIs
const stats = ref({
  total: 0,
  activos: 0,
  baneados: 0,
  suspendidos: 0
})

// Modals
const showDetailsModal = ref(false)
const showBanModal = ref(false)
const showResetModal = ref(false)
const showCreateUserModal = ref(false)
const creatingUser = ref(false)
const createError = ref('')
const resetting = ref(false)

// Soft-delete modal
const showDeleteModal = ref(false)
const deleteTicketCode = ref('')
const deleteMotivo = ref('')
const deleting = ref(false)
const deleteError = ref('')
const userToDelete = ref<Usuario | null>(null)

const newUser = ref({
  rol: 'directivo',
  email: '',
  password: '',
  nombre: '',
  apellido: '',
  id_colegio: '' as number | '',
  tipo_documento: 'CC',
  documento: '',
  telefono: ''
})

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#'
  let pass = ''
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  newUser.value.password = pass
}

const openCreateUserModal = () => {
  createError.value = ''
  newUser.value = {
    rol: 'directivo',
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    id_colegio: selectedSchool.value ? Number(selectedSchool.value) : '',
    tipo_documento: 'CC',
    documento: '',
    telefono: ''
  }
  generateRandomPassword()
  showCreateUserModal.value = true
}

const submitCreateUser = async () => {
  if (creatingUser.value) return
  createError.value = ''

  if (newUser.value.rol !== 'admin_general' && !newUser.value.id_colegio) {
    createError.value = 'Debe seleccionar una institución educativa.'
    return
  }

  if (!newUser.value.email.trim()) {
    createError.value = 'El correo electrónico es obligatorio.'
    return
  }

  if (!newUser.value.password || newUser.value.password.length < 6) {
    createError.value = 'La contraseña debe tener al menos 6 caracteres.'
    return
  }

  if (!newUser.value.nombre.trim()) {
    createError.value = 'El nombre es obligatorio.'
    return
  }

  try {
    creatingUser.value = true
    await adminGeneralService.createUsuario({
      rol: newUser.value.rol,
      email: newUser.value.email.trim(),
      password: newUser.value.password,
      nombre: newUser.value.nombre.trim(),
      apellido: newUser.value.apellido.trim() || undefined,
      id_colegio: newUser.value.id_colegio ? Number(newUser.value.id_colegio) : null,
      tipo_documento: newUser.value.tipo_documento || null,
      documento: newUser.value.documento.trim() || null,
      telefono: newUser.value.telefono.trim() || null
    })

    showCreateUserModal.value = false
    await fetchUsers()
  } catch (error: any) {
    createError.value = error.response?.data?.error || 'Error al crear el usuario'
  } finally {
    creatingUser.value = false
  }
}

const selectedUser = ref<Usuario | null>(null)
const banReason = ref('')
const tempPassword = ref('')
const copied = ref(false)

// Modificación de credenciales con ticket de soporte
const editingCredentials = ref(false)
const ticketCodeVerification = ref('')
const verifyingTicket = ref(false)
const verificationError = ref('')
const editableNombre = ref('')
const editableApellido = ref('')
const editableTipoDoc = ref('')
const editableDocumento = ref('')
const editableRoles = ref<string[]>([])
const applyingChange = ref(false)

const verifyTicketAndEnableEdit = async () => {
  if (!ticketCodeVerification.value.trim() || !selectedUser.value) return
  try {
    verifyingTicket.value = true
    verificationError.value = ''
    
    // Consultar el endpoint privado de validación del ticket para esta cuenta específica
    await adminGeneralService.validarTicketUsuario(selectedUser.value.id_usuario, {
      codigo_ticket: ticketCodeVerification.value.trim()
    })


    // Inicializar campos editables si pasa la validación de correspondencia y estado
    editableNombre.value = selectedUser.value.nombre
    editableApellido.value = selectedUser.value.apellido || ''
    
    // Normalizar Tipo de Documento
    const rawTipoDoc = String(selectedUser.value.tipo_documento || '').trim()
    if (rawTipoDoc.includes('Cédula de Ciudadanía') || rawTipoDoc === 'CC') {
      editableTipoDoc.value = 'CC'
    } else if (rawTipoDoc.includes('Tarjeta de Identidad') || rawTipoDoc === 'TI') {
      editableTipoDoc.value = 'TI'
    } else if (rawTipoDoc.includes('Cédula de Extranjería') || rawTipoDoc === 'CE') {
      editableTipoDoc.value = 'CE'
    } else if (rawTipoDoc.includes('Registro Civil') || rawTipoDoc === 'RC') {
      editableTipoDoc.value = 'RC'
    } else if (rawTipoDoc.includes('PEP') || rawTipoDoc.includes('PPT') || rawTipoDoc === 'PEP') {
      editableTipoDoc.value = 'PEP'
    } else {
      editableTipoDoc.value = 'CC'
    }

    editableDocumento.value = selectedUser.value.documento || ''
    
    // Normalizar Roles a mayúsculas
    editableRoles.value = (selectedUser.value.roles || []).map((r: string) => {
      let normalized = String(r).toUpperCase().trim();
      if (normalized === 'ADMIN') return 'ADMIN_GENERAL';
      if (normalized === 'PADRE_FAMILIA') return 'PADRE';
      return normalized;
    })
    
    editingCredentials.value = true
  } catch (error: any) {
    verificationError.value = error.response?.data?.error || 'Código de ticket inválido o no corresponde a esta cuenta.'
  } finally {
    verifyingTicket.value = false
  }
}

const cancelEdit = () => {
  editingCredentials.value = false
  ticketCodeVerification.value = ''
  verificationError.value = ''
  editableNombre.value = ''
  editableApellido.value = ''
  editableTipoDoc.value = ''
  editableDocumento.value = ''
  editableRoles.value = []
}

const applyCredentialsChange = async () => {
  if (!selectedUser.value || applyingChange.value) return
  try {
    applyingChange.value = true
    await adminGeneralService.updateUsuarioCredencialesConTicket(selectedUser.value.id_usuario, {
      codigo_ticket: ticketCodeVerification.value.trim(),
      nombre: editableNombre.value,
      apellido: editableApellido.value,
      tipo_documento: editableTipoDoc.value,
      documento: editableDocumento.value,
      roles: editableRoles.value
    })

    alert('Credenciales y roles actualizados exitosamente.')
    
    // Actualizar localmente el usuario seleccionado
    selectedUser.value.nombre = editableNombre.value
    selectedUser.value.apellido = editableApellido.value
    selectedUser.value.tipo_documento = editableTipoDoc.value
    selectedUser.value.documento = editableDocumento.value
    selectedUser.value.roles = [...editableRoles.value]
    selectedUser.value.rol_nombre = editableRoles.value[0] || 'sin_rol'

    cancelEdit()
    showDetailsModal.value = false
    await fetchUsers()
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al aplicar los cambios de credenciales.')
  } finally {
    applyingChange.value = false
  }
}

const fetchSchools = async () => {
  try {
    const data = await adminGeneralService.getColegios()
    schools.value = (data || []).map((c: any) => ({ id_colegio: c.id_colegio, nombre: c.nombre }))
  } catch (error) {
    console.error('Error fetching schools:', error)
  }
}

const fetchUsers = async () => {
  try {
    loading.value = true
    const params = {
      estado: selectedEstado.value || undefined,
      rol: selectedRole.value || undefined,
      id_colegio: selectedSchool.value || undefined,
      search: search.value || undefined
    }
    const data = await adminGeneralService.getUsuarios(params)
    
    users.value = (data || []).map((u: any) => ({
      ...u,
      rol_nombre: u.roles && u.roles[0] ? u.roles[0] : 'sin_rol'
    }))

    // Refresh KPI counts
    stats.value = {
      total: users.value.length,
      activos: users.value.filter(u => u.estado === 'ACTIVO').length,
      baneados: users.value.filter(u => u.estado === 'BANEADO').length,
      suspendidos: users.value.filter(u => u.estado === 'SUSPENDIDO').length
    }
  } catch (error) {
    console.error('Error fetching users:', error)
  } finally {
    loading.value = false
  }
}

let debounceTimeout: any = null
watch(search, () => {
  if (debounceTimeout) clearTimeout(debounceTimeout)
  debounceTimeout = setTimeout(() => {
    fetchUsers()
  }, 400)
})

watch([selectedRole, selectedEstado, selectedSchool], () => {
  fetchUsers()
})

watch(() => route.query.rol, (newVal) => {
  selectedRole.value = (newVal as string) || ''
})

onMounted(() => {
  fetchSchools()
  fetchUsers()
})

const openDetails = async (user: Usuario) => {
  selectedUser.value = user
  showDetailsModal.value = true
  try {
    const res = await adminGeneralService.getUsuario(user.id_usuario)
    const data = res || {}
    selectedUser.value = { 
      ...user, 
      ...data,
      rol_nombre: data.roles && data.roles[0] ? data.roles[0] : (user.rol_nombre || 'sin_rol')
    }
  } catch (error) {
    console.error('Error fetching user details:', error)
  }
}

const updateStatus = async (user: Usuario, estado: string, motivo?: string) => {
  const ok = await confirm({
    title: 'Cambiar Estado de Usuario',
    message: `¿Confirmas el cambio de estado de ${user.nombre} a ${estado}?`,
    confirmText: 'Confirmar Cambio',
    type: estado === 'BANEADO' || estado === 'SUSPENDIDO' ? 'danger' : 'primary'
  })
  if (!ok) return

  try {
    await adminGeneralService.updateUsuarioEstado(user.id_usuario, {
      estado,
      motivo
    })
    toast.success(`Estado actualizado a ${estado}`)
    await fetchUsers()
    if (selectedUser.value?.id_usuario === user.id_usuario) {
      selectedUser.value.estado = estado as any
    }
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al cambiar estado')
  }
}

const openBan = (user: Usuario) => {
  selectedUser.value = user
  banReason.value = ''
  showBanModal.value = true
}

const handleBan = async () => {
  if (!selectedUser.value) return
  if (!banReason.value.trim()) {
    toast.warning('Por favor indica un motivo para el baneo.')
    return
  }
  await updateStatus(selectedUser.value, 'BANEADO', banReason.value)
  showBanModal.value = false
}

const handleResetPassword = async (user: Usuario) => {
  const ok = await confirm({
    title: 'Restablecer Contraseña',
    message: `¿Estás seguro de que deseas restablecer la contraseña de ${user.nombre} ${user.apellido || ''}? Se generará una contraseña temporal.`,
    confirmText: 'Restablecer Contraseña',
    type: 'warning'
  })
  if (!ok) return

  try {
    resetting.value = true
    selectedUser.value = user
    tempPassword.value = ''
    showResetModal.value = true
    const res = await adminGeneralService.restablecerPassword(user.id_usuario)
    tempPassword.value = res.password_temporal || res.tempPassword || ''
    toast.success('Contraseña temporal generada con éxito')
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al restablecer contraseña')
    showResetModal.value = false
  } finally {
    resetting.value = false
  }
}

const copyPassword = () => {
  navigator.clipboard.writeText(tempPassword.value)
  copied.value = true
  toast.info('Contraseña copiada al portapapeles')
  setTimeout(() => copied.value = false, 2000)
}

const handleForceLogout = async (user: Usuario) => {
  const ok = await confirm({
    title: 'Forzar Cierre de Sesión',
    message: `¿Deseas forzar el cierre de todas las sesiones activas de ${user.nombre}?`,
    confirmText: 'Cerrar Sesiones',
    type: 'danger'
  })
  if (!ok) return

  try {
    await adminGeneralService.cerrarSesionUsuario(user.id_usuario)
    toast.success('Sesiones cerradas con éxito.')
  } catch (error: any) {
    toast.error(error.response?.data?.error || 'Error al forzar cierre de sesión')
  }
}

const openDeleteModal = (user: Usuario) => {
  userToDelete.value = user
  deleteTicketCode.value = ''
  deleteMotivo.value = ''
  deleteError.value = ''
  showDeleteModal.value = true
}

const handleDelete = async () => {
  if (!userToDelete.value) return
  if (!deleteTicketCode.value.trim()) {
    deleteError.value = 'El código de ticket del Directivo es obligatorio.'
    return
  }
  try {
    deleting.value = true
    deleteError.value = ''
    const res = await adminGeneralService.eliminarUsuarioConTicket(userToDelete.value.id_usuario, {
      codigo_ticket: deleteTicketCode.value.trim(),
      motivo: deleteMotivo.value.trim() || undefined
    })
    showDeleteModal.value = false
    showDetailsModal.value = false
    await fetchUsers()
    alert(res.message || 'Usuario eliminado exitosamente.')
  } catch (error: any) {
    deleteError.value = error.response?.data?.error || 'Error al eliminar usuario. Verifica que tienes sesión de supervisión activa y que el ticket es válido.'
  } finally {
    deleting.value = false
  }
}

</script>

<template>
  <div class="max-w-[1400px] mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="px-8 py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Users :size="32" />
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">Usuarios de la Plataforma</h1>
            <p class="text-slate-500 dark:text-slate-400 font-medium">Control administrativo de cuentas de usuarios registrados.</p>
          </div>
        </div>

        <button 
          @click="openCreateUserModal" 
          class="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-6 py-3.5 rounded-2xl font-black shadow-lg shadow-indigo-500/20 transition-all cursor-pointer text-sm"
        >
          <UserPlus :size="18" />
          <span>Crear Usuario</span>
        </button>
      </div>
    </div>

    <!-- KPIs Row -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard title="Total Filtrados" :value="stats.total">
        <template #icon>
          <Users :size="20" class="text-indigo-600 dark:text-indigo-400" />
        </template>
      </StatCard>

      <StatCard title="Activos" :value="stats.activos">
        <template #icon>
          <UserCheck :size="20" class="text-emerald-600 dark:text-emerald-400" />
        </template>
      </StatCard>

      <StatCard title="Baneados" :value="stats.baneados">
        <template #icon>
          <Ban :size="20" class="text-red-600 dark:text-red-400" />
        </template>
      </StatCard>

      <StatCard title="Suspendidos" :value="stats.suspendidos">
        <template #icon>
          <ShieldAlert :size="20" class="text-orange-600 dark:text-orange-400" />
        </template>
      </StatCard>
    </div>


    <!-- Filters and Table -->
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-300">
      <div class="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-800/20 flex flex-col md:flex-row gap-3">
        <!-- Search bar -->
        <div class="relative flex-1">
          <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" :size="16" />
          <input 
            v-model="search" 
            type="text" 
            placeholder="Buscar por nombre, apellido, correo..."
            class="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none text-slate-900 dark:text-white"
          />
        </div>

        <div class="flex flex-wrap gap-3">
          <!-- Role selector -->
          <select v-model="selectedRole" class="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none text-slate-700 dark:text-slate-200 cursor-pointer min-w-[140px]">
            <option value="">Todos los roles</option>
            <option value="directivo">Directivos</option>
            <option value="docente">Docentes</option>
            <option value="padre">Padres</option>
            <option value="estudiante">Estudiantes</option>
            <option value="admin_general">Admin General</option>
          </select>

          <!-- State selector -->
          <select v-model="selectedEstado" class="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none text-slate-700 dark:text-slate-200 cursor-pointer min-w-[140px]">
            <option value="">Todos los estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="SUSPENDIDO">Suspendidos</option>
            <option value="BANEADO">Baneados</option>
            <option value="ELIMINADO">Eliminados</option>
          </select>

          <!-- School selector -->
          <select v-model="selectedSchool" class="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-sm font-bold border-none outline-none text-slate-700 dark:text-slate-200 cursor-pointer max-w-[200px]">
            <option value="">Todas las instituciones</option>
            <option v-for="school in schools" :key="school.id_colegio" :value="school.id_colegio">{{ school.nombre }}</option>
          </select>
        </div>
      </div>

      <!-- User Table -->
      <div class="p-4">
        <SkeletonTable v-if="loading" :rows="6" :cols="5" />

        <EmptyState 
          v-else-if="users.length === 0"
          title="No se encontraron usuarios"
          description="No hay cuentas de usuario que coincidan con los filtros seleccionados."
        >
          <template #icon>
            <Users class="w-8 h-8 text-indigo-500" />
          </template>
        </EmptyState>

        <DataTable v-else>
          <template #header>
            <tr>
              <th class="p-4">Usuario</th>
              <th class="p-4">Rol</th>
              <th class="p-4">Institución</th>
              <th class="p-4">Estado</th>
              <th class="p-4 text-center">Acciones</th>
            </tr>
          </template>
          <tr v-for="user in users" :key="user.id_usuario" class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">

              <td class="p-4">
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white">{{ user.nombre }} {{ user.apellido || '' }}</h4>
                  <p class="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5"><Mail :size="12" /> {{ user.email }}</p>
                </div>
              </td>
              <td class="p-4">
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="r in user.roles || [user.rol_nombre]" 
                    :key="r"
                    class="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
                  >
                    {{ r }}
                  </span>
                </div>
              </td>
              <td class="p-4">
                <span class="truncate max-w-[200px] block" :title="user.colegio_nombre || 'Global'">
                  {{ user.colegio_nombre || 'Global / Sin Asignar' }}
                </span>
              </td>
              <td class="p-4">
                <span 
                  :class="[
                    user.estado === 'ACTIVO' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 dark:text-emerald-400' : '',
                    user.estado === 'SUSPENDIDO' ? 'text-orange-600 bg-orange-50 dark:bg-orange-950/20 dark:text-orange-400' : '',
                    user.estado === 'BANEADO' ? 'text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400' : '',
                    user.estado === 'ELIMINADO' ? 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400' : '',
                    'px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider'
                  ]"
                >
                  {{ user.estado }}
                </span>
              </td>
              <td class="p-4">
                <div class="flex items-center justify-center gap-1.5">
                  <button @click="openDetails(user)" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-xl transition-all" title="Ver Detalle">
                    <Eye :size="16" />
                  </button>

                  <template v-if="user.estado !== 'ELIMINADO' && user.rol_nombre !== 'admin_general'">
                    <!-- State actions -->
                    <button 
                      v-if="user.estado !== 'ACTIVO'"
                      @click="updateStatus(user, 'ACTIVO')" 
                      class="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl transition-all"
                      title="Activar cuenta"
                    >
                      <UserCheck :size="16" />
                    </button>
                    <button 
                      v-if="user.estado === 'ACTIVO'"
                      @click="updateStatus(user, 'SUSPENDIDO')" 
                      class="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 rounded-xl transition-all"
                      title="Suspender cuenta"
                    >
                      <ShieldAlert :size="16" />
                    </button>
                    <button 
                      v-if="user.estado !== 'BANEADO'"
                      @click="openBan(user)" 
                      class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                      title="Banear cuenta"
                    >
                      <Ban :size="16" />
                    </button>

                    <!-- Reset Password -->
                    <button @click="handleResetPassword(user)" class="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-xl transition-all" title="Restablecer Contraseña">
                      <Key :size="16" />
                    </button>

                    <!-- Force logout -->
                    <button @click="handleForceLogout(user)" class="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all" title="Forzar Cierre de Sesiones">
                      <LogOut :size="16" />
                    </button>

                    <!-- Delete -->
                    <button @click="openDeleteModal(user)" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all" title="Eliminar cuenta (requiere ticket de Directivo)">
                      <Trash2 :size="16" />
                    </button>
                  </template>
                </div>
              </td>
            </tr>
        </DataTable>
      </div>
    </div>


    <!-- Modals -->
    <Teleport to="body">
      <!-- Details Modal -->
      <div v-if="showDetailsModal && selectedUser" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showDetailsModal = false"></div>
        <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          <div class="p-8 space-y-6">
            <div class="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h2 class="text-2xl font-black text-slate-900 dark:text-white">{{ selectedUser.nombre }} {{ selectedUser.apellido || '' }}</h2>
                <span class="text-xs text-indigo-500 font-extrabold uppercase mt-1 tracking-wider block">ID de Cuenta: #{{ selectedUser.id_usuario }}</span>
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 uppercase tracking-widest">{{ selectedUser.estado }}</span>
            </div>

            <!-- Profile Info: Read Only -->
            <div v-if="!editingCredentials" class="grid grid-cols-2 gap-4 text-sm font-semibold text-slate-600 dark:text-slate-400">
              <p class="flex items-center gap-2"><Mail :size="14" class="text-slate-400" /> <span class="font-medium text-slate-900 dark:text-white">{{ selectedUser.email }}</span></p>
              <div class="flex items-center gap-2 flex-wrap">
                <Shield :size="14" class="text-slate-400" /> 
                <span>Roles:</span>
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="r in selectedUser.roles || [selectedUser.rol_nombre]" 
                    :key="r"
                    class="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider"
                  >
                    {{ r }}
                  </span>
                </div>
              </div>
              <p class="flex items-center gap-2"><School :size="14" class="text-slate-400" /> Colegio: <span class="font-medium text-slate-900 dark:text-white">{{ selectedUser.colegio_nombre || 'Global (Administración)' }}</span></p>
              <p class="flex items-center gap-2"><Calendar :size="14" class="text-slate-400" /> Creación: <span class="font-medium text-slate-900 dark:text-white">{{ new Date(selectedUser.fecha_creacion).toLocaleDateString() }}</span></p>
              <p v-if="selectedUser.tipo_documento && selectedUser.documento" class="col-span-2 flex items-center gap-2">
                <Clipboard :size="14" class="text-slate-400" /> 
                <span>Identificación: </span>
                <span class="font-bold text-slate-900 dark:text-white">{{ selectedUser.tipo_documento }} #{{ selectedUser.documento }}</span>
              </p>
            </div>

            <!-- Profile Info: Edit Mode -->
            <div v-else class="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <h3 class="text-xs font-black text-slate-850 dark:text-white uppercase tracking-wider border-b pb-2">Modificar Datos Críticos</h3>
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nombre</label>
                  <input v-model="editableNombre" type="text" class="w-full bg-white dark:bg-slate-850 px-3 py-2 text-xs rounded-xl border border-slate-255 dark:border-slate-700 outline-none text-slate-800 dark:text-white font-bold" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Apellido</label>
                  <input v-model="editableApellido" type="text" class="w-full bg-white dark:bg-slate-850 px-3 py-2 text-xs rounded-xl border border-slate-255 dark:border-slate-700 outline-none text-slate-800 dark:text-white font-bold" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest ml-1">Tipo de Documento</label>
                  <select v-model="editableTipoDoc" class="w-full bg-white dark:bg-slate-850 px-3 py-2 text-xs rounded-xl border border-slate-255 dark:border-slate-700 outline-none text-slate-805 dark:text-white font-bold">
                    <option value="CC">Cédula de Ciudadanía (CC)</option>
                    <option value="TI">Tarjeta de Identidad (TI)</option>
                    <option value="CE">Cédula de Extranjería (CE)</option>
                    <option value="RC">Registro Civil (RC)</option>
                    <option value="PEP">PEP</option>
                  </select>
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Documento</label>
                  <input v-model="editableDocumento" type="text" class="w-full bg-white dark:bg-slate-850 px-3 py-2 text-xs rounded-xl border border-slate-255 dark:border-slate-700 outline-none text-slate-800 dark:text-white font-mono font-bold" />
                </div>
              </div>

              <!-- Roles checkbox list -->
              <div class="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 block">Roles Asignados</label>
                <div class="flex flex-wrap gap-4 px-1 py-1">
                  <label v-for="roleKey in ['ADMIN_GENERAL', 'DIRECTIVO', 'DOCENTE', 'PADRE', 'ESTUDIANTE']" :key="roleKey" class="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer">
                    <input type="checkbox" :value="roleKey" v-model="editableRoles" class="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 w-4 h-4" />
                    <span>{{ roleKey }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Modificar credentials ticket authorization panel -->
            <div v-if="!editingCredentials && selectedUser.estado !== 'ELIMINADO' && selectedUser.rol_nombre !== 'admin_general'" class="bg-indigo-50/20 dark:bg-slate-800/20 p-4 rounded-2xl border border-dashed border-indigo-200/50 dark:border-slate-800/80 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-black text-slate-700 dark:text-slate-300">¿Deseas modificar nombres, documentos o roles?</span>
              </div>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                Para desbloquear la edición de credenciales inmutables y la asignación de roles, es obligatorio ingresar el código del ticket de soporte correspondiente.
              </p>
              
              <div class="flex flex-col sm:flex-row gap-2 pt-1">
                <input 
                  v-model="ticketCodeVerification"
                  type="text"
                  placeholder="Código de ticket (Ej: TKT-1B3X9H7Z)"
                  class="flex-1 bg-white dark:bg-slate-850 px-3 py-2 border border-slate-200 dark:border-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl outline-none"
                />
                <button 
                  @click="verifyTicketAndEnableEdit"
                  :disabled="verifyingTicket || !ticketCodeVerification.trim()"
                  class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all shrink-0"
                >
                  <Loader2 v-if="verifyingTicket" class="w-3 h-3 animate-spin" />
                  Habilitar Edición
                </button>
              </div>
              
              <p v-if="verificationError" class="text-[10px] font-bold text-red-600 mt-1">{{ verificationError }}</p>
            </div>

            <!-- Ban / Suspension Logs -->
            <div v-if="selectedUser.estado === 'BANEADO' && selectedUser.motivo_baneo" class="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-4 rounded-2xl text-xs space-y-2">
              <h4 class="font-black text-red-600 dark:text-red-400 uppercase tracking-wider">Detalles del Baneo</h4>
              <p class="text-slate-600 dark:text-slate-400 font-bold">Baneado por: <span class="font-medium text-slate-900 dark:text-white">{{ selectedUser.baneado_por_email || 'Sistema' }}</span></p>
              <p v-if="selectedUser.fecha_baneo" class="text-slate-600 dark:text-slate-400 font-bold">Fecha: <span class="font-medium text-slate-900 dark:text-white">{{ new Date(selectedUser.fecha_baneo).toLocaleString() }}</span></p>
              <p class="text-slate-600 dark:text-slate-400 font-bold">Motivo: <span class="font-medium text-red-800 dark:text-red-300 block mt-1 bg-red-100/50 dark:bg-red-950/40 p-2 rounded-xl">{{ selectedUser.motivo_baneo }}</span></p>
            </div>

            <!-- Footer actions -->
            <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
              <template v-if="editingCredentials">
                <button 
                  @click="cancelEdit" 
                  class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs transition-all"
                >
                  Cancelar
                </button>
                <button 
                  @click="applyCredentialsChange" 
                  :disabled="applyingChange || !editableNombre.trim() || !editableApellido.trim() || !editableDocumento.trim() || editableRoles.length === 0"
                  class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Loader2 v-if="applyingChange" class="w-3.5 h-3.5 animate-spin" />
                  Aplicar Cambios
                </button>
              </template>
              <button 
                v-else
                @click="showDetailsModal = false" 
                class="px-6 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-bold text-sm hover:translate-y-[-2px] transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Ban Prompt Modal -->
      <div v-if="showBanModal && selectedUser" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-red-950/30 backdrop-blur-md" @click="showBanModal = false"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl">
          <div class="p-8 space-y-4">
            <div class="w-16 h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <Ban :size="32" />
            </div>
            <div class="text-center">
              <h2 class="text-xl font-black text-slate-900 dark:text-white">Banear Cuenta</h2>
              <p class="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">Por favor escribe la razón por la cual deseas banear a {{ selectedUser.nombre }}. El usuario no podrá iniciar sesión.</p>
            </div>
            <textarea 
              v-model="banReason"
              placeholder="Indica detalladamente los motivos del baneo..."
              rows="4"
              class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-bold outline-none text-slate-900 dark:text-white resize-none"
            ></textarea>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-6 flex gap-3 border-t border-slate-100 dark:border-slate-800">
            <button @click="showBanModal = false" class="flex-1 px-6 py-3 rounded-xl font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-all text-xs">Cancelar</button>
            <button 
              @click="handleBan"
              class="flex-1 bg-red-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-600 transition-all text-xs shadow-lg shadow-red-100 dark:shadow-none"
            >
              Aplicar Baneo
            </button>
          </div>
        </div>
      </div>

      <!-- Password Reset Result Modal -->
      <div v-if="showResetModal" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showResetModal = false"></div>
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl">
          <div class="p-8 space-y-4">
            <div class="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <Lock :size="32" />
            </div>
            <div class="text-center">
              <h2 class="text-xl font-black text-slate-900 dark:text-white">Contraseña Restablecida</h2>
              <p class="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">Comparte de manera segura esta credencial temporal con el usuario:</p>
            </div>
            
            <div v-if="resetting" class="text-center p-4 font-bold text-slate-400">Generando...</div>
            <div v-else class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 font-mono text-base font-black">
              <span class="text-slate-900 dark:text-white select-all">{{ tempPassword }}</span>
              <button @click="copyPassword" class="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all flex items-center gap-1">
                <component :is="copied ? Check : Clipboard" :size="16" />
                <span class="text-[10px] font-sans font-bold uppercase tracking-wider">{{ copied ? 'Copiado!' : 'Copiar' }}</span>
              </button>
            </div>
          </div>
          
          <div class="bg-slate-50 dark:bg-slate-800/50 p-6 flex justify-center border-t border-slate-100 dark:border-slate-800">
            <button @click="showResetModal = false" class="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:translate-y-[-1px] transition-all text-xs">Aceptar y Cerrar</button>
          </div>
        </div>
      </div>

      <!-- Create User Modal -->
      <div v-if="showCreateUserModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="showCreateUserModal = false"></div>
        <div class="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 my-8 max-h-[90vh] flex flex-col">
          <div class="px-8 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
            <div>
              <h2 class="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus :size="20" class="text-indigo-600 dark:text-indigo-400" />
                Crear Nuevo Usuario
              </h2>
              <p class="text-slate-500 dark:text-slate-400 text-xs font-medium mt-0.5">Registra cuentas institucionales y globales en la plataforma.</p>
            </div>
            <button @click="showCreateUserModal = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-2">✕</button>
          </div>

          <div class="p-8 overflow-y-auto space-y-4">
            <div v-if="createError" class="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-2xl text-xs font-bold text-red-600 dark:text-red-400">
              {{ createError }}
            </div>

            <div class="grid grid-cols-2 gap-4">
              <!-- Rol -->
              <div class="col-span-2 space-y-1.5">
                <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Rol de Usuario</label>
                <select v-model="newUser.rol" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white">
                  <option value="directivo">Directivo / Administrador de Colegio</option>
                  <option value="docente">Docente</option>
                  <option value="padre">Padre de Familia / Acudiente</option>
                  <option value="admin_general">Admin General (Superadmin)</option>
                </select>
                <p class="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-1.5 ml-1">
                  ⚠️ Los estudiantes se registran únicamente a través del proceso oficial de Matrícula Institucional.
                </p>
              </div>

              <!-- Institución Educativa -->
              <div v-if="newUser.rol !== 'admin_general'" class="col-span-2 space-y-1.5">
                <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Institución Educativa (Colegio)</label>
                <select v-model="newUser.id_colegio" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white">
                  <option value="">Selecciona un colegio</option>
                  <option v-for="school in schools" :key="school.id_colegio" :value="school.id_colegio">{{ school.nombre }}</option>
                </select>
              </div>



              <!-- Nombres -->
              <div class="space-y-1.5">
                <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Nombres</label>
                <input v-model="newUser.nombre" type="text" placeholder="Ej. Juan Carlos" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white" />
              </div>

              <!-- Apellidos -->
              <div class="space-y-1.5">
                <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Apellidos</label>
                <input v-model="newUser.apellido" type="text" placeholder="Ej. Pérez Gómez" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white" />
              </div>

              <!-- Email -->
              <div class="col-span-2 space-y-1.5">
                <div class="flex justify-between items-center">
                  <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Correo Electrónico</label>
                  <span v-if="newUser.rol === 'estudiante'" class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">(Opcional para Estudiantes)</span>
                </div>
                <input v-model="newUser.email" type="email" placeholder="ejemplo@academianeiva.edu.co" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white" />
              </div>

              <!-- Password -->
              <div class="col-span-2 space-y-1.5">
                <div class="flex justify-between items-center">
                  <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Contraseña de Acceso</label>
                  <button type="button" @click="generateRandomPassword" class="text-[11px] font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                    <RefreshCw :size="12" /> Generar Aleatoria
                  </button>
                </div>
                <input v-model="newUser.password" type="text" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-3.5 font-mono font-bold outline-none text-sm text-slate-900 dark:text-white" />
              </div>

              <!-- Tipo Doc -->
              <div class="space-y-1.5">
                <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Tipo de Documento</label>
                <select v-model="newUser.tipo_documento" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white">
                  <option value="CC">Cédula de Ciudadanía (CC)</option>
                  <option value="TI">Tarjeta de Identidad (TI)</option>
                  <option value="CE">Cédula de Extranjería (CE)</option>
                  <option value="PASAPORTE">Pasaporte</option>
                  <option value="PEP">PEP</option>
                </select>
              </div>

              <!-- Documento -->
              <div class="space-y-1.5">
                <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Número de Documento</label>
                <input v-model="newUser.documento" type="text" placeholder="Ej. 1075123456" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white" />
              </div>

              <!-- Telefono -->
              <div class="col-span-2 space-y-1.5">
                <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Teléfono de Contacto</label>
                <input v-model="newUser.telefono" type="text" placeholder="Ej. 3101234567" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white" />
              </div>
            </div>
          </div>

          <div class="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3 border-t border-slate-100 dark:border-slate-800">
            <button @click="showCreateUserModal = false" class="flex-1 px-4 py-3.5 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm">Cancelar</button>
            <button @click="submitCreateUser" :disabled="creatingUser" class="flex-[2] bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-6 py-3.5 rounded-2xl font-black shadow-lg shadow-indigo-500/20 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Loader2 v-if="creatingUser" class="animate-spin" :size="18" />
              <span>{{ creatingUser ? 'Registrando...' : 'Confirmar y Crear Usuario' }}</span>
            </button>
          </div>
        </div>
      </div>
      <!-- Soft-Delete Modal -->
      <div v-if="showDeleteModal && userToDelete" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" @click="showDeleteModal = false"></div>
        <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-red-100 dark:border-red-900/40 overflow-hidden">
          <div class="p-8 space-y-5">
            <!-- Header -->
            <div class="flex items-start gap-4">
              <div class="p-3 bg-red-50 dark:bg-red-950/30 rounded-2xl text-red-600 dark:text-red-400 flex-shrink-0">
                <Trash2 :size="24" />
              </div>
              <div>
                <h2 class="text-xl font-black text-slate-900 dark:text-white">Baja Definitiva de Usuario</h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Estás a punto de eliminar la cuenta de <strong class="text-slate-800 dark:text-white">{{ userToDelete.nombre }} {{ userToDelete.apellido || '' }}</strong>. Esta acción requiere consentimiento del Directivo del colegio.
                </p>
              </div>
            </div>

            <!-- Warnings -->
            <div class="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-4 space-y-2 text-sm text-red-700 dark:text-red-400">
              <p class="font-black">⚠️ Atención — efectos irreversibles:</p>
              <ul class="list-disc list-inside space-y-1 font-medium">
                <li>El usuario no podrá iniciar sesión.</li>
                <li>Si es Estudiante: su matrícula activa se cancelará automáticamente.</li>
                <li>La acción queda registrada en la auditoría de la sesión de supervisión activa.</li>
                <li>Se requiere <strong>sesión de supervisión activa</strong> para proceder.</li>
              </ul>
            </div>

            <!-- Ticket Code -->
            <div class="space-y-1.5">
              <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Código de Ticket del Directivo <span class="text-red-500">*</span></label>
              <input
                v-model="deleteTicketCode"
                type="text"
                placeholder="Ej. TKT-ABC123"
                class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-red-400/50 rounded-2xl p-3.5 font-mono font-bold outline-none text-sm text-slate-900 dark:text-white uppercase"
                @input="deleteTicketCode = deleteTicketCode.toUpperCase()"
              />
              <p class="text-[11px] text-slate-400 ml-1">El ticket debe haber sido creado por el Directivo del mismo colegio del usuario afectado.</p>
            </div>

            <!-- Motivo -->
            <div class="space-y-1.5">
              <label class="text-xs font-black text-slate-700 dark:text-slate-300 ml-1">Motivo de la baja <span class="text-slate-400">(opcional)</span></label>
              <textarea
                v-model="deleteMotivo"
                rows="2"
                placeholder="Ej. Retiro voluntario del sistema solicitado por el Directivo."
                class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-red-400/50 rounded-2xl p-3.5 font-medium outline-none text-sm text-slate-900 dark:text-white resize-none"
              />
            </div>

            <!-- Error -->
            <div v-if="deleteError" class="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-2xl p-4 text-sm font-medium">
              {{ deleteError }}
            </div>
          </div>

          <div class="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3 border-t border-slate-100 dark:border-slate-800">
            <button @click="showDeleteModal = false" class="flex-1 px-4 py-3.5 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm">Cancelar</button>
            <button
              @click="handleDelete"
              :disabled="deleting || !deleteTicketCode.trim()"
              class="flex-[2] bg-red-600 hover:bg-red-700 active:scale-95 text-white px-6 py-3.5 rounded-2xl font-black shadow-lg shadow-red-500/20 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Loader2 v-if="deleting" class="animate-spin" :size="18" />
              <Trash2 v-else :size="16" />
              <span>{{ deleting ? 'Eliminando...' : 'Confirmar Baja Definitiva' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
</style>
