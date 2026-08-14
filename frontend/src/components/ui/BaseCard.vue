<script setup lang="ts">
withDefaults(defineProps<{
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}>(), {
  padding: 'md',
  hover: false
})

const paddingClasses = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8'
}
</script>

<template>
  <div
    :class="[
      'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm transition-all',
      paddingClasses[padding],
      hover ? 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700' : ''
    ]"
  >
    <div v-if="$slots.header" class="pb-4 border-b border-slate-100 dark:border-slate-800 mb-4 flex items-center justify-between">
      <slot name="header" />
    </div>

    <slot />

    <div v-if="$slots.footer" class="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between">
      <slot name="footer" />
    </div>
  </div>
</template>
