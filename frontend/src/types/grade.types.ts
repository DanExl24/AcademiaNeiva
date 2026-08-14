export interface Criterion {
  id_criterio: number
  id_actividadmateria: number
  id_evidencia: number | null
  descripcion: string
  porcentaje: number | string
}

export interface Activity {
  id_actividadmateria: number
  nombre: string
  porcentaje: string | number
  id_competencia: number
  id_evidencia: number | null
  fecha_limite?: string
  evidencias_dba?: number[]
  criterios?: Criterion[]
}

export interface GradeScale {
  id_escala: number
  nombre: string
  abreviatura?: string
  nota_minima: number
  nota_maxima: number
  id_colegio?: number
  es_aprobatoria?: boolean
  color?: string
}

export interface CourseAssignment {
  id_grado: number
  grado_nombre: string
  seccion: string
  id_materia: number
  materia_nombre: string
  id_detallegrado: number
  jornada_nombre: string
  id_docente?: number
}

export interface StudentGradeRow {
  id_estudiante: number
  nombre: string
  apellido: string
  codigo: string
  calificaciones: Record<number, number | null> // activity_id -> score
  calificaciones_criterios?: Record<number, Record<number, number | null>> // activity_id -> criterion_id -> score
  definitiva?: number | null
  escala_desempeno?: string
}
