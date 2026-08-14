<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string | number | null
  label?: string
  placeholder?: string
  type?: string
  error?: string
  disabled?: boolean
  required?: boolean
  icon?: any
}>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
  required: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div class="space-y-1.5 w-full">
    <label v-if="label" class="block text-xs font-bold text-slate-700 dark:text-slate-300">
      {{ label }}
      <span v-if="required" class="text-rose-500">*</span>
    </label>

    <div class="relative rounded-2xl">
      <div v-if="icon" class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
        <component :is="icon" :size="18" />
      </div>

      <input
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        @input="onInput"
        :class="[
          'w-full bg-white dark:bg-slate-900 border text-slate-900 dark:text-white rounded-2xl text-sm transition-all outline-none disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:cursor-not-allowed',
          icon ? 'pl-11 pr-4 py-2.5' : 'px-4 py-2.5',
          error 
            ? 'border-rose-300 dark:border-rose-800 focus:ring-4 focus:ring-rose-100 dark:focus:ring-rose-950/40' 
            : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40'
        ]"
      />
    </div>

    <p v-if="error" class="text-[11px] font-bold text-rose-500 mt-1">
      {{ error }}
    </p>
  </div>
</template>
