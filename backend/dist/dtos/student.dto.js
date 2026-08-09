"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeStudentGradeSchema = exports.UpdateStudentStatusSchema = void 0;
const zod_1 = require("zod");
exports.UpdateStudentStatusSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().regex(/^\d+$/, 'El ID de estudiante debe ser numérico')
    }),
    body: zod_1.z.object({
        estado: zod_1.z.enum(['ACTIVO', 'INACTIVO', 'SANCIONADO', 'EXPULSADO', 'RETIRADO', 'GRADUADO']),
        motivo: zod_1.z.string().optional(),
        motivo_cambio: zod_1.z.string().optional(),
        id_tipo_sancion: zod_1.z.number().optional().nullable(),
        fecha_inicio: zod_1.z.string().optional().nullable(),
        fecha_fin: zod_1.z.string().optional().nullable(),
        observaciones: zod_1.z.string().optional().nullable()
    })
});
exports.ChangeStudentGradeSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().regex(/^\d+$/, 'El ID de estudiante debe ser numérico')
    }),
    body: zod_1.z.object({
        id_grupo: zod_1.z.number({ message: 'El grupo de destino es obligatorio' }),
        id_nivel: zod_1.z.number({ message: 'El nivel escolar es obligatorio' }),
        motivo: zod_1.z.string().min(3, 'El motivo del cambio debe tener al menos 3 caracteres')
    })
});
