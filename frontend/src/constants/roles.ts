export const ROLES = {
  ADMIN: 'admin',
  ADMIN_GENERAL: 'admin_general',
  DIRECTIVO: 'directivo',
  DOCENTE: 'docente',
  ESTUDIANTE: 'estudiante',
  PADRE: 'padre'
} as const

export type RoleType = typeof ROLES[keyof typeof ROLES]

