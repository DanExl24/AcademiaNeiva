<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral'
  size?: 'sm' | 'md'
  dot?: boolean
}>(), {
  variant: 'neutral',
  size: 'md',
  dot: false
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
    case 'warning':
      return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
    case 'danger':
      return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
    case 'info':
      return 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60'
    case 'purple':
      return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  }
})

const dotColor = computed(() => {
  switch (props.variant) {
    case 'success': return 'bg-emerald-500'
    case 'warning': return 'bg-amber-500'
    case 'danger': return 'bg-rose-500'
    case 'info': return 'bg-sky-500'
    case 'purple': return 'bg-indigo-500'
    default: return 'bg-slate-400'
  }
})
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 font-bold uppercase tracking-wider border rounded-xl',
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
      variantClasses
    ]"
  >
    <span v-if="dot" :class="['w-1.5 h-1.5 rounded-full shrink-0 animate-pulse', dotColor]"></span>
    <slot />
  </span>
</template>
