"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifyNonExistentStudentSchema = exports.SendParentReingresoLinkSchema = void 0;
const zod_1 = require("zod");
exports.SendParentReingresoLinkSchema = zod_1.z.object({
    body: zod_1.z.object({
        id_estudiante: zod_1.z.number({ message: 'El ID del estudiante es obligatorio' }),
        id_nivel: zod_1.z.number({ message: 'El nivel escolar es obligatorio' }),
        id_grupo: zod_1.z.number({ message: 'El grupo de destino es obligatorio' }),
        id_anio: zod_1.z.number({ message: 'El año lectivo es obligatorio' }),
        id_ticket: zod_1.z.number().optional().nullable(),
        correo_padre: zod_1.z.string().email('Debe ser un correo electrónico válido'),
        observaciones: zod_1.z.string().optional().nullable(),
        document_config: zod_1.z.array(zod_1.z.object({
            tipo_documento: zod_1.z.string(),
            estado_renovacion: zod_1.z.enum([
                'VIGENTE',
                'RENOVAR',
                'RECOMENDADO_ACTUALIZAR',
                'OBLIGATORIO_ACTUALIZAR',
                'DESACTUALIZADO_POR_FECHA'
            ]),
            url: zod_1.z.string().optional().nullable()
        })).optional()
    })
});
exports.NotifyNonExistentStudentSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().regex(/^\d+$/, 'El ID del ticket debe ser numérico')
    }),
    body: zod_1.z.object({
        motivo: zod_1.z.string().optional()
    })
});
