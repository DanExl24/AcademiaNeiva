<script setup lang="ts">


interface Props {
  modelValue?: string | number | null
  label?: string
  placeholder?: string
  type?: string
  error?: string
  hint?: string
  disabled?: boolean
  required?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: '',
  placeholder: '',
  type: 'text',
  error: '',
  hint: '',
  disabled: false,
  required: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div class="flex flex-col gap-1.5 w-full">
    <label v-if="label" class="text-xs font-semibold text-slate-700 dark:text-slate-200">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <div class="relative flex items-center">
      <div v-if="$slots.prefix" class="absolute left-3 text-slate-400">
        <slot name="prefix" />
      </div>
      <input
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        @input="handleInput"
        :class="[
          'w-full bg-white dark:bg-slate-900 border rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 dark:disabled:bg-slate-800',
          $slots.prefix ? 'pl-9' : '',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-400/30 dark:border-red-600'
            : 'border-slate-300 dark:border-slate-700 focus:border-brand-primary focus:ring-brand-primary/20'
        ]"
      />
      <div v-if="$slots.suffix" class="absolute right-3 text-slate-400">
        <slot name="suffix" />
      </div>
    </div>
    <p v-if="error" class="text-xs text-red-500 font-medium">{{ error }}</p>
    <p v-else-if="hint" class="text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
