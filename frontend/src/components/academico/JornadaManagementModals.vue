<script setup lang="ts">
import { ref, watch } from 'vue'
import { Sun, Trash2, ArrowRightLeft, Clock, Sunset, Globe, Moon } from 'lucide-vue-next'
import { getCourseDisplayName } from '../../utils/courseHelper'

const DEFAULT_JORNADA_SCHEDULES: Record<string, { start: string; end: string; desc: string; label: string }> = {
  MAÑANA: { start: '06:30', end: '12:30', desc: 'Jornada Mañana (6:30 AM - 12:30 PM)', label: 'Mañana (6:30 AM – 12:30 PM)' },
  TARDE: { start: '12:30', end: '18:30', desc: 'Jornada Tarde (12:30 PM - 6:30 PM)', label: 'Tarde (12:30 PM – 6:30 PM)' },
  UNICA: { start: '06:30', end: '14:30', desc: 'Jornada Única (6:30 AM - 2:30 PM)', label: 'Única (6:30 AM – 2:30 PM)' },
  NOCTURNA: { start: '18:00', end: '22:00', desc: 'Jornada Nocturna (6:00 PM - 10:00 PM)', label: 'Nocturna (6:00 PM – 10:00 PM)' },
}

const props = defineProps<{
  showCreate: boolean
  availableJornadasToAdd: string[]
  savingJornada: boolean
  showDelete: boolean
  targetJornadaToDelete: any | null
  deletingJornada: boolean
  showReassign: boolean
  targetGroupToReassign: any | null
  reassigningJornada: boolean
  showEditHours?: boolean
  targetJornadaToEdit?: any | null
  editingJornada?: boolean
  jornadas: any[]
}>()

const emit = defineEmits<{
  (e: 'closeCreate'): void
  (e: 'confirmCreate', payload: { nombre: string; hora_inicio?: string; hora_fin?: string; descripcion?: string }): void
  (e: 'closeDelete'): void
  (e: 'confirmDelete'): void
  (e: 'closeReassign'): void
  (e: 'confirmReassign', newJornadaId: number): void
  (e: 'closeEditHours'): void
  (e: 'confirmEditHours', payload: { id_jornada: number; hora_inicio: string; hora_fin: string; descripcion?: string }): void
}>()

const newJornadaName = ref('MAÑANA')
const createHoraInicio = ref('06:30')
const createHoraFin = ref('12:30')
const createDescripcion = ref('')

const editHoraInicio = ref('06:30')
const editHoraFin = ref('12:30')
const editDescripcion = ref('')

const newTargetJornadaId = ref<number | null>(null)

const cleanTimeToHM = (timeStr?: string | null): string => {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
  }
  return timeStr
}

const applyDefaultsForName = (name: string) => {
  const norm = String(name || '').toUpperCase()
  const def = DEFAULT_JORNADA_SCHEDULES[norm] || { start: '07:00', end: '13:00', desc: `Jornada ${name}` }
  createHoraInicio.value = def.start
  createHoraFin.value = def.end
  createDescripcion.value = def.desc
}

watch(() => props.availableJornadasToAdd, (list) => {
  if (list && list.length > 0 && !list.includes(newJornadaName.value)) {
    newJornadaName.value = list[0]
    applyDefaultsForName(list[0])
  }
}, { immediate: true })

watch(newJornadaName, (val) => {
  if (val) {
    applyDefaultsForName(val)
  }
})

watch(() => props.targetGroupToReassign, (group) => {
  if (group) {
    newTargetJornadaId.value = group.id_jornada
  } else {
    newTargetJornadaId.value = null
  }
})

watch(() => props.targetJornadaToEdit, (jornada) => {
  if (jornada) {
    const norm = String(jornada.nombre || '').toUpperCase()
    const def = DEFAULT_JORNADA_SCHEDULES[norm] || { start: '07:00', end: '13:00', desc: `Jornada ${norm}` }
    editHoraInicio.value = cleanTimeToHM(jornada.hora_inicio) || def.start
    editHoraFin.value = cleanTimeToHM(jornada.hora_fin) || def.end
    editDescripcion.value = jornada.descripcion || def.desc
  }
}, { immediate: true })

const handleCreate = () => {
  if (!newJornadaName.value || props.savingJornada) return
  emit('confirmCreate', {
    nombre: newJornadaName.value,
    hora_inicio: createHoraInicio.value ? `${createHoraInicio.value}:00` : undefined,
    hora_fin: createHoraFin.value ? `${createHoraFin.value}:00` : undefined,
    descripcion: createDescripcion.value || undefined,
  })
}

const handleEditSubmit = () => {
  if (!props.targetJornadaToEdit || props.editingJornada) return
  emit('confirmEditHours', {
    id_jornada: props.targetJornadaToEdit.id_jornada,
    hora_inicio: `${editHoraInicio.value}:00`,
    hora_fin: `${editHoraFin.value}:00`,
    descripcion: editDescripcion.value || undefined,
  })
}

const handleReassign = () => {
  if (!newTargetJornadaId.value || props.reassigningJornada) return
  emit('confirmReassign', newTargetJornadaId.value)
}
</script>

<template>
  <Teleport to="body">
    <!-- Create Jornada Modal -->
    <div v-if="showCreate" class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('closeCreate')"></div>
      <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden border border-white/20 max-h-[90dvh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-5 sm:p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-between">
          <div class="space-y-5">
            <!-- Header -->
            <div class="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div class="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl shrink-0">
                <Sun :size="22" />
              </div>
              <div>
                <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white">Habilitar Nueva Jornada</h3>
                <p class="text-xs text-slate-400 font-medium">Activa una jornada institucional y personaliza su franja horaria</p>
              </div>
            </div>

            <!-- Seleccionar Tipo Oficial -->
            <div class="space-y-2">
              <label class="text-xs font-bold text-slate-600 dark:text-slate-300">Seleccionar Tipo Oficial (MEN / SIMAT):</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="name in availableJornadasToAdd"
                  :key="name"
                  type="button"
                  @click="newJornadaName = name"
                  :class="[
                    'p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer',
                    newJornadaName === name
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-500/30'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                  ]"
                >
                  <Sun v-if="name === 'MAÑANA'" :size="16" class="shrink-0" />
                  <Sunset v-else-if="name === 'TARDE'" :size="16" class="shrink-0" />
                  <Globe v-else-if="name === 'UNICA'" :size="16" class="shrink-0" />
                  <Moon v-else :size="16" class="shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="font-black text-xs leading-tight truncate">{{ name }}</p>
                    <p class="text-[10px] opacity-75 truncate">{{ DEFAULT_JORNADA_SCHEDULES[name]?.start || '06:30' }} - {{ DEFAULT_JORNADA_SCHEDULES[name]?.end || '12:30' }}</p>
                  </div>
                </button>
              </div>
            </div>

            <!-- Franja Horaria Configurable -->
            <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Clock :size="15" class="text-indigo-500 shrink-0" />
                  <span>Horario de Funcionamiento Institucional</span>
                </div>
                <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                  Configurable
                </span>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Hora Entrada:</label>
                  <input 
                    type="time" 
                    v-model="createHoraInicio"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Hora Salida:</label>
                  <input 
                    type="time" 
                    v-model="createHoraFin"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Descripción / Alias (Opcional):</label>
                <input 
                  type="text" 
                  v-model="createDescripcion"
                  placeholder="Ej: Jornada Única (6:00 AM - 2:00 PM)"
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
              <p class="text-[10px] text-slate-400 italic">
                * Puedes ajustar las horas si tu colegio inicia a las 6:00 AM o maneja otro horario específico.
              </p>
            </div>
          </div>

          <!-- Buttons -->
          <div class="flex flex-col-reverse sm:flex-row items-center gap-2.5 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button 
              @click="emit('closeCreate')"
              class="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              @click="handleCreate"
              :disabled="savingJornada || !newJornadaName || !createHoraInicio || !createHoraFin"
              class="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
            >
              {{ savingJornada ? 'Habilitando...' : 'Habilitar Jornada' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Jornada Hours Modal -->
    <div v-if="showEditHours && targetJornadaToEdit" class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('closeEditHours')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden border border-white/20 max-h-[90dvh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-5 sm:p-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-between">
          <div class="space-y-4">
            <div class="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div class="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl shrink-0">
                <Clock :size="22" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">Editar Horario de Jornada</h3>
                <p class="text-xs text-slate-400 font-medium truncate">Jornada {{ targetJornadaToEdit.nombre }}</p>
              </div>
            </div>

            <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Hora Entrada:</label>
                  <input 
                    type="time" 
                    v-model="editHoraInicio"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Hora Salida:</label>
                  <input 
                    type="time" 
                    v-model="editHoraFin"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Descripción / Nota:</label>
                <input 
                  type="text" 
                  v-model="editDescripcion"
                  placeholder="Ej: Jornada Única (6:00 AM - 2:00 PM)"
                  class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div class="flex flex-col-reverse sm:flex-row items-center gap-2.5 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button 
              @click="emit('closeEditHours')"
              class="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              @click="handleEditSubmit"
              :disabled="editingJornada || !editHoraInicio || !editHoraFin"
              class="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
            >
              {{ editingJornada ? 'Guardando...' : 'Guardar Horario' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Jornada Modal -->
    <div v-if="showDelete && targetJornadaToDelete" class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <div class="absolute inset-0 bg-red-950/30 backdrop-blur-md" @click="emit('closeDelete')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] overflow-hidden shadow-2xl max-h-[90dvh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-6 sm:p-8 text-center overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-between">
          <div>
            <div class="w-14 h-14 sm:w-16 sm:h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shrink-0">
              <Trash2 class="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white">¿Eliminar Jornada {{ targetJornadaToDelete.nombre }}?</h2>
            <p class="text-slate-500 dark:text-slate-400 font-medium mt-2 sm:mt-3 text-xs leading-relaxed">
              Esta jornada no posee cursos asignados y será retirada de la institución. Esta acción no afecta cursos existentes.
            </p>
          </div>
          
          <div class="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button @click="emit('closeDelete')" class="w-full sm:w-auto flex-1 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer">Cancelar</button>
            <button 
              @click="emit('confirmDelete')"
              :disabled="deletingJornada"
              class="w-full sm:w-auto flex-1 bg-red-500 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-100 dark:shadow-none hover:bg-red-600 transition-all disabled:opacity-50 cursor-pointer"
            >
              {{ deletingJornada ? 'Eliminando...' : 'Sí, Retirar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reassign Group Jornada Modal -->
    <div v-if="showReassign && targetGroupToReassign" class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('closeReassign')"></div>
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[32px] shadow-2xl overflow-hidden border border-white/20 max-h-[90dvh] flex flex-col animate-in fade-in zoom-in duration-200">
        <div class="p-5 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 sm:mb-6">
              <div class="p-2.5 sm:p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl sm:rounded-2xl shrink-0">
                <ArrowRightLeft :size="22" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">Reasignar Jornada</h3>
                <p class="text-xs text-slate-400 font-medium truncate">{{ getCourseDisplayName(targetGroupToReassign) }}</p>
              </div>
            </div>

            <div class="space-y-3">
              <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl sm:rounded-2xl text-xs space-y-1">
                <p class="text-slate-400 font-medium">Jornada Actual: <span class="font-bold text-slate-900 dark:text-white">{{ targetGroupToReassign.jornada_nombre }}</span></p>
                <p class="text-slate-400 font-medium">Estudiantes Vinculados: <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ targetGroupToReassign.matriculas_count }}</span></p>
              </div>

              <label class="text-xs font-bold text-slate-600 dark:text-slate-300 block">Nueva Jornada de Destino:</label>
              <select 
                v-model="newTargetJornadaId"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 font-bold outline-none text-xs text-slate-900 dark:text-white cursor-pointer"
              >
                <option v-for="j in jornadas" :key="j.id_jornada" :value="j.id_jornada">
                  {{ j.nombre }} {{ j.id_jornada === targetGroupToReassign.id_jornada ? '(Actual)' : '' }}
                </option>
              </select>
            </div>
          </div>

          <div class="flex flex-col-reverse sm:flex-row items-center gap-2.5 sm:gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button 
              @click="emit('closeReassign')"
              class="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              @click="handleReassign"
              :disabled="reassigningJornada || !newTargetJornadaId || newTargetJornadaId === targetGroupToReassign.id_jornada"
              class="w-full sm:w-auto flex-1 py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
            >
              {{ reassigningJornada ? 'Reasignando...' : 'Confirmar Cambio' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
