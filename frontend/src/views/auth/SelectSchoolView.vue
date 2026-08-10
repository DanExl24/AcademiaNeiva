<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { GraduationCap, Building2, ArrowRight, CheckCircle2, ShieldCheck, LogOut } from 'lucide-vue-next'
import axios from 'axios'

interface UserSchool {
  id_colegio: number
  colegio_nombre: string
  rol_nombre?: string
  dane?: string
  escudo_url?: string
}

const auth = useAuthStore()
const router = useRouter()

const schools = ref<UserSchool[]>([])
const loading = ref(true)
const selectingSchoolId = ref<number | null>(null)

const fetchSchools = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/traslados/mis-vinculaciones')
    const activeVinculaciones = (res.data || []).filter((v: any) => v.estado === 'ACTIVO')
    
    const uniqueMap = new Map<number, UserSchool>()
    activeVinculaciones.forEach((v: any) => {
      if (!uniqueMap.has(v.id_colegio)) {
        uniqueMap.set(v.id_colegio, {
          id_colegio: v.id_colegio,
          colegio_nombre: v.colegio_nombre,
          rol_nombre: v.rol_nombre || auth.activeRole || 'Docente',
          dane: v.dane,
          escudo_url: v.escudo_url
        })
      }
    })

    schools.value = Array.from(uniqueMap.values())
    
    // Si solo tiene 1 colegio, auto-seleccionar y redirigir
    if (schools.value.length === 1) {
      selectSchool(schools.value[0].id_colegio)
    }
  } catch (error) {
    console.error('Error fetching user schools:', error)
  } finally {
    loading.value = false
  }
}

const selectSchool = (schoolId: number) => {
  selectingSchoolId.value = schoolId
  auth.setSelectedSchoolId(schoolId)
  
  setTimeout(() => {
    router.push('/dashboard')
  }, 200)
}

const handleLogout = () => {
  auth.logout()
  router.push('/login')
}

onMounted(() => {
  if (!auth.isAuthenticated) {
    router.push('/login')
    return
  }
  fetchSchools()
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
    <!-- Fondo decorativo -->
    <div class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-950/50 via-slate-900 to-slate-950 -z-10"></div>
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-[80px] -z-10 animate-pulse"></div>
    <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full filter blur-[80px] -z-10 animate-pulse"></div>

    <div class="max-w-2xl w-full space-y-8 bg-slate-950/60 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl shadow-2xl border border-slate-800/80">
      
      <!-- Encabezado -->
      <div class="text-center">
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white mx-auto shadow-xl shadow-indigo-500/20 mb-5 border border-indigo-400/20">
          <GraduationCap :size="36" />
        </div>
        
        <h2 class="text-3xl font-extrabold text-white tracking-tight">
          ¡Hola, {{ auth.user?.name || 'Docente' }}!
        </h2>
        <p class="mt-2 text-sm text-slate-400 max-w-md mx-auto">
          Selecciona la institución educativa en la que deseas trabajar en esta sesión.
        </p>
      </div>

      <!-- Estado de carga -->
      <div v-if="loading" class="py-12 flex flex-col items-center justify-center space-y-4">
        <div class="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 font-medium">Cargando tus instituciones asociadas...</p>
      </div>

      <!-- Lista de Colegios -->
      <div v-else class="space-y-4">
        <div 
          v-for="school in schools" 
          :key="school.id_colegio"
          @click="selectSchool(school.id_colegio)"
          :class="[
            'group relative p-6 rounded-2xl border transition-all cursor-pointer flex items-center justify-between',
            auth.selectedSchoolId === school.id_colegio 
              ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10' 
              : 'bg-slate-900/60 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/90'
          ]"
        >
          <div class="flex items-center space-x-4">
            <div class="h-14 w-14 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform overflow-hidden p-2">
              <img v-if="school.escudo_url" :src="school.escudo_url" alt="Escudo" class="h-full w-full object-contain" />
              <Building2 v-else :size="28" />
            </div>

            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                  {{ school.colegio_nombre }}
                </h3>
                <span v-if="auth.selectedSchoolId === school.id_colegio" class="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                  <CheckCircle2 :size="12" /> Actual
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span class="capitalize bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-medium">
                  {{ school.rol_nombre || 'Docente' }}
                </span>
                <span v-if="school.dane" class="text-slate-500">DANE: {{ school.dane }}</span>
              </p>
            </div>
          </div>

          <div class="flex items-center text-slate-400 group-hover:text-indigo-400 transition-colors">
            <span class="text-xs font-semibold mr-2 hidden sm:inline">Ingresar</span>
            <ArrowRight :size="20" class="transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div v-if="schools.length === 0" class="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800">
          <ShieldCheck :size="40" class="mx-auto text-slate-600 mb-3" />
          <p class="text-sm font-semibold text-slate-300">No se encontraron vinculaciones activas</p>
          <p class="text-xs text-slate-500 mt-1">Contacta al directivo o administrador institucional para verificar tu asignación.</p>
        </div>
      </div>

      <!-- Pie de página y Logout -->
      <div class="pt-4 border-t border-slate-800/80 flex items-center justify-between">
        <button 
          @click="handleLogout"
          class="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-red-400 transition-colors py-2 px-3 rounded-lg hover:bg-red-500/10"
        >
          <LogOut :size="15" />
          Cerrar sesión
        </button>

        <p class="text-[11px] text-slate-500">
          AcademiaNeiva &bull; Selección de Entorno
        </p>
      </div>

    </div>
  </div>
</template>
