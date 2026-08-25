<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Plus } from 'lucide-vue-next'

const props = defineProps<{
  show: 'grade' | 'course' | null
  niveles: any[]
  tiposGrados: any[]
  jornadas: any[]
  savingGrade: boolean
  savingGroup: boolean
  computedNextSectionName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'createGrade', payload: { id_nivel: number; nombre: string }): void
  (e: 'createGroup', payload: { id_nivel: number; id_tipo_grado: number; id_jornada: number; cupos_totales: number }): void
  (e: 'updateGroupNivel', nivelId: string | number): void
  (e: 'updateGroupGrade', gradeId: string | number): void
  (e: 'updateGroupJornada', jornadaId: string | number): void
}>()

const newGradeType = ref({ id_nivel: '', nombre: '' })
const newGroup = ref({
  id_nivel: '',
  id_tipo_grado: '',
  id_jornada: '',
  cupos_totales: 30
})

const gradeNameValidationError = computed(() => {
  if (!newGradeType.value.nombre.trim()) return null
  const num = parseInt(newGradeType.value.nombre.trim())
  if (!isNaN(num) && num > 11) {
    return 'En Colombia los grados van hasta 11° (Undécimo). Si es educación superior o ciclo especial, usa un nombre descriptivo.'
  }
  return null
})

const filteredGradeTypes = computed(() => {
  if (!newGroup.value.id_nivel) return props.tiposGrados
  return props.tiposGrados.filter(t => t.id_nivel === Number(newGroup.value.id_nivel))
})

watch(() => newGroup.value.id_nivel, (val) => {
  emit('updateGroupNivel', val)
})

watch(() => newGroup.value.id_tipo_grado, (val) => {
  emit('updateGroupGrade', val)
})

watch(() => newGroup.value.id_jornada, (val) => {
  emit('updateGroupJornada', val)
})

watch(() => props.show, (val) => {
  if (!val) {
    newGradeType.value = { id_nivel: '', nombre: '' }
    newGroup.value = {
      id_nivel: '',
      id_tipo_grado: '',
      id_jornada: '',
      cupos_totales: 30
    }
  }
})

const handleCreateGrade = () => {
  if (!newGradeType.value.id_nivel || !newGradeType.value.nombre.trim() || gradeNameValidationError.value) return
  emit('createGrade', {
    id_nivel: Number(newGradeType.value.id_nivel),
    nombre: newGradeType.value.nombre.trim()
  })
}

const handleCreateGroup = () => {
  if (!newGroup.value.id_nivel || !newGroup.value.id_tipo_grado || !newGroup.value.id_jornada) return
  emit('createGroup', {
    id_nivel: Number(newGroup.value.id_nivel),
    id_tipo_grado: Number(newGroup.value.id_tipo_grado),
    id_jornada: Number(newGroup.value.id_jornada),
    cupos_totales: Number(newGroup.value.cupos_totales) || 30
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" @click="emit('close')"></div>
      <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-indigo-500/10 overflow-hidden border border-white/20">
        <div class="px-8 pt-8 pb-6 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
          <h2 class="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <Plus :size="24" class="text-indigo-600" />
            {{ show === 'grade' ? 'Configurar Nuevo Grado' : 'Configurar Nuevo Curso' }}
          </h2>
          <p class="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Completa la información necesaria para el registro.</p>
        </div>

        <!-- Grade Form -->
        <div v-if="show === 'grade'" class="p-8 space-y-6">
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nivel Académico</label>
              <select v-model="newGradeType.id_nivel" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white transition-all appearance-none cursor-pointer">
                <option value="">Selecciona un nivel</option>
                <option v-for="nivel in niveles" :key="nivel.id_nivel" :value="nivel.id_nivel">{{ nivel.nombre }}</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nombre Descriptivo</label>
              <input v-model="newGradeType.nombre" type="text" placeholder="Ej. Grado Sexto" class="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl p-4 font-bold outline-none text-slate-900 dark:text-white placeholder:text-slate-400" />
              <div v-if="gradeNameValidationError" class="text-xs font-bold text-amber-600 dark:text-amber-400 ml-1 mt-1">
                {{ gradeNameValidationError }}
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button @click="emit('close')" class="flex-1 px-6 py-4 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button @click="handleCreateGrade" :disabled="savingGrade || !!gradeNameValidationError || !newGradeType.id_nivel || !newGradeType.nombre.trim()" class="flex-[2] bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-slate-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-0 transition-all disabled:opacity-50">
              {{ savingGrade ? 'Registrando...' : 'Confirmar Registro' }}
            </button>
          </div>
        </div>

        <!-- Course (Group) Form -->
        <div v-else class="p-8 space-y-5">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2 space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Nivel Académico</label>
              <select v-model="newGroup.id_nivel" class="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white border-2 border-transparent focus:border-indigo-500/20">
                <option value="">Seleccionar Nivel</option>
                <option v-for="nivel in niveles" :key="nivel.id_nivel" :value="nivel.id_nivel">{{ nivel.nombre }}</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Grado Relacionado</label>
              <select v-model="newGroup.id_tipo_grado" class="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white border-2 border-transparent focus:border-indigo-500/20">
                <option value="">Seleccionar Grado</option>
                <option v-for="tipo in filteredGradeTypes" :key="tipo.id_tipo_grado" :value="tipo.id_tipo_grado">{{ tipo.nombre }}</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Jornada</label>
              <select v-model="newGroup.id_jornada" class="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white border-2 border-transparent focus:border-indigo-500/20">
                <option value="">Seleccionar Jornada</option>
                <option v-for="jornada in jornadas" :key="jornada.id_jornada" :value="jornada.id_jornada">{{ jornada.nombre }}</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Sección Auto-Generada</label>
              <input 
                :value="computedNextSectionName || 'Selecciona un Grado primero'" 
                type="text" 
                disabled
                class="w-full bg-slate-100 dark:bg-slate-800 border-2 border-transparent rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed" 
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-black text-slate-700 dark:text-slate-300 ml-1">Capacidad (Cupos)</label>
              <input v-model.number="newGroup.cupos_totales" type="number" min="0" class="w-full bg-slate-50 dark:bg-slate-800 rounded-2xl p-3.5 font-bold outline-none text-sm text-slate-900 dark:text-white border-2 border-transparent focus:border-indigo-500/20" />
            </div>
          </div>

          <div class="flex gap-3 pt-5 border-t border-slate-100 dark:border-slate-800">
            <button @click="emit('close')" class="flex-1 px-4 py-4 rounded-2xl font-black text-slate-500 dark:text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
            <button @click="handleCreateGroup" :disabled="savingGroup || !newGroup.id_nivel || !newGroup.id_tipo_grado || !newGroup.id_jornada" class="flex-[2] bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 dark:shadow-none hover:translate-y-[-2px] transition-all disabled:opacity-50">
              {{ savingGroup ? 'Creando...' : 'Registrar Curso' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
