export interface ReingresoStudentHistory {
  student: {
    id_estudiante: number;
    nombre: string;
    apellido: string;
    documento: string;
    codigo: string | null;
    estado: string;
    motivo_estado: string | null;
    tipo_documento_nombre: string | null;
  };
  lastEnrollment: {
    id_matricula: number;
    id_nivel: number;
    id_grupo: number | null;
    anio_lectivo: string;
    nombre_nivel: string;
    nombre_grupo: string | null;
  } | null;
  parent: {
    id_padrefamilia: number;
    nombre: string;
    apellido: string;
    email: string;
    documento: string;
  } | null;
  documents: Array<{
    id_documento: number;
    tipo_documento: string;
    url: string;
    estado: string;
    estado_renovacion_sugerido: 'VIGENTE' | 'RENOVAR';
    estado_renovacion: 'VIGENTE' | 'RENOVAR';
  }>;
}

export interface SendReingresoPayload {
  id_estudiante: number;
  id_nivel: number;
  id_grupo: number;
  id_anio: number;
  id_ticket?: number | null;
  correo_padre: string;
  observaciones?: string;
  document_config?: Array<{
    tipo_documento: string;
    estado_renovacion: 'VIGENTE' | 'RENOVAR';
    url?: string | null;
  }>;
}
