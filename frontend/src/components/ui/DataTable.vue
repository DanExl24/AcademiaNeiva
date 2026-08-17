<script setup lang="ts">
interface Props {
  hoverable?: boolean
  dense?: boolean
}

withDefaults(defineProps<Props>(), {
  hoverable: true,
  dense: false
})
</script>

<template>
  <div class="w-full overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs">
    <div class="overflow-x-auto w-full max-w-full">
      <table class="w-full text-left border-collapse">
        <thead class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
          <slot name="header" />
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-700 dark:text-slate-200">
          <slot />
        </tbody>
      </table>
    </div>
    <div v-if="$slots.footer" class="px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
      <slot name="footer" />
    </div>
  </div>
</template>
