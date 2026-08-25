<script setup lang="ts">
import { Zap, Loader2 } from 'lucide-vue-next'

defineProps<{
  show: boolean
  selectedTicketForExtraordinary: any | null
  extraordinaryStudentMode: 'NUEVO' | 'EXISTENTE'
  selectedStudentIdForExtraordinary: number | null
  institutionStudents: any[]
  extraordinaryParentEmail: string
  extraordinaryReason: string
  submittingExtraordinary: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:extraordinaryStudentMode', val: 'NUEVO' | 'EXISTENTE'): void
  (e: 'update:selectedStudentIdForExtraordinary', val: number | null): void
  (e: 'update:extraordinaryParentEmail', val: string): void
  (e: 'update:extraordinaryReason', val: string): void
  (e: 'submit'): void
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <div class="p-2 bg-purple-100 dark:bg-purple-950/40 text-purple-600 rounded-xl">
              <Zap :size="20" />
            </div>
            <div>
              <h3 class="font-black text-slate-900 dark:text-white text-base">Autorizar Matrícula Extraordinaria</h3>
              <p class="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Ticket: {{ selectedTicketForExtraordinary?.codigo_ticket }}</p>
            </div>
          </div>
          <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg cursor-pointer">✕</button>
        </div>

        <!-- Opciones de Modalidad de Estudiante -->
        <div class="space-y-2">
          <label class="text-xs font-black text-slate-500 uppercase tracking-wider block">Modalidad del Estudiante</label>
          <div class="grid grid-cols-2 gap-3">
            <button 
              type="button" 
              @click="emit('update:extraordinaryStudentMode', 'NUEVO')"
              class="p-3.5 border rounded-2xl text-left transition-all flex items-center gap-3 cursor-pointer"
              :class="extraordinaryStudentMode === 'NUEVO' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-300 font-black' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold'"
            >
              <span class="text-lg">🆕</span>
              <div>
                <p class="text-xs font-bold">Estudiante Nuevo</p>
                <p class="text-[10px] opacity-75">Aspirante por primera vez</p>
              </div>
            </button>

            <button 
              type="button" 
              @click="emit('update:extraordinaryStudentMode', 'EXISTENTE')"
              class="p-3.5 border rounded-2xl text-left transition-all flex items-center gap-3 cursor-pointer"
              :class="extraordinaryStudentMode === 'EXISTENTE' ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-300 font-black' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold'"
            >
              <span class="text-lg">👤</span>
              <div>
                <p class="text-xs font-bold">Estudiante Existente</p>
                <p class="text-[10px] opacity-75">Alumno ya registrado</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Selector de Estudiante Existente -->
        <div v-if="extraordinaryStudentMode === 'EXISTENTE'" class="space-y-1.5">
          <label class="text-xs font-black text-slate-500 uppercase tracking-wider block">Seleccionar Estudiante *</label>
          <select 
            :value="selectedStudentIdForExtraordinary"
            @change="emit('update:selectedStudentIdForExtraordinary', Number(($event.target as HTMLSelectElement).value) || null)"
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
          >
            <option :value="null">-- Seleccionar Estudiante --</option>
            <option v-for="st in institutionStudents" :key="st.id_estudiante" :value="st.id_estudiante">
              {{ st.nombre }} {{ st.apellido }} (Doc: {{ st.documento }})
            </option>
          </select>
        </div>

        <!-- Correo del Acudiente (Precargado desde el Ticket) -->
        <div class="space-y-1.5">
          <label class="text-xs font-black text-slate-500 uppercase tracking-wider block">Correo del Acudiente (Precargado desde Ticket) *</label>
          <input 
            :value="extraordinaryParentEmail"
            @input="emit('update:extraordinaryParentEmail', ($event.target as HTMLInputElement).value)"
            type="email"
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
            placeholder="ejemplo@correo.com"
          />
        </div>

        <!-- Motivo de Autorización -->
        <div class="space-y-1.5">
          <label class="text-xs font-black text-slate-500 uppercase tracking-wider block">Motivo u Observación de Autorización *</label>
          <textarea 
            :value="extraordinaryReason"
            @input="emit('update:extraordinaryReason', ($event.target as HTMLTextAreaElement).value)"
            rows="3"
            class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none resize-none"
            placeholder="Indica el motivo de la autorización..."
          ></textarea>
        </div>

        <!-- Botones de Acción -->
        <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button 
            type="button"
            @click="emit('close')"
            class="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase cursor-pointer"
          >
            Cancelar
          </button>
          <button 
            type="button"
            @click="emit('submit')"
            :disabled="submittingExtraordinary || !extraordinaryParentEmail || (extraordinaryStudentMode === 'EXISTENTE' && !selectedStudentIdForExtraordinary)"
            class="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black text-xs uppercase tracking-wider disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <Loader2 v-if="submittingExtraordinary" class="w-4 h-4 animate-spin" />
            <span>Enviar Enlace al Acudiente</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
