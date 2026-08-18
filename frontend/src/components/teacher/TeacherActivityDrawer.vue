<script setup lang="ts">
import { 
  Settings, X, BookOpen, AlertCircle, ClipboardList, Plus, Trash2, Eye 
} from 'lucide-vue-next'

defineProps<{
  isOpen: boolean
  isPeriodClosed: boolean
  isMonitoring: boolean
  competency: any | null
  competenciasList: any[]
  evidencias: any[]
  activities: any[]
  totalPercentage: number
  showAddActivity: boolean
  dbaEvidencesInfo: any | null
  plannedDbaItems: any[]
  newActivity: any
  newCriterion: Record<number, { descripcion: string; porcentaje: number }>
  selectedExtraEvidencesCount: number
  selectedExtraEvidencesList: any[]
  getDbaNumberForCompetency: (comp: any) => string | number | undefined
  getLinkedCompetencyIndex: (id: number | null | undefined) => number | null
  getDbaEvidenceDetails: (act: any) => any[]
  getLinkedActivityForEvidence: (id: number) => string | undefined
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updateActivityWeight', act: any): void
  (e: 'removeActivity', id: number): void
  (e: 'toggleAddCriterion', actId: number): void
  (e: 'addCriterion', act: any): void
  (e: 'removeCriterion', payload: { act: any; critId: number }): void
  (e: 'toggleShowAddActivity', show: boolean): void
  (e: 'addActivity'): void
  (e: 'openExtraWarning'): void
}>()
</script>

<template>
  <!-- Slide-Over Drawer -->
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>
    
    <div class="absolute inset-y-0 right-0 pl-10 max-w-full flex">
      <div class="w-screen max-w-lg bg-white dark:bg-slate-900 shadow-2xl flex flex-col transition-all transform duration-300 ease-in-out border-l border-slate-100 dark:border-slate-800">
        <!-- Drawer Header -->
        <div class="px-6 py-5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Settings :size="20" />
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white leading-none">
                {{ isPeriodClosed ? 'Detalle de Actividades (Solo Lectura)' : 'Gestión Pedagógica' }}
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                {{ isPeriodClosed ? 'Materia cerrada para este periodo' : 'Configura actividades y evidencias DBA' }}
              </p>
            </div>
          </div>
          <button @click="emit('close')" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            <X :size="20" />
          </button>
        </div>
        
        <!-- Drawer Body (scrollable) -->
        <div class="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          <!-- Section 1: Active Competency -->
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 bg-violet-50 dark:bg-violet-950/30 rounded-lg flex items-center justify-center shrink-0">
                <BookOpen class="w-4 h-4 text-violet-500 dark:text-violet-400" />
              </div>
              <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Competencia del Periodo</h3>
            </div>

            <div v-if="!competency" class="flex flex-col items-center justify-center py-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-850">
              <AlertCircle class="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p class="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Sin competencia definida</p>
            </div>
            <div v-else class="space-y-4">
              <!-- Si hay competencias estructuradas (agrupadas por DBA) -->
              <div v-if="competenciasList.length" class="space-y-4">
                <div v-for="(comp, cIdx) in competenciasList" :key="comp.id_competencia" class="bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-2xl p-4 shadow-sm transition-all hover:shadow-md">
                  <span class="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest block mb-1">
                    Competencia #{{ cIdx + 1 }}{{ getDbaNumberForCompetency(comp) ? ` / DBA #${getDbaNumberForCompetency(comp)}` : '' }}
                  </span>
                  <p class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">{{ comp.descripcion }}</p>
                  
                  <div v-if="comp.evidencias && comp.evidencias.length" class="mt-3 pt-3 border-t border-violet-200/40 dark:border-violet-800/60">
                    <h4 class="text-[9px] font-black text-violet-700 dark:text-violet-400 uppercase tracking-wider mb-2">Evidencias</h4>
                    <ul class="space-y-1.5">
                      <li v-for="ev in comp.evidencias" :key="ev.id_evidencia" class="flex items-start gap-2">
                        <div class="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0"></div>
                        <span class="text-[10px] font-semibold text-violet-900/80 dark:text-violet-300/80 leading-relaxed">{{ ev.descripcion }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Fallback tradicional si no se cargaron estructuradas -->
              <div v-else class="bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 rounded-2xl p-4">
                <p class="text-sm font-semibold text-violet-900 dark:text-violet-300 leading-relaxed whitespace-pre-line">{{ competency.descripcion }}</p>
                
                <div v-if="evidencias.length" class="mt-4 pt-4 border-t border-violet-200/60 dark:border-violet-800/60">
                  <h4 class="text-[10px] font-black text-violet-900 dark:text-violet-400 uppercase tracking-wider mb-2">Evidencias Vinculadas</h4>
                  <ul class="space-y-1.5">
                    <li v-for="ev in evidencias" :key="ev.id_evidencia" class="flex items-start gap-2">
                      <div class="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0"></div>
                      <span class="text-[11px] font-medium text-violet-800 dark:text-violet-300/80 leading-relaxed">{{ ev.descripcion }}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div class="flex items-center gap-2 px-1">
              <div class="w-3.5 h-3.5 text-slate-400 shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <p class="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
                Definida por la dirección académica
              </p>
            </div>
          </div>

          <hr class="border-slate-100 dark:border-slate-800" />

          <!-- Section 2: Activities List & Creation -->
          <div class="space-y-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg flex items-center justify-center shrink-0">
                  <ClipboardList class="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                </div>
                <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Actividades</h3>
              </div>
              <span :class="[totalPercentage === 100 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400', 'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter']">
                {{ totalPercentage }}% / 100%
              </span>
            </div>

            <!-- List of activities -->
            <div class="space-y-4">
              <div v-for="act in activities" :key="act.id_actividadmateria" class="space-y-3">
                <div class="group relative p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-850 hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
                  <div class="flex justify-between items-start">
                    <div>
                      <h4 class="text-sm font-bold text-slate-900 dark:text-white">{{ act.nombre }}</h4>
                      <div class="flex items-center gap-1.5 mt-1">
                        <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso:</span>
                        <input 
                          v-if="!isMonitoring && !isPeriodClosed"
                          type="number" 
                          v-model.number="act.porcentaje" 
                          @blur="emit('updateActivityWeight', act)"
                          @keyup.enter="($event.target as HTMLInputElement).blur()"
                          class="w-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-black text-center text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <span v-else class="text-[10px] font-black text-slate-600 dark:text-slate-400">{{ act.porcentaje }}%</span>
                      </div>
                      
                      <!-- DBA Evidences of Activity -->
                      <div v-if="dbaEvidencesInfo?.usaDba && getDbaEvidenceDetails(act).length > 0" class="mt-2 space-y-1.5">
                        <div v-for="ev in getDbaEvidenceDetails(act)" :key="ev.id_evidencia_dba" class="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex flex-col gap-0.5">
                          <div class="flex items-start gap-1.5 flex-wrap">
                            <span class="shrink-0 font-bold text-emerald-600 dark:text-emerald-400">DBA {{ ev.numero_dba }}:</span>
                            <span>{{ ev.descripcion }}</span>
                            <span :class="ev.tipo === 'PLANEADA' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'" class="rounded px-1.5 py-0.2 text-[8px] font-black uppercase">
                              {{ ev.tipo }}
                            </span>
                          </div>
                          <div v-if="ev.tipo === 'PLANEADA' && getLinkedCompetencyIndex(ev.id_competencia)" class="flex flex-wrap gap-1 mt-1 pl-2">
                            <span class="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-[8px] font-black text-violet-700 dark:text-violet-400 border border-violet-200/40 dark:border-violet-900 uppercase tracking-wider">
                              Competencia {{ getLinkedCompetencyIndex(ev.id_competencia) }}{{ getDbaNumberForCompetency(competenciasList[(getLinkedCompetencyIndex(ev.id_competencia) || 1) - 1]) ? ` / DBA ${getDbaNumberForCompetency(competenciasList[(getLinkedCompetencyIndex(ev.id_competencia) || 1) - 1])}` : '' }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Delete & Add Criterion buttons -->
                    <div v-if="!isMonitoring && !isPeriodClosed" class="flex gap-1">
                      <button @click="emit('toggleAddCriterion', act.id_actividadmateria)" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all" title="Añadir criterio">
                        <Plus :size="14" />
                      </button>
                      <button @click="emit('removeActivity', act.id_actividadmateria)" class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all" title="Eliminar">
                        <Trash2 :size="14" />
                      </button>
                    </div>
                  </div>

                  <!-- Criteria List -->
                  <div v-if="act.criterios && act.criterios.length > 0" class="mt-4 space-y-2 border-t border-slate-200/60 dark:border-slate-750/60 pt-3">
                    <div v-for="crit in act.criterios" :key="crit.id_criterio" class="flex items-center justify-between bg-white dark:bg-slate-900/50 p-2 rounded-xl text-[11px] group/crit shadow-sm border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900">
                      <span class="font-medium text-slate-600 dark:text-slate-300 truncate pr-2">{{ crit.descripcion }}</span>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="font-black text-indigo-500">{{ crit.porcentaje }}%</span>
                        <button v-if="!isMonitoring && !isPeriodClosed" @click="emit('removeCriterion', { act, critId: crit.id_criterio })" class="text-slate-300 hover:text-red-500 opacity-0 group-hover/crit:opacity-100 p-0.5">
                          <X :size="12" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Add Criterion Form -->
                  <div v-if="newCriterion[act.id_actividadmateria]" class="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900 space-y-3 animate-in slide-in-from-top-1 duration-200 shadow-sm">
                    <input v-model="newCriterion[act.id_actividadmateria].descripcion" type="text" placeholder="Descripción del criterio..." class="w-full bg-slate-50 dark:bg-slate-800 border-0 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white" />
                    <div class="flex gap-2">
                      <input v-model.number="newCriterion[act.id_actividadmateria].porcentaje" type="number" placeholder="Peso %" class="w-20 bg-slate-50 dark:bg-slate-800 border-0 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white" />
                      <button @click="emit('addCriterion', act)" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-[10px] font-black uppercase">Añadir</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- New Activity Button & Form -->
            <div v-if="!isMonitoring && !isPeriodClosed && totalPercentage < 100" class="border-t border-slate-100 dark:border-slate-800 pt-6">
              <button 
                v-if="!showAddActivity"
                @click="emit('toggleShowAddActivity', true)"
                class="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-900 rounded-2xl text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all font-bold text-sm"
              >
                <Plus :size="16" />
                Nueva Actividad
              </button>

              <div v-else class="p-5 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900 space-y-4 animate-in zoom-in-95">
                <div v-if="dbaEvidencesInfo?.usaDba" class="space-y-4">
                  <div class="flex flex-col gap-2">
                    <div class="flex items-center justify-between">
                      <label class="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest ml-1">Evidencias DBA Planeadas *</label>
                    </div>
                    
                    <!-- DBA Scrollable Selector (Only planned) -->
                    <div class="space-y-4 max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-750 rounded-xl p-3 bg-white dark:bg-slate-900">
                      <div v-if="plannedDbaItems.length === 0" class="text-xs text-slate-400 dark:text-slate-500 italic py-4 text-center">
                        No hay evidencias planeadas para este periodo por el directivo.
                      </div>
                      
                      <div v-for="dbaItem in plannedDbaItems" :key="dbaItem.id_dba" class="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-0 last:pb-0">
                        <div class="flex items-start gap-2">
                          <span class="rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.5 text-[9px] font-black dark:bg-indigo-950/40 dark:text-indigo-400 shrink-0">
                            DBA #{{ dbaItem.numero_dba }}
                          </span>
                          <p class="text-xs font-bold text-slate-700 dark:text-slate-300 leading-normal">
                            {{ dbaItem.enunciado }}
                          </p>
                        </div>
                        
                        <div class="pl-4 space-y-1.5">
                          <label v-for="ev in dbaItem.evidencias" :key="ev.id_evidencia_dba" :class="getLinkedActivityForEvidence(ev.id_evidencia_dba) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'" class="flex flex-col gap-1 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                            <div class="flex items-start gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400">
                              <input type="checkbox" v-model="newActivity.evidencias_dba" :value="ev.id_evidencia_dba" :disabled="!!getLinkedActivityForEvidence(ev.id_evidencia_dba)" class="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" />
                              <div class="flex flex-wrap items-center gap-1.5">
                                <span>{{ ev.descripcion }}</span>
                                <span class="rounded px-1.5 py-0.2 text-[8px] font-black uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                  PLANEADA
                                </span>
                                <span v-if="getLinkedActivityForEvidence(ev.id_evidencia_dba)" class="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 rounded px-1.5 py-0.5 text-[8px] font-bold border border-red-200/40 uppercase tracking-wide">
                                  Asignada a: {{ getLinkedActivityForEvidence(ev.id_evidencia_dba) }}
                                </span>
                              </div>
                            </div>
                            <div v-if="getLinkedCompetencyIndex(ev.id_competencia)" class="flex flex-wrap gap-1 mt-1 pl-6">
                              <span class="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/40 text-[8px] font-black text-violet-700 dark:text-violet-400 border border-violet-200/40 dark:border-violet-900 uppercase tracking-wider">
                                Competencia {{ getLinkedCompetencyIndex(ev.id_competencia) }}{{ getDbaNumberForCompetency(competenciasList[(getLinkedCompetencyIndex(ev.id_competencia) || 1) - 1]) ? ` / DBA ${getDbaNumberForCompetency(competenciasList[(getLinkedCompetencyIndex(ev.id_competencia) || 1) - 1])}` : '' }}
                              </span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <!-- Botón para ver todas/extra evidencias -->
                    <div class="mt-1">
                      <button 
                        type="button" 
                        @click="emit('openExtraWarning')"
                        class="w-full flex items-center justify-center gap-1.5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-wider transition-all"
                      >
                        <Eye :size="13" />
                        Ver todas las evidencias para este curso
                      </button>
                    </div>

                    <!-- Resumen de evidencias extra seleccionadas -->
                    <div v-if="selectedExtraEvidencesCount > 0" class="mt-2 p-4 bg-blue-50/30 dark:bg-blue-950/10 rounded-2xl border border-blue-100 dark:border-blue-900/50 space-y-3">
                      <p class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">
                        Evidencias Extra Seleccionadas ({{ selectedExtraEvidencesCount }})
                      </p>
                      <ul class="space-y-1.5">
                        <li v-for="ev in selectedExtraEvidencesList" :key="ev.id_evidencia_dba" class="text-xs font-semibold text-slate-600 dark:text-slate-350 leading-relaxed flex items-start gap-2">
                          <span class="rounded bg-blue-50 text-blue-700 px-1 py-0.5 text-[8px] font-black dark:bg-blue-950/40 dark:text-blue-400 mt-0.5 shrink-0">DBA #{{ ev.numero_dba }}</span>
                          <div class="flex-1 min-w-0">
                            <span>{{ ev.descripcion }}</span>
                            <span v-if="ev.planeada_otro_periodo_nombre" class="ml-1.5 rounded px-1.5 py-0.2 text-[8px] font-black uppercase bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/30">
                              Planeada en: {{ ev.planeada_otro_periodo_nombre }}
                            </span>
                          </div>
                        </li>
                      </ul>

                      <!-- Motivo y Justificación -->
                      <div class="pt-3 border-t border-slate-200/40 dark:border-slate-800 space-y-3">
                        <div class="space-y-1">
                          <label class="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest ml-1">
                            Motivo del uso EXTRA *
                          </label>
                          <select v-model="newActivity.motivo_extra" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500">
                            <option value="">Selecciona un motivo</option>
                            <option value="RECUPERACION_REFUERZO">Recuperación o refuerzo</option>
                            <option value="ADELANTO_CURRICULAR">Adelanto curricular</option>
                            <option value="INTEGRACION_ASIGNATURA">Integración con otra asignatura</option>
                            <option value="CALENDARIO_INSTITUCIONAL">Ajuste por calendario institucional</option>
                            <option value="NECESIDAD_PEDAGOGICA">Necesidad pedagógica detectada</option>
                            <option value="OTRO">Otro (requiere descripción)</option>
                          </select>
                        </div>
                        <div v-if="newActivity.motivo_extra === 'OTRO'" class="space-y-1">
                          <label class="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest ml-1">Descripción de la justificación *</label>
                          <textarea v-model="newActivity.justificacion_extra" rows="3" placeholder="Describe brevemente el por qué deseas evaluar esta evidencia..." class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500"></textarea>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
                
                <div v-else class="space-y-1">
                  <label class="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Evidencia *</label>
                  <select v-model="newActivity.id_evidencia" class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 outline-none">
                    <option :value="null">Selecciona</option>
                    <option v-for="ev in evidencias" :key="ev.id_evidencia" :value="ev.id_evidencia">
                      E{{ ev.orden }}: {{ ev.descripcion }}
                    </option>
                  </select>
                </div>

                <div class="space-y-1">
                  <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre de la actividad</label>
                  <input v-model="newActivity.nombre" type="text" placeholder="Ej: Taller 1, Evaluación..." class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                </div>

                <div class="space-y-1">
                  <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Peso porcentual</label>
                  <div class="flex items-center gap-3">
                    <input v-model.number="newActivity.porcentaje" type="number" placeholder="Ej: 20" class="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">% del total</span>
                  </div>
                </div>

                <div class="flex gap-2 pt-2">
                  <button @click="emit('toggleShowAddActivity', false)" class="flex-1 py-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Cancelar</button>
                  <button @click="emit('addActivity')" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95 transition-all">Crear Actividad</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
