import { customRef } from 'vue'


export function useDebounce<T>(value: T, delay = 300) {
  let timeout: any
  return customRef((track, trigger) => {
    return {
      get() {
        track()
        return value
      },
      set(newValue: T) {
        clearTimeout(timeout)
        timeout = setTimeout(() => {
          value = newValue
          trigger()
        }, delay)
      }
    }
  })
}

export function useDebounceFn<T extends (...args: any[]) => any>(fn: T, delay = 300) {
  let timeout: any
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}
