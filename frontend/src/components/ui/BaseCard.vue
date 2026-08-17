<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  padding: 'md'
})

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6'
}
</script>

<template>
  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-colors">
    <div v-if="title || $slots.header" class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
      <div v-if="title">
        <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">{{ title }}</h3>
        <p v-if="subtitle" class="text-xs text-slate-500 mt-0.5">{{ subtitle }}</p>
      </div>
      <slot name="header" />
    </div>
    <div :class="paddingClasses[padding]">
      <slot />
    </div>
    <div v-if="$slots.footer" class="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
      <slot name="footer" />
    </div>
  </div>
</template>
