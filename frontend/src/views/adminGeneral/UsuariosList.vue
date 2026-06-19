<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import { 
  Users, Search, UserCheck, ShieldAlert, Key, LogOut, Trash2, Eye, 
  Mail, School, Shield, Calendar, Lock, Clipboard, Check, Ban
} from 'lucide-vue-next'

const auth = useAuthStore()
const route = useRoute()

interface Usuario {
  id_usuario: number
  email: string
  nombre: string
  apellido: string
  rol_nombre: string
  colegio_nombre?: string
  id_colegio?: number
  estado: 'ACTIVO' | 'SUSPENDIDO' | 'BANEADO' | 'ELIMINADO'
  fecha_creacion: string
  motivo_baneo?: string
  fecha_baneo?: string
  baneado_por_nombre?: string
  baneado_por_email?: string
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
const resetting = ref(false)

const selectedUser = ref<Usuario | null>(null)
const banReason = ref('')
const tempPassword = ref('')
const copied = ref(false)

const fetchSchools = async () => {
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get('http://localhost:3000/api/admin/colegios', { headers })
    schools.value = res.data.map((c: any) => ({ id_colegio: c.id_colegio, nombre: c.nombre }))
  } catch (error) {
    console.error('Error fetching schools:', error)
  }
}

const fetchUsers = async () => {
  try {
    loading.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get('http://localhost:3000/api/admin/usuarios', {
      headers,
      params: {
        estado: selectedEstado.value || undefined,
        rol: selectedRole.value || undefined,
        id_colegio: selectedSchool.value || undefined,
        search: search.value || undefined
      }
    })
    users.value = res.data

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

watch([selectedRole, selectedEstado, selectedSchool, search], () => {
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
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.get(`http://localhost:3000/api/admin/usuarios/${user.id_usuario}`, { headers })
    selectedUser.value = { ...user, ...res.data }
  } catch (error) {
    console.error('Error fetching user details:', error)
  }
}

const updateStatus = async (user: Usuario, estado: string, motivo?: string) => {
  const confirmMsg = `¿Confirmas el cambio de estado de ${user.nombre} a ${estado}?`
  if (!confirm(confirmMsg)) return

  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.patch(`http://localhost:3000/api/admin/usuarios/${user.id_usuario}/estado`, {
      estado,
      motivo
    }, { headers })
    await fetchUsers()
    if (selectedUser.value?.id_usuario === user.id_usuario) {
      selectedUser.value.estado = estado as any
    }
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al cambiar estado')
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
    alert('Por favor indica un motivo para el baneo.')
    return
  }
  await updateStatus(selectedUser.value, 'BANEADO', banReason.value)
  showBanModal.value = false
}

const handleResetPassword = async (user: Usuario) => {
  if (!confirm(`¿Estás seguro de que deseas restablecer la contraseña de ${user.nombre} ${user.apellido || ''}? Se generará una contraseña temporal.`)) return

  try {
    resetting.value = true
    selectedUser.value = user
    tempPassword.value = ''
    showResetModal.value = true
    const headers = { Authorization: `Bearer ${auth.token}` }
    const res = await axios.post(`http://localhost:3000/api/admin/usuarios/${user.id_usuario}/restablecer-password`, {}, { headers })
    tempPassword.value = res.data.tempPassword
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al restablecer contraseña')
    showResetModal.value = false
  } finally {
    resetting.value = false
  }
}

const copyPassword = () => {
  navigator.clipboard.writeText(tempPassword.value)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}

const handleForceLogout = async (user: Usuario) => {
  if (!confirm(`¿Deseas forzar el cierre de todas las sesiones activas de ${user.nombre}?`)) return
  try {
    const headers = { Authorization: `Bearer ${auth.token}` }
    await axios.post(`http://localhost:3000/api/admin/usuarios/${user.id_usuario}/cerrar-sesion`, {}, { headers })
    alert('Sesiones cerradas con éxito.')
  } catch (error: any) {
    alert(error.response?.data?.error || 'Error al forzar cierre de sesión')
  }
}

const handleDelete = async (user: Usuario) => {
  if (confirm(`¿Estás seguro de que deseas eliminar la cuenta de ${user.nombre}? Se marcará como inactiva (soft-delete).`)) {
    try {
      const headers = { Authorization: `Bearer ${auth.token}` }
      await axios.delete(`http://localhost:3000/api/admin/usuarios/${user.id_usuario}`, { headers })
      await fetchUsers()
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar usuario')
    }
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
      </div>
    </div>

    <!-- KPIs Row -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div class="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
          <Users :size="22" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtrados</p>
          <h3 class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{{ stats.total }}</h3>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
          <UserCheck :size="22" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Activos</p>
          <h3 class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{{ stats.activos }}</h3>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div class="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl">
          <Ban :size="22" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Baneados</p>
          <h3 class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{{ stats.baneados }}</h3>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
        <div class="p-3 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-2xl">
          <ShieldAlert :size="22" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Suspendidos</p>
          <h3 class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{{ stats.suspendidos }}</h3>
        </div>
      </div>
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
      <div class="overflow-x-auto">
        <div v-if="loading" class="h-64 flex items-center justify-center text-slate-400">
          <span class="animate-pulse font-bold">Cargando cuentas...</span>
        </div>

        <div v-else-if="users.length === 0" class="p-12 text-center text-slate-400">
          <Users class="mx-auto mb-4 opacity-20" :size="48" />
          <p class="font-bold">No se encontraron usuarios con los filtros seleccionados</p>
        </div>

        <table v-else class="w-full text-left border-collapse">
          <thead>
            <tr class="text-xs font-black uppercase text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <th class="p-4">Usuario</th>
              <th class="p-4">Rol</th>
              <th class="p-4">Institución</th>
              <th class="p-4">Estado</th>
              <th class="p-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody class="text-sm font-medium text-slate-700 dark:text-slate-300 divide-y divide-slate-100 dark:divide-slate-800/50">
            <tr v-for="user in users" :key="user.id_usuario" class="hover:bg-slate-50/30 dark:hover:bg-slate-800/10 transition-colors">
              <td class="p-4">
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white">{{ user.nombre }} {{ user.apellido || '' }}</h4>
                  <p class="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5"><Mail :size="12" /> {{ user.email }}</p>
                </div>
              </td>
              <td class="p-4">
                <span class="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
                  {{ user.rol_nombre }}
                </span>
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
                    <button @click="handleDelete(user)" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all" title="Eliminar cuenta (Soft Delete)">
                      <Trash2 :size="16" />
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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

            <!-- Profile Info -->
            <div class="grid grid-cols-2 gap-4 text-sm font-semibold text-slate-600 dark:text-slate-400">
              <p class="flex items-center gap-2"><Mail :size="14" class="text-slate-400" /> <span class="font-medium text-slate-900 dark:text-white">{{ selectedUser.email }}</span></p>
              <p class="flex items-center gap-2"><Shield :size="14" class="text-slate-400" /> Rol: <span class="font-bold text-slate-900 dark:text-white">{{ selectedUser.rol_nombre }}</span></p>
              <p class="flex items-center gap-2"><School :size="14" class="text-slate-400" /> Colegio: <span class="font-medium text-slate-900 dark:text-white">{{ selectedUser.colegio_nombre || 'Global (Administración)' }}</span></p>
              <p class="flex items-center gap-2"><Calendar :size="14" class="text-slate-400" /> Creación: <span class="font-medium text-slate-900 dark:text-white">{{ new Date(selectedUser.fecha_creacion).toLocaleDateString() }}</span></p>
            </div>

            <!-- Ban / Suspension Logs -->
            <div v-if="selectedUser.estado === 'BANEADO' && selectedUser.motivo_baneo" class="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-4 rounded-2xl text-xs space-y-2">
              <h4 class="font-black text-red-600 dark:text-red-400 uppercase tracking-wider">Detalles del Baneo</h4>
              <p class="text-slate-600 dark:text-slate-400 font-bold">Baneado por: <span class="font-medium text-slate-900 dark:text-white">{{ selectedUser.baneado_por_email || 'Sistema' }}</span></p>
              <p v-if="selectedUser.fecha_baneo" class="text-slate-600 dark:text-slate-400 font-bold">Fecha: <span class="font-medium text-slate-900 dark:text-white">{{ new Date(selectedUser.fecha_baneo).toLocaleString() }}</span></p>
              <p class="text-slate-600 dark:text-slate-400 font-bold">Motivo: <span class="font-medium text-red-800 dark:text-red-300 block mt-1 bg-red-100/50 dark:bg-red-950/40 p-2 rounded-xl">{{ selectedUser.motivo_baneo }}</span></p>
            </div>

            <!-- Footer actions -->
            <div class="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
              <button @click="showDetailsModal = false" class="px-6 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-bold text-sm hover:translate-y-[-2px] transition-all">Cerrar</button>
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
    </Teleport>
  </div>
</template>

<style scoped>
</style>
