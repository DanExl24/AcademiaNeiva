export interface Student {
  id_estudiante: number
  codigo: string
  nombre: string
  apellido: string
  documento: string
  id_tipodocumento?: number
  tipo_documento?: string
  telefono?: string
  direccion?: string
  fecha_nacimiento?: string
  estado: 'ACTIVO' | 'INACTIVO' | 'RETIRADO' | 'EXPULSADO' | 'SANCIONADO' | 'GRADUADO'
  id_colegio: number
  id_usuario?: number
  id_grupo?: number
  nombre_grupo?: string
  nombre_grado?: string
  motivo_estado?: string
}

export interface StudentObservation {
  id_observacion?: number
  id_estudiante: number
  id_periodo: number
  id_docente?: number
  tipo: 'ACADEMICA' | 'CONVIVENCIA' | 'DISCIPLINARIA' | 'OTRO'
  descripcion: string
  fecha: string
}
