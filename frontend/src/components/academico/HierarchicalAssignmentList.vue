<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  Users, 
  BookOpen, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  UserMinus, 
  CheckCircle2, 
  SlidersHorizontal,
  FolderOpen,
  FolderClosed,
  GraduationCap
} from 'lucide-vue-next'
import { getCourseDisplayName } from '../../utils/courseHelper'

export interface AssignmentItem {
  id_detallegrado: number
  id_docente: number
  docente_nombre?: string
  docente_apellido?: string
  id_materia?: number
  materia_nombre?: string
  id_grupo: number
  grado_nombre?: string
  tipo_grado_nombre?: string
  seccion_nombre: string
  jornada_nombre: string
  nivel_nombre?: string
  id_tipo_grado?: number
  [key: string]: any
}

interface Props {
  items: AssignmentItem[]
  mode: 'subject' | 'teacher'
  readOnly?: boolean
  emptyTitle?: string
  emptyMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  readOnly: false,
  emptyTitle: 'Sin asignaciones',
  emptyMessage: 'No se encontraron asignaciones registradas con los filtros aplicados.'
})

const emit = defineEmits<{
  (e: 'delete', item: AssignmentItem): void
}>()

// Grouping Modes
// For mode === 'subject': 'docente' (default), 'grado', 'flat'
// For mode === 'teacher': 'materia' (default), 'grado', 'flat'
const defaultGroupMode = props.mode === 'subject' ? 'docente' : 'materia'
const currentGrouping = ref<'docente' | 'materia' | 'grado' | 'flat'>(defaultGroupMode)

// Collapsed state tracking (Set of group keys that are collapsed)
const collapsedGroups = ref<Set<string>>(new Set())

const toggleGroup = (key: string) => {
  const newSet = new Set(collapsedGroups.value)
  if (newSet.has(key)) {
    newSet.delete(key)
  } else {
    newSet.add(key)
  }
  collapsedGroups.value = newSet
}

const isGroupCollapsed = (key: string) => collapsedGroups.value.has(key)

// Computed Hierarchical Groups
interface GroupData {
  key: string
  title: string
  subtitle?: string
  badgeLabel: string
  iconType: 'docente' | 'materia' | 'grado'
  avatarText?: string
  items: AssignmentItem[]
}

const groupedData = computed<GroupData[]>(() => {
  if (currentGrouping.value === 'flat') {
    return []
  }

  const map = new Map<string, GroupData>()

  props.items.forEach((item) => {
    let groupKey = ''
    let title = ''
    let subtitle = ''
    let iconType: 'docente' | 'materia' | 'grado' = 'docente'
    let avatarText = ''

    if (currentGrouping.value === 'docente') {
      groupKey = `docente-${item.id_docente || item.docente_nombre}`
      title = item.docente_nombre || 'Docente no asignado'
      subtitle = 'Docente titular de curso'
      iconType = 'docente'
      avatarText = item.docente_nombre ? item.docente_nombre.charAt(0).toUpperCase() : 'D'
    } else if (currentGrouping.value === 'materia') {
      groupKey = `materia-${item.id_materia || item.materia_nombre}`
      title = item.materia_nombre || 'Materia'
      subtitle = 'Asignatura del plan curricular'
      iconType = 'materia'
      avatarText = item.materia_nombre ? item.materia_nombre.charAt(0).toUpperCase() : 'M'
    } else if (currentGrouping.value === 'grado') {
      const gName = item.tipo_grado_nombre || item.grado_nombre || 'Grado'
      groupKey = `grado-${gName}`
      title = `Grado ${gName}`
      subtitle = item.nivel_nombre ? `Nivel: ${item.nivel_nombre}` : 'Nivel institucional'
      iconType = 'grado'
      avatarText = gName.charAt(0).toUpperCase()
    }

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        key: groupKey,
        title,
        subtitle,
        badgeLabel: '',
        iconType,
        avatarText,
        items: []
      })
    }

    map.get(groupKey)!.items.push(item)
  })

  // Sort groups alphabetically by title
  const result = Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title))

  // Update badge labels
  result.forEach(g => {
    g.badgeLabel = `${g.items.length} ${g.items.length === 1 ? 'curso' : 'cursos'}`
  })

  return result
})

const expandAll = () => {
  collapsedGroups.value = new Set()
}

const collapseAll = () => {
  const allKeys = groupedData.value.map(g => g.key)
  collapsedGroups.value = new Set(allKeys)
}

const getJornadaClass = (jornada: string) => {
  const j = (jornada || '').toUpperCase()
  if (j.includes('MAÑANA') || j.includes('MANANA')) {
    return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80'
  }
  if (j.includes('TARDE')) {
    return 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200/80 dark:border-orange-800/80'
  }
  if (j.includes('NOCHE') || j.includes('NOCTURNA')) {
    return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/80'
  }
  return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/80'
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header Controls: Grouping Switcher & Expand/Collapse -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
      <!-- Group By Options -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
          <SlidersHorizontal :size="13" class="text-indigo-500" />
          Agrupar:
        </span>

        <button 
          v-if="mode === 'subject'"
          type="button"
          @click="currentGrouping = 'docente'"
          :class="[
            'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
            currentGrouping === 'docente' 
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-slate-700' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          ]"
        >
          <Users :size="13" />
          Docente
        </button>

        <button 
          v-if="mode === 'teacher'"
          type="button"
          @click="currentGrouping = 'materia'"
          :class="[
            'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
            currentGrouping === 'materia' 
              ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs border border-slate-200/80 dark:border-slate-700' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          ]"
        >
          <BookOpen :size="13" />
          Materia
        </button>

        <button 
          type="button"
          @click="currentGrouping = 'grado'"
          :class="[
            'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5',
            currentGrouping === 'grado' 
              ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-xs border border-slate-200/80 dark:border-slate-700' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          ]"
        >
          <Layers :size="13" />
          Grado
        </button>

        <button 
          type="button"
          @click="currentGrouping = 'flat'"
          :class="[
            'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
            currentGrouping === 'flat' 
              ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          ]"
        >
          Lista Plana
        </button>
      </div>

      <!-- Quick Actions: Expand/Collapse All & Count Badge -->
      <div class="flex items-center gap-2 justify-between sm:justify-end">
        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">
          Total: <strong class="text-slate-900 dark:text-white">{{ items.length }}</strong>
        </span>

        <div v-if="currentGrouping !== 'flat' && groupedData.length > 0" class="flex items-center gap-1 border-l border-slate-300 dark:border-slate-700 pl-2">
          <button 
            type="button"
            @click="expandAll" 
            class="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
            title="Expandir todos los grupos"
          >
            <FolderOpen :size="14" />
          </button>
          <button 
            type="button"
            @click="collapseAll" 
            class="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
            title="Colapsar todos los grupos"
          >
            <FolderClosed :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div 
      v-if="items.length === 0" 
      class="text-center py-14 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 p-6"
    >
      <div class="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
        <GraduationCap :size="28" />
      </div>
      <h4 class="text-sm font-black text-slate-800 dark:text-slate-200">{{ emptyTitle }}</h4>
      <p class="text-xs font-medium text-slate-400 max-w-sm mx-auto">{{ emptyMessage }}</p>
    </div>

    <!-- HIERARCHICAL GROUPED VIEW -->
    <div v-else-if="currentGrouping !== 'flat'" class="space-y-3.5">
      <div 
        v-for="group in groupedData" 
        :key="group.key"
        class="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700"
      >
        <!-- Group Header (Accordion Trigger) -->
        <button 
          type="button"
          @click="toggleGroup(group.key)"
          class="w-full p-4 bg-slate-50/80 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-3.5 min-w-0">
            <!-- Group Icon / Avatar -->
            <div 
              :class="[
                'w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs',
                group.iconType === 'docente' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60' :
                group.iconType === 'materia' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60' :
                'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60'
              ]"
            >
              <span v-if="group.avatarText">{{ group.avatarText }}</span>
              <Users v-else-if="group.iconType === 'docente'" :size="18" />
              <BookOpen v-else-if="group.iconType === 'materia'" :size="18" />
              <Layers v-else :size="18" />
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-black text-slate-900 dark:text-white text-sm truncate">{{ group.title }}</h4>
                <span class="px-2 py-0.5 bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 rounded-md text-xs font-bold">
                  {{ group.badgeLabel }}
                </span>
              </div>
              <p v-if="group.subtitle" class="text-xs font-semibold text-slate-400 truncate mt-0.5">{{ group.subtitle }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <div class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <ChevronUp v-if="!isGroupCollapsed(group.key)" :size="16" />
              <ChevronDown v-else :size="16" />
            </div>
          </div>
        </button>

        <!-- Group Body (Items) -->
        <div v-show="!isGroupCollapsed(group.key)" class="p-4 bg-slate-50/30 dark:bg-slate-900/30">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div 
              v-for="item in group.items" 
              :key="item.id_detallegrado"
              class="bg-white dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700/80 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all"
            >
              <div class="min-w-0 space-y-1">
                <!-- If grouped by docente, show course info and subject -->
                <div v-if="currentGrouping === 'docente'">
                  <p class="text-xs font-black text-slate-800 dark:text-slate-100">
                    {{ getCourseDisplayName({ tipo_grado_nombre: item.tipo_grado_nombre || item.grado_nombre, seccion_nombre: item.seccion_nombre }) }}
                  </p>
                  <p v-if="item.materia_nombre" class="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {{ item.materia_nombre }}
                  </p>
                </div>

                <!-- If grouped by materia, show course info and teacher -->
                <div v-else-if="currentGrouping === 'materia'">
                  <p class="text-xs font-black text-slate-800 dark:text-slate-100">
                    {{ getCourseDisplayName({ tipo_grado_nombre: item.tipo_grado_nombre || item.grado_nombre, seccion_nombre: item.seccion_nombre }) }}
                  </p>
                  <p v-if="item.docente_nombre" class="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {{ item.docente_nombre }}
                  </p>
                </div>

                <!-- If grouped by grado, show section + subject + teacher -->
                <div v-else>
                  <p class="text-xs font-black text-slate-800 dark:text-slate-100">
                    Sección {{ item.seccion_nombre }}
                    <span v-if="mode === 'subject' && item.docente_nombre" class="text-slate-500 font-medium"> · {{ item.docente_nombre }}</span>
                    <span v-else-if="mode === 'teacher' && item.materia_nombre" class="text-slate-500 font-medium"> · {{ item.materia_nombre }}</span>
                  </p>
                </div>

                <!-- Jornada Badge -->
                <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span :class="['px-2 py-0.5 rounded-md text-xs font-bold border', getJornadaClass(item.jornada_nombre)]">
                    {{ item.jornada_nombre }}
                  </span>
                  <span v-if="item.nivel_nombre" class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 rounded-md text-xs font-semibold">
                    {{ item.nivel_nombre }}
                  </span>
                </div>
              </div>

              <!-- Item Actions -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  v-if="!readOnly"
                  type="button"
                  @click="emit('delete', item)"
                  class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all cursor-pointer"
                  title="Eliminar o desvincular asignación"
                >
                  <UserMinus :size="16" />
                </button>
                <div v-else class="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold border border-emerald-200/60 dark:border-emerald-800/60">
                  <CheckCircle2 :size="13" />
                  <span>Asignado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- FLAT VIEW (Single Card List with Contrast Borders) -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div 
        v-for="item in items" 
        :key="item.id_detallegrado"
        class="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border border-indigo-100 dark:border-indigo-900">
            {{ mode === 'subject' ? (item.docente_nombre ? item.docente_nombre.charAt(0).toUpperCase() : 'D') : (item.materia_nombre ? item.materia_nombre.charAt(0).toUpperCase() : 'M') }}
          </div>
          <div class="min-w-0">
            <h4 class="font-black text-slate-800 dark:text-white text-xs truncate">
              {{ mode === 'subject' ? item.docente_nombre : item.materia_nombre }}
            </h4>
            <p class="text-xs font-bold text-indigo-500 uppercase mt-0.5 truncate">
              {{ getCourseDisplayName({ tipo_grado_nombre: item.tipo_grado_nombre || item.grado_nombre, seccion_nombre: item.seccion_nombre }) }} · {{ item.jornada_nombre }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            v-if="!readOnly"
            type="button"
            @click="emit('delete', item)"
            class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all cursor-pointer"
            title="Eliminar asignación"
          >
            <UserMinus :size="16" />
          </button>
          <span v-else class="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700">
            Asignado
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
