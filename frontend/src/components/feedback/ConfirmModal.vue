<script setup lang="ts">
import { useConfirm } from '../../composables/useConfirm'
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-vue-next'

const { confirmState, handleConfirm, handleCancel } = useConfirm()

const getIcon = (type?: string) => {
  if (type === 'danger') return AlertTriangle
  if (type === 'warning') return AlertCircle
  if (type === 'success') return CheckCircle2
  return Info
}

const getStyles = (type?: string) => {
  if (type === 'danger') {
    return {
      iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 dark:shadow-none'
    }
  }
  if (type === 'warning') {
    return {
      iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200 dark:shadow-none'
    }
  }
  if (type === 'success') {
    return {
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 dark:shadow-none'
    }
  }
  return {
    iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-none'
  }
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
      <div v-if="confirmState.isOpen" class="fixed inset-0 z-[99999] flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
          @click="handleCancel"
        ></div>

        <!-- Modal Card -->
        <div class="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-5 animate-in fade-in zoom-in-95 duration-150">
          <button 
            @click="handleCancel"
            class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X :size="18" />
          </button>

          <div 
            :class="[getStyles(confirmState.type).iconBg, 'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto transition-transform']"
          >
            <component :is="getIcon(confirmState.type)" :size="32" />
          </div>

          <div class="space-y-2">
            <h3 class="text-xl font-bold text-slate-900 dark:text-white leading-tight">
              {{ confirmState.title }}
            </h3>
            <p class="text-sm text-slate-600 dark:text-slate-350 leading-relaxed">
              {{ confirmState.message }}
            </p>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button
              type="button"
              @click="handleCancel"
              class="flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-[0.98]"
            >
              {{ confirmState.cancelText }}
            </button>
            <button
              type="button"
              @click="handleConfirm"
              :class="[getStyles(confirmState.type).btn, 'flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all active:scale-[0.98]']"
            >
              {{ confirmState.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
