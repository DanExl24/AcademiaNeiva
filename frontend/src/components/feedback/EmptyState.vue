<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'

withDefaults(defineProps<{
  title?: string
  description?: string
  icon?: any
}>(), {
  title: 'No hay registros disponibles',
  description: 'Actualmente no se encontraron datos para mostrar con los filtros aplicados.',
  icon: Inbox
})
</script>

<template>
  <div class="flex flex-col items-center justify-center p-12 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30">
    <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
      <component :is="icon" :size="32" />
    </div>
    <h4 class="text-base font-bold text-slate-800 dark:text-slate-200">
      {{ title }}
    </h4>
    <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-5 leading-relaxed">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="flex items-center gap-3">
      <slot name="action" />
    </div>
  </div>
</template>
