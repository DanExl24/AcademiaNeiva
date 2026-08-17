<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next'

interface Props {
  title?: string
  description?: string
}

withDefaults(defineProps<Props>(), {
  title: 'No hay registros disponibles',
  description: 'No se encontraron datos que coincidan con la búsqueda o el filtro actual.'
})
</script>

<template>
  <div class="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 my-4">
    <div class="p-4 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-2xl mb-3">
      <slot name="icon">
        <FolderOpen class="w-8 h-8" />
      </slot>
    </div>
    <h4 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
      {{ title }}
    </h4>
    <p class="text-xs text-slate-500 max-w-sm mt-1">
      {{ description }}
    </p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
