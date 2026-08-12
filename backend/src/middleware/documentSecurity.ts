import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

/**
 * Genera un token firmado de corta duración (30 minutos) para acceder a un documento específico.
 */
export const generateDocumentAccessToken = (idDocumento: number, expiresInMinutes: number = 30): string => {
  return jwt.sign(
    {
      id_documento: idDocumento,
      type: "doc_access"
    },
    JWT_SECRET,
    { expiresIn: `${expiresInMinutes}m` }
  );
};

/**
 * Middleware híbrido para validar el acceso a documentos.
 * 
 * 1. Acceso para Directivos / Admins: Si el usuario tiene una sesión activa (Token Bearer / x-auth-token),
 *    se le permite el acceso ilimitado en cualquier momento.
 * 2. Acceso por URL Firmada Temporal: Si se consulta vía enlace o visor con ?token=..., se valida la firma HMAC
 *    y caducidad del token de corta duración.
 * 3. Cualquier intento de acceso público sin token o con ID alterado es bloqueado con 403 Forbidden (Anti-IDOR).
 */
export const verifyDocumentToken = (req: Request, res: Response, next: NextFunction): void => {
  const { idDocumento } = req.params;

  // 1. Verificar si la solicitud incluye un token de sesión de usuario de la plataforma (Directivos / Admins)
  const authHeader = req.headers.authorization || (req.headers["x-auth-token"] as string) || (req.query.authToken as string);
  if (authHeader) {
    const userToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
    try {
      const userDecoded = jwt.verify(userToken, JWT_SECRET) as any;
      if (userDecoded && userDecoded.id_usuario) {
        // Usuario autenticado en la plataforma (Directivo, Admin, Docente) -> Acceso concedido siempre
        next();
        return;
      }
    } catch {
      // Si el token de usuario falló, continuar a la verificación por token firmado de documento
    }
  }

  // 2. Verificar token de acceso firmado específico del documento (?token=...)
  const docToken = (req.query.token as string) || (req.headers["x-doc-token"] as string);

  if (!docToken) {
    res.status(403).json({
      error: "Acceso denegado: Se requiere sesión de directivo o token firmado válido para visualizar este documento."
    });
    return;
  }

  try {
    const decoded = jwt.verify(docToken, JWT_SECRET) as any;

    if (!decoded || decoded.type !== "doc_access") {
      res.status(403).json({
        error: "Acceso denegado: Token de acceso a documento no válido."
      });
      return;
    }

    if (Number(decoded.id_documento) !== Number(idDocumento)) {
      res.status(403).json({
        error: "Acceso denegado: El token no pertenece a este documento."
      });
      return;
    }

    next();
  } catch (error: any) {
    res.status(403).json({
      error: "Acceso denegado: Token de documento expirado o alterado."
    });
  }
};
