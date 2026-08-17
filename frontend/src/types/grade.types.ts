export interface Activity {
  id_actividadmateria: number
  nombre: string
  descripcion?: string
  porcentaje: number
  fecha_entrega?: string
  id_materia: number
  id_periodo: number
  id_grupo: number
}

export interface ActivityGrade {
  id_notactividad?: number
  id_actividadmateria: number
  id_estudiante: number
  nota: number
  observacion?: string
}

export interface FinalSubjectGrade {
  id_resultadoacademico?: number
  id_estudiante: number
  id_materia: number
  id_periodo: number
  definitiva: number
  desempeno?: string
  fallas?: number
}
