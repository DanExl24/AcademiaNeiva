<script setup lang="ts">
import EmptyState from '../feedback/EmptyState.vue'
import SkeletonTable from '../feedback/SkeletonTable.vue'

withDefaults(defineProps<{
  loading?: boolean
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
}>(), {
  loading: false,
  empty: false,
  emptyTitle: 'No se encontraron datos',
  emptyDescription: 'No hay elementos para mostrar en este momento.'
})
</script>

<template>
  <div class="w-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col">
    <!-- Header / Toolbar slot -->
    <div v-if="$slots.toolbar" class="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
      <slot name="toolbar" />
    </div>

    <!-- Loading Skeleton State -->
    <div v-if="loading" class="p-6">
      <SkeletonTable />
    </div>

    <!-- Empty State -->
    <div v-else-if="empty" class="p-6">
      <EmptyState :title="emptyTitle" :description="emptyDescription">
        <template #action v-if="$slots.emptyAction">
          <slot name="emptyAction" />
        </template>
      </EmptyState>
    </div>

    <!-- Table content with safe horizontal scroll container -->
    <div v-else class="w-full overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
          <slot name="header" />
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm text-slate-800 dark:text-slate-200">
          <slot />
        </tbody>
      </table>
    </div>

    <!-- Footer / Pagination slot -->
    <div v-if="$slots.footer" class="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between">
      <slot name="footer" />
    </div>
  </div>
</template>
