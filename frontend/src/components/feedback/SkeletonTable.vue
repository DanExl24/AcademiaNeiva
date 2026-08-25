<script setup lang="ts">
interface Props {
  rows?: number
  cols?: number
}

withDefaults(defineProps<Props>(), {
  rows: 5,
  cols: 4
})
</script>

<template>
  <div class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 animate-pulse space-y-4">
    <div class="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg w-full" />
    <div class="space-y-2">
      <div v-for="r in rows" :key="r" class="h-10 bg-slate-50 dark:bg-slate-800/60 rounded-lg flex items-center px-4 gap-4">
        <div v-for="c in cols" :key="c" class="h-4 bg-slate-200/70 dark:bg-slate-700/60 rounded-md flex-1" />
      </div>
    </div>
  </div>
</template>
