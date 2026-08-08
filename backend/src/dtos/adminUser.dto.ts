import { z } from 'zod';
import { validateDocumentFormatByTipo } from '../utils/documentValidation';

export const createAdminUserSchema = z.object({
  body: z.object({
    rol: z.enum(['directivo', 'docente', 'padre', 'admin_general'], {
      message: 'El rol seleccionado no es válido. Los estudiantes deben crearse a través del proceso de Matrícula Institucional.'
    }),
    email: z.string().email('Debe ser un correo electrónico válido').optional().or(z.literal('')),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    nombre: z.string()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .regex(/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,50}$/, 'El nombre solo puede contener letras y espacios'),
    apellido: z.string()
      .regex(/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,50}$/, 'El apellido solo puede contener letras y espacios')
      .optional()
      .nullable()
      .or(z.literal('')),
    id_colegio: z.number().optional().nullable(),
    tipo_documento: z.string().optional().nullable(),
    documento: z.string().optional().nullable().or(z.literal('')),
    telefono: z.string()
      .regex(/^[0-9+()\s-]{7,20}$/, 'El número de teléfono debe tener un formato válido (7 a 20 dígitos)')
      .optional()
      .nullable()
      .or(z.literal('')),
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
  }).refine((data) => {
    if (data.documento && data.documento.trim()) {
      const check = validateDocumentFormatByTipo(data.documento, data.tipo_documento);
      return check.isValid;
    }
    return true;
  }, {
    message: 'El número de documento no cumple con el formato requerido para el tipo de documento seleccionado.',
    path: ['documento']
  })
});

