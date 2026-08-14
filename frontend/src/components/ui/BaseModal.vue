<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full'
  closable?: boolean
}>(), {
  show: false,
  maxWidth: 'lg',
  closable: true
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.show && props.closable) {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-6xl'
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="show" class="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto">
        <!-- Backdrop -->
        <div 
          class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity" 
          @click="closable ? emit('close') : null"
        ></div>

        <!-- Modal Body -->
        <div 
          :class="[
            'relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full p-6 sm:p-8 my-8 max-h-[90vh] flex flex-col z-10 animate-in fade-in zoom-in-95',
            maxWidthClasses[maxWidth]
          ]"
        >
          <!-- Header -->
          <div v-if="title || $slots.header || closable" class="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <slot name="header">
              <h3 class="text-lg font-bold text-slate-900 dark:text-white">
                {{ title }}
              </h3>
            </slot>
            <button
              v-if="closable"
              type="button"
              @click="emit('close')"
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto py-4 space-y-4">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-end gap-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
