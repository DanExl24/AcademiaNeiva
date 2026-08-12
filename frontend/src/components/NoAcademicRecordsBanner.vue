<script setup lang="ts">
import { CalendarX2, Sparkles } from 'lucide-vue-next'

defineProps<{
  yearLabel?: string | number
  customMessage?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center p-10 md:p-14 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 shadow-sm text-center my-6 animate-in fade-in duration-500">
    <div class="h-20 w-20 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5 shadow-inner">
      <CalendarX2 :size="40" stroke-width="2" />
    </div>
    
    <h3 class="text-xl md:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
      No cuentas con registros académicos para este año
    </h3>
    
    <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md leading-relaxed font-medium">
      {{ customMessage || `No se encontraron matrículas, calificaciones ni actividades registradas a tu nombre para ${yearLabel ? 'el año ' + yearLabel : 'el año lectivo seleccionado'}. Si recién te incorporaste a la institución en 2026, por favor selecciona el año vigente.` }}
    </p>

    <div class="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl text-xs font-bold border border-indigo-100 dark:border-indigo-900/50">
      <Sparkles :size="14" />
      <span>Consejo: Selecciona un año lectivo en el selector de la barra superior</span>
    </div>
  </div>
</template>
