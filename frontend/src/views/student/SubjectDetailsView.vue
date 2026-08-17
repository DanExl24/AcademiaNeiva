<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { 
  ArrowLeft, 
  BookOpenCheck, 
  Calendar, 
  TrendingUp,
  Award,
  CheckCircle2,
  User
} from 'lucide-vue-next'
import { studentService } from '../../services/studentService'
import { useAuthStore } from '../../stores/auth'

import NoAcademicRecordsBanner from '../../components/NoAcademicRecordsBanner.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const loading = ref(true)
const subjectDetails = ref<any[]>([])
const subjectInfo = ref<any>(null)

const id_estudiante_param = route.params.id_estudiante
const id_materia = route.params.id_materia
const id_periodo = route.params.id_periodo

const fetchDetails = async () => {
  try {
    let finalStudentId = id_estudiante_param
    
    if (!finalStudentId) {
      const userId = auth.isMonitoring ? auth.monitoringUser?.id : auth.user?.id
      if (!userId) return
      const resEst = await studentService.getByUserId(userId)
      finalStudentId = resEst.id_estudiante
    }

    const data = await studentService.getGradeDetails(finalStudentId as string, id_periodo as string, id_materia as string)
    subjectDetails.value = data
    
    if (subjectDetails.value.length > 0) {
      subjectInfo.value = {
        nombre: subjectDetails.value[0].materia,
        docente: subjectDetails.value[0].docente
      }
    }
  } catch (err) {
    console.error("Error fetching subject details:", err)
  } finally {
    loading.value = false
  }
}


onMounted(fetchDetails)

const goBack = () => {
  router.back()
}

const getNotaColor = (nota: number) => {
  if (nota < 3.0) return 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/30'
  if (nota < 4.0) return 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/30'
  return 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30'
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
    
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div class="flex items-center gap-4">
        <button 
          @click="goBack"
          class="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-95"
        >
          <ArrowLeft :size="24" />
        </button>
        <div v-if="subjectInfo">
          <h1 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            {{ subjectInfo.nombre }}
          </h1>
          <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-2">
            <User :size="16" class="text-indigo-500" />
            {{ subjectInfo.docente }}
          </p>
        </div>
        <div v-else>
          <h1 class="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            Detalle de Calificaciones
          </h1>
          <p class="text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-2">
            <BookOpenCheck :size="16" class="text-indigo-500" />
            Cargando información de la materia...
          </p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
      <div class="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
      <p class="mt-4 text-slate-500 dark:text-slate-400 font-medium italic">Obteniendo detalles de la materia...</p>
    </div>

    <!-- Empty State -->
    <NoAcademicRecordsBanner v-else-if="subjectDetails.length === 0" />

    <template v-else>
      <!-- Activity List -->
      <div class="grid grid-cols-1 gap-6">
        <div v-for="(act, idx) in subjectDetails" :key="idx" 
             class="group bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all duration-500 relative overflow-hidden">
          
          <div class="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <CheckCircle2 :size="120" class="text-indigo-600" />
          </div>

          <div class="flex flex-col md:flex-row md:items-start justify-between gap-8 relative z-10">
            <div class="flex-1 space-y-4">
              <div class="flex items-center gap-3 flex-wrap">
                <span class="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[11px] font-black uppercase tracking-widest rounded-full border border-indigo-100 dark:border-indigo-900/50">
                  {{ act.porcentaje }}% de la materia
                </span>
                <span class="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-xs font-bold">
                  <Calendar :size="14" />
                  Actividad de Periodo
                </span>
                <!-- Docente creador (si es diferente al actual) -->
                <span
                  v-if="act.docente_creador && act.docente_creador !== act.docente"
                  class="flex items-center gap-1.5 text-violet-500 dark:text-violet-400 text-xs font-bold"
                >
                  <User :size="13" />
                  Creado por: {{ act.docente_creador }}
                </span>
              </div>

              <h2 class="text-2xl font-black text-slate-800 dark:text-white capitalize">
                {{ act.actividad }}
              </h2>

              <!-- Criterios individuales con nota por criterio -->
              <div v-if="act.criterios && act.criterios.length > 0" class="space-y-3">
                <p class="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Criterios de Evaluación</p>
                <div
                  v-for="criterio in act.criterios"
                  :key="criterio.id_criterio"
                  class="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800/50"
                >
                  <div class="flex-1 min-w-0 mr-4">
                    <p class="text-slate-600 dark:text-slate-300 font-medium leading-snug">{{ criterio.descripcion }}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5 font-semibold">Peso: {{ criterio.porcentaje }}%</p>
                  </div>
                  <div
                    class="h-12 w-12 rounded-xl flex flex-col items-center justify-center border-2 shrink-0 text-sm font-black transition-all"
                    :class="criterio.nota_criterio != null ? getNotaColor(criterio.nota_criterio) : 'text-slate-400 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700'"
                  >
                    {{ criterio.nota_criterio != null ? criterio.nota_criterio : '—' }}
                  </div>
                </div>
              </div>

              <!-- Criterio único (actividades sin criterios múltiples) -->
              <div v-else class="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                <p class="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3 block">Criterio de Evaluación</p>
                <p class="text-slate-600 dark:text-slate-300 leading-relaxed font-medium italic">
                  "{{ act.criterio || 'No se ha registrado una descripción detallada para este criterio.' }}"
                </p>
              </div>
            </div>

            <!-- Nota final de la actividad -->
            <div class="flex md:flex-col items-center justify-between md:justify-center gap-4 min-w-[140px]">
               <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 md:hidden">Calificación</p>
               <div 
                class="h-24 w-24 rounded-[2rem] flex flex-col items-center justify-center border-2 transition-all duration-500 group-hover:scale-110 shadow-lg"
                :class="act.nota != null ? getNotaColor(act.nota) : 'text-slate-300 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-600'"
               >
                 <span class="text-4xl font-black">{{ act.nota != null ? act.nota : '---' }}</span>
                 <span class="text-[9px] font-black uppercase opacity-60 mt-1">Puntos</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <!-- General Info Alert -->
      <div class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 p-8 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-900/50 flex flex-col md:flex-row items-center gap-6">
        <div class="h-16 w-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
          <Award :size="32" class="text-indigo-600" />
        </div>
        <div class="text-center md:text-left">
          <h4 class="text-lg font-black uppercase tracking-tight mb-1">Sobre tus calificaciones</h4>
          <p class="font-medium opacity-80 leading-relaxed">
            Cada actividad tiene un peso en la nota final. Cuando una actividad tiene criterios, tu nota refleja el promedio ponderado de cada uno. Consulta con tu docente si tienes dudas.
          </p>
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <div v-if="!loading && subjectDetails.length === 0" class="flex flex-col items-center justify-center py-32 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800">
      <div class="bg-slate-50 dark:bg-slate-800 p-8 rounded-full mb-8">
        <TrendingUp :size="64" class="text-slate-300 dark:text-slate-600" />
      </div>
      <h3 class="text-2xl font-black text-slate-800 dark:text-white">Sin detalles registrados</h3>
      <p class="text-slate-500 dark:text-slate-400 mt-3 max-w-sm text-center px-6 leading-relaxed font-bold italic">
        Aún no se han cargado las actividades detalladas para esta materia en este periodo.
      </p>
      <button @click="goBack" class="mt-8 bg-slate-800 text-white px-8 py-3 rounded-2xl font-black hover:bg-slate-900 transition-all active:scale-95 shadow-lg">
        Regresar al Panel
      </button>
    </div>

  </div>
</template>

<style scoped>
.animate-in {
  animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
