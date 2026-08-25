<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success' | 'outline' | 'ghost'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
  block: false
})

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-brand-primary text-white hover:opacity-90 shadow-sm focus:ring-brand-primary/40'
    case 'secondary':
      return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 focus:ring-slate-400'
    case 'danger':
      return 'bg-red-600 text-white hover:bg-red-700 shadow-sm focus:ring-red-500/40'
    case 'warning':
      return 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm focus:ring-amber-400/40'
    case 'success':
      return 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm focus:ring-emerald-500/40'
    case 'outline':
      return 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:ring-slate-400'
    case 'ghost':
      return 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 focus:ring-slate-400'
    default:
      return 'bg-brand-primary text-white'
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'px-2.5 py-1 text-xs gap-1.5 rounded-lg'
    case 'sm':
      return 'px-3 py-1.5 text-xs font-medium gap-2 rounded-lg'
    case 'md':
      return 'px-4 py-2 text-sm font-medium gap-2 rounded-xl'
    case 'lg':
      return 'px-5 py-2.5 text-base font-medium gap-2.5 rounded-xl'
    default:
      return 'px-4 py-2 text-sm'
  }
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[
      'inline-flex items-center justify-center transition-all duration-150 font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none active:scale-[0.98]',
      variantClasses,
      sizeClasses,
      block ? 'w-full' : ''
    ]"
  >
    <Loader2 v-if="loading" class="w-4 h-4 animate-spin text-current shrink-0" />
    <slot name="icon" v-if="!loading" />
    <slot />
  </button>
</template>
