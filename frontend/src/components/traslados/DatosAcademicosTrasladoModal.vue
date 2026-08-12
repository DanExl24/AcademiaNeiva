<script setup lang="ts">
import { ref, watch } from 'vue'
import axios from 'axios'
import html2pdf from 'html2pdf.js'
import { API_BASE_URL } from '../../config/api'
import { useAuthStore } from '../../stores/auth'
import {
  Download,
  FileSpreadsheet,
  X,
  AlertCircle,
  BookOpen
} from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  targetId: number | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const auth = useAuthStore()
const loading = ref(false)
const exportingPDF = ref(false)
const exportingExcel = ref(false)
const errorMsg = ref('')
const reportData = ref<any>(null)
const printableRef = ref<HTMLElement | null>(null)

const fetchDatosAcademicos = async () => {
  if (!props.targetId) return
  loading.value = true
  errorMsg.value = ''
  reportData.value = null
  try {
    const res = await axios.get(`${API_BASE_URL}/api/traslados/datos-academicos/${props.targetId}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    reportData.value = res.data
  } catch (err: any) {
    console.error('Error cargando datos académicos de traslado:', err)
    errorMsg.value = err.response?.data?.error || 'No se pudieron cargar los datos académicos del traslado.'
  } finally {
    loading.value = false
  }
}

watch(() => props.show, (newVal) => {
  if (newVal && props.targetId) {
    fetchDatosAcademicos()
  }
})

const exportToPDF = async () => {
  if (!printableRef.value || exportingPDF.value) return
  exportingPDF.value = true
  try {
    const studentName = reportData.value?.estudiante?.nombre || 'estudiante'
    const fileName = `Datos_Academicos_Traslado_${studentName.replace(/\s+/g, '_')}.pdf`
    
    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4] as [number, number, number, number],
      filename:     fileName,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' as const },
      pagebreak:    { mode: ['css', 'legacy'] }
    }
    
    await html2pdf().set(opt).from(printableRef.value).save()
  } catch (err) {
    console.error('Error exportando PDF:', err)
  } finally {
    exportingPDF.value = false
  }
}

const exportToExcel = () => {
  if (!reportData.value || exportingExcel.value) return
  exportingExcel.value = true
  try {
    const est = reportData.value.estudiante
    const materias = reportData.value.materias || []
    const asistencia = reportData.value.asistencia || {}
    const observaciones = reportData.value.observaciones || []

    let csvContent = `\uFEFF` // UTF-8 BOM
    csvContent += `INFORME DE DATOS ACADÉMICOS DE TRASLADO INTERINSTITUCIONAL\n`
    csvContent += `Estudiante;${est.nombre}\n`
    csvContent += `Documento;${est.documento}\n`
    csvContent += `Código;${est.codigo}\n`
    csvContent += `Colegio Origen;${est.colegio_origen}\n`
    csvContent += `Colegio Destino;${est.colegio_destino}\n`
    csvContent += `Fecha de Traslado;${new Date(est.fecha_traslado).toLocaleDateString()}\n`
    csvContent += `Motivo;${est.motivo || 'N/A'}\n\n`

    csvContent += `RESUMEN DE ASISTENCIA\n`
    csvContent += `Total Clases;Asistencias;Inasistencias;Excusas;Porcentaje Asistencia\n`
    csvContent += `${asistencia.total};${asistencia.asistencias};${asistencia.inasistencias};${asistencia.excusas};${asistencia.porcentaje_asistencia}%\n\n`

    csvContent += `REGISTRO DE NOTAS POR MATERIA Y PERIODO\n`
    csvContent += `Materia;Docente;Periodo;Actividad;Porcentaje (%);Nota;Promedio Periodo;Desempeño\n`

    for (const mat of materias) {
      if (!mat.periodos || mat.periodos.length === 0) {
        csvContent += `"${mat.materia_nombre}";"${mat.docente_nombre}";"Sin Registros";"N/A";0;0;${mat.promedio_general};"N/A"\n`
      } else {
        for (const p of mat.periodos) {
          for (const act of p.actividades) {
            csvContent += `"${mat.materia_nombre}";"${mat.docente_nombre}";"${p.periodo_nombre}";"${act.actividad}";${act.porcentaje}%;${act.nota};${p.promedio};"${p.desempeno}"\n`
          }
        }
      }
    }

    csvContent += `\nOBSERVACIONES DE CONVIVENCIA\n`
    csvContent += `Fecha;Tipo;Docente;Observación\n`
    for (const obs of observaciones) {
      csvContent += `"${new Date(obs.fecha).toLocaleDateString()}";"${obs.tipo_observacion}";"${obs.docente_nombre}";"${obs.observacion.replace(/"/g, '""')}"\n`
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const fileName = `Datos_Academicos_Traslado_${est.nombre.replace(/\s+/g, '_')}.csv`
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('Error exportando Excel:', err)
  } finally {
    exportingExcel.value = false
  }
}

const getBadgeDesempeno = (desempeno: string) => {
  switch (desempeno) {
    case 'Superior': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'Alto':     return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
    case 'Básico':   return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
    default:         return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
            <BookOpen :size="22" />
          </div>
          <div>
            <h3 class="text-base font-black text-slate-800 dark:text-white">Datos Académicos de Traslados</h3>
            <p class="text-xs text-slate-400 font-medium">Histórico del estudiante previo/durante el traslado interinstitucional</p>
          </div>
        </div>
        
        <button 
          @click="emit('close')"
          class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X :size="20" />
        </button>
      </div>

      <!-- Modal Body (Content) -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        
        <!-- Loading State -->
        <div v-if="loading" class="py-16 text-center">
          <div class="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando expediente académico...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="errorMsg" class="p-6 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-center">
          <AlertCircle :size="36" class="text-rose-500 mx-auto mb-2" />
          <p class="text-sm font-bold text-rose-700 dark:text-rose-400">{{ errorMsg }}</p>
        </div>

        <!-- Report Printable Area -->
        <div v-else-if="reportData" ref="printableRef" class="bg-white dark:bg-slate-900 p-6 space-y-6 rounded-2xl">
          
          <!-- Student Header Banner -->
          <div class="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-indigo-800/40 relative overflow-hidden">
            <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span class="inline-block bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
                  Registro de Traslado Interinstitucional
                </span>
                <h2 class="text-2xl font-black tracking-tight">{{ reportData.estudiante?.nombre }}</h2>
                <div class="flex flex-wrap items-center gap-4 text-xs text-indigo-200 mt-2">
                  <span><strong>Doc:</strong> {{ reportData.estudiante?.documento }}</span>
                  <span>•</span>
                  <span><strong>Código:</strong> {{ reportData.estudiante?.codigo }}</span>
                  <span>•</span>
                  <span><strong>Fecha:</strong> {{ new Date(reportData.estudiante?.fecha_traslado).toLocaleDateString() }}</span>
                </div>
              </div>
              
              <div class="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 text-xs space-y-1">
                <p><strong>Origen:</strong> <span class="text-indigo-200">{{ reportData.estudiante?.colegio_origen }}</span></p>
                <p><strong>Destino:</strong> <span class="text-emerald-300 font-bold">{{ reportData.estudiante?.colegio_destino }}</span></p>
              </div>
            </div>
          </div>

          <!-- Resumen de Asistencia -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asistencia Total</p>
              <p class="text-2xl font-black text-slate-800 dark:text-white font-mono mt-1">{{ reportData.asistencia?.porcentaje_asistencia }}%</p>
            </div>
            <div class="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 text-center">
              <p class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Asistencias</p>
              <p class="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-1">{{ reportData.asistencia?.asistencias }}</p>
            </div>
            <div class="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30 text-center">
              <p class="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Inasistencias</p>
              <p class="text-2xl font-black text-rose-700 dark:text-rose-300 font-mono mt-1">{{ reportData.asistencia?.inasistencias }}</p>
            </div>
            <div class="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-center">
              <p class="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Excusas</p>
              <p class="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono mt-1">{{ reportData.asistencia?.excusas }}</p>
            </div>
          </div>

          <!-- Materias y Calificaciones -->
          <div class="space-y-4">
            <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <BookOpen :size="16" class="text-indigo-600" />
              Histórico de Calificaciones por Materia
            </h4>

            <div v-if="reportData.materias?.length === 0" class="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-center text-xs text-slate-400 italic">
              No hay calificaciones registradas antes del traslado.
            </div>

            <div v-for="mat in reportData.materias" :key="mat.materia_nombre" class="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
              <div class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
                <div>
                  <h5 class="text-sm font-black text-slate-800 dark:text-white">{{ mat.materia_nombre }}</h5>
                  <p class="text-[10px] font-bold text-slate-400">Docente: {{ mat.docente_nombre }}</p>
                </div>
                <div class="text-right">
                  <span class="text-xs font-black text-slate-500 uppercase mr-2">Promedio acumulado:</span>
                  <span class="text-base font-black font-mono text-indigo-600 dark:text-indigo-400">{{ mat.promedio_general.toFixed(2) }}</span>
                </div>
              </div>

              <!-- Tabla de periodos -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div v-for="p in mat.periodos" :key="p.periodo_nombre" class="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300">{{ p.periodo_nombre }}</span>
                    <span :class="['px-2 py-0.5 rounded-md text-[10px] font-black border', getBadgeDesempeno(p.desempeno)]">
                      {{ p.promedio.toFixed(2) }} ({{ p.desempeno }})
                    </span>
                  </div>
                  
                  <div class="space-y-1">
                    <div v-for="(act, aIdx) in p.actividades" :key="aIdx" class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span class="truncate max-w-[180px]">• {{ act.actividad }} ({{ act.porcentaje }}%)</span>
                      <span class="font-mono font-bold text-slate-700 dark:text-slate-200">{{ act.nota.toFixed(2) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Observaciones de convivencia -->
          <div v-if="reportData.observaciones?.length > 0" class="space-y-3">
            <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
              Observaciones de Convivencia
            </h4>
            <div class="space-y-2">
              <div v-for="obs in reportData.observaciones" :key="obs.id_observador" class="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 rounded-xl text-xs space-y-1">
                <div class="flex items-center justify-between font-bold text-amber-900 dark:text-amber-300">
                  <span>{{ obs.tipo_observacion }} — {{ obs.docente_nombre }}</span>
                  <span class="text-[10px] text-amber-700 font-mono">{{ new Date(obs.fecha).toLocaleDateString() }}</span>
                </div>
                <p class="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">{{ obs.observacion }}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- Modal Actions Footer -->
      <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
        <button 
          @click="emit('close')"
          class="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          Cerrar
        </button>

        <div class="flex items-center gap-3">
          <button 
            @click="exportToExcel"
            :disabled="!reportData || exportingExcel"
            class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 disabled:opacity-40"
          >
            <FileSpreadsheet :size="16" />
            {{ exportingExcel ? 'Generando Excel...' : 'Exportar Excel' }}
          </button>

          <button 
            @click="exportToPDF"
            :disabled="!reportData || exportingPDF"
            class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center gap-2 disabled:opacity-40"
          >
            <Download :size="16" />
            {{ exportingPDF ? 'Generando PDF...' : 'Exportar PDF' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
