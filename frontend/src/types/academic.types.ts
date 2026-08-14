export interface AcademicYear {
  id_anio: number
  calendario: number | string
  estado: 'ACTIVO' | 'CERRADO'
  id_colegio: number
  fecha_inicio?: string
  fecha_fin?: string
}

export interface Period {
  id_periodo: number
  id_anio?: number
  nombre: string
  numero?: number
  porcentaje: number
  estado: 'ABIERTO' | 'CERRADO'
  fecha_inicio?: string
  fecha_fin?: string
  fecha_cierre?: string
}

export interface NivelAcademico {
  id_nivel: number
  nombre: string
  id_colegio?: number
}

export interface TipoGrado {
  id_tipogrado: number
  nombre: string
  id_nivel: number
}

export interface DetalleGrado {
  id_detallegrado: number
  id_grado?: number
  grado_nombre: string
  seccion: string
  jornada_nombre: string
  id_nivel?: number
  nivel_nombre?: string
  cupo_maximo?: number
  cupos_disponibles?: number
}

export interface Subject {
  id_materia: number
  nombre: string
  id_area?: number
  area_nombre?: string
  horas_semanales?: number
  porcentaje_area?: number
  es_obligatoria?: boolean
}

export interface Competency {
  id_competencia: number
  descripcion: string
  id_periodo: number
  id_detallegrado?: number
  id_materia?: number
  evidencias_dba?: number[]
}

export interface DBAEvidence {
  id_evidencia: number
  id_dba?: number
  codigo?: string
  descripcion: string
  orden: number
}
