<script setup lang="ts">
import { computed } from 'vue'
import { BarChart3 } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    badgeText?: string
    icon?: any
    compact?: boolean
  }>(),
  {
    title: 'En espera de calificaciones',
    description: 'La gráfica y sus comparativas se generarán automáticamente a medida que los docentes registren las primeras evaluaciones.',
    badgeText: 'Periodo en curso',
    icon: null,
    compact: false
  }
)

const displayIcon = computed(() => props.icon || BarChart3)
</script>

<template>
  <div 
    :class="[
      'w-full flex flex-col items-center justify-center text-center rounded-3xl border border-dashed transition-all duration-300 select-none',
      compact ? 'p-5 min-h-[180px] bg-slate-50/40 dark:bg-slate-800/20 border-slate-200/80 dark:border-slate-800' : 'p-8 h-full min-h-[240px] bg-slate-50/60 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800'
    ]"
  >
    <!-- Badge -->
    <div 
      v-if="badgeText" 
      class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3 shadow-xs"
    >
      <span class="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
      {{ badgeText }}
    </div>

    <!-- Icon Container -->
    <div 
      :class="[
        'rounded-2xl flex items-center justify-center transition-transform hover:scale-105 shadow-sm',
        compact ? 'h-11 w-11 bg-white dark:bg-slate-800 text-indigo-500 mb-2 border border-slate-100 dark:border-slate-700' : 'h-14 w-14 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 mb-3 border border-indigo-100/80 dark:border-slate-700 ring-4 ring-indigo-500/5 dark:ring-indigo-500/10'
      ]"
    >
      <component :is="displayIcon" :size="compact ? 22 : 28" stroke-width="2.2" />
    </div>

    <!-- Text content -->
    <h4 
      :class="[
        'font-black text-slate-800 dark:text-slate-200 tracking-tight',
        compact ? 'text-xs' : 'text-sm'
      ]"
    >
      {{ title }}
    </h4>
    
    <p 
      :class="[
        'text-slate-400 dark:text-slate-500 font-medium leading-relaxed mt-1',
        compact ? 'text-[11px] max-w-[200px]' : 'text-xs max-w-sm'
      ]"
    >
      {{ description }}
    </p>
  </div>
</template>
