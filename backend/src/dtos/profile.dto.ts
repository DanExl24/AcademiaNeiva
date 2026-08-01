import { z } from 'zod';

export const updatePhoneSchema = z.object({
  telefono: z.string().max(50, 'El teléfono no puede superar los 50 caracteres').nullable().optional()
});
