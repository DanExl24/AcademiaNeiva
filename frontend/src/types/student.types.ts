export interface Student {
  id_estudiante: number
  id_usuario?: number
  nombre: string
  apellido: string
  codigo: string
  documento?: string
  id_tipodocumento?: number
  tipo_documento_nombre?: string
  fecha_nacimiento?: string
  genero?: string
  direccion?: string
  telefono?: string
  id_detallegrado?: number
  grado_nombre?: string
  seccion?: string
  jornada_nombre?: string
  estado: 'ACTIVO' | 'INACTIVO' | 'RETIRADO' | 'GRADUADO' | 'SANCIONADO' | 'PENDIENTE'
  foto_url?: string
}

export interface StudentSanction {
  id_sancion?: number
  id_estudiante: number
  tipo: string
  motivo: string
  fecha_inicio: string
  fecha_fin: string
  hasta?: string
  estado: 'ACTIVA' | 'CUMPLIDA' | 'REVOCADA'
}

export interface AttendanceRecord {
  id_asistencia?: number
  id_estudiante: number
  id_detallegrado: number
  id_materia?: number
  fecha: string
  estado: 'PRESENTE' | 'AUSENTE' | 'TARDANZA' | 'JUSTIFICADA'
  observaciones?: string
}

export interface ObservationRecord {
  id_observacion?: number
  id_estudiante: number
  id_docente: number
  fecha: string
  tipo: 'ACADEMICA' | 'DISCIPLINARIA' | 'POSITIVA'
  titulo: string
  descripcion: string
  compromiso?: string
  docente_nombre?: string
}
