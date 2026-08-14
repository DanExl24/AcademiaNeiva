<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

withDefaults(defineProps<{
  size?: number
  text?: string
}>(), {
  size: 24,
  text: ''
})
</script>

<template>
  <div class="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400">
    <Loader2 :size="size" class="animate-spin shrink-0" />
    <span v-if="text" class="text-xs font-bold text-slate-600 dark:text-slate-350">{{ text }}</span>
  </div>
</template>
