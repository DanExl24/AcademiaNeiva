"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEmailChangeSchema = exports.requestEmailChangeSchema = exports.updatePhoneSchema = void 0;
const zod_1 = require("zod");
exports.updatePhoneSchema = zod_1.z.object({
    body: zod_1.z.object({
        telefono: zod_1.z.string().max(50, 'El teléfono no puede superar los 50 caracteres').nullable().optional()
    })
});
exports.requestEmailChangeSchema = zod_1.z.object({
    body: zod_1.z.object({
        nuevo_email: zod_1.z.string().email('Debe proporcionar un correo electrónico válido.')
    })
});
exports.verifyEmailChangeSchema = zod_1.z.object({
    body: zod_1.z.object({
        nuevo_email: zod_1.z.string().email('Debe proporcionar un correo electrónico válido.'),
        codigo: zod_1.z.string().length(6, 'El código de verificación debe tener 6 dígitos').regex(/^\d{6}$/, 'El código debe contener únicamente números')
    })
});
