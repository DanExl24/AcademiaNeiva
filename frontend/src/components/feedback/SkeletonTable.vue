<script setup lang="ts">
withDefaults(defineProps<{
  rows?: number
  columns?: number
}>(), {
  rows: 5,
  columns: 4
})
</script>

<template>
  <div class="w-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 space-y-4 animate-pulse">
    <!-- Header skeleton -->
    <div class="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
      <div class="h-6 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/4"></div>
      <div class="h-8 bg-slate-200 dark:bg-slate-800 rounded-xl w-32"></div>
    </div>

    <!-- Rows -->
    <div class="space-y-3">
      <div v-for="r in rows" :key="r" class="flex items-center gap-4 py-2">
        <div v-for="c in columns" :key="c" class="h-5 bg-slate-100 dark:bg-slate-800/60 rounded-lg flex-1"></div>
      </div>
    </div>
  </div>
</template>
