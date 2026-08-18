<script setup lang="ts">
import { Lock, Award, GraduationCap, Save } from 'lucide-vue-next'

defineProps<{
  show: boolean
  isYearClosed: boolean
  targetStudentForDecision: any | null
  decisionForm: {
    decisionTaken: string
    assignedGradeId: number | ''
    observation: string
  }
  grades: any[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[1000]">
      <div class="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800">
        <div class="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <Lock v-if="isYearClosed" class="w-5 h-5 text-slate-500" />
            <Award v-else class="w-5 h-5 text-indigo-600" />
            <h3 class="font-black text-slate-800 dark:text-white text-base">
              {{ isYearClosed ? 'Visualizar Decisión Institucional (Solo Lectura)' : (targetStudentForDecision?.decision_directivo ? 'Editar Decisión Institucional' : 'Registro de Decisión Institucional') }}
            </h3>
          </div>
          <button class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold leading-none cursor-pointer" @click="emit('close')">×</button>
        </div>

        <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <!-- Alerta de Año Cerrado -->
          <div v-if="isYearClosed" class="p-3.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-xs flex items-center gap-2.5 shadow-sm">
            <Lock class="w-5 h-5 text-slate-500 shrink-0" />
            <div>
              <strong>Año Lectivo Cerrado (Modo Solo Lectura):</strong> Las decisiones institucionales de este ciclo escolar son de carácter histórico e inmodificables.
            </div>
          </div>

          <!-- Resumen del Estudiante -->
          <div class="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5 text-xs">
            <div class="flex justify-between items-center">
              <span class="font-bold text-slate-800 dark:text-white text-sm">
                {{ targetStudentForDecision?.apellido }} {{ targetStudentForDecision?.nombre }}
              </span>
              <span 
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold" 
                :class="{
                  'bg-emerald-100 text-emerald-800 border border-emerald-200': (targetStudentForDecision?.resultado_anual || targetStudentForDecision?.estado_academico) === 'APROBADO',
                  'bg-rose-100 text-rose-800 border border-rose-200': (targetStudentForDecision?.resultado_anual || targetStudentForDecision?.estado_academico) === 'NO_PROMOVIDO',
                  'bg-amber-100 text-amber-800 border border-amber-200': (targetStudentForDecision?.resultado_anual || targetStudentForDecision?.estado_academico) === 'PENDIENTE_RECUPERACION'
                }"
              >
                {{ targetStudentForDecision?.resultado_anual || targetStudentForDecision?.estado_academico }}
              </span>
            </div>
            <p class="text-slate-500 dark:text-slate-400">
              Documento: <strong class="text-slate-700 dark:text-slate-200">{{ targetStudentForDecision?.documento }}</strong> • 
              Curso: <strong class="text-slate-700 dark:text-slate-200">{{ targetStudentForDecision?.grado_nombre }} {{ targetStudentForDecision?.grupo_nombre }}</strong>
            </p>

            <!-- Resumen de materias reprobadas -->
            <div v-if="targetStudentForDecision?.asignaturas_reprobadas && targetStudentForDecision?.asignaturas_reprobadas.length > 0" class="pt-1">
              <p class="font-bold text-rose-800 dark:text-rose-400 mb-1">Materias reprobadas por el estudiante:</p>
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="sub in targetStudentForDecision.asignaturas_reprobadas" 
                  :key="sub.id_materia"
                  class="inline-flex px-2 py-0.5 bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 rounded text-[11px] font-semibold"
                >
                  {{ sub.materia_nombre }} ({{ sub.promedio_anual || sub.calificacion }})
                </span>
              </div>
            </div>
          </div>

          <!-- Alerta Informativa para Último Año -->
          <div v-if="!isYearClosed && (targetStudentForDecision?.is_final_grade || targetStudentForDecision?.es_ultimo_grado)" class="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-900 dark:text-amber-300 text-xs flex items-center gap-2.5 shadow-sm">
            <GraduationCap class="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <strong>Estudiante en Año de Graduación:</strong> Al aprobar la promoción, su estado cambiará automáticamente a <span class="font-black text-indigo-700 dark:text-indigo-400 uppercase">GRADUADO</span> y se inscribirá en el libro oficial de graduados.
            </div>
          </div>

          <!-- Selector de Decisión -->
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Decisión adoptada por la institución / directivo:
            </label>
            <select v-model="decisionForm.decisionTaken" :disabled="isYearClosed" class="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-65 disabled:bg-slate-100 dark:disabled:bg-slate-800">
              <option value="PROMOVER_SIGUIENTE_GRADO">
                {{ (targetStudentForDecision?.is_final_grade || targetStudentForDecision?.es_ultimo_grado) ? 'Promover y Graduar Estudiante 🎓' : 'Promover al siguiente grado (Excepción / Aprobación)' }}
              </option>
              <option value="MANTENER_GRADO">Mantener en el mismo grado (No promovido)</option>
              <option value="MATRICULA_CONDICIONADA">Matrícula condicionada con compromisos</option>
              <option value="OTRA_DECISION">Otra decisión institucional personalizada</option>
            </select>
          </div>

          <!-- Grado asignado opcional -->
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Grado institucional sugerido / asignado (Opcional):
            </label>
            <select v-model="decisionForm.assignedGradeId" :disabled="isYearClosed" class="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-65 disabled:bg-slate-100 dark:disabled:bg-slate-800">
              <option value="">Mantener grado por defecto</option>
              <option v-for="g in grades" :key="g.id_tipo_grado || g.id_grado" :value="g.id_tipo_grado || g.id_grado">
                {{ g.nombre }}
              </option>
            </select>
          </div>

          <!-- Justificación u observaciones -->
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Justificación u observaciones institucionales:
            </label>
            <textarea 
              v-model="decisionForm.observation" 
              rows="3" 
              :disabled="isYearClosed"
              class="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-65 disabled:bg-slate-100 dark:disabled:bg-slate-800 resize-none"
              placeholder="Indique los motivos, actas o acuerdos de la comisión de evaluación y promoción..."
            ></textarea>
          </div>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <button class="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 transition" @click="emit('close')">
            {{ isYearClosed ? 'Cerrar' : 'Cancelar' }}
          </button>
          <button v-if="!isYearClosed" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50" :disabled="loading" @click="emit('save')">
            <Save class="w-4 h-4" /> 
            {{ loading ? 'Guardando...' : 'Guardar Decisión' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
