export interface Enrollment {
  id_matricula: number
  codigo_matricula?: string
  id_estudiante?: number
  id_colegio: number
  id_anio: number
  id_grupo?: number
  id_nivel?: number
  nombre_estudiante?: string
  apellido_estudiante?: string
  documento_estudiante?: string
  correo_padre: string
  telefono_acudiente?: string
  telefono_estudiante?: string
  token_seguimiento: string
  estado: 'PENDIENTE' | 'CORRECCION' | 'APROBADA' | 'ACTIVA' | 'RECHAZADA' | 'CANCELADA' | 'TRASLADADA' | 'CULMINADA'
  fecha_solicitud?: string
}

export interface EnrollmentDocument {
  id_documentomatricula: number
  id_matricula: number
  id_tipodocumentoanexo: number
  nombre_archivo: string
  url_archivo?: string
  estado: 'PENDIENTE' | 'VALIDADO' | 'RECHAZADO' | 'VIGENTE'
  motivo_rechazo?: string
}
