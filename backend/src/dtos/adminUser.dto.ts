import { z } from 'zod';

export const createAdminUserSchema = z.object({
  body: z.object({
    rol: z.enum(['directivo', 'docente', 'padre', 'admin_general'], {
      message: 'El rol seleccionado no es válido. Los estudiantes deben crearse a través del proceso de Matrícula Institucional.'
    }),
    email: z.string().email('Debe ser un correo electrónico válido').optional().or(z.literal('')),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    apellido: z.string().optional().nullable(),
    id_colegio: z.number().optional().nullable(),
    tipo_documento: z.string().optional().nullable(),
    documento: z.string().optional().nullable(),
    telefono: z.string().optional().nullable(),
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
  })
});

