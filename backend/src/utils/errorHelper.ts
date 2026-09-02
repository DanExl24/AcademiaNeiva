/**
 * Utilidad para formatear mensajes de error amables y amigables con el usuario,
 * previniendo la exposición de detalles técnicos o restricciones de SQL.
 */
export const formatFriendlyErrorMessage = (
  error: any,
  defaultMsg: string = "Ocurrió un error inesperado al procesar la solicitud. Por favor intente nuevamente."
): string => {
  if (!error) return defaultMsg;

  // 1. Captura de violaciones de clave única en PostgreSQL (Código 23505)
  if (error.code === '23505') {
    const constraint = String(error.constraint || error.detail || '');
    if (constraint.includes('docente_id_usuario_key') || constraint.includes('docente_id_usuario_id_colegio_key')) {
      return "El usuario seleccionado ya se encuentra registrado como docente en esta institución.";
    }
    if (constraint.includes('usuario_email_key') || constraint.includes('email')) {
      return "El correo electrónico ingresado ya se encuentra registrado en la plataforma por otro usuario.";
    }
    if (constraint.includes('usuario_documento_key') || constraint.includes('documento')) {
      return "El número de documento de identidad ingresado ya se encuentra registrado por otro usuario en la plataforma.";
    }
    if (constraint.includes('estudiante_codigo_key') || constraint.includes('codigo')) {
      return "El código institucional ingresado ya está registrado en la plataforma.";
    }
    if (constraint.includes('estudiante_id_usuario_key')) {
      return "El usuario ya se encuentra vinculado a un perfil de estudiante en el sistema.";
    }
    if (constraint.includes('padre_familia_id_usuario_key')) {
      return "El usuario ya se encuentra vinculado a un perfil de padre de familia en el sistema.";
    }
    return "Ya existe un usuario o registro en la plataforma con la misma información de correo o documento.";
  }

  // 2. Si el error proviene de una validación personalizada del backend
  if (typeof error.message === 'string' && error.message.trim()) {
    const msg = error.message.trim();
    const isTechnical = /duplicate key|unique constraint|foreign key|syntax error|relation ".*" does not exist|column ".*" does not exist|violates check constraint|invalid input syntax|eval/i.test(msg);
    if (!isTechnical) {
      return msg;
    }
  }

  return defaultMsg;
};

/**
 * Sanitiza y repara strings con doble codificación o caracteres mojibake UTF-8
 */
export const cleanMojibake = (str: string | null | undefined): string => {
  if (!str || typeof str !== 'string') return '';
  if (/[\u00C2\u00C3\u00C4\u00C5\u00E2]/.test(str)) {
    try {
      const fixed = Buffer.from(str, 'latin1').toString('utf8');
      if (!fixed.includes('\uFFFD')) {
        return fixed;
      }
    } catch {
      return str;
    }
  }
  return str;
};
