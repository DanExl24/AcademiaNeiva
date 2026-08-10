import { z } from 'zod';

export const CreateTrasladoSchema = z.object({
  tipo: z.enum(['TRASLADO_USUARIO', 'TRASLADO_MATRICULA']).default('TRASLADO_USUARIO'),
  id_usuario: z.number().positive({ message: 'El ID de usuario es obligatorio' }),
  id_colegio_origen: z.number().positive({ message: 'El ID de colegio origen es obligatorio' }),
  id_colegio_destino: z.number().positive({ message: 'El ID de colegio destino es obligatorio' }),
  id_matricula: z.number().positive().optional().nullable(),
  motivo: z.string().min(5, { message: 'El motivo debe contener al menos 5 caracteres' })
}).refine(data => data.id_colegio_origen !== data.id_colegio_destino, {
  message: 'La institución de origen y destino deben ser diferentes',
  path: ['id_colegio_destino']
});

export const ApproveTrasladoSchema = z.object({
  accion: z.enum(['APROBAR', 'RECHAZAR', 'CANCELAR']),
  comentario: z.string().optional().nullable()
});

export const FilterTrasladoSchema = z.object({
  estado: z.enum(['SOLICITADA', 'EN_APROBACION', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'EJECUTADA']).optional(),
  tipo: z.enum(['TRASLADO_USUARIO', 'TRASLADO_MATRICULA']).optional(),
  id_colegio: z.number().positive().optional()
});

export type CreateTrasladoInput = z.infer<typeof CreateTrasladoSchema>;
export type ApproveTrasladoInput = z.infer<typeof ApproveTrasladoSchema>;
export type FilterTrasladoInput = z.infer<typeof FilterTrasladoSchema>;
