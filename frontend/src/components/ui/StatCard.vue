<script setup lang="ts">
interface Props {
  title: string
  value: string | number
  subtitle?: string
  trend?: string
  trendType?: 'positive' | 'negative' | 'neutral'
}

withDefaults(defineProps<Props>(), {
  subtitle: '',
  trend: '',
  trendType: 'neutral'
})
</script>

<template>
  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4">
    <div class="flex-1 min-w-0">
      <p class="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
        {{ title }}
      </p>
      <p class="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
        {{ value }}
      </p>
      <p v-if="subtitle" class="text-xs text-slate-500 mt-1 truncate">
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.icon" class="p-3 bg-brand-primary/10 text-brand-primary rounded-xl shrink-0">
      <slot name="icon" />
    </div>
  </div>
</template>
