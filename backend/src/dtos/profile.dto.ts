import { z } from 'zod';

export const updatePhoneSchema = z.object({
  body: z.object({
    telefono: z.string().max(50, 'El teléfono no puede superar los 50 caracteres').nullable().optional()
  })
});

export const requestEmailChangeSchema = z.object({
  body: z.object({
    nuevo_email: z.string().email('Debe proporcionar un correo electrónico válido.')
  })
});

export const verifyEmailChangeSchema = z.object({
  body: z.object({
    nuevo_email: z.string().email('Debe proporcionar un correo electrónico válido.'),
    codigo: z.string().length(6, 'El código de verificación debe tener 6 dígitos').regex(/^\d{6}$/, 'El código debe contener únicamente números')
  })
});
