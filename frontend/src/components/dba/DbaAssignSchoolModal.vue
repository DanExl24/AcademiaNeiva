<script setup lang="ts">
import { X, BookOpen } from 'lucide-vue-next'
import DataTable from '../ui/DataTable.vue'
import EmptyState from '../feedback/EmptyState.vue'

defineProps<{
  showAssignModal: boolean
  assignForm: {
    id_colegio: string
    area: string
    grado: string
    version_curricular: string
  }
  colleges: any[]
  areas: string[]
  gradeOptions: string[]
  versions: string[]
  saving: boolean
  showViewAssignmentsModal: boolean
  selectedSchoolForView: any | null
  activeSchoolAssignments: any[]
}>()

const emit = defineEmits<{
  (e: 'closeAssign'): void
  (e: 'saveAssign'): void
  (e: 'closeViewAssignments'): void
}>()
</script>

<template>
  <Teleport to="body">
    <!-- MODAL 1: Asignar versión a Colegio -->
    <div v-if="showAssignModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-lg p-8 space-y-6">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-black text-slate-900 dark:text-white">
            Asignar Versión Curricular a Colegio
          </h3>
          <button @click="emit('closeAssign')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X :size="20" />
          </button>
        </div>

        <div class="space-y-4">
          <!-- Colegio -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Colegio *</label>
            <select v-model="assignForm.id_colegio" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="" disabled>Seleccione un colegio</option>
              <option value="TODOS" class="font-black text-indigo-600">📋 Todos los colegios (asignación masiva)</option>
              <option v-for="col in colleges" :key="col.id_colegio" :value="col.id_colegio.toString()">
                {{ col.nombre }}
              </option>
            </select>
          </div>

          <!-- Área -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Área Académica *</label>
            <select v-model="assignForm.area" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="TODAS" class="font-black text-indigo-600">📚 Todas las materias (asignación masiva)</option>
              <option v-for="a in areas" :key="a" :value="a">{{ a }}</option>
            </select>
          </div>

          <!-- Grado -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Grado *</label>
            <select v-model="assignForm.grado" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="TODOS">Todos los grados</option>
              <option v-for="grade in gradeOptions" :key="grade" :value="grade">{{ grade }}</option>
            </select>
          </div>

          <!-- Versión Curricular -->
          <div>
            <label class="text-xs font-bold text-slate-400 uppercase block mb-1">Versión Curricular *</label>
            <select v-model="assignForm.version_curricular" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="ver in versions" :key="ver" :value="ver">{{ ver }}</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button @click="emit('closeAssign')" class="px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            Cancelar
          </button>
          <button :disabled="saving" @click="emit('saveAssign')" class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
            <span v-if="saving" class="animate-spin border-2 border-white border-t-transparent rounded-full h-4 w-4"></span>
            Asignar
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL 2: Ver Asignaciones de un Colegio -->
    <div v-if="showViewAssignmentsModal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999]">
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-2xl w-full max-w-2xl p-8 space-y-6">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-lg font-black text-slate-900 dark:text-white">
              Configuración Curricular Asignada
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ selectedSchoolForView?.nombre }}</p>
          </div>
          <button @click="emit('closeViewAssignments')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400">
            <X :size="20" />
          </button>
        </div>

        <div class="max-h-[50vh] overflow-y-auto">
          <EmptyState
            v-if="activeSchoolAssignments.length === 0"
            title="Sin versiones asignadas"
            description="El colegio no tiene ninguna versión curricular asignada en este momento."
          >
            <template #icon>
              <BookOpen class="w-8 h-8 text-indigo-500" />
            </template>
          </EmptyState>

          <DataTable v-else>
            <template #header>
              <tr>
                <th class="py-3 px-4">Área</th>
                <th class="py-3 px-4">Grado</th>
                <th class="py-3 px-4 text-center">Versión Curricular</th>
                <th class="py-3 px-4 text-right">Asignado el</th>
              </tr>
            </template>
            <tr 
              v-for="asig in activeSchoolAssignments" 
              :key="asig.id"
              class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              <td class="py-3.5 px-4">{{ asig.area }}</td>
              <td class="py-3.5 px-4">{{ asig.grado }}</td>
              <td class="py-3.5 px-4 text-center">
                <span class="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-bold rounded-md">
                  {{ asig.version_curricular }}
                </span>
              </td>
              <td class="py-3.5 px-4 text-right text-slate-400">
                {{ new Date(asig.fecha_asignacion).toLocaleDateString() }}
              </td>
            </tr>
          </DataTable>
        </div>

        <div class="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <button @click="emit('closeViewAssignments')" class="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
