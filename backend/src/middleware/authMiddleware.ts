import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    roles: string[];
    schoolId: number | null;
    schoolIds?: number[];
    jti?: string;
  };
}

/**
 * Middleware que verifica el token JWT, valida si está en la lista negra, y extrae la información del usuario.
 */
export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticación requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Verificar si el token ha sido invalidado (blacklist)
    if (decoded.jti) {
      const blacklistRes = await pool.query(
        'SELECT 1 FROM token_blacklist WHERE jti = $1',
        [decoded.jti]
      );
      if (blacklistRes.rows.length > 0) {
        res.status(401).json({ error: 'Sesión invalidada por cierre forzado' });
        return;
      }
    }

    // Verificar estado del usuario e invalidación global en la base de datos
    const userDbRes = await pool.query(
      'SELECT estado, logged_out_at FROM usuario WHERE id_usuario = $1',
      [decoded.id]
    );

    if (userDbRes.rows.length === 0) {
      res.status(401).json({ error: 'Usuario no encontrado' });
      return;
    }

    const dbUser = userDbRes.rows[0];

    if (dbUser.estado !== 'ACTIVO') {
      res.status(401).json({ error: 'Tu cuenta se encuentra inactiva o suspendida.' });
      return;
    }

    if (dbUser.logged_out_at && decoded.iat) {
      const loggedOutTime = new Date(dbUser.logged_out_at).getTime();
      const tokenIssuedTime = decoded.iat * 1000;
      if (tokenIssuedTime < loggedOutTime) {
        res.status(401).json({ error: 'Sesión expirada por cierre forzado' });
        return;
      }
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      roles: decoded.roles || [decoded.role],
      schoolId: decoded.schoolId || null,
      schoolIds: decoded.schoolIds || [],
      jti: decoded.jti
    };

    // Si el usuario es administrador general, verificar supervisión activa
    if (req.user.roles.includes('admin_general')) {
      const supervisionRes = await pool.query(
        `SELECT a.*, c.nombre AS colegio_nombre
         FROM auditoria_supervision a
         JOIN colegio c ON c.id_colegio = a.id_colegio
         WHERE a.id_admin_general = $1 AND a.estado_supervision = 'ACTIVA' AND a.eliminado = FALSE
         LIMIT 1`,
        [req.user.id]
      );

      if (supervisionRes.rows.length > 0) {
        const supervision = supervisionRes.rows[0];
        const entrada = new Date(supervision.fecha_entrada);
        const limitTime = entrada.getTime() + supervision.duracion_maxima_minutos * 60000;
        const now = new Date().getTime();

        if (now > limitTime) {
          // LA SUPERVISIÓN HA EXPIRADO
          console.log(`[verifyToken] La supervisión ID: ${supervision.id_auditoria} para el administrador ${req.user.id} ha expirado. Finalizando automáticamente.`);
          
          const client = await pool.connect();
          try {
            await client.query('BEGIN');

            // 1. Cambiar estado a EXPIRADA
            await client.query(
              `UPDATE auditoria_supervision
               SET estado_supervision = 'EXPIRADA',
                   fecha_salida = NOW()
               WHERE id_auditoria = $1`,
              [supervision.id_auditoria]
            );

            // 2. Contar acciones
            const accionesRes = await client.query(
              'SELECT COUNT(*)::int AS total FROM auditoria_acciones_realizadas WHERE id_auditoria = $1',
              [supervision.id_auditoria]
            );
            const totalAcciones = accionesRes.rows[0].total || 0;

            const diffMs = new Date().getTime() - entrada.getTime();
            const diffMin = Math.round(diffMs / 60000);
            const duracionStr = diffMin < 60 ? `${diffMin} minutos` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;

            // 3. Notificar a directivos
            const directivos = await client.query(
              `SELECT d.id, u.email, u.nombre, u.apellido
               FROM directivo d
               JOIN usuario u ON d.id_usuario = u.id_usuario
               WHERE d.id_colegio = $1 AND d.estado = 'ACTIVO'`,
              [supervision.id_colegio]
            );

            const adminEmail = req.user.email;
            const adminFullName = `${req.user.role} (${adminEmail})`;

            for (const dir of directivos.rows) {
              await client.query(
                `INSERT INTO notificacion_supervision (id_auditoria, id_directivo, tipo_notificacion, mensaje)
                 VALUES ($1, $2, 'SALIDA', $3)`,
                [
                  supervision.id_auditoria,
                  dir.id,
                  `La supervisión del Admin General ha EXPIRADO automáticamente. Duración: ${duracionStr}. Acciones: ${totalAcciones}`
                ]
              );

              // Enviar email asíncrono
              const { AdminGeneralNotificationService } = require('../services/adminGeneralNotificationService');
              AdminGeneralNotificationService.sendSupervisionFinalizada(
                dir.email,
                `${dir.nombre} ${dir.apellido || ''}`.trim(),
                adminEmail,
                supervision.colegio_nombre,
                `${duracionStr} (Expiración automática por inactividad)`,
                totalAcciones
              ).catch((err: any) => console.error(err));
            }

            await client.query('COMMIT');
          } catch (err) {
            await client.query('ROLLBACK');
            console.error("Error auto-expiring supervision inside verifyToken:", err);
          } finally {
            client.release();
          }

          req.user.schoolId = null;
        } else {
          // Supervisión activa y no expirada -> Asignar id_colegio de la supervisión
          req.user.schoolId = supervision.id_colegio;
        }
      }
    }

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

  if (
    !req.user.roles.includes('directivo') &&
    !req.user.roles.includes('rector') &&
    !req.user.roles.includes('admin_general')
  ) {
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Directivo o Administrador General.' });
    return;
  }

  next();
};

/**
 * Middleware que verifica que el usuario sea un docente.
 * Debe usarse DESPUÉS de verifyToken.
 */
export const requireDocente = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  if (!req.user.roles.includes('docente') && !req.user.roles.includes('admin_general')) {
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Docente o Administrador General.' });
    return;
  }

  next();
};

/**
 * Middleware que verifica que el usuario sea un padre.
 * Debe usarse DESPUÉS de verifyToken.
 */
export const requirePadre = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  if (!req.user.roles.includes('padre') && !req.user.roles.includes('admin_general')) {
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Padre o Administrador General.' });
    return;
  }

  next();
};

/**
 * Middleware que verifica que el usuario sea un estudiante.
 * Debe usarse DESPUÉS de verifyToken.
 */
export const requireEstudiante = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  if (!req.user.roles.includes('estudiante') && !req.user.roles.includes('admin_general')) {
    res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Estudiante o Administrador General.' });
    return;
  }

  next();
};

