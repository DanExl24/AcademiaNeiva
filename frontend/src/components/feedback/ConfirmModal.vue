<script setup lang="ts">
import { useConfirm } from '../../composables/useConfirm'
import { AlertTriangle, Info } from 'lucide-vue-next'
import BaseButton from '../ui/BaseButton.vue'


const { isVisible, options, handleConfirm, handleCancel } = useConfirm()
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
        v-if="isVisible"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        @click.self="handleCancel"
      >
        <div class="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
          <div class="flex items-start gap-4">
            <div
              :class="[
                'p-3 rounded-xl shrink-0',
                options.type === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-950/50' :
                options.type === 'warning' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50' :
                'bg-blue-50 text-blue-600 dark:bg-blue-950/50'
              ]"
            >
              <AlertTriangle v-if="options.type === 'danger' || options.type === 'warning'" class="w-6 h-6" />
              <Info v-else class="w-6 h-6" />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100">
                {{ options.title }}
              </h3>
              <p class="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {{ options.message }}
              </p>
            </div>
          </div>

          <div class="mt-6 flex items-center justify-end gap-3">
            <BaseButton variant="secondary" size="sm" @click="handleCancel">
              {{ options.cancelText }}
            </BaseButton>
            <BaseButton
              :variant="options.type === 'danger' ? 'danger' : 'primary'"
              size="sm"
              @click="handleConfirm"
            >
              {{ options.confirmText }}
            </BaseButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
