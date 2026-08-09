"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancelEnrollmentSchema = exports.FinalizeEnrollmentSchema = exports.ValidateDocumentSchema = exports.SubmitEnrollmentSchema = exports.EstadoMatriculaSchema = exports.TipoMatriculaSchema = void 0;
const zod_1 = require("zod");
const documentValidation_1 = require("../utils/documentValidation");
exports.TipoMatriculaSchema = zod_1.z.enum([
    'REGULAR',
    'RENOVACION',
    'REINGRESO',
    'EXTRAORDINARIA',
    'TRASLADADA'
]);
exports.EstadoMatriculaSchema = zod_1.z.enum([
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
exports.SubmitEnrollmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        id_colegio: zod_1.z.number({ message: 'El ID del colegio es obligatorio' }),
        id_nivel: zod_1.z.number({ message: 'El ID del nivel es obligatorio' }),
        id_anio: zod_1.z.number({ message: 'El ID del año lectivo es obligatorio' }),
        correo_padre: zod_1.z.string().email('Debe ingresar un correo válido'),
        student_firstname: zod_1.z.string().min(2, 'El nombre debe contener al menos 2 caracteres'),
        student_lastname: zod_1.z.string().min(2, 'El apellido debe contener al menos 2 caracteres'),
        student_document: zod_1.z.string().min(1, 'El documento del estudiante es obligatorio'),
        student_id_tipodocumento: zod_1.z.number().optional().nullable(),
        parent_firstname: zod_1.z.string().optional().nullable(),
        parent_lastname: zod_1.z.string().optional().nullable(),
        parent_document: zod_1.z.string().optional().nullable(),
        parent_id_tipodocumento: zod_1.z.number().optional().nullable(),
    }).superRefine((data, ctx) => {
        if (data.student_document) {
            const check = (0, documentValidation_1.validateDocumentFormatByTipo)(data.student_document, data.student_id_tipodocumento);
            if (!check.isValid) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: check.error || 'El número de documento del estudiante no es correcto.',
                    path: ['student_document']
                });
            }
        }
        if (data.parent_document && data.parent_document.trim()) {
            const check = (0, documentValidation_1.validateDocumentFormatByTipo)(data.parent_document, data.parent_id_tipodocumento);
            if (!check.isValid) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: check.error || 'El número de documento del acudiente no es correcto.',
                    path: ['parent_document']
                });
            }
        }
    })
});
exports.ValidateDocumentSchema = zod_1.z.object({
    params: zod_1.z.object({
        idDocumento: zod_1.z.string().regex(/^\d+$/, 'El ID del documento debe ser numérico')
    }),
    body: zod_1.z.object({
        estado: zod_1.z.enum(['PENDIENTE', 'VALIDADO', 'RECHAZADO']),
        motivo: zod_1.z.string().optional().nullable()
    })
});
exports.FinalizeEnrollmentSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().regex(/^\d+$/, 'El ID de matrícula debe ser numérico')
    }),
    body: zod_1.z.object({
        student: zod_1.z.object({
            nombre: zod_1.z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
            apellido: zod_1.z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
            documento: zod_1.z.string().min(1, 'El documento del estudiante es obligatorio'),
            id_tipodocumento: zod_1.z.number().optional()
        }),
        parent: zod_1.z.object({
            nombre: zod_1.z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
            apellido: zod_1.z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
            documento: zod_1.z.string().min(1, 'El documento del acudiente es obligatorio'),
            id_tipodocumento: zod_1.z.number().optional()
        }),
        id_grado: zod_1.z.number().optional().nullable(),
        existing_parent_user_id: zod_1.z.number().optional().nullable(),
        id_estudiante: zod_1.z.number().optional().nullable()
    }).superRefine((data, ctx) => {
        const sCheck = (0, documentValidation_1.validateDocumentFormatByTipo)(data.student.documento, data.student.id_tipodocumento);
        if (!sCheck.isValid) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: sCheck.error || 'El número de documento del estudiante no es correcto.',
                path: ['student', 'documento']
            });
        }
        const pCheck = (0, documentValidation_1.validateDocumentFormatByTipo)(data.parent.documento, data.parent.id_tipodocumento);
        if (!pCheck.isValid) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: pCheck.error || 'El número de documento del acudiente no es correcto.',
                path: ['parent', 'documento']
            });
        }
    })
});
exports.CancelEnrollmentSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().regex(/^\d+$/, 'El ID de matrícula debe ser numérico')
    }),
    body: zod_1.z.object({
        motivo: zod_1.z.string().min(2, 'El motivo de la cancelación es obligatorio'),
        detalles: zod_1.z.string().optional().nullable(),
        estado_estudiante: zod_1.z.enum(['RETIRADO', 'EXPULSADO']).default('RETIRADO')
    })
});
