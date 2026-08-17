export interface AcademicYear {
  id_anio: number
  anio: number
  nombre?: string
  fecha_inicio: string
  fecha_fin: string
  estado: 'ABIERTO' | 'CERRADO'
  id_colegio: number
}

export interface AcademicPeriod {
  id_periodo: number
  id_anio: number
  numero_periodo: number
  nombre: string
  porcentaje: number
  fecha_inicio: string
  fecha_fin: string
  estado: 'PENDIENTE' | 'ABIERTO' | 'CERRADO'
  id_colegio: number
}

export interface AcademicScale {
  id_escala?: number
  id_colegio: number
  nombre_escala: string
  nota_minima: number
  nota_maxima: number
  nota_aprobacion: number
}

export interface Subject {
  id_materia: number
  nombre: string
  codigo?: string
  area?: string
  ih?: number
  id_colegio: number
}

export interface GradeGroup {
  id_grupo: number
  nombre_grupo: string
  id_grado: number
  nombre_grado?: string
  id_colegio: number
  cupos_maximos?: number
}
