import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../config/kysely';
import { sql } from 'kysely';

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
      const blacklistRes = await db
        .selectFrom("token_blacklist")
        .select(sql<number>`1`.as("one"))
        .where("jti", "=", decoded.jti)
        .executeTakeFirst();
      if (blacklistRes) {
        res.status(401).json({ error: 'Sesión invalidada por cierre forzado' });
        return;
      }
    }

    // Verificar estado del usuario e invalidación global en la base de datos
    const dbUser = await db
      .selectFrom("usuario")
      .select(["estado", "logged_out_at"])
      .where("id_usuario", "=", decoded.id)
      .executeTakeFirst();

    if (!dbUser) {
      res.status(401).json({ error: 'Usuario no encontrado' });
      return;
    }

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
      const supervision = await db
        .selectFrom("auditoria_supervision as a")
        .innerJoin("colegio as c", "c.id_colegio", "a.id_colegio")
        .select([
          "a.id_auditoria",
          "a.id_admin_general",
          "a.id_colegio",
          "a.fecha_entrada",
          "a.fecha_salida",
          "a.duracion_maxima_minutos",
          "a.tipo_supervision",
          "a.motivo_solicitud",
          "a.estado_supervision",
          "a.eliminado",
          "c.nombre as colegio_nombre"
        ])
        .where("a.id_admin_general", "=", req.user.id)
        .where("a.estado_supervision", "=", "ACTIVA")
        .where("a.eliminado", "=", false)
        .limit(1)
        .executeTakeFirst();

      if (supervision) {
        const entrada = new Date(supervision.fecha_entrada as any);
        const limitTime = entrada.getTime() + supervision.duracion_maxima_minutos * 60000;
        const now = new Date().getTime();

        if (now > limitTime) {
          // LA SUPERVISIÓN HA EXPIRADO
          console.log(`[verifyToken] La supervisión ID: ${supervision.id_auditoria} para el administrador ${req.user.id} ha expirado. Finalizando automáticamente.`);
          
          try {
            await db.transaction().execute(async (trx) => {
              // 1. Cambiar estado a EXPIRADA
              await trx
                .updateTable("auditoria_supervision")
                .set({
                  estado_supervision: "EXPIRADA",
                  fecha_salida: sql`NOW()`
                })
                .where("id_auditoria", "=", supervision.id_auditoria)
                .execute();

              // 2. Contar acciones
              const accionesRes = await trx
                .selectFrom("auditoria_acciones_realizadas")
                .select(sql<number>`COUNT(*)::int`.as("total"))
                .where("id_auditoria", "=", supervision.id_auditoria)
                .executeTakeFirst();
              const totalAcciones = accionesRes?.total || 0;

              const diffMs = new Date().getTime() - entrada.getTime();
              const diffMin = Math.round(diffMs / 60000);
              const duracionStr = diffMin < 60 ? `${diffMin} minutos` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;

              // 3. Notificar a directivos
              const directivos = await trx
                .selectFrom("directivo as d")
                .innerJoin("usuario as u", "d.id_usuario", "u.id_usuario")
                .select(["d.id", "u.email", "u.nombre", "u.apellido"])
                .where("d.id_colegio", "=", supervision.id_colegio)
                .where("d.estado", "=", "ACTIVO")
                .execute();

              const adminEmail = req.user?.email || '';

              for (const dir of directivos) {
                await trx
                  .insertInto("notificacion_supervision")
                  .values({
                    id_auditoria: supervision.id_auditoria,
                    id_directivo: dir.id,
                    tipo_notificacion: "SALIDA",
                    mensaje: `La supervisión del Admin General ha EXPIRADO automáticamente. Duración: ${duracionStr}. Acciones: ${totalAcciones}`
                  })
                  .execute();

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
            });
          } catch (err) {
            console.error("Error auto-expiring supervision inside verifyToken:", err);
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
              db.insertInto("auditoria_acciones_realizadas")
                .values({
                  id_auditoria: supervision.id_auditoria,
                  modulo: auditDetails.modulo as any,
                  tipo_accion: auditDetails.tipo_accion as any,
                  accion: auditDetails.accion,
                  recurso_afectado: auditDetails.recurso_afectado
                })
                .execute()
                .catch((err: any) => {
                  console.error('Error logging automatic GET action in active supervision:', err);
                });
            }
          } else {
            // Para peticiones modificadoras, registrar en el evento 'finish' si no fueron auditadas manualmente
            res.on('finish', () => {
              const isSupervisionControl = req.originalUrl.includes('/supervision/') || req.originalUrl.includes('/auth/');
              if (res.statusCode >= 200 && res.statusCode < 400 && !req.auditLogged && !isSupervisionControl) {
                req.auditLogged = true;
                const auditDetails = getAuditLogDetails(req.originalUrl);
                const modulo = auditDetails?.modulo || getModuloFromUrl(req.originalUrl);
                const tipo_accion = getTipoAccionFromMethod(req.method);
                const accion = `${getAccionPrefixFromMethod(req.method)} en módulo ${modulo}`;
                const recurso_afectado = `Petición ${req.method} a la ruta: ${req.originalUrl}`;
                
                const valor_antiguo = tipo_accion === 'MODIFICACION' ? {} : null;
                const valor_nuevo = tipo_accion === 'MODIFICACION' ? req.body : null;
                const motivo_cambio = req.body.motivo_cambio || req.body.motivo || 'Acción general realizada bajo modo supervisión';

                db.insertInto("auditoria_acciones_realizadas")
                  .values({
                    id_auditoria: supervision.id_auditoria,
                    modulo: modulo as any,
                    tipo_accion: tipo_accion as any,
                    accion,
                    recurso_afectado,
                    valor_antiguo: valor_antiguo ? (valor_antiguo as any) : null,
                    valor_nuevo: valor_nuevo ? (valor_nuevo as any) : null,
                    motivo_cambio
                  })
                  .execute()
                  .catch((err: any) => {
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
      const blacklistRes = await db
        .selectFrom("token_blacklist")
        .select(sql<number>`1`.as("one"))
        .where("jti", "=", decoded.jti)
        .executeTakeFirst();
      if (blacklistRes) {
        next();
        return;
      }
    }

    const dbUser = await db
      .selectFrom("usuario")
      .select(["estado", "logged_out_at"])
      .where("id_usuario", "=", decoded.id)
      .executeTakeFirst();

    if (dbUser && dbUser.estado === 'ACTIVO') {
      
      const iat = decoded.iat * 1000;
      if (dbUser.logged_out_at && new Date(dbUser.logged_out_at).getTime() > iat) {
        next();
        return;
      }

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        roles: decoded.roles || (decoded.role ? [decoded.role] : []),
        schoolId: decoded.schoolId || null
      };
    }
  } catch (error) {
    // Si falla la verificación del token, se ignora silenciosamente para visitantes
  }
  next();
};

/**
 * Normaliza la URL eliminando el prefijo '/api' si existe.
 * Esto es necesario porque req.originalUrl puede venir con o sin el prefijo
 * dependiendo de cómo el frontend envíe la petición (baseURL sin /api).
 */
function normalizeUrl(url: string): string {
  return url.startsWith('/api/') ? url.substring(4) : url;
}

function getAuditLogDetails(rawUrl: string) {
  const url = normalizeUrl(rawUrl);

  if (url.includes('/supervision/') || url.includes('/notificaciones') || url.includes('/dashboard/stats') || url.includes('/auth/')) {
    return null;
  }
  
  let modulo = '';
  let tipo_accion: 'LECTURA' | 'EXPORTACION' = 'LECTURA';
  let accion = '';
  let recurso_afectado = '';

  if (url.startsWith('/boletines')) {
    modulo = 'BOLETINES';
    if (url.includes('/student/')) {
      tipo_accion = 'EXPORTACION';
      const parts = url.split('/');
      const studentId = parts[3] || 'N/A';
      const periodId = parts[4] || 'N/A';
      accion = 'Generación de Boletín de Estudiante';
      recurso_afectado = `Boletín Estudiante ID: ${studentId}, Periodo ID: ${periodId}`;
    } else if (url.includes('/grade/')) {
      tipo_accion = 'EXPORTACION';
      const parts = url.split('/');
      const grupoId = parts[3] || 'N/A';
      const periodId = parts[4] || 'N/A';
      accion = 'Generación de Boletines por Grado';
      recurso_afectado = `Boletines Grado ID: ${grupoId}, Periodo ID: ${periodId}`;
    } else {
      accion = 'Consulta de Boletines';
      recurso_afectado = `Generador de boletines`;
    }
  } else if (url.startsWith('/student')) {
    modulo = 'ESTUDIANTES';
    if (url.includes('/summary')) {
      const parts = url.split('/');
      const id = parts[2] || 'N/A';
      accion = 'Lectura de Ficha de Estudiante';
      recurso_afectado = `Ficha Resumen Estudiante ID: ${id}`;
    } else if (url.includes('/colegio/')) {
      const parts = url.split('/');
      const colegioId = parts[3] || 'N/A';
      accion = 'Consulta de Listado de Estudiantes';
      recurso_afectado = `Listado Estudiantes Colegio ID: ${colegioId}`;
    } else {
      accion = 'Consulta de Datos de Estudiante';
      recurso_afectado = `Ficha de estudiante`;
    }
  } else if (url.startsWith('/academic-admin/config')) {
    modulo = 'CONFIGURACION';
    accion = 'Consulta de Malla Curricular y Directrices';
    recurso_afectado = 'Configuración curricular';
  } else if (url.startsWith('/academic-admin/settings')) {
    modulo = 'CONFIGURACION';
    accion = 'Consulta de Parámetros Institucionales';
    recurso_afectado = 'Configuración académica';
  } else if (url.startsWith('/academic-admin/tracking')) {
    modulo = 'SEGUIMIENTO';
    accion = 'Consulta de Dashboard y Seguimiento';
    recurso_afectado = 'Dashboard académico';
  } else if (url.startsWith('/academic-admin/periods')) {
    modulo = 'PERIODOS';
    accion = 'Consulta de Periodos Académicos';
    recurso_afectado = 'Gestión de periodos';
  } else if (url.startsWith('/academic-admin/scales')) {
    modulo = 'ESCALAS';
    accion = 'Consulta de Escalas de Valoración';
    recurso_afectado = 'Escala institucional';
  } else if (url.startsWith('/academic-admin/competencies')) {
    modulo = 'COMPETENCIAS';
    accion = 'Consulta de Competencias Académicas';
    recurso_afectado = 'Competencias institucionales';
  } else if (url.startsWith('/academic-admin/teachers')) {
    modulo = 'DOCENTES';
    accion = 'Consulta de Planta Docente y Asignaciones';
    recurso_afectado = 'Gestión de docentes';
  } else if (url.startsWith('/academic-admin/years')) {
    modulo = 'AÑOS_LECTIVOS';
    accion = 'Consulta de Años Lectivos';
    recurso_afectado = 'Vigencias académicas';
  } else if (url.startsWith('/academic-admin/subjects')) {
    modulo = 'ASIGNATURAS';
    accion = 'Consulta de Asignaturas';
    recurso_afectado = 'Plan de estudios';
  } else if (url.startsWith('/academic-admin')) {
    modulo = 'CONFIGURACION';
    accion = 'Consulta de Configuración Académica';
    recurso_afectado = 'Configuración del colegio';
  } else if (url.startsWith('/matriculas') || url.startsWith('/matricula')) {
    modulo = 'MATRICULAS';
    accion = 'Consulta de Solicitudes de Matrícula';
    recurso_afectado = 'Gestión de matrículas';
  } else if (url.startsWith('/traslados')) {
    modulo = 'TRASLADOS';
    accion = 'Consulta de Solicitudes de Traslado';
    recurso_afectado = 'Gestión de traslados';
  } else if (url.startsWith('/reingreso')) {
    modulo = 'REINGRESOS';
    accion = 'Consulta de Solicitudes de Reingreso';
    recurso_afectado = 'Gestión de reingresos';
  } else if (url.startsWith('/parent')) {
    modulo = 'PADRES';
    accion = 'Consulta de Padres de Familia';
    recurso_afectado = 'Gestión de acudientes';
  } else if (url.startsWith('/teacher')) {
    modulo = 'DOCENTES';
    accion = 'Consulta de Docentes';
    recurso_afectado = 'Gestión de docentes';
  } else if (url.startsWith('/grados')) {
    modulo = 'GRADOS';
    accion = 'Consulta de Grados y Secciones';
    recurso_afectado = 'Gestión de grupos';
  } else if (url.startsWith('/dba')) {
    modulo = 'DBA';
    accion = 'Consulta de Derechos Básicos de Aprendizaje';
    recurso_afectado = 'Malla DBA';
  } else if (url.startsWith('/support')) {
    modulo = 'SOPORTE';
    accion = 'Consulta de Tickets de Soporte';
    recurso_afectado = 'Módulo de soporte';
  }

  return modulo ? { modulo, tipo_accion, accion, recurso_afectado } : null;
}

function getModuloFromUrl(rawUrl: string): string {
  const url = normalizeUrl(rawUrl);
  if (url.startsWith('/student')) return 'ESTUDIANTES';
  if (url.startsWith('/boletines')) return 'BOLETINES';
  if (url.startsWith('/academic-admin/config')) return 'CONFIGURACION';
  if (url.startsWith('/academic-admin/settings')) return 'CONFIGURACION';
  if (url.startsWith('/academic-admin/tracking')) return 'SEGUIMIENTO';
  if (url.startsWith('/academic-admin/periods')) return 'PERIODOS';
  if (url.startsWith('/academic-admin/scales')) return 'ESCALAS';
  if (url.startsWith('/academic-admin/competencies')) return 'COMPETENCIAS';
  if (url.startsWith('/academic-admin/teachers')) return 'DOCENTES';
  if (url.startsWith('/academic-admin/years')) return 'AÑOS_LECTIVOS';
  if (url.startsWith('/academic-admin/subjects')) return 'ASIGNATURAS';
  if (url.startsWith('/academic-admin')) return 'CONFIGURACION';
  if (url.startsWith('/matriculas') || url.startsWith('/matricula')) return 'MATRICULAS';
  if (url.startsWith('/traslados')) return 'TRASLADOS';
  if (url.startsWith('/reingreso')) return 'REINGRESOS';
  if (url.startsWith('/parent')) return 'PADRES';
  if (url.startsWith('/teacher')) return 'DOCENTES';
  if (url.startsWith('/grados')) return 'GRADOS';
  if (url.startsWith('/dba')) return 'DBA';
  if (url.startsWith('/support')) return 'SOPORTE';
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

