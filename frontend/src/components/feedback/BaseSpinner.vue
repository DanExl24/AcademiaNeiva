<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

interface Props {
  size?: 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), {
  size: 'md'
})

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8'
}
</script>

<template>
  <div class="flex items-center justify-center p-4">
    <Loader2 :class="['animate-spin text-brand-primary', sizeClasses[size]]" />
  </div>
</template>
