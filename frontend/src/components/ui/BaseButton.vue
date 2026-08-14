<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
  disabled?: boolean
  icon?: any
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  loading: false,
  disabled: false
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'py-1.5 px-3 text-xs rounded-xl gap-1.5'
    case 'lg': return 'py-3.5 px-6 text-sm rounded-2xl gap-2.5'
    default: return 'py-2.5 px-4 text-xs rounded-xl gap-2'
  }
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98]'
    case 'danger':
      return 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200 dark:shadow-none active:scale-[0.98]'
    case 'success':
      return 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-none active:scale-[0.98]'
    case 'outline':
      return 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98]'
    case 'ghost':
      return 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98]'
    default:
      return 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100 dark:shadow-none active:scale-[0.98]'
  }
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[
      'inline-flex items-center justify-center font-bold tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
      sizeClasses,
      variantClasses
    ]"
  >
    <Loader2 v-if="loading" class="animate-spin shrink-0" :size="size === 'sm' ? 14 : 16" />
    <component v-else-if="icon" :is="icon" class="shrink-0" :size="size === 'sm' ? 14 : 16" />
    <slot />
  </button>
</template>
