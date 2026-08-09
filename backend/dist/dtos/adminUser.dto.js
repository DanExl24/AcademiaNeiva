"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAdminUserSchema = void 0;
const zod_1 = require("zod");
const documentValidation_1 = require("../utils/documentValidation");
exports.createAdminUserSchema = zod_1.z.object({
    body: zod_1.z.object({
        rol: zod_1.z.enum(['directivo', 'docente', 'padre', 'admin_general'], {
            message: 'El rol seleccionado no es válido. Los estudiantes deben crearse a través del proceso de Matrícula Institucional.'
        }),
        email: zod_1.z.string().email('Debe ser un correo electrónico válido').optional().or(zod_1.z.literal('')),
        password: zod_1.z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
        nombre: zod_1.z.string()
            .min(2, 'El nombre debe tener al menos 2 caracteres')
            .regex(/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,50}$/, 'El nombre solo puede contener letras y espacios'),
        apellido: zod_1.z.string()
            .regex(/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,50}$/, 'El apellido solo puede contener letras y espacios')
            .optional()
            .nullable()
            .or(zod_1.z.literal('')),
        id_colegio: zod_1.z.number().optional().nullable(),
        tipo_documento: zod_1.z.string().optional().nullable(),
        documento: zod_1.z.string().optional().nullable().or(zod_1.z.literal('')),
        telefono: zod_1.z.string()
            .regex(/^[0-9+()\s-]{7,20}$/, 'El número de teléfono debe tener un formato válido (7 a 20 dígitos)')
            .optional()
            .nullable()
            .or(zod_1.z.literal('')),
    }).refine((data) => {
        // Para todos los roles, el email es obligatorio
        if (!data.email || !data.email.trim()) {
            return false;
        }
        return true;
    }, {
        message: 'El correo electrónico es obligatorio.',
        path: ['email']
    }).refine((data) => {
        // Para directivo, docente, padre: id_colegio es obligatorio
        if (data.rol !== 'admin_general' && !data.id_colegio) {
            return false;
        }
        return true;
    }, {
        message: 'Debe seleccionar una institución educativa para este rol.',
        path: ['id_colegio']
    }).superRefine((data, ctx) => {
        if (data.documento && data.documento.trim()) {
            const check = (0, documentValidation_1.validateDocumentFormatByTipo)(data.documento, data.tipo_documento);
            if (!check.isValid) {
                ctx.addIssue({
                    code: zod_1.z.ZodIssueCode.custom,
                    message: check.error || 'El número de documento de identidad no es correcto.',
                    path: ['documento']
                });
            }
        }
    })
});
