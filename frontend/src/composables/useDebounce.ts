import { ref, watch, type Ref } from 'vue'

export function useDebouncedRef<T>(source: Ref<T>, delay = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timeout: any = null

  watch(source, (newVal) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      debounced.value = newVal
    }, delay)
  })

  return debounced
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay = 300): (...args: Parameters<T>) => void {
  let timeout: any = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}
