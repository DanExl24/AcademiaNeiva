import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';

import { JWT_SECRET } from '../config/jwt';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    roles: string[];
    schoolId: number | null;
    schoolIds?: number[];
    jti?: string;
    supervisionId?: number | null;
  };
  academicYearId?: number | null;
  auditLogged?: boolean;
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

    const headerSchoolId = req.headers['x-school-id'] ? Number(req.headers['x-school-id']) : null;
    const userSchoolIds = (decoded.schoolIds || []).map(Number);
    
    let activeSchoolId = decoded.schoolId || null;
    if (headerSchoolId && (userSchoolIds.length === 0 || userSchoolIds.includes(headerSchoolId) || decoded.roles?.includes('admin_general'))) {
      activeSchoolId = headerSchoolId;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      roles: decoded.roles || [decoded.role],
      schoolId: activeSchoolId,
      schoolIds: userSchoolIds,
      jti: decoded.jti,
      supervisionId: null
    };

    const headerYearId = req.headers['x-academic-year-id'] ? Number(req.headers['x-academic-year-id']) : (req.query.yearId ? Number(req.query.yearId) : null);
    req.academicYearId = headerYearId && !Number.isNaN(headerYearId) ? headerYearId : null;

    // Bloquear modificaciones si la petición viene de Modo Monitoreo
    const isMonitoringHeader = req.headers['x-monitoring-mode'] === 'true' || req.headers['x-monitoring-mode'] === '1';
    if (isMonitoringHeader) {
      const isExitRoute = req.originalUrl.includes('/stop-monitoring') || req.originalUrl.endsWith('/salir');
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isExitRoute) {
        res.status(403).json({ error: 'Acceso denegado. El Modo Monitoreo es estrictamente de SOLO LECTURA.' });
        return;
      }
    }

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
          req.user.supervisionId = null;
        } else {
          // Supervisión activa y no expirada -> Asignar id_colegio de la supervisión
          req.user.schoolId = supervision.id_colegio;
          req.user.supervisionId = supervision.id_auditoria;

          // Bloquear escrituras si el modo es SOLO_LECTURA
          if (supervision.tipo_supervision === 'SOLO_LECTURA') {
            const isExitRoute = req.originalUrl.includes('/supervision/') && req.originalUrl.endsWith('/salir');
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !isExitRoute) {
              res.status(403).json({ error: 'Acceso denegado. Estás en modo supervisión de SOLO LECTURA.' });
              return;
            }
          }

          // Registrar lecturas y exportaciones asíncronamente
          if (req.method === 'GET') {
            const auditDetails = getAuditLogDetails(req.originalUrl);
            if (auditDetails) {
              pool.query(
                `INSERT INTO auditoria_acciones_realizadas
                 (id_auditoria, modulo, tipo_accion, accion, recurso_afectado)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                  supervision.id_auditoria,
                  auditDetails.modulo,
                  auditDetails.tipo_accion,
                  auditDetails.accion,
                  auditDetails.recurso_afectado
                ]
              ).catch((err: any) => {
                console.error('Error logging automatic GET action in active supervision:', err);
              });
            }
          } else {
            // Para peticiones modificadoras, registrar en el evento 'finish' si no fueron auditadas manualmente
            res.on('finish', () => {
              if (res.statusCode >= 200 && res.statusCode < 400 && !req.auditLogged) {
                req.auditLogged = true;
                const auditDetails = getAuditLogDetails(req.originalUrl);
                const modulo = auditDetails?.modulo || getModuloFromUrl(req.originalUrl);
                const tipo_accion = getTipoAccionFromMethod(req.method);
                const accion = `${getAccionPrefixFromMethod(req.method)} en módulo ${modulo}`;
                const recurso_afectado = `Petición ${req.method} a la ruta: ${req.originalUrl}`;
                
                const valor_antiguo = tipo_accion === 'MODIFICACION' ? {} : null;
                const valor_nuevo = tipo_accion === 'MODIFICACION' ? req.body : null;
                const motivo_cambio = req.body.motivo_cambio || req.body.motivo || 'Acción general realizada bajo modo supervisión';

                pool.query(
                  `INSERT INTO auditoria_acciones_realizadas
                   (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                  [
                    supervision.id_auditoria,
                    modulo,
                    tipo_accion,
                    accion,
                    recurso_afectado,
                    valor_antiguo ? JSON.stringify(valor_antiguo) : null,
                    valor_nuevo ? JSON.stringify(valor_nuevo) : null,
                    motivo_cambio
                  ]
                ).catch((err: any) => {
                  console.error('Error logging automatic modifying action in active supervision:', err);
                });
              }
            });
          }
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

/**
 * Middleware que opcionalmente extrae el token JWT si existe, pero no bloquea el paso si es visitante.
 */
export const verifyTokenOptional = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.jti) {
      const blacklistRes = await pool.query(
        'SELECT 1 FROM token_blacklist WHERE jti = $1',
        [decoded.jti]
      );
      if (blacklistRes.rows.length > 0) {
        next();
        return;
      }
    }

    const userDbRes = await pool.query(
      'SELECT estado, logged_out_at, rol FROM usuario WHERE id_usuario = $1',
      [decoded.id]
    );

    if (userDbRes.rows.length > 0 && userDbRes.rows[0].estado === 'ACTIVO') {
      const dbUser = userDbRes.rows[0];
      
      const iat = decoded.iat * 1000;
      if (dbUser.logged_out_at && new Date(dbUser.logged_out_at).getTime() > iat) {
        next();
        return;
      }

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role || dbUser.rol,
        roles: decoded.roles || [dbUser.rol],
        schoolId: decoded.schoolId || null
      };
    }
  } catch (error) {
    // Si falla la verificación del token, se ignora silenciosamente para visitantes
  }
  next();
};

function getAuditLogDetails(url: string) {
  if (url.includes('/supervision/') || url.includes('/notificaciones') || url.includes('/dashboard/stats')) {
    return null;
  }
  
  let modulo = '';
  let tipo_accion: 'LECTURA' | 'EXPORTACION' = 'LECTURA';
  let accion = '';
  let recurso_afectado = '';

  if (url.startsWith('/api/boletines')) {
    modulo = 'BOLETINES';
    if (url.includes('/student/')) {
      tipo_accion = 'EXPORTACION';
      const parts = url.split('/');
      const studentId = parts[4] || 'N/A';
      const periodId = parts[5] || 'N/A';
      accion = 'Generación de Boletín de Estudiante';
      recurso_afectado = `Boletín Estudiante ID: ${studentId}, Periodo ID: ${periodId}`;
    } else if (url.includes('/grade/')) {
      tipo_accion = 'EXPORTACION';
      const parts = url.split('/');
      const grupoId = parts[4] || 'N/A';
      const periodId = parts[5] || 'N/A';
      accion = 'Generación de Boletines por Grado';
      recurso_afectado = `Boletines Grado ID: ${grupoId}, Periodo ID: ${periodId}`;
    } else {
      accion = 'Consulta de Boletines';
      recurso_afectado = `Consulta: ${url}`;
    }
  } else if (url.startsWith('/api/student')) {
    modulo = 'ESTUDIANTES';
    if (url.includes('/summary')) {
      const parts = url.split('/');
      const id = parts[3] || 'N/A';
      accion = 'Lectura de Ficha de Estudiante';
      recurso_afectado = `Ficha Resumen Estudiante ID: ${id}`;
    } else if (url.includes('/colegio/')) {
      const parts = url.split('/');
      const colegioId = parts[4] || 'N/A';
      accion = 'Consulta de Listado de Estudiantes';
      recurso_afectado = `Listado Estudiantes Colegio ID: ${colegioId}`;
    } else {
      accion = 'Consulta de Datos de Estudiante';
      recurso_afectado = `Consulta: ${url}`;
    }
  } else if (url.startsWith('/api/academic-admin')) {
    modulo = 'CONFIGURACION';
    accion = 'Consulta de Configuración Académica';
    recurso_afectado = `Consulta: ${url}`;
  } else if (url.startsWith('/api/matriculas') || url.startsWith('/api/matricula')) {
    modulo = 'MATRICULAS';
    accion = 'Consulta de Matrículas';
    recurso_afectado = `Consulta: ${url}`;
  } else if (url.startsWith('/api/teacher')) {
    modulo = 'DOCENTES';
    accion = 'Consulta de Docentes';
    recurso_afectado = `Consulta: ${url}`;
  } else if (url.startsWith('/api/grados')) {
    modulo = 'GRADOS';
    accion = 'Consulta de Grados';
    recurso_afectado = `Consulta: ${url}`;
  } else if (url.startsWith('/api/dba')) {
    modulo = 'DBA';
    accion = 'Consulta de DBA';
    recurso_afectado = `Consulta: ${url}`;
  } else if (url.startsWith('/api/support')) {
    modulo = 'SOPORTE';
    accion = 'Consulta de Soporte';
    recurso_afectado = `Consulta: ${url}`;
  }

  return modulo ? { modulo, tipo_accion, accion, recurso_afectado } : null;
}

function getModuloFromUrl(url: string): string {
  if (url.startsWith('/api/student')) return 'ESTUDIANTES';
  if (url.startsWith('/api/boletines')) return 'BOLETINES';
  if (url.startsWith('/api/academic-admin')) return 'CONFIGURACION';
  if (url.startsWith('/api/matriculas') || url.startsWith('/api/matricula')) return 'MATRICULAS';
  if (url.startsWith('/api/teacher')) return 'DOCENTES';
  if (url.startsWith('/api/grados')) return 'GRADOS';
  if (url.startsWith('/api/dba')) return 'DBA';
  if (url.startsWith('/api/support')) return 'SOPORTE';
  return 'GENERAL';
}

function getTipoAccionFromMethod(method: string): 'CREACION' | 'MODIFICACION' | 'ELIMINACION' | 'LECTURA' {
  if (method === 'POST') return 'CREACION';
  if (method === 'DELETE') return 'ELIMINACION';
  if (method === 'PUT' || method === 'PATCH') return 'MODIFICACION';
  return 'LECTURA';
}

function getAccionPrefixFromMethod(method: string): string {
  if (method === 'POST') return 'Creación de registro';
  if (method === 'DELETE') return 'Eliminación de registro';
  if (method === 'PUT' || method === 'PATCH') return 'Modificación de registro';
  return 'Consulta';
}

