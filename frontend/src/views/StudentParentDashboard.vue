<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  MessageSquare, 
  FileText, 
  User, 
  LogOut, 
  Download,
  Mail,
  Lock,
  ArrowLeftRight,
  TrendingUp,
  AlertCircle
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import axios from 'axios'

const auth = useAuthStore()
const router = useRouter()

const activeTab = ref('notas')
const students = ref<any[]>([])
const selectedStudentId = ref<string | null>(auth.user?.studentId || null)
const academicData = ref<any>({
  grades: [],
  attendance: [],
  observations: [],
  periods: []
})
const selectedPeriodId = ref<number | null>(null)
const isLoading = ref(false)

const isParent = computed(() => auth.user?.roles.includes('padre_familia'))
const isTeacher = computed(() => auth.user?.roles.includes('docente'))

const fetchStudents = async () => {
  if (!isParent.value || !auth.user?.padreId) return
  try {
    const res = await axios.get(`http://localhost:3000/api/academic/parent/${auth.user.padreId}/students`)
    students.value = res.data || []
    if (students.value.length > 0 && !selectedStudentId.value) {
      selectedStudentId.value = students.value[0].id_estudiante
    }
  } catch (error) {
    console.error('Error fetching students:', error)
  }
}

const fetchPeriods = async () => {
  try {
    const res = await axios.get(`http://localhost:3000/api/academic/periods/${auth.user?.schoolId}`)
    academicData.value.periods = res.data || []
    const active = academicData.value.periods.find((p: any) => p.estado === 'ABIERTO')
    if (active) selectedPeriodId.value = active.id_periodo
    else if (academicData.value.periods.length > 0) selectedPeriodId.value = academicData.value.periods[0].id_periodo
  } catch (error) {
    console.error('Error fetching periods:', error)
  }
}

const fetchData = async () => {
  if (!selectedStudentId.value || !selectedPeriodId.value) return
  isLoading.value = true
  try {
    const [grades, attendance, observations] = await Promise.all([
      axios.get(`http://localhost:3000/api/academic/student/${selectedStudentId.value}/grades?periodId=${selectedPeriodId.value}`),
      axios.get(`http://localhost:3000/api/academic/student/${selectedStudentId.value}/attendance?periodId=${selectedPeriodId.value}`),
      axios.get(`http://localhost:3000/api/academic/student/${selectedStudentId.value}/observations?periodId=${selectedPeriodId.value}`)
    ])
    academicData.value.grades = grades.data || []
    academicData.value.attendance = attendance.data || []
    academicData.value.observations = observations.data || []
  } catch (error) {
    console.error('Error fetching academic data:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchStudents(), fetchPeriods()])
  await fetchData()
})

watch([selectedStudentId, selectedPeriodId], fetchData)

const handleLogout = () => {
  auth.logout()
  router.push('/login')
}

const updateEmailData = ref({
  newEmail: auth.user?.email || '',
  password: ''
})

const handleUpdateEmail = async () => {
  try {
    await axios.post('http://localhost:3000/api/academic/update-email', {
      userId: auth.user?.id,
      newEmail: updateEmailData.value.newEmail,
      password: updateEmailData.value.password
    })
    alert('Correo actualizado correctamente')
    updateEmailData.value.password = ''
  } catch (error: any) {
    alert(error.response?.data?.message || 'Error al actualizar correo')
  }
}


const getAverage = computed(() => {
  if (academicData.value.grades.length === 0) return 0
  const sum = academicData.value.grades.reduce((acc: number, curr: any) => acc + parseFloat(curr.nota), 0)
  return (sum / academicData.value.grades.length).toFixed(2)
})

</script>

<template>
  <div class="min-h-screen bg-[#f8fafc] flex">
    <!-- Sidebar -->
    <aside class="w-72 bg-white border-r border-gray-100 flex flex-col hidden lg:flex shadow-sm">
      <div class="p-8">
        <div class="flex items-center gap-3 mb-10">
          <div class="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <GraduationCap :size="24" />
          </div>
          <span class="font-bold text-xl text-gray-900 tracking-tight">Academia Neiva</span>
        </div>

        <nav class="space-y-2">
          <button 
            v-for="item in [
              { id: 'notas', icon: BookOpen, label: 'Notas' },
              { id: 'asistencia', icon: Calendar, label: 'Asistencia' },
              { id: 'observaciones', icon: MessageSquare, label: 'Observaciones' },
              { id: 'boletines', icon: FileText, label: 'Boletines' },
              { id: 'perfil', icon: User, label: 'Mi Perfil' }
            ]"
            :key="item.id"
            @click="activeTab = item.id"
            :class="[
              'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group',
              activeTab === item.id 
                ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            ]"
          >
            <component :is="item.icon" :size="20" :class="activeTab === item.id ? 'text-indigo-600' : 'group-hover:text-gray-900'" />
            <span class="font-semibold">{{ item.label }}</span>
          </button>
        </nav>
      </div>

      <div class="mt-auto p-8 border-t border-gray-50">
        <div v-if="isTeacher" class="mb-6">
          <button 
            @click="router.push('/dashboard')"
            class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-colors border border-emerald-100"
          >
            <ArrowLeftRight :size="18" />
            Vista Docente
          </button>
        </div>
        <button 
          @click="handleLogout"
          class="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all font-semibold"
        >
          <LogOut :size="20" />
          Cerrar Sesión
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto">
      <!-- Header -->
      <header class="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10 px-8 py-6">
        <div class="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 class="text-2xl font-extrabold text-gray-900 tracking-tight">
              Hola, {{ auth.user?.email.split('@')[0] }}
            </h1>
            <p class="text-gray-500 text-sm font-medium mt-1">
              {{ auth.user?.schoolName }} • {{ isParent ? 'Padre de Familia' : 'Estudiante' }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-4">
            <!-- Student Selector (only for parents) -->
            <div v-if="isParent" class="relative group">
              <select 
                v-model="selectedStudentId"
                class="appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all"
              >
                <option v-for="s in students" :key="s.id_estudiante" :value="s.id_estudiante">
                  {{ s.nombre }} {{ s.apellido }}
                </option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <User :size="16" />
              </div>
            </div>

            <!-- Period Selector -->
            <div class="relative">
              <select 
                v-model="selectedPeriodId"
                class="appearance-none bg-white border border-gray-200 text-gray-700 py-2.5 pl-4 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all shadow-sm"
              >
                <option v-for="p in academicData.periods" :key="p.id_periodo" :value="p.id_periodo">
                  {{ p.nombre }}
                </option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                <Calendar :size="16" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div class="p-8 max-w-6xl mx-auto">
        <!-- Stats Overview -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-center gap-4">
              <div class="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <TrendingUp :size="24" />
              </div>
              <div>
                <p class="text-sm font-bold text-gray-400 uppercase tracking-wider">Promedio Actual</p>
                <p class="text-3xl font-black text-gray-900">{{ getAverage }}</p>
              </div>
            </div>
          </div>
          <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div class="flex items-center gap-4">
              <div class="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Calendar :size="24" />
              </div>
              <div>
                <p class="text-sm font-bold text-gray-400 uppercase tracking-wider">Asistencias</p>
                <p class="text-3xl font-black text-gray-900">{{ academicData.attendance.length }}</p>
              </div>
            </div>
          </div>
          <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div class="flex items-center gap-4">
              <div class="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <MessageSquare :size="24" />
              </div>
              <div>
                <p class="text-sm font-bold text-gray-400 uppercase tracking-wider">Observaciones</p>
                <p class="text-3xl font-black text-gray-900">{{ academicData.observations.length }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Content Area -->
        <div class="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden min-h-[500px]">
          
          <!-- Loading State -->
          <div v-if="isLoading" class="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
            <div class="h-12 w-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-gray-500 font-medium animate-pulse">Cargando información académica...</p>
          </div>

          <!-- Tabs Content -->
          <div v-else class="p-8">
            <!-- NOTAS -->
            <div v-if="activeTab === 'notas'" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div class="flex items-center justify-between mb-2">
                <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen class="text-indigo-600" />
                  Calificaciones del Periodo
                </h2>
              </div>
              
              <div v-if="academicData.grades.length === 0" class="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <BookOpen :size="48" class="text-gray-300 mb-4" />
                <p class="text-gray-500 font-bold">No hay calificaciones registradas para este periodo.</p>
              </div>

              <div v-else class="overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="text-left border-b border-gray-100">
                      <th class="pb-4 font-bold text-gray-400 uppercase text-xs tracking-widest">Materia</th>
                      <th class="pb-4 font-bold text-gray-400 uppercase text-xs tracking-widest">Actividad</th>
                      <th class="pb-4 font-bold text-gray-400 uppercase text-xs tracking-widest text-center">Nota</th>
                      <th class="pb-4 font-bold text-gray-400 uppercase text-xs tracking-widest text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50">
                    <tr v-for="g in academicData.grades" :key="g.id_notaactividad" class="hover:bg-gray-50/50 transition-colors group">
                      <td class="py-5">
                        <span class="font-bold text-gray-900">{{ g.materia_nombre }}</span>
                      </td>
                      <td class="py-5">
                        <span class="text-gray-600 font-medium">{{ g.actividad }}</span>
                      </td>
                      <td class="py-5 text-center">
                        <span :class="[
                          'inline-flex items-center justify-center h-10 w-10 rounded-xl font-black text-lg',
                          parseFloat(g.nota) >= 3 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                        ]">
                          {{ g.nota }}
                        </span>
                      </td>
                      <td class="py-5 text-right">
                        <span :class="[
                          'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
                          parseFloat(g.nota) >= 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        ]">
                          {{ parseFloat(g.nota) >= 3 ? 'Aprobado' : 'Reprobado' }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- ASISTENCIA -->
            <div v-if="activeTab === 'asistencia'" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar class="text-indigo-600" />
                Historial de Asistencia
              </h2>
              
              <div v-if="academicData.attendance.length === 0" class="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <Calendar :size="48" class="text-gray-300 mb-4" />
                <p class="text-gray-500 font-bold">No hay registros de asistencia.</p>
              </div>

              <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div v-for="a in academicData.attendance" :key="a.id_registroasistencia" class="p-5 rounded-2xl border border-gray-100 flex items-center justify-between hover:border-indigo-200 transition-all bg-white shadow-sm">
                  <div class="flex items-center gap-4">
                    <div :class="[
                      'h-12 w-12 rounded-xl flex items-center justify-center',
                      a.estado === 'PRESENTE' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    ]">
                      <AlertCircle v-if="a.estado !== 'PRESENTE'" :size="20" />
                      <span v-else class="font-bold">P</span>
                    </div>
                    <div>
                      <p class="font-bold text-gray-900">{{ a.materia_nombre }}</p>
                      <p class="text-sm text-gray-500">{{ new Date(a.fecha).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }}</p>
                    </div>
                  </div>
                  <span :class="[
                    'px-3 py-1 rounded-full text-xs font-bold uppercase',
                    a.estado === 'PRESENTE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  ]">
                    {{ a.estado }}
                  </span>
                </div>
              </div>
            </div>

            <!-- OBSERVACIONES -->
            <div v-if="activeTab === 'observaciones'" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare class="text-indigo-600" />
                Observaciones del Docente
              </h2>

              <div v-if="academicData.observations.length === 0" class="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <MessageSquare :size="48" class="text-gray-300 mb-4" />
                <p class="text-gray-500 font-bold">No hay observaciones registradas.</p>
              </div>

              <div v-else class="space-y-6">
                <div v-for="o in academicData.observations" :key="o.id_observacion" class="bg-gray-50 rounded-3xl p-8 border border-gray-100 relative">
                  <div class="absolute -top-3 left-8 px-4 py-1 bg-indigo-600 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-lg">
                    {{ o.materia_nombre }}
                  </div>
                  <div class="grid md:grid-cols-2 gap-8 mt-4">
                    <div>
                      <h4 class="text-emerald-700 font-bold mb-3 flex items-center gap-2">
                        <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                        Fortalezas
                      </h4>
                      <p class="text-gray-700 leading-relaxed bg-white p-4 rounded-2xl border border-emerald-50 shadow-sm">{{ o.fortalezas || 'No registradas' }}</p>
                    </div>
                    <div>
                      <h4 class="text-amber-700 font-bold mb-3 flex items-center gap-2">
                        <span class="h-2 w-2 rounded-full bg-amber-500"></span>
                        Recomendaciones
                      </h4>
                      <p class="text-gray-700 leading-relaxed bg-white p-4 rounded-2xl border border-amber-50 shadow-sm">{{ o.recomendaciones || 'No registradas' }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- BOLETINES -->
            <div v-if="activeTab === 'boletines'" class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText class="text-indigo-600" />
                Descarga de Boletines
              </h2>
              
              <div class="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-start gap-4">
                <AlertCircle class="text-indigo-600 shrink-0" />
                <div>
                  <p class="text-indigo-900 font-bold mb-1">Información importante</p>
                  <p class="text-indigo-700 text-sm leading-relaxed">
                    Los boletines oficiales solo pueden descargarse una vez que el periodo académico ha sido cerrado por la institución. 
                    Si el botón de descarga no aparece, el periodo aún está en proceso de validación.
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                <div v-for="p in academicData.periods" :key="p.id_periodo" class="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-lg transition-all group">
                  <div class="flex items-center justify-between mb-4">
                    <div class="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <FileText :size="24" />
                    </div>
                    <span :class="[
                      'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest',
                      p.estado === 'CERRADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    ]">
                      {{ p.estado }}
                    </span>
                  </div>
                  <h3 class="font-extrabold text-gray-900 mb-2">{{ p.nombre }}</h3>
                  <p class="text-gray-500 text-xs mb-6 font-medium">Formato: PDF • Tamaño: ~1.2 MB</p>
                  <button 
                    :disabled="p.estado !== 'CERRADO'"
                    class="w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    :class="p.estado === 'CERRADO' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95' : 'bg-gray-100 text-gray-400'"
                  >
                    <Download :size="18" />
                    Descargar
                  </button>
                </div>
              </div>
            </div>

            <!-- MI PERFIL -->
            <div v-if="activeTab === 'perfil'" class="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 class="text-xl font-bold text-gray-900 mb-8 flex items-center gap-2">
                <User class="text-indigo-600" />
                Configuración del Perfil
              </h2>

              <form @submit.prevent="handleUpdateEmail" class="space-y-6">
                <div class="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm space-y-6">
                  <div class="space-y-2">
                    <label class="text-sm font-bold text-gray-700 ml-1">Nuevo Correo Electrónico</label>
                    <div class="relative">
                      <input 
                        v-model="updateEmailData.newEmail"
                        type="email" 
                        required
                        class="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                      >
                      <Mail class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" :size="20" />
                    </div>
                  </div>

                  <div class="space-y-2">
                    <label class="text-sm font-bold text-gray-700 ml-1">Confirmar con Contraseña</label>
                    <div class="relative">
                      <input 
                        v-model="updateEmailData.password"
                        type="password" 
                        required
                        placeholder="••••••••"
                        class="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                      >
                      <Lock class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" :size="20" />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    Actualizar Datos de Acceso
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.animate-in {
  animation-duration: 0.5s;
}

select {
  background-image: none;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
</style>
