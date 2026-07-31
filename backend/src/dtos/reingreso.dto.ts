import { z } from 'zod';

export const SendParentReingresoLinkSchema = z.object({
  body: z.object({
    id_estudiante: z.number({ message: 'El ID del estudiante es obligatorio' }),
    id_nivel: z.number({ message: 'El nivel escolar es obligatorio' }),
    id_grupo: z.number({ message: 'El grupo de destino es obligatorio' }),
    id_anio: z.number({ message: 'El año lectivo es obligatorio' }),
    id_ticket: z.number().optional().nullable(),
    correo_padre: z.string().email('Debe ser un correo electrónico válido'),
    observaciones: z.string().optional().nullable(),
    document_config: z.array(z.object({
      tipo_documento: z.string(),
      estado_renovacion: z.enum(['VIGENTE', 'RENOVAR']),
      url: z.string().optional().nullable()
    })).optional()
  })
});

export const NotifyNonExistentStudentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID del ticket debe ser numérico')
  }),
  body: z.object({
    motivo: z.string().optional()
  })
});

export type SendParentReingresoLinkDTO = z.infer<typeof SendParentReingresoLinkSchema>['body'];
