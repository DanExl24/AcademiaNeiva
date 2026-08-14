export function formatFullName(nombre?: string | null, apellido?: string | null): string {
  const n = (nombre || '').trim()
  const a = (apellido || '').trim()
  if (!n && !a) return '—'
  return `${n} ${a}`.trim()
}

export function formatDocument(documento?: string | null, tipo?: string | null): string {
  if (!documento) return 'Sin documento'
  if (!tipo) return documento
  return `${tipo}: ${documento}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(amount)
}
