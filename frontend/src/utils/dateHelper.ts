export function formatDate(dateString?: string | Date | null, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return '—'
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (isNaN(date.getTime())) return '—'

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options
  }

  return date.toLocaleDateString('es-CO', defaultOptions)
}

export function formatDateTime(dateString?: string | Date | null): string {
  if (!dateString) return '—'
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (isNaN(date.getTime())) return '—'

  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export function formatTime(dateString?: string | Date | null): string {
  if (!dateString) return '—'
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  if (isNaN(date.getTime())) return '—'

  return date.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
}
