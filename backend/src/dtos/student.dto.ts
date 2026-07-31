import { z } from 'zod';

export const UpdateStudentStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID de estudiante debe ser numérico')
  }),
  body: z.object({
    estado: z.enum(['ACTIVO', 'INACTIVO', 'SANCIONADO', 'EXPULSADO', 'RETIRADO', 'GRADUADO']),
    motivo: z.string().optional(),
    motivo_cambio: z.string().optional(),
    id_tipo_sancion: z.number().optional().nullable(),
    fecha_inicio: z.string().optional().nullable(),
    fecha_fin: z.string().optional().nullable(),
    observaciones: z.string().optional().nullable()
  })
});

export const ChangeStudentGradeSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID de estudiante debe ser numérico')
  }),
  body: z.object({
    id_grupo: z.number({ message: 'El grupo de destino es obligatorio' }),
    id_nivel: z.number({ message: 'El nivel escolar es obligatorio' }),
    motivo: z.string().min(3, 'El motivo del cambio debe tener al menos 3 caracteres')
  })
});

export type UpdateStudentStatusDTO = z.infer<typeof UpdateStudentStatusSchema>['body'];
export type ChangeStudentGradeDTO = z.infer<typeof ChangeStudentGradeSchema>['body'];
