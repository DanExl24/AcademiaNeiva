<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  value: string | number
  subtitle?: string
  icon?: any
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky'
}>(), {
  color: 'indigo'
})

const colorStyles = {
  indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/40',
  emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/40',
  amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/40',
  rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/40',
  sky: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-800/40'
}
</script>

<template>
  <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex items-center justify-between gap-4 transition-all hover:shadow-md">
    <div class="space-y-1">
      <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {{ title }}
      </p>
      <h3 class="text-2xl font-black text-slate-900 dark:text-white">
        {{ value }}
      </h3>
      <p v-if="subtitle" class="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {{ subtitle }}
      </p>
    </div>

    <div v-if="icon" :class="['w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0', colorStyles[color]]">
      <component :is="icon" :size="26" />
    </div>
  </div>
</template>
