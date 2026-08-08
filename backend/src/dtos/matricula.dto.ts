import { z } from 'zod';
import { validateDocumentFormatByTipo } from '../utils/documentValidation';

export const TipoMatriculaSchema = z.enum([
  'REGULAR',
  'RENOVACION',
  'REINGRESO',
  'EXTRAORDINARIA',
  'TRASLADADA'
]);

export const EstadoMatriculaSchema = z.enum([
  'PENDIENTE',
  'CORRECCION',
  'CORREGIDA',
  'APROBADA',
  'ACTIVA',
  'RECHAZADA',
  'CANCELADA',
  'TRASLADADA',
  'CULMINADA'
]);

export type TipoMatriculaDTO = z.infer<typeof TipoMatriculaSchema>;
export type EstadoMatriculaDTO = z.infer<typeof EstadoMatriculaSchema>;

export const SubmitEnrollmentSchema = z.object({
  body: z.object({
    id_colegio: z.number({ message: 'El ID del colegio es obligatorio' }),
    id_nivel: z.number({ message: 'El ID del nivel es obligatorio' }),
    id_anio: z.number({ message: 'El ID del año lectivo es obligatorio' }),
    correo_padre: z.string().email('Debe ingresar un correo válido'),
    student_firstname: z.string().min(2, 'El nombre debe contener al menos 2 caracteres'),
    student_lastname: z.string().min(2, 'El apellido debe contener al menos 2 caracteres'),
    student_document: z.string().min(1, 'El documento del estudiante es obligatorio'),
    student_id_tipodocumento: z.number().optional().nullable(),
    parent_firstname: z.string().optional().nullable(),
    parent_lastname: z.string().optional().nullable(),
    parent_document: z.string().optional().nullable(),
    parent_id_tipodocumento: z.number().optional().nullable(),
  }).superRefine((data, ctx) => {
    if (data.student_document) {
      const check = validateDocumentFormatByTipo(data.student_document, data.student_id_tipodocumento);
      if (!check.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.error || 'El número de documento del estudiante no es correcto.',
          path: ['student_document']
        });
      }
    }
    if (data.parent_document && data.parent_document.trim()) {
      const check = validateDocumentFormatByTipo(data.parent_document, data.parent_id_tipodocumento);
      if (!check.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.error || 'El número de documento del acudiente no es correcto.',
          path: ['parent_document']
        });
      }
    }
  })
});

export const ValidateDocumentSchema = z.object({
  params: z.object({
    idDocumento: z.string().regex(/^\d+$/, 'El ID del documento debe ser numérico')
  }),
  body: z.object({
    estado: z.enum(['PENDIENTE', 'VALIDADO', 'RECHAZADO']),
    motivo: z.string().optional().nullable()
  })
});

export const FinalizeEnrollmentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID de matrícula debe ser numérico')
  }),
  body: z.object({
    student: z.object({
      nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
      apellido: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
      documento: z.string().min(1, 'El documento del estudiante es obligatorio'),
      id_tipodocumento: z.number().optional()
    }),
    parent: z.object({
      nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
      apellido: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
      documento: z.string().min(1, 'El documento del acudiente es obligatorio'),
      id_tipodocumento: z.number().optional()
    }),
    id_grado: z.number().optional().nullable(),
    existing_parent_user_id: z.number().optional().nullable(),
    id_estudiante: z.number().optional().nullable()
  }).superRefine((data, ctx) => {
    const sCheck = validateDocumentFormatByTipo(data.student.documento, data.student.id_tipodocumento);
    if (!sCheck.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: sCheck.error || 'El número de documento del estudiante no es correcto.',
        path: ['student', 'documento']
      });
    }
    const pCheck = validateDocumentFormatByTipo(data.parent.documento, data.parent.id_tipodocumento);
    if (!pCheck.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: pCheck.error || 'El número de documento del acudiente no es correcto.',
        path: ['parent', 'documento']
      });
    }
  })
});

export type SubmitEnrollmentDTO = z.infer<typeof SubmitEnrollmentSchema>['body'];
export type FinalizeEnrollmentDTO = z.infer<typeof FinalizeEnrollmentSchema>['body'];

export const CancelEnrollmentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID de matrícula debe ser numérico')
  }),
  body: z.object({
    motivo: z.string().min(2, 'El motivo de la cancelación es obligatorio'),
    detalles: z.string().optional().nullable(),
    estado_estudiante: z.enum(['RETIRADO', 'EXPULSADO']).default('RETIRADO')
  })
});

export type CancelEnrollmentDTO = z.infer<typeof CancelEnrollmentSchema>['body'];
