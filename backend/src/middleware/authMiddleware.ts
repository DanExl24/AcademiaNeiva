import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    roles: string[];
    schoolId: number | null;
  };
}

/**
 * Middleware que verifica el token JWT y extrae la información del usuario.
 */
export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticación requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      roles: decoded.roles || [decoded.role],
      schoolId: decoded.schoolId || null,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

/**
 * Middleware que verifica que el usuario tenga el rol de Admin General.
 * Debe usarse DESPUÉS de verifyToken.
 */
export const requireAdminGeneral = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  if (!req.user.roles.includes('admin_general')) {
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador General.' });
    return;
  }

  next();
};

/**
 * Middleware que verifica que el usuario sea un directivo del colegio indicado.
 * Debe usarse DESPUÉS de verifyToken.
 */
export const requireDirectivo = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  if (!req.user.roles.includes('directivo') && !req.user.roles.includes('rector')) {
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Directivo.' });
    return;
  }

  next();
};
