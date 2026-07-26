/**
 * Validation and sanitization helpers for form inputs across Academia Neiva
 */

/**
 * Sanitizes input string to allow only letters (including Spanish accents) and spaces.
 * Prevents digits, symbols, and punctuation.
 */
export function sanitizeLettersOnly(val: string): string {
  if (!val) return ''
  // Keep only Spanish letters, accents and spaces
  return val.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '').replace(/\s+/g, ' ')
}

/**
 * Sanitizes document number input to allow only alphanumeric characters and hyphens.
 * Disallows spaces and special symbols.
 */
export function sanitizeDocumentNumber(val: string): string {
  if (!val) return ''
  return val.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
}

/**
 * Sanitizes input to allow digits only.
 */
export function sanitizeDigitsOnly(val: string): string {
  if (!val) return ''
  return val.replace(/[^0-9]/g, '')
}

/**
 * Validates email format using standard regex.
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email.trim())
}
