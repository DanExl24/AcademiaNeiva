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
 * Middleware para validar el token firmado de acceso a documentos.
 * Previene IDOR y escaneo público sin autorización.
 */
export const verifyDocumentToken = (req: Request, res: Response, next: NextFunction): void => {
  const { idDocumento } = req.params;
  const token = (req.query.token as string) || (req.headers["x-doc-token"] as string);

  if (!token) {
    res.status(403).json({
      error: "Acceso denegado: Se requiere un token firmado para visualizar este documento."
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (!decoded || decoded.type !== "doc_access") {
      res.status(403).json({
        error: "Acceso denegado: Token de acceso no válido."
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
