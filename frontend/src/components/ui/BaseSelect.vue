<script setup lang="ts">
withDefaults(defineProps<{
  modelValue?: string | number | null
  label?: string
  options?: { value: string | number; label: string; disabled?: boolean }[]
  error?: string
  disabled?: boolean
  required?: boolean
  placeholder?: string
}>(), {
  modelValue: '',
  options: () => [],
  disabled: false,
  required: false,
  placeholder: 'Seleccionar opción'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
}>()

const onChange = (e: Event) => {
  const target = e.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div class="space-y-1.5 w-full">
    <label v-if="label" class="block text-xs font-bold text-slate-700 dark:text-slate-300">
      {{ label }}
      <span v-if="required" class="text-rose-500">*</span>
    </label>

    <select
      :value="modelValue"
      :disabled="disabled"
      :required="required"
      @change="onChange"
      :class="[
        'w-full bg-white dark:bg-slate-900 border text-slate-900 dark:text-white rounded-2xl px-4 py-2.5 text-sm transition-all outline-none cursor-pointer disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:cursor-not-allowed',
        error 
          ? 'border-rose-300 dark:border-rose-800 focus:ring-4 focus:ring-rose-100 dark:focus:ring-rose-950/40' 
          : 'border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/40'
      ]"
    >
      <option value="" disabled>{{ placeholder }}</option>
      <option 
        v-for="opt in options" 
        :key="opt.value" 
        :value="opt.value"
        :disabled="opt.disabled"
        class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
      >
        {{ opt.label }}
      </option>
      <slot />
    </select>

    <p v-if="error" class="text-[11px] font-bold text-rose-500 mt-1">
      {{ error }}
    </p>
  </div>
</template>
