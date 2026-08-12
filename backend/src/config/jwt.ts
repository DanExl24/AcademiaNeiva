import dotenv from "dotenv";
dotenv.config();

/**
 * Obtiene y valida la clave secreta de JWT (JWT_SECRET).
 * En entornos de producción, lanza un error fatal si la clave está ausente o es débil.
 * En entornos de desarrollo, emite una advertencia de seguridad si se usa un valor provisional.
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret || secret.trim() === "" || secret === "fallback-secret") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY ERROR: La variable de entorno JWT_SECRET no está configurada o usa una clave por defecto en producción."
      );
    }
    console.warn(
      "⚠️ [SEGURIDAD]: JWT_SECRET no está definida en el entorno. Se utiliza una clave provisional de desarrollo."
    );
    return "academianeiva-dev-jwt-secret-key-2026";
  }

  return secret;
};

export const JWT_SECRET = getJwtSecret();
