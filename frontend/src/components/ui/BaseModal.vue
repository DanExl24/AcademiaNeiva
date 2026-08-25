<script setup lang="ts">
import { X } from 'lucide-vue-next'

interface Props {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  title: '',
  size: 'md'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}>()

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl'
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        @click.self="close"
      >
        <div
          :class="[
            'relative w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-200',
            sizeClasses[size]
          ]"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">
              {{ title }}
            </h3>
            <button
              type="button"
              @click="close"
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Cerrar modal"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 max-h-[75vh] overflow-y-auto">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
