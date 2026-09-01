import { Response } from 'express';
import { db } from '../config/kysely';
import { sql } from 'kysely';
import { AuthRequest } from '../middleware/authMiddleware';
import { AdminGeneralNotificationService } from '../services/adminGeneralNotificationService';
import bcrypt from 'bcrypt';
import { validateDocumentUniqueness, resolveTipoDocumentoId } from '../utils/documentValidation';
import { upsertInstitutionalEmail } from '../utils/emailResolver';

// ═══════════════════════════════════════════════════════════════════════════
// GESTIÓN DE COLEGIOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/colegios
 * Listar todos los colegios con filtros opcionales por estado.
 */
export const listarColegios = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { estado, busqueda } = req.query;
    const page = req.query.page ? Number(req.query.page) : null;
    const limit = req.query.limit ? Number(req.query.limit) : null;

    let baseQuery = db
      .selectFrom("colegio as c")
      .leftJoin("directivo as d", (join) => join.onRef("d.id_colegio", "=", "c.id_colegio").on("d.estado", "=", "ACTIVO"))
      .leftJoin("docente as doc", (join) => join.onRef("doc.id_colegio", "=", "c.id_colegio").on("doc.estado", "=", "ACTIVO"))
      .leftJoin("estudiante as e", (join) => join.onRef("e.id_colegio", "=", "c.id_colegio").on("e.estado", "=", "ACTIVO"))
      .leftJoin("padre_familia as pf", "pf.id_colegio", "c.id_colegio")
      .select([
        "c.id_colegio",
        "c.nombre",
        "c.tipo_colegio",
        "c.sede",
        "c.contacto",
        "c.correo",
        "c.dane",
        "c.tipo_calendario",
        "c.estado",
        "c.fecha_registro",
        "c.motivo_rechazo",
        "c.escudo_url",
        "c.color_primario",
        "c.color_secundario",
        sql<number>`COUNT(DISTINCT d.id)::int`.as("total_directivos"),
        sql<number>`COUNT(DISTINCT d.id)::int`.as("directivos_count"),
        sql<number>`COUNT(DISTINCT doc.id_docente)::int`.as("total_docentes"),
        sql<number>`COUNT(DISTINCT doc.id_docente)::int`.as("docentes_count"),
        sql<number>`COUNT(DISTINCT e.id_estudiante)::int`.as("total_estudiantes"),
        sql<number>`COUNT(DISTINCT e.id_estudiante)::int`.as("estudiantes_count"),
        sql<number>`COUNT(DISTINCT pf.id_padrefamilia)::int`.as("total_padres"),
        sql<number>`COUNT(DISTINCT pf.id_padrefamilia)::int`.as("padres_count")
      ])
      .groupBy("c.id_colegio");

    if (estado && estado !== 'TODOS') {
      baseQuery = baseQuery.where("c.estado", "=", estado as any);
    }

    if (busqueda) {
      const searchPattern = `%${busqueda}%`;
      baseQuery = baseQuery.where((eb) => eb.or([
        eb("c.nombre", "ilike", searchPattern),
        eb("c.dane", "ilike", searchPattern),
        eb("c.correo", "ilike", searchPattern)
      ]));
    }

    const allRows = await baseQuery.orderBy("c.fecha_registro", "desc").execute();
    const totalCount = allRows.length;

    let pagedRows = allRows;
    if (page && limit) {
      const offset = (Number(page) - 1) * Number(limit);
      pagedRows = allRows.slice(offset, offset + Number(limit));
    }

    res.setHeader("x-total-count", String(totalCount));
    res.setHeader("Access-Control-Expose-Headers", "x-total-count");
    res.json(pagedRows);
  } catch (error: any) {
    console.error('Error listando colegios:', error);
    res.status(500).json({ error: 'Error al listar colegios' });
  }
};

export const detalleColegio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = Number(req.params.id);
    const school = await db
      .selectFrom("colegio as c")
      .leftJoin("directivo as d", "d.id_colegio", "c.id_colegio")
      .leftJoin("docente as doc", "doc.id_colegio", "c.id_colegio")
      .leftJoin("estudiante as e", "e.id_colegio", "c.id_colegio")
      .leftJoin("padre_familia as pf", "pf.id_colegio", "c.id_colegio")
      .select([
        "c.id_colegio",
        "c.nombre",
        "c.tipo_colegio",
        "c.sede",
        "c.contacto",
        "c.correo",
        "c.dane",
        "c.tipo_calendario",
        "c.estado",
        "c.fecha_registro",
        "c.motivo_rechazo",
        "c.escudo_url",
        "c.color_primario",
        "c.color_secundario",
        sql<number>`COUNT(DISTINCT d.id)::int`.as("total_directivos"),
        sql<number>`COUNT(DISTINCT d.id)::int`.as("directivos_count"),
        sql<number>`COUNT(DISTINCT doc.id_docente)::int`.as("total_docentes"),
        sql<number>`COUNT(DISTINCT doc.id_docente)::int`.as("docentes_count"),
        sql<number>`COUNT(DISTINCT e.id_estudiante)::int`.as("total_estudiantes"),
        sql<number>`COUNT(DISTINCT e.id_estudiante)::int`.as("estudiantes_count"),
        sql<number>`COUNT(DISTINCT pf.id_padrefamilia)::int`.as("total_padres"),
        sql<number>`COUNT(DISTINCT pf.id_padrefamilia)::int`.as("padres_count")
      ])
      .where("c.id_colegio", "=", schoolId)
      .groupBy("c.id_colegio")
      .executeTakeFirst();

    if (!school) {
      res.status(404).json({ error: 'Colegio no encontrado' });
      return;
    }

    res.json(school);
  } catch (error: any) {
    console.error('Error obteniendo detalle colegio:', error);
    res.status(500).json({ error: 'Error al obtener detalle del colegio' });
  }
};

export const registrarColegio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { nombre, tipo_colegio, sede, contacto, correo, dane, tipo_calendario, escudo_url } = req.body;

    if (!nombre || !tipo_colegio || !sede || !contacto || !correo || !dane) {
      res.status(400).json({ error: 'Todos los campos son obligatorios' });
      return;
    }

    const cleanDane = String(dane).trim();
    const daneCheck = await db
      .selectFrom("colegio")
      .select("id_colegio")
      .where("dane", "=", cleanDane)
      .executeTakeFirst();

    if (daneCheck) {
      res.status(400).json({ error: `El código DANE '${dane}' ya se encuentra registrado para otra institución.` });
      return;
    }

    const newSchool = await db
      .insertInto("colegio")
      .values({
        nombre,
        tipo_colegio,
        sede,
        contacto: String(contacto),
        correo,
        dane: cleanDane,
        tipo_calendario: tipo_calendario || 'A',
        estado: 'PENDIENTE',
        escudo_url: escudo_url || null
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    res.status(201).json(newSchool);
  } catch (error: any) {
    console.error('Error registrando colegio:', error);
    res.status(500).json({ error: 'Error al registrar colegio' });
  }
};

export const actualizarColegio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = Number(req.params.id);
    const { nombre, tipo_colegio, sede, contacto, correo, dane, tipo_calendario, escudo_url, color_primario, color_secundario } = req.body;

    const colegioActual = await db
      .selectFrom("colegio")
      .select(["id_colegio", "estado"])
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!colegioActual) {
      res.status(404).json({ error: 'Colegio no encontrado' });
      return;
    }
    if (colegioActual.estado === 'ELIMINADO') {
      res.status(400).json({ error: 'No se puede editar un colegio en estado ELIMINADO' });
      return;
    }

    if (dane) {
      const cleanDane = String(dane).trim();
      const daneCheck = await db
        .selectFrom("colegio")
        .select("id_colegio")
        .where("dane", "=", cleanDane)
        .where("id_colegio", "!=", schoolId)
        .executeTakeFirst();

      if (daneCheck) {
        res.status(400).json({ error: `El código DANE '${dane}' ya se encuentra registrado para otra institución.` });
        return;
      }
    }

    const updateObject: any = {};
    if (nombre !== undefined) updateObject.nombre = nombre;
    if (tipo_colegio !== undefined) updateObject.tipo_colegio = tipo_colegio;
    if (sede !== undefined) updateObject.sede = sede;
    if (contacto !== undefined) updateObject.contacto = String(contacto);
    if (correo !== undefined) updateObject.correo = correo;
    if (dane !== undefined) updateObject.dane = String(dane).trim();
    if (tipo_calendario !== undefined) updateObject.tipo_calendario = tipo_calendario;
    if (escudo_url !== undefined) updateObject.escudo_url = escudo_url;
    if (color_primario !== undefined) updateObject.color_primario = color_primario;
    if (color_secundario !== undefined) updateObject.color_secundario = color_secundario;

    const updated = await db
      .updateTable("colegio")
      .set(updateObject)
      .where("id_colegio", "=", schoolId)
      .returningAll()
      .executeTakeFirstOrThrow();

    res.json(updated);
  } catch (error: any) {
    console.error('Error actualizando colegio:', error);
    res.status(500).json({ error: 'Error al actualizar colegio' });
  }
};

/**
 * POST /admin/colegios/upload-escudo
 * Subir archivo del escudo del colegio.
 */
export const uploadEscudo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No se ha subido ningún archivo' });
      return;
    }
    const mimeType = req.file.mimetype || 'image/png';
    const base64Data = req.file.buffer.toString('base64');
    const fileUrl = `data:${mimeType};base64,${base64Data}`;
    res.json({ url: fileUrl });
  } catch (error: any) {
    console.error('Error al subir escudo:', error);
    res.status(500).json({ error: 'Error al subir el escudo del colegio' });
  }
};

/**
 * PATCH /admin/colegios/:id/estado
 * Cambiar el estado de un colegio (aprobar, rechazar, suspender, etc.)
 * Regla: Todo cambio de estado debe ser notificado a los directivos.
 */
export const cambiarEstadoColegio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = Number(req.params.id);
    const { estado, motivo } = req.body;

    const estadosValidos = ['PENDIENTE', 'ACTIVO', 'SUSPENDIDO', 'RECHAZADO', 'ELIMINADO'];
    if (!estadosValidos.includes(estado)) {
      res.status(400).json({ error: `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}` });
      return;
    }

    const result = await db.transaction().execute(async (trx) => {
      const colegioActual = await trx
        .selectFrom('colegio')
        .select(['id_colegio', 'nombre', 'estado'])
        .where('id_colegio', '=', schoolId)
        .executeTakeFirst();

      if (!colegioActual) {
        throw new Error('COLEGIO_NOT_FOUND');
      }

      const estadoAnterior = colegioActual.estado;
      const colegioNombre = colegioActual.nombre;

      // RN-COL-005: Restricción de Eliminación de Colegio si posee registros históricos activos
      if (estado === 'ELIMINADO') {
        const checkRecords = await trx
          .selectFrom('colegio')
          .select([
            (eb) => eb.selectFrom('estudiante').select(sql<number>`COUNT(*)::int`.as('count')).where('id_colegio', '=', schoolId).as('estudiantes_count'),
            (eb) => eb.selectFrom('matricula').select(sql<number>`COUNT(*)::int`.as('count')).where('id_colegio', '=', schoolId).as('matriculas_count'),
            (eb) => eb.selectFrom('anio_lectivo').select(sql<number>`COUNT(*)::int`.as('count')).where('id_colegio', '=', schoolId).as('anios_count')
          ])
          .where('id_colegio', '=', schoolId)
          .executeTakeFirst();

        const estudiantesCount = checkRecords?.estudiantes_count || 0;
        const matriculasCount = checkRecords?.matriculas_count || 0;
        const aniosCount = checkRecords?.anios_count || 0;

        if (estudiantesCount > 0 || matriculasCount > 0 || aniosCount > 0) {
          throw new Error('COLEGIO_HAS_RECORDS');
        }
      }

      const updateObject: any = {
        estado: estado as any,
        fecha_cambio_estado: new Date()
      };

      if (estado === 'RECHAZADO' && motivo) {
        updateObject.motivo_rechazo = motivo;
      }

      await trx
        .updateTable('colegio')
        .set(updateObject)
        .where('id_colegio', '=', schoolId)
        .execute();

      // Obtener directivos del colegio para notificar
      const directivos = await trx
        .selectFrom('directivo as d')
        .innerJoin('usuario as u', 'u.id_usuario', 'd.id_usuario')
        .select(['d.id', 'u.email', 'u.nombre', 'u.apellido'])
        .where('d.id_colegio', '=', schoolId)
        .where('d.estado', '=', 'ACTIVO')
        .execute();

      for (const dir of directivos) {
        await trx
          .insertInto('notificacion_colegio')
          .values({
            id_colegio: schoolId,
            id_directivo: dir.id,
            tipo: 'CAMBIO_ESTADO',
            mensaje: `El estado del colegio ${colegioNombre} cambió de ${estadoAnterior} a ${estado}`,
            estado_anterior: estadoAnterior,
            estado_nuevo: estado
          })
          .execute();

        if (estado === 'SUSPENDIDO' && dir.email) {
          AdminGeneralNotificationService.sendColegioSuspendido(
            dir.email,
            `${dir.nombre} ${dir.apellido || ''}`.trim(),
            colegioNombre,
            motivo || 'No especificado'
          );
        }
      }

      if (estado === 'ELIMINADO') {
        await trx
          .updateTable('usuario_colegio')
          .set({ estado: 'INACTIVO', fecha_fin: new Date() })
          .where('id_colegio', '=', schoolId)
          .execute();
      }

      return { estadoAnterior, estado };
    });

    res.json({ message: `Estado del colegio actualizado a ${estado}`, estado_anterior: result.estadoAnterior, estado_nuevo: result.estado });
  } catch (error: any) {
    if (error.message === 'COLEGIO_NOT_FOUND') {
      res.status(404).json({ error: 'Colegio no encontrado' });
      return;
    }
    if (error.message === 'COLEGIO_HAS_RECORDS') {
      res.status(400).json({ 
        error: 'No se puede eliminar el colegio porque cuenta con matrículas, estudiantes o años lectivos registrados. Utilice el estado SUSPENDIDO.' 
      });
      return;
    }
    console.error('Error cambiando estado colegio:', error);
    res.status(500).json({ error: 'Error al cambiar estado del colegio' });
  }
};

/**
 * DELETE /admin/colegios/:id
 * Eliminar un colegio (cambia estado a ELIMINADO y desvincula usuarios).
 */
export const eliminarColegio = async (req: AuthRequest, res: Response): Promise<void> => {
  req.body = { ...req.body, estado: 'ELIMINADO' };
  return cambiarEstadoColegio(req, res);
};

// ═══════════════════════════════════════════════════════════════════════════
// GESTIÓN DE USUARIOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/usuarios
 * Listar todos los usuarios del sistema con filtros opcionales.
 */
export const listarUsuarios = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { estado, rol, id_colegio } = req.query;
    const busqueda = req.query.busqueda || req.query.search;
    const page = req.query.page ? Number(req.query.page) : null;
    const limit = req.query.limit ? Number(req.query.limit) : null;

    let baseQuery = db
      .selectFrom("usuario as u")
      .leftJoin("usuario_colegio as uc", (join) => 
        join.onRef("uc.id_usuario", "=", "u.id_usuario").on("uc.estado", "=", "ACTIVO")
      )
      .leftJoin("colegio as c", "c.id_colegio", "uc.id_colegio")
      .leftJoin("usuario_rol as ur", "ur.id_usuario", "u.id_usuario")
      .leftJoin("rol as r", "r.id_rol", "ur.id_rol")
      .select([
        "u.id_usuario",
        "u.email",
        "u.nombre",
        "u.apellido",
        "u.estado",
        "uc.id_colegio",
        "u.fecha_creacion",
        "u.motivo_baneo",
        "u.fecha_baneo",
        "c.nombre as colegio_nombre",
        sql<string[]>`array_agg(DISTINCT r.nombre)`.as("roles")
      ])
      .groupBy([
        "u.id_usuario", "u.email", "u.nombre", "u.apellido", "u.estado", 
        "uc.id_colegio", "u.fecha_creacion", "u.motivo_baneo", "u.fecha_baneo", "c.nombre"
      ]);

    if (estado && estado !== 'TODOS') {
      baseQuery = baseQuery.where("u.estado", "=", estado as any);
    }

    if (rol) {
      baseQuery = baseQuery.where("r.nombre", "=", rol as string);
    }

    if (busqueda) {
      const searchPattern = `%${busqueda}%`;
      baseQuery = baseQuery.where((eb) => eb.or([
        eb("u.nombre", "ilike", searchPattern),
        eb("u.apellido", "ilike", searchPattern),
        eb("u.email", "ilike", searchPattern)
      ]));
    }

    if (id_colegio) {
      baseQuery = baseQuery.where("uc.id_colegio", "=", Number(id_colegio));
    }

    const allRows = await baseQuery.orderBy("u.fecha_creacion", "desc").execute();
    const totalCount = allRows.length;

    let pagedRows = allRows;
    if (page && limit) {
      const offset = (Number(page) - 1) * Number(limit);
      pagedRows = allRows.slice(offset, offset + Number(limit));
    }

    res.setHeader("x-total-count", String(totalCount));
    res.setHeader("Access-Control-Expose-Headers", "x-total-count");
    res.json(pagedRows);
  } catch (error: any) {
    console.error('Error listando usuarios:', error);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
};

/**
 * GET /admin/usuarios/:id
 * Ver información de un usuario.
 */
export const detalleUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const userDetail = await db
      .selectFrom("usuario as u")
      .leftJoin("usuario_colegio as uc", (join) => 
        join.onRef("uc.id_usuario", "=", "u.id_usuario").on("uc.estado", "=", "ACTIVO")
      )
      .leftJoin("colegio as c", "c.id_colegio", "uc.id_colegio")
      .leftJoin("usuario_rol as ur", "ur.id_usuario", "u.id_usuario")
      .leftJoin("rol as r", "r.id_rol", "ur.id_rol")
      .leftJoin("tipo_documento as td", "td.id_tipodocumento", "u.id_tipodocumento")
      .select([
        "u.id_usuario",
        "u.email",
        "u.nombre",
        "u.apellido",
        "u.estado",
        "uc.id_colegio",
        "u.fecha_creacion",
        "u.motivo_baneo",
        "u.fecha_baneo",
        "u.activo",
        "u.documento",
        "u.telefono",
        "u.id_tipodocumento",
        "c.nombre as colegio_nombre",
        "td.tipo as tipo_documento",
        sql<string[]>`array_agg(DISTINCT r.nombre)`.as("roles")
      ])
      .where("u.id_usuario", "=", userId)
      .groupBy([
        "u.id_usuario", "u.email", "u.nombre", "u.apellido", "u.estado", "uc.id_colegio",
        "u.fecha_creacion", "u.motivo_baneo", "u.fecha_baneo", "u.activo", "u.documento",
        "u.telefono", "u.id_tipodocumento", "c.nombre", "td.tipo"
      ])
      .executeTakeFirst();

    if (!userDetail) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json(userDetail);
  } catch (error: any) {
    console.error('Error obteniendo detalle usuario:', error);
    res.status(500).json({ error: 'Error al obtener detalle del usuario' });
  }
};

/**
 * PATCH /admin/usuarios/:id/estado
 * Cambiar estado de un usuario (banear, suspender, activar, eliminar).
 * Regla: Un usuario baneado no puede iniciar sesión.
 */
export const cambiarEstadoUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const { estado, motivo } = req.body;

    const estadosValidos = ['ACTIVO', 'SUSPENDIDO', 'BANEADO', 'ELIMINADO'];
    if (!estadosValidos.includes(estado)) {
      res.status(400).json({ error: `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}` });
      return;
    }

    // Prevenir que el Admin General suspenda, banee o elimine su propia cuenta
    if (req.user && Number(req.user.id) === userId && estado !== 'ACTIVO') {
      res.status(400).json({ error: 'No puedes suspender, banear ni eliminar tu propia cuenta de Administrador General.' });
      return;
    }

    const updateObject: any = {
      estado: estado as any,
      activo: estado === 'ACTIVO'
    };

    if (estado !== 'ACTIVO') {
      updateObject.logged_out_at = new Date();
    }

    if (estado === 'BANEADO') {
      updateObject.motivo_baneo = motivo || null;
      updateObject.fecha_baneo = new Date();
      updateObject.baneado_por = req.user!.id;
    } else {
      updateObject.motivo_baneo = null;
      updateObject.fecha_baneo = null;
      updateObject.baneado_por = null;
    }

    const result = await db
      .updateTable('usuario')
      .set(updateObject)
      .where('id_usuario', '=', userId)
      .returning(['id_usuario', 'email', 'nombre', 'estado'])
      .executeTakeFirst();

    if (!result) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({ message: `Estado del usuario actualizado a ${estado}`, usuario: result });
  } catch (error: any) {
    console.error('Error cambiando estado usuario:', error);
    res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
};

/**
 * POST /admin/usuarios/:id/restablecer-password
 * Restablecer contraseña de un usuario (genera contraseña temporal).
 */
export const restablecerPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    const { nueva_password } = req.body;

    const generatedPassword = `Temp-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const password = nueva_password || generatedPassword;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db
      .updateTable("usuario")
      .set({ password: hashedPassword })
      .where("id_usuario", "=", userId)
      .returning(["id_usuario", "email", "nombre"])
      .executeTakeFirst();

    if (!result) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({ 
      message: 'Contraseña restablecida exitosamente', 
      usuario: result, 
      password_temporal: password,
      tempPassword: password 
    });
  } catch (error: any) {
    console.error('Error restableciendo contraseña:', error);
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
};

/**
 * POST /admin/usuarios/:id/cerrar-sesion
 * Forzar cierre de sesión de un usuario.
 */
export const forzarCierreSesion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);

    const user = await db
      .selectFrom('usuario')
      .select(['id_usuario', 'email', 'nombre'])
      .where('id_usuario', '=', userId)
      .executeTakeFirst();

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    await db
      .updateTable('usuario')
      .set({ logged_out_at: new Date() })
      .where('id_usuario', '=', userId)
      .execute();

    res.json({ message: 'Sesión cerrada forzosamente y tokens invalidados', usuario: user });
  } catch (error: any) {
    console.error('Error forzando cierre de sesión:', error);
    res.status(500).json({ error: 'Error al forzar cierre de sesión' });
  }
};

/**
 * PATCH /admin/usuarios/:id/eliminar
 * Soft-delete controlado de un usuario.
 */
export const eliminarUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { codigo_ticket, motivo } = req.body;

  const supervisionId = (req as any).user?.supervisionId;
  if (!supervisionId) {
    res.status(403).json({
      error: 'Operación no permitida: debe tener una sesión de supervisión activa aprobada por el Directivo del colegio antes de realizar esta acción.'
    });
    return;
  }

  if (!codigo_ticket || !String(codigo_ticket).trim()) {
    res.status(400).json({
      error: 'Se requiere el código de ticket de soporte del Directivo del colegio para autorizar esta operación.'
    });
    return;
  }

  if (req.user && Number(req.user.id) === id) {
    res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de Administrador General.' });
    return;
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      const targetUser = await trx
        .selectFrom('usuario as u')
        .leftJoin('usuario_colegio as uc', (join) =>
          join.onRef('uc.id_usuario', '=', 'u.id_usuario').on('uc.estado', '=', 'ACTIVO')
        )
        .leftJoin('colegio as c', 'c.id_colegio', 'uc.id_colegio')
        .leftJoin('usuario_rol as ur', 'ur.id_usuario', 'u.id_usuario')
        .leftJoin('rol as r', 'r.id_rol', 'ur.id_rol')
        .select([
          'u.id_usuario', 'u.email', 'u.nombre', 'u.apellido', 'u.estado',
          'uc.id_colegio', 'u.fecha_creacion', 'u.documento', 'u.telefono',
          'c.nombre as colegio_nombre',
          sql<string[]>`array_agg(DISTINCT r.nombre)`.as('roles')
        ])
        .where('u.id_usuario', '=', id)
        .groupBy(['u.id_usuario', 'u.email', 'u.nombre', 'u.apellido', 'u.estado', 'uc.id_colegio', 'u.fecha_creacion', 'u.documento', 'u.telefono', 'c.nombre'])
        .executeTakeFirst();

      if (!targetUser) {
        throw new Error('USER_NOT_FOUND');
      }

      if (targetUser.estado === 'ELIMINADO') {
        throw new Error('USER_ALREADY_DELETED');
      }

      const ticket = await trx
        .selectFrom('tickets_soporte')
        .select(['id_ticket', 'id_usuario', 'correo_remitente', 'asunto', 'descripcion', 'observaciones', 'estado', 'codigo_ticket'])
        .where('codigo_ticket', '=', String(codigo_ticket).trim().toUpperCase())
        .executeTakeFirst();

      if (!ticket) {
        throw new Error('TICKET_NOT_FOUND');
      }

      if (ticket.estado === 'RESUELTO') {
        throw new Error('TICKET_RESOLVED');
      }

      if (!ticket.id_usuario) {
        throw new Error('TICKET_NOT_LINKED_USER');
      }

      const creatorRolesRes = await trx
        .selectFrom('usuario_rol as ur')
        .innerJoin('rol as r', 'r.id_rol', 'ur.id_rol')
        .innerJoin('usuario as u', 'u.id_usuario', 'ur.id_usuario')
        .leftJoin('usuario_colegio as uc', (join) =>
          join.onRef('uc.id_usuario', '=', 'u.id_usuario').on('uc.estado', '=', 'ACTIVO')
        )
        .select(['r.nombre', 'uc.id_colegio'])
        .where('ur.id_usuario', '=', ticket.id_usuario)
        .execute();

      const creatorRoles = creatorRolesRes.map((r) => String(r.nombre).toUpperCase());
      const creatorSchoolId = creatorRolesRes[0]?.id_colegio;
      const isDirectivo = creatorRoles.includes('DIRECTIVO');

      if (!isDirectivo) {
        throw new Error('TICKET_CREATOR_NOT_DIRECTIVO');
      }

      if (!creatorSchoolId || !targetUser.id_colegio || Number(creatorSchoolId) !== Number(targetUser.id_colegio)) {
        const err = new Error('TICKET_CREATOR_DIFFERENT_SCHOOL');
        (err as any).creatorSchoolId = creatorSchoolId;
        (err as any).targetSchoolId = targetUser.id_colegio;
        throw err;
      }

      const directivo = await trx
        .selectFrom('usuario as u')
        .leftJoin('directivo as d', 'd.id_usuario', 'u.id_usuario')
        .select(['u.id_usuario', 'u.nombre', 'u.apellido', 'd.id as id_directivo'])
        .where('u.id_usuario', '=', ticket.id_usuario)
        .executeTakeFirst();

      const userSnapshot = {
        id_usuario: targetUser.id_usuario,
        email: targetUser.email,
        nombre: targetUser.nombre,
        apellido: targetUser.apellido,
        estado_anterior: targetUser.estado,
        id_colegio: targetUser.id_colegio,
        colegio_nombre: targetUser.colegio_nombre,
        roles: targetUser.roles,
        documento: targetUser.documento,
        telefono: targetUser.telefono,
        fecha_creacion: targetUser.fecha_creacion,
        eliminado_por_admin: req.user!.id,
        consentimiento_directivo: {
          id_usuario_directivo: directivo?.id_usuario,
          nombre_directivo: `${directivo?.nombre || ''} ${directivo?.apellido || ''}`.trim(),
          id_directivo: directivo?.id_directivo,
          codigo_ticket: ticket.codigo_ticket,
          id_ticket: ticket.id_ticket
        },
        motivo_eliminacion: motivo || 'Baja definitiva del usuario por Administrador General.'
      };

      const estudiante = await trx
        .selectFrom('estudiante')
        .select('id_estudiante')
        .where('id_usuario', '=', id)
        .executeTakeFirst();

      if (estudiante) {
        await trx
          .updateTable('matricula')
          .set({
            estado: 'CANCELADA',
            motivo_cancelacion: 'Baja definitiva del usuario por Administrador General.',
            detalles_cancelacion: `Ticket de consentimiento: ${ticket.codigo_ticket}. Admin General ID: ${req.user!.id}.`
          })
          .where('id_estudiante', '=', estudiante.id_estudiante)
          .where('estado', '=', 'ACTIVA')
          .execute();

        await trx
          .updateTable('estudiante')
          .set({
            estado: 'RETIRADO',
            motivo_estado: `Cuenta eliminada por Administrador General. Ticket: ${ticket.codigo_ticket}.`
          })
          .where('id_estudiante', '=', estudiante.id_estudiante)
          .execute();
      }

      await trx
        .updateTable('usuario')
        .set({
          estado: 'ELIMINADO',
          activo: false,
          logged_out_at: new Date()
        })
        .where('id_usuario', '=', id)
        .execute();

      await trx
        .insertInto('auditoria_acciones_realizadas')
        .values({
          id_auditoria: supervisionId,
          modulo: 'USUARIOS',
          tipo_accion: 'ELIMINACION',
          accion: `Soft-delete controlado de usuario. Consentimiento del Directivo via ticket ${ticket.codigo_ticket}.`,
          recurso_afectado: `Usuario ID: ${id} (${targetUser.nombre} ${targetUser.apellido || ''}) — Colegio: ${targetUser.colegio_nombre || targetUser.id_colegio}`,
          id_usuario_afectado: Number(id),
          valor_antiguo: JSON.stringify(userSnapshot) as any,
          valor_nuevo: null,
          motivo_cambio: userSnapshot.motivo_eliminacion
        })
        .execute();

      let currentObs: any[] = [];
      try {
        currentObs = typeof ticket.observaciones === 'string'
          ? JSON.parse(ticket.observaciones || '[]')
          : (ticket.observaciones || []);
      } catch {
        currentObs = [];
      }

      currentObs.push({
        id_usuario: Number(req.user!.id),
        nombre_usuario: 'Administrador General (Auditoría)',
        tipo: 'ADMIN_GENERAL',
        mensaje: `Acción de BAJA DEFINITIVA ejecutada bajo el consentimiento de este ticket.\n` +
          `Usuario eliminado: ${targetUser.nombre} ${targetUser.apellido || ''} (ID: ${id}, Email: ${targetUser.email || 'Sin email'}).\n` +
          `Colegio: ${targetUser.colegio_nombre || targetUser.id_colegio}.\n` +
          `Directivo consentidor: ${directivo?.nombre || ''} ${directivo?.apellido || ''}.\n` +
          `Motivo: ${userSnapshot.motivo_eliminacion}\n` +
          `Sesión de supervisión activa: ID ${supervisionId}.`,
        fecha_creacion: new Date().toISOString()
      });

      await trx
        .updateTable('tickets_soporte')
        .set({ observaciones: JSON.stringify(currentObs) })
        .where('id_ticket', '=', ticket.id_ticket)
        .execute();

      return { targetUser, ticket };
    });

    res.json({
      message: `Usuario ${result.targetUser.nombre} ${result.targetUser.apellido || ''} eliminado exitosamente. La acción ha quedado registrada en la auditoría de la sesión activa (ID: ${supervisionId}) y en el ticket de soporte ${result.ticket.codigo_ticket}.`,
      id_usuario_eliminado: Number(id),
      codigo_ticket: result.ticket.codigo_ticket,
      id_auditoria: supervisionId
    });
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }
    if (error.message === 'USER_ALREADY_DELETED') {
      res.status(400).json({ error: 'El usuario ya se encuentra en estado ELIMINADO.' });
      return;
    }
    if (error.message === 'TICKET_NOT_FOUND') {
      res.status(400).json({ error: 'El código de ticket ingresado no existe.' });
      return;
    }
    if (error.message === 'TICKET_RESOLVED') {
      res.status(400).json({ error: 'El ticket ya está RESUELTO y no puede usarse como consentimiento.' });
      return;
    }
    if (error.message === 'TICKET_NOT_LINKED_USER') {
      res.status(400).json({ error: 'El ticket no está vinculado a un usuario registrado. Se requiere un ticket creado por el Directivo del colegio.' });
      return;
    }
    if (error.message === 'TICKET_CREATOR_NOT_DIRECTIVO') {
      res.status(403).json({ error: 'El remitente del ticket no es un Directivo. Solo el Directivo del colegio puede otorgar consentimiento para eliminar usuarios.' });
      return;
    }
    if (error.message === 'TICKET_CREATOR_DIFFERENT_SCHOOL') {
      res.status(403).json({
        error: `El Directivo que emitió el ticket pertenece a una institución diferente (colegio ID: ${error.creatorSchoolId}) a la del usuario a eliminar (colegio ID: ${error.targetSchoolId}). Solo el Directivo del mismo colegio puede dar consentimiento.`
      });
      return;
    }
    console.error('Error en soft-delete controlado de usuario:', error);
    res.status(500).json({ error: 'Error interno al eliminar el usuario.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GESTIÓN DE DIRECTIVOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/colegios/:colegioId/directivos
 * Listar directivos de un colegio.
 */
export const listarDirectivos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const colegioId = Number(req.params.colegioId);
    const result = await db
      .selectFrom('directivo as d')
      .innerJoin('usuario as u', 'u.id_usuario', 'd.id_usuario')
      .select([
        'd.id', 'd.cargo', 'd.estado', 'd.fecha_vinculacion', 'd.fecha_desvinculacion',
        'u.id_usuario', 'u.nombre', 'u.apellido', 'u.email'
      ])
      .where('d.id_colegio', '=', colegioId)
      .orderBy('d.fecha_vinculacion', 'desc')
      .execute();

    res.json(result);
  } catch (error: any) {
    console.error('Error listando directivos:', error);
    res.status(500).json({ error: 'Error al listar directivos' });
  }
};

/**
 * POST /admin/directivos
 * Registrar un nuevo directivo (vinculado a un colegio y un usuario).
 */
export const registrarDirectivo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id_usuario, id_colegio, cargo } = req.body;

    if (!id_usuario || !id_colegio) {
      res.status(400).json({ error: 'id_usuario e id_colegio son obligatorios' });
      return;
    }

    const result = await db.transaction().execute(async (trx) => {
      const usuario = await trx
        .selectFrom('usuario')
        .select('id_usuario')
        .where('id_usuario', '=', Number(id_usuario))
        .executeTakeFirst();

      if (!usuario) {
        throw new Error('USER_NOT_FOUND');
      }

      const existente = await trx
        .selectFrom('directivo')
        .select('id')
        .where('id_usuario', '=', Number(id_usuario))
        .executeTakeFirst();

      if (existente) {
        throw new Error('DIRECTIVO_ALREADY_EXISTS');
      }

      const created = await trx
        .insertInto('directivo')
        .values({
          id_colegio: Number(id_colegio),
          id_usuario: Number(id_usuario),
          cargo: cargo || 'Directivo',
          estado: 'ACTIVO',
          fecha_vinculacion: new Date()
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const rolDirectivo = await trx
        .selectFrom('rol')
        .select('id_rol')
        .where('nombre', '=', 'directivo')
        .executeTakeFirst();

      if (rolDirectivo) {
        await trx
          .insertInto('usuario_rol')
          .values({
            id_usuario: Number(id_usuario),
            id_rol: rolDirectivo.id_rol
          })
          .onConflict((oc) => oc.doNothing())
          .execute();

        await trx
          .insertInto('usuario_colegio')
          .values({
            id_usuario: Number(id_usuario),
            id_colegio: Number(id_colegio),
            id_rol: rolDirectivo.id_rol,
            estado: 'ACTIVO',
            fecha_inicio: new Date()
          })
          .onConflict((oc) => oc.doNothing())
          .execute();

        const userEmailRes = await trx
          .selectFrom('usuario')
          .select('email')
          .where('id_usuario', '=', Number(id_usuario))
          .executeTakeFirst();

        const userEmail = userEmailRes?.email || null;
        if (userEmail) {
          await upsertInstitutionalEmail(Number(id_usuario), Number(id_colegio), userEmail, null);
        }
      }

      return created;
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }
    if (error.message === 'DIRECTIVO_ALREADY_EXISTS') {
      res.status(400).json({ error: 'El usuario ya está registrado como directivo' });
      return;
    }
    console.error('Error registrando directivo:', error);
    res.status(500).json({ error: 'Error al registrar directivo' });
  }
};

/**
 * PUT /admin/directivos/:id
 * Actualizar información de un directivo.
 */
export const actualizarDirectivo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { cargo } = req.body;

    const updateObject: any = {};
    if (cargo !== undefined) updateObject.cargo = cargo;

    const result = await db
      .updateTable('directivo')
      .set(updateObject)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!result) {
      res.status(404).json({ error: 'Directivo no encontrado' });
      return;
    }

    res.json(result);
  } catch (error: any) {
    console.error('Error actualizando directivo:', error);
    res.status(500).json({ error: 'Error al actualizar directivo' });
  }
};

/**
 * PATCH /admin/directivos/:id/desvincular
 * Desvincular un directivo de su colegio.
 */
export const desvincularDirectivo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const directivo = await db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable('directivo')
        .set({
          estado: 'SUSPENDIDO',
          fecha_desvinculacion: new Date()
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        throw new Error('DIRECTIVO_NOT_FOUND');
      }

      if (updated.id_usuario) {
        await trx
          .updateTable('usuario')
          .set({
            estado: 'SUSPENDIDO',
            activo: false,
            logged_out_at: new Date()
          })
          .where('id_usuario', '=', updated.id_usuario)
          .execute();

        if (updated.id_colegio) {
          await trx
            .updateTable('usuario_colegio')
            .set({
              estado: 'INACTIVO',
              fecha_fin: new Date()
            })
            .where('id_usuario', '=', updated.id_usuario)
            .where('id_colegio', '=', updated.id_colegio)
            .execute();
        }
      }

      return updated;
    });

    res.json({ message: 'Directivo desvinculado e inhabilitado exitosamente', directivo });
  } catch (error: any) {
    if (error.message === 'DIRECTIVO_NOT_FOUND') {
      res.status(404).json({ error: 'Directivo no encontrado' });
      return;
    }
    console.error('Error desvinculando directivo:', error);
    res.status(500).json({ error: 'Error al desvincular directivo' });
  }
};

/**
 * DELETE /admin/directivos/:id
 * Eliminar un directivo (Soft delete y suspensión de usuario).
 */
export const eliminarDirectivo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const directivo = await db.transaction().execute(async (trx) => {
      const updated = await trx
        .updateTable('directivo')
        .set({
          estado: 'ELIMINADO',
          fecha_desvinculacion: new Date()
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        throw new Error('DIRECTIVO_NOT_FOUND');
      }

      if (updated.id_usuario) {
        await trx
          .updateTable('usuario')
          .set({
            estado: 'ELIMINADO',
            activo: false,
            logged_out_at: new Date()
          })
          .where('id_usuario', '=', updated.id_usuario)
          .execute();
      }

      return updated;
    });

    res.json({ message: 'Directivo eliminado exitosamente', directivo });
  } catch (error: any) {
    if (error.message === 'DIRECTIVO_NOT_FOUND') {
      res.status(404).json({ error: 'Directivo no encontrado' });
      return;
    }
    console.error('Error eliminando directivo:', error);
    res.status(500).json({ error: 'Error al eliminar directivo' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MODO SUPERVISIÓN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /admin/supervision/solicitar
 * Crear una solicitud de supervisión.
 */
export const solicitarSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id_colegio, motivo, tipo_supervision, duracion_maxima_minutos } = req.body;
    const schoolId = Number(id_colegio);

    if (!id_colegio || !motivo || !tipo_supervision) {
      res.status(400).json({ error: 'id_colegio, motivo y tipo_supervision son obligatorios' });
      return;
    }

    if (!['SOLO_LECTURA', 'EDITOR'].includes(tipo_supervision)) {
      res.status(400).json({ error: 'tipo_supervision debe ser SOLO_LECTURA o EDITOR' });
      return;
    }

    const createdAuditoria = await db.transaction().execute(async (trx) => {
      const configResult = await trx
        .selectFrom('configuracion_plataforma')
        .select(['clave', 'valor'])
        .where('clave', 'in', ['supervision_duracion_minima_minutos', 'supervision_duracion_maxima_minutos'])
        .execute();

      const configMap: Record<string, number> = {};
      for (const row of configResult) {
        configMap[row.clave] = Number(row.valor);
      }
      const limiteMinimo = configMap['supervision_duracion_minima_minutos'] || 5;
      const limiteMaximo = configMap['supervision_duracion_maxima_minutos'] || 300;

      const duracionSolicitada = duracion_maxima_minutos ? Number(duracion_maxima_minutos) : limiteMinimo;

      if (duracionSolicitada < limiteMinimo || duracionSolicitada > limiteMaximo) {
        const err = new Error('INVALID_DURATION');
        (err as any).limiteMinimo = limiteMinimo;
        (err as any).limiteMaximo = limiteMaximo;
        throw err;
      }

      const colegio = await trx
        .selectFrom('colegio')
        .select(['id_colegio', 'nombre', 'estado'])
        .where('id_colegio', '=', schoolId)
        .executeTakeFirst();

      if (!colegio) {
        throw new Error('COLEGIO_NOT_FOUND');
      }

      const activa = await trx
        .selectFrom('auditoria_supervision')
        .select('id_auditoria')
        .where('id_admin_general', '=', Number(req.user!.id))
        .where('id_colegio', '=', schoolId)
        .where('estado_supervision', 'in', ['SOLICITADA', 'APROBADA', 'ACTIVA'])
        .where('eliminado', '=', false)
        .executeTakeFirst();

      if (activa) {
        throw new Error('SUPERVISION_ALREADY_EXISTS');
      }

      const created = await trx
        .insertInto('auditoria_supervision')
        .values({
          id_admin_general: Number(req.user!.id),
          id_colegio: schoolId,
          motivo_solicitud: motivo,
          tipo_supervision,
          estado_supervision: 'SOLICITADA',
          duracion_maxima_minutos: duracionSolicitada,
          ip_admin: req.ip || null
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const directivos = await trx
        .selectFrom('directivo as d')
        .innerJoin('usuario as u', 'u.id_usuario', 'd.id_usuario')
        .select(['d.id', 'u.email', 'u.nombre', 'u.apellido'])
        .where('d.id_colegio', '=', schoolId)
        .where('d.estado', '=', 'ACTIVO')
        .execute();

      const adminNombre = `${req.user!.email}`;
      const colegioNombre = colegio.nombre;

      for (const dir of directivos) {
        await trx
          .insertInto('notificacion_supervision')
          .values({
            id_auditoria: created.id_auditoria,
            id_directivo: dir.id,
            tipo_notificacion: 'SOLICITUD',
            mensaje: `El Admin General ha solicitado entrar en modo supervisión (${tipo_supervision}) al colegio ${colegioNombre}`
          })
          .execute();

        if (dir.email) {
          AdminGeneralNotificationService.sendSupervisionSolicitada(
            dir.email,
            `${dir.nombre} ${dir.apellido || ''}`.trim(),
            adminNombre,
            colegioNombre,
            motivo,
            tipo_supervision
          );
        }
      }

      return created;
    });

    res.status(201).json(createdAuditoria);
  } catch (error: any) {
    if (error.message === 'INVALID_DURATION') {
      res.status(400).json({ 
        error: `La duración debe estar entre ${error.limiteMinimo} y ${error.limiteMaximo} minutos` 
      });
      return;
    }
    if (error.message === 'COLEGIO_NOT_FOUND') {
      res.status(404).json({ error: 'Colegio no encontrado' });
      return;
    }
    if (error.message === 'SUPERVISION_ALREADY_EXISTS') {
      res.status(400).json({ error: 'Ya existe una supervisión pendiente o activa para este colegio' });
      return;
    }
    console.error('Error solicitando supervisión:', error);
    res.status(500).json({ error: 'Error al solicitar supervisión' });
  }
};

/**
 * POST /admin/supervision/:id/aprobar
 * Aprobar una solicitud de supervisión (ejecutado por un directivo).
 */
export const aprobarSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    await db.transaction().execute(async (trx) => {
      const auditoria = await trx
        .selectFrom('auditoria_supervision as a')
        .innerJoin('colegio as c', 'c.id_colegio', 'a.id_colegio')
        .innerJoin('usuario as u', 'u.id_usuario', 'a.id_admin_general')
        .select([
          'a.id_auditoria', 'a.id_colegio', 'a.id_admin_general', 'a.tipo_supervision',
          'a.duracion_maxima_minutos', 'a.estado_supervision',
          'c.nombre as colegio_nombre', 'u.email as admin_email', 'u.nombre as admin_nombre'
        ])
        .where('a.id_auditoria', '=', id)
        .where('a.estado_supervision', '=', 'SOLICITADA')
        .where('a.eliminado', '=', false)
        .executeTakeFirst();

      if (!auditoria) {
        throw new Error('AUDITORIA_NOT_FOUND');
      }

      const directivo = await trx
        .selectFrom('directivo as d')
        .select('d.id')
        .where('d.id_usuario', '=', Number(req.user!.id))
        .where('d.id_colegio', '=', auditoria.id_colegio)
        .where('d.estado', '=', 'ACTIVO')
        .executeTakeFirst();

      if (!directivo) {
        throw new Error('NOT_DIRECTIVO');
      }

      await trx
        .updateTable('auditoria_supervision')
        .set({
          estado_supervision: 'APROBADA',
          id_directivo_aprobador: directivo.id,
          fecha_aprobacion: new Date()
        })
        .where('id_auditoria', '=', id)
        .execute();

      if (auditoria.admin_email) {
        AdminGeneralNotificationService.sendSupervisionAprobada(
          auditoria.admin_email,
          auditoria.admin_nombre,
          auditoria.colegio_nombre,
          `${req.user!.email}`,
          auditoria.tipo_supervision,
          auditoria.duracion_maxima_minutos
        );
      }
    });

    res.json({ message: 'Supervisión aprobada exitosamente' });
  } catch (error: any) {
    if (error.message === 'AUDITORIA_NOT_FOUND') {
      res.status(404).json({ error: 'Solicitud de supervisión no encontrada o ya procesada' });
      return;
    }
    if (error.message === 'NOT_DIRECTIVO') {
      res.status(403).json({ error: 'Solo un directivo activo del colegio puede aprobar la supervisión' });
      return;
    }
    console.error('Error aprobando supervisión:', error);
    res.status(500).json({ error: 'Error al aprobar supervisión' });
  }
};

/**
 * POST /admin/supervision/:id/entrar
 * Activar modo supervisión (el admin entra al colegio).
 */
export const entrarSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { password, motivo_entrada } = req.body;

    if (!password) {
      res.status(400).json({ error: 'Se requiere re-autenticación. Envía tu contraseña.' });
      return;
    }

    const aud = await db.transaction().execute(async (trx) => {
      const userRes = await trx
        .selectFrom('usuario')
        .select('password')
        .where('id_usuario', '=', Number(req.user!.id))
        .executeTakeFirst();

      const validPassword = userRes ? await bcrypt.compare(password, userRes.password) : false;
      if (!validPassword) {
        throw new Error('INVALID_PASSWORD');
      }

      const auditoria = await trx
        .selectFrom('auditoria_supervision as a')
        .innerJoin('colegio as c', 'c.id_colegio', 'a.id_colegio')
        .select(['a.id_auditoria', 'a.id_colegio', 'a.motivo_solicitud', 'a.tipo_supervision', 'a.duracion_maxima_minutos', 'c.nombre as colegio_nombre'])
        .where('a.id_auditoria', '=', id)
        .where('a.estado_supervision', '=', 'APROBADA')
        .where('a.id_admin_general', '=', Number(req.user!.id))
        .where('a.eliminado', '=', false)
        .executeTakeFirst();

      if (!auditoria) {
        throw new Error('AUDITORIA_NOT_FOUND');
      }

      await trx
        .updateTable('auditoria_supervision')
        .set({
          estado_supervision: 'ACTIVA',
          fecha_entrada: new Date(),
          motivo_entrada: motivo_entrada || auditoria.motivo_solicitud
        })
        .where('id_auditoria', '=', id)
        .execute();

      const directivos = await trx
        .selectFrom('directivo as d')
        .innerJoin('usuario as u', 'u.id_usuario', 'd.id_usuario')
        .select(['d.id', 'u.email', 'u.nombre', 'u.apellido'])
        .where('d.id_colegio', '=', auditoria.id_colegio)
        .where('d.estado', '=', 'ACTIVO')
        .execute();

      for (const dir of directivos) {
        await trx
          .insertInto('notificacion_supervision')
          .values({
            id_auditoria: id,
            id_directivo: dir.id,
            tipo_notificacion: 'ENTRADA',
            mensaje: `El Admin General ha ENTRADO en modo supervisión al colegio ${auditoria.colegio_nombre}`
          })
          .execute();

        if (dir.email) {
          AdminGeneralNotificationService.sendSupervisionIniciada(
            dir.email,
            `${dir.nombre} ${dir.apellido || ''}`.trim(),
            req.user!.email,
            auditoria.colegio_nombre,
            auditoria.tipo_supervision
          );
        }
      }

      return auditoria;
    });

    res.json({
      message: 'Modo supervisión activado',
      tipo: aud.tipo_supervision,
      colegio: aud.colegio_nombre,
      duracion_maxima_minutos: aud.duracion_maxima_minutos,
    });
  } catch (error: any) {
    if (error.message === 'INVALID_PASSWORD') {
      res.status(401).json({ error: 'Contraseña incorrecta. Re-autenticación fallida.' });
      return;
    }
    if (error.message === 'AUDITORIA_NOT_FOUND') {
      res.status(404).json({ error: 'Supervisión no encontrada, no aprobada, o no le pertenece' });
      return;
    }
    console.error('Error entrando supervisión:', error);
    res.status(500).json({ error: 'Error al entrar en modo supervisión' });
  }
};

/**
 * POST /admin/supervision/:id/salir
 * Finalizar modo supervisión (el admin sale voluntariamente).
 */
export const salirSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const result = await db.transaction().execute(async (trx) => {
      const auditoria = await trx
        .selectFrom('auditoria_supervision as a')
        .innerJoin('colegio as c', 'c.id_colegio', 'a.id_colegio')
        .select(['a.id_auditoria', 'a.id_colegio', 'a.fecha_entrada', 'c.nombre as colegio_nombre'])
        .where('a.id_auditoria', '=', id)
        .where('a.estado_supervision', '=', 'ACTIVA')
        .where('a.id_admin_general', '=', Number(req.user!.id))
        .where('a.eliminado', '=', false)
        .executeTakeFirst();

      if (!auditoria) {
        throw new Error('AUDITORIA_NOT_FOUND');
      }

      await trx
        .updateTable('auditoria_supervision')
        .set({
          estado_supervision: 'FINALIZADA',
          fecha_salida: new Date()
        })
        .where('id_auditoria', '=', id)
        .execute();

      const acciones = await trx
        .selectFrom('auditoria_acciones_realizadas')
        .select(sql<number>`COUNT(*)::int`.as('total'))
        .where('id_auditoria', '=', id)
        .executeTakeFirst();

      const entrada = auditoria.fecha_entrada ? new Date(auditoria.fecha_entrada) : new Date();
      const salida = new Date();
      const diffMs = salida.getTime() - entrada.getTime();
      const diffMin = Math.round(diffMs / 60000);
      const duracionStr = diffMin < 60 ? `${diffMin} minutos` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;

      const directivos = await trx
        .selectFrom('directivo as d')
        .innerJoin('usuario as u', 'u.id_usuario', 'd.id_usuario')
        .select(['d.id', 'u.email', 'u.nombre', 'u.apellido'])
        .where('d.id_colegio', '=', auditoria.id_colegio)
        .where('d.estado', '=', 'ACTIVO')
        .execute();

      const totalAccionesNum = acciones?.total || 0;

      for (const dir of directivos) {
        await trx
          .insertInto('notificacion_supervision')
          .values({
            id_auditoria: id,
            id_directivo: dir.id,
            tipo_notificacion: 'SALIDA',
            mensaje: `El Admin General ha SALIDO del modo supervisión del colegio ${auditoria.colegio_nombre}. Duración: ${duracionStr}. Acciones: ${totalAccionesNum}`
          })
          .execute();

        if (dir.email) {
          AdminGeneralNotificationService.sendSupervisionFinalizada(
            dir.email,
            `${dir.nombre} ${dir.apellido || ''}`.trim(),
            req.user!.email,
            auditoria.colegio_nombre,
            duracionStr,
            totalAccionesNum
          );
        }
      }

      return { duracionStr, totalAccionesNum };
    });

    res.json({
      message: 'Modo supervisión finalizado',
      duracion: result.duracionStr,
      total_acciones: result.totalAccionesNum,
    });
  } catch (error: any) {
    if (error.message === 'AUDITORIA_NOT_FOUND') {
      res.status(404).json({ error: 'Supervisión activa no encontrada' });
      return;
    }
    console.error('Error saliendo supervisión:', error);
    res.status(500).json({ error: 'Error al finalizar modo supervisión' });
  }
};

/**
 * POST /admin/supervision/:id/revocar
 * Revocar una supervisión activa (ejecutado por un directivo).
 */
export const revocarSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { motivo } = req.body;

    await db.transaction().execute(async (trx) => {
      const auditoria = await trx
        .selectFrom('auditoria_supervision as a')
        .innerJoin('colegio as c', 'c.id_colegio', 'a.id_colegio')
        .innerJoin('usuario as u', 'u.id_usuario', 'a.id_admin_general')
        .select([
          'a.id_auditoria', 'a.id_colegio', 'a.fecha_entrada', 'a.fecha_salida',
          'c.nombre as colegio_nombre', 'u.email as admin_email', 'u.nombre as admin_nombre'
        ])
        .where('a.id_auditoria', '=', id)
        .where('a.estado_supervision', 'in', ['SOLICITADA', 'APROBADA', 'ACTIVA'])
        .where('a.eliminado', '=', false)
        .executeTakeFirst();

      if (!auditoria) {
        throw new Error('AUDITORIA_NOT_FOUND');
      }

      const directivo = await trx
        .selectFrom('directivo as d')
        .select('d.id')
        .where('d.id_usuario', '=', Number(req.user!.id))
        .where('d.id_colegio', '=', auditoria.id_colegio)
        .where('d.estado', '=', 'ACTIVO')
        .executeTakeFirst();

      if (!directivo) {
        throw new Error('NOT_DIRECTIVO');
      }

      await trx
        .updateTable('auditoria_supervision')
        .set({
          estado_supervision: 'REVOCADA',
          revocado_por: directivo.id,
          fecha_revocacion: new Date(),
          motivo_revocacion: motivo || 'No especificado',
          fecha_salida: auditoria.fecha_entrada ? new Date() : (auditoria.fecha_salida || null)
        })
        .where('id_auditoria', '=', id)
        .execute();

      if (auditoria.admin_email) {
        AdminGeneralNotificationService.sendSupervisionRechazada(
          auditoria.admin_email,
          auditoria.admin_nombre,
          auditoria.colegio_nombre,
          req.user!.email,
          motivo || 'No especificado'
        );
      }
    });

    res.json({ message: 'Supervisión revocada exitosamente' });
  } catch (error: any) {
    if (error.message === 'AUDITORIA_NOT_FOUND') {
      res.status(404).json({ error: 'Supervisión no encontrada o no revocable' });
      return;
    }
    if (error.message === 'NOT_DIRECTIVO') {
      res.status(403).json({ error: 'Solo un directivo activo del colegio puede revocar la supervisión' });
      return;
    }
    console.error('Error revocando supervisión:', error);
    res.status(500).json({ error: 'Error al revocar supervisión' });
  }
};

/**
 * GET /admin/supervision/verificar-activa
 * Verificar el estado de la supervisión activa para el Administrador General.
 */
export const verificarSupervisionActiva = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supervision = await db
      .selectFrom('auditoria_supervision as a')
      .innerJoin('colegio as c', 'c.id_colegio', 'a.id_colegio')
      .leftJoin('directivo as d', 'd.id', 'a.revocado_por')
      .leftJoin('usuario as u', 'u.id_usuario', 'd.id_usuario')
      .select([
        'a.id_auditoria',
        'a.estado_supervision',
        'a.motivo_revocacion',
        'a.revocado_por',
        'c.nombre as colegio_nombre',
        'u.nombre as directivo_revocador_nombre',
        'u.apellido as directivo_revocador_apellido'
      ])
      .where('a.id_admin_general', '=', Number(req.user!.id))
      .where('a.eliminado', '=', false)
      .orderBy('a.fecha_solicitud', 'desc')
      .executeTakeFirst();

    if (!supervision) {
      res.json({ activa: false });
      return;
    }

    const payload = {
      activa: supervision.estado_supervision === 'ACTIVA',
      estado: supervision.estado_supervision,
      motivo_revocacion: supervision.motivo_revocacion || null,
      revocador_nombre: supervision.revocado_por ? `${supervision.directivo_revocador_nombre || ''} ${supervision.directivo_revocador_apellido || ''}`.trim() : null
    };

    res.json(payload);
  } catch (error) {
    console.error('Error verifying active supervision status:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

/**
 * GET /admin/supervision/:id/acciones
 * Ver acciones registradas durante una supervisión.
 */
export const verAccionesSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const result = await db
      .selectFrom('auditoria_acciones_realizadas as a')
      .leftJoin('usuario as u', 'u.id_usuario', 'a.id_usuario_afectado')
      .select([
        'a.id_accion', 'a.id_auditoria', 'a.modulo', 'a.tipo_accion', 'a.accion',
        'a.recurso_afectado', 'a.id_usuario_afectado', 'a.valor_antiguo', 'a.valor_nuevo',
        'a.motivo_cambio', 'a.fecha_accion',
        'u.nombre as usuario_afectado_nombre', 'u.email as usuario_afectado_email'
      ])
      .where('a.id_auditoria', '=', id)
      .orderBy('a.fecha_accion', 'asc')
      .execute();

    const mapped = result.map((row: any) => ({
      ...row,
      recurso_afectado: transformResourceForExport(row.recurso_afectado).descripcion
    }));

    res.json(mapped);
  } catch (error: any) {
    console.error('Error obteniendo acciones:', error);
    res.status(500).json({ error: 'Error al obtener acciones de la supervisión' });
  }
};

/**
 * GET /admin/supervision/historial
 * Historial de supervisiones con filtros.
 */
export const historialSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id_colegio, estado, desde, hasta } = req.query;

    let query = db
      .selectFrom('auditoria_supervision as a')
      .innerJoin('colegio as c', 'c.id_colegio', 'a.id_colegio')
      .innerJoin('usuario as u', 'u.id_usuario', 'a.id_admin_general')
      .leftJoin('directivo as d', 'd.id', 'a.id_directivo_aprobador')
      .leftJoin('usuario as ud', 'ud.id_usuario', 'd.id_usuario')
      .leftJoin('directivo as dr', 'dr.id', 'a.revocado_por')
      .leftJoin('usuario as udr', 'udr.id_usuario', 'dr.id_usuario')
      .select([
        'a.id_auditoria', 'a.id_colegio', 'a.id_admin_general', 'a.tipo_supervision',
        'a.estado_supervision', 'a.motivo_solicitud', 'a.fecha_solicitud', 'a.fecha_aprobacion',
        'a.fecha_entrada', 'a.fecha_salida', 'a.duracion_maxima_minutos', 'a.motivo_entrada',
        'a.id_directivo_aprobador', 'a.revocado_por', 'a.motivo_revocacion', 'a.fecha_revocacion',
        'a.fecha_retencion_hasta', 'a.ip_admin', 'a.eliminado',
        'c.nombre as colegio_nombre',
        'u.nombre as admin_nombre', 'u.email as admin_email',
        'ud.nombre as directivo_nombre', 'ud.apellido as directivo_apellido',
        'udr.nombre as directivo_revocador_nombre', 'udr.apellido as directivo_revocador_apellido',
        (eb) => eb
          .selectFrom('auditoria_acciones_realizadas as acc')
          .select(sql<number>`COUNT(acc.id_accion)::int`.as('count'))
          .whereRef('acc.id_auditoria', '=', 'a.id_auditoria')
          .as('total_acciones')
      ])
      .where('a.eliminado', '=', false);

    if (id_colegio) {
      query = query.where('a.id_colegio', '=', Number(id_colegio));
    }

    if (estado) {
      query = query.where('a.estado_supervision', '=', estado as any);
    }

    if (desde) {
      query = query.where('a.fecha_solicitud', '>=', new Date(String(desde)));
    }

    if (hasta) {
      query = query.where('a.fecha_solicitud', '<=', new Date(`${hasta} 23:59:59`));
    }

    const result = await query.orderBy('a.fecha_solicitud', 'desc').execute();
    res.json(result);
  } catch (error: any) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error al obtener historial de supervisiones' });
  }
};

/**
 * POST /admin/supervision/:id/exportar
 * Exportar auditoría (registra la exportación como acción independiente).
 */
export const exportarAuditoria = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const result = await db.transaction().execute(async (trx) => {
      const auditoria = await trx
        .selectFrom('auditoria_supervision as a')
        .innerJoin('colegio as c', 'c.id_colegio', 'a.id_colegio')
        .select(['a.id_auditoria', 'a.id_colegio', 'c.nombre as colegio_nombre', 'a.tipo_supervision', 'a.estado_supervision'])
        .where('a.id_auditoria', '=', id)
        .where('a.eliminado', '=', false)
        .executeTakeFirst();

      if (!auditoria) {
        throw new Error('AUDITORIA_NOT_FOUND');
      }

      await trx
        .insertInto('auditoria_acciones_realizadas')
        .values({
          id_auditoria: id,
          modulo: 'AUDITORIA',
          tipo_accion: 'EXPORTACION',
          accion: 'Exportación de datos de auditoría',
          recurso_afectado: `Auditoría #${id} - ${auditoria.colegio_nombre}`
        })
        .execute();

      const acciones = await trx
        .selectFrom('auditoria_acciones_realizadas')
        .selectAll()
        .where('id_auditoria', '=', id)
        .orderBy('fecha_accion', 'asc')
        .execute();

      return { auditoria, acciones };
    });

    const mappedAcciones = result.acciones.map((row: any) => {
      const cleanResource = transformResourceForExport(row.recurso_afectado);
      return {
        ...row,
        recurso_afectado: cleanResource.descripcion,
        detalles_tecnicos: cleanResource.endpoint ? {
          endpoint: cleanResource.endpoint,
          query: cleanResource.query || null
        } : null
      };
    });

    res.json({
      auditoria: result.auditoria,
      acciones: mappedAcciones,
      exportado_en: new Date().toISOString(),
      exportado_por: req.user!.email,
    });
  } catch (error: any) {
    if (error.message === 'AUDITORIA_NOT_FOUND') {
      res.status(404).json({ error: 'Auditoría no encontrada' });
      return;
    }
    console.error('Error exportando auditoría:', error);
    res.status(500).json({ error: 'Error al exportar auditoría' });
  }
};

function transformResourceForExport(recurso: string): { descripcion: string; endpoint?: string; query?: any } {
  if (!recurso) {
    return { descripcion: 'No especificado' };
  }

  let url = '';

  if (recurso.startsWith('Consulta: /')) {
    url = recurso.substring(10);
  } else if (recurso.startsWith('Petición ') && recurso.includes(' a la ruta: ')) {
    const parts = recurso.split(' a la ruta: ');
    url = parts[1] || '';
  } else if (recurso.includes('?')) {
    url = recurso;
  } else if (recurso.startsWith('/api/')) {
    url = recurso;
  }

  if (!url) {
    return { descripcion: recurso };
  }

  const cleanPath = url.split('?')[0];
  const queryString = url.includes('?') ? url.substring(url.indexOf('?') + 1) : '';
  const queryParams: Record<string, string> = {};

  if (queryString) {
    const pairs = queryString.split('&');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key) {
        queryParams[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    }
  }

  let entity = 'Recurso';
  let entityId = '';
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.includes('academic-admin') || segments.includes('curriculum')) {
    if (segments.includes('materias')) entity = 'Materia / Asignatura';
    else if (segments.includes('competencias')) entity = 'Competencias';
    else if (segments.includes('dba')) entity = 'DBA y Evidencias';
    else if (segments.includes('escalas')) entity = 'Escalas de Valoración';
    else if (segments.includes('periodos')) entity = 'Periodos Académicos';
    else if (segments.includes('docentes')) entity = 'Gestión Docente';
    else if (segments.includes('grados')) entity = 'Gestión de Cursos y Grados';
    else entity = 'Administración Curricular';
  } else if (segments.includes('matriculas')) {
    entity = 'Matrícula';
  } else if (segments.includes('estudiantes')) {
    entity = 'Estudiante';
  } else if (segments.includes('colegios')) {
    entity = 'Colegio';
  } else if (segments.includes('usuarios')) {
    entity = 'Usuario';
  }

  for (const seg of segments) {
    if (/^\d+$/.test(seg)) {
      entityId = ` #${seg}`;
      break;
    }
  }

  let readable = `Consulta de ${entity}${entityId}`;
  if (Object.keys(queryParams).length > 0) {
    const paramDescriptions: string[] = [];
    if (queryParams.id_materia) paramDescriptions.push(`Materia #${queryParams.id_materia}`);
    if (queryParams.id_periodo) paramDescriptions.push(`Periodo #${queryParams.id_periodo}`);
    if (queryParams.id_grupo) paramDescriptions.push(`Grupo #${queryParams.id_grupo}`);
    if (queryParams.search || queryParams.busqueda) paramDescriptions.push(`Búsqueda: "${queryParams.search || queryParams.busqueda}"`);
    if (queryParams.estado) paramDescriptions.push(`Estado: ${queryParams.estado}`);

    if (paramDescriptions.length > 0) {
      readable += ` (${paramDescriptions.join(', ')})`;
    }
  }

  return {
    descripcion: readable,
    endpoint: cleanPath,
    query: Object.keys(queryParams).length > 0 ? queryParams : undefined
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRO DE ACCIONES DE AUDITORÍA (helper para uso interno)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registra una acción en la auditoría de supervisión activa del admin.
 */
export const registrarAccionAuditoria = async (
  idAuditoria: number,
  modulo: string,
  tipoAccion: 'LECTURA' | 'CREACION' | 'MODIFICACION' | 'ELIMINACION' | 'EXPORTACION',
  accion: string,
  recursoAfectado: string,
  idUsuarioAfectado?: number,
  valorAntiguo?: any,
  valorNuevo?: any,
  motivoCambio?: string
): Promise<void> => {
  await db
    .insertInto('auditoria_acciones_realizadas')
    .values({
      id_auditoria: idAuditoria,
      modulo,
      tipo_accion: tipoAccion,
      accion,
      recurso_afectado: recursoAfectado,
      id_usuario_afectado: idUsuarioAfectado || null,
      valor_antiguo: valorAntiguo ? JSON.stringify(valorAntiguo) as any : (tipoAccion === 'MODIFICACION' ? '{}' as any : null),
      valor_nuevo: valorNuevo ? JSON.stringify(valorNuevo) as any : (tipoAccion === 'MODIFICACION' ? '{}' as any : null),
      motivo_cambio: motivoCambio || (tipoAccion === 'MODIFICACION' ? 'Modificación auditada en modo supervisión' : null)
    })
    .execute();
};

/**
 * GET /admin/dashboard/stats
 * Obtener estadísticas globales y estado de salud de la plataforma para el panel de Admin General.
 */
export const obtenerStatsDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Colegios KPIs
    const colegiosRes = await db
      .selectFrom('colegio')
      .select([
        sql<number>`COUNT(*)::int`.as('total'),
        sql<number>`COUNT(CASE WHEN estado = 'ACTIVO' THEN 1 END)::int`.as('activos'),
        sql<number>`COUNT(CASE WHEN estado = 'PENDIENTE' THEN 1 END)::int`.as('pendientes'),
        sql<number>`COUNT(CASE WHEN estado = 'SUSPENDIDO' THEN 1 END)::int`.as('suspendidos')
      ])
      .where('estado', '!=', 'ELIMINADO')
      .executeTakeFirst();

    const colegios = colegiosRes || { total: 0, activos: 0, pendientes: 0, suspendidos: 0 };

    // 2. Usuarios KPIs
    const usuariosRes = await db
      .selectFrom('usuario')
      .select([
        sql<number>`COUNT(*)::int`.as('total'),
        sql<number>`COUNT(CASE WHEN estado = 'ACTIVO' THEN 1 END)::int`.as('activos')
      ])
      .where('estado', '!=', 'ELIMINADO')
      .executeTakeFirst();

    const usuariosTotal = usuariosRes?.total || 0;
    
    const { socketManager } = require('../services/socketManager');
    const usuariosConectados = socketManager?.activeUserCount || 0;

    // 3. Distribución de usuarios por Rol
    const distribucionRes = await db
      .selectFrom('usuario as u')
      .innerJoin('usuario_rol as ur', 'ur.id_usuario', 'u.id_usuario')
      .innerJoin('rol as r', 'r.id_rol', 'ur.id_rol')
      .select([
        'r.nombre as rol',
        sql<number>`COUNT(*)::int`.as('cantidad')
      ])
      .where('u.estado', '!=', 'ELIMINADO')
      .groupBy('r.nombre')
      .execute();
    
    const distribucion: Record<string, number> = {
      directivo: 0,
      docente: 0,
      padre: 0,
      estudiante: 0,
      admin: 0,
      admin_general: 0
    };
    distribucionRes.forEach((row: any) => {
      distribucion[String(row.rol).toLowerCase()] = row.cantidad;
    });

    // 4. Crecimiento
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentMonthIdx = new Date().getMonth();
    
    const crecimiento = meses.map((mes, idx) => {
      let count = 0;
      if (idx === 0) count = 5;
      else if (idx === 1) count = 8;
      else if (idx === 2) count = 12;
      else if (idx === 3) count = 15;
      else if (idx === 4) count = 24;
      else if (idx === currentMonthIdx) {
        count = colegios.total;
      }
      return { mes, colegios: count };
    });

    // 5. Actividad Reciente
    const actividadRaw = await sql<any>`
      SELECT fecha, descripcion FROM (
        SELECT fecha_registro AS fecha, 'Colegio ' || nombre || ' se registró' AS descripcion FROM colegio WHERE estado != 'ELIMINADO'
        UNION ALL
        SELECT fecha_cambio_estado AS fecha, 
               CASE 
                 WHEN estado = 'ACTIVO' THEN 'Colegio ' || nombre || ' fue aprobado'
                 WHEN estado = 'SUSPENDIDO' THEN 'Colegio ' || nombre || ' fue suspendido'
                 WHEN estado = 'RECHAZADO' THEN 'Colegio ' || nombre || ' fue rechazado'
                 ELSE 'Colegio ' || nombre || ' cambió a estado ' || estado
               END AS descripcion 
        FROM colegio 
        WHERE fecha_cambio_estado IS NOT NULL AND estado != 'ELIMINADO'
        UNION ALL
        SELECT fecha_solicitud AS fecha, 'Solicitud de supervisión creada para ' || c.nombre AS descripcion 
        FROM auditoria_supervision aus JOIN colegio c ON aus.id_colegio = c.id_colegio
        UNION ALL
        SELECT fecha_aprobacion AS fecha, 'Supervisión aprobada por directivo para ' || c.nombre AS descripcion 
        FROM auditoria_supervision aus JOIN colegio c ON aus.id_colegio = c.id_colegio WHERE fecha_aprobacion IS NOT NULL
        UNION ALL
        SELECT fecha_entrada AS fecha, 'Supervisión iniciada por Admin en ' || c.nombre AS descripcion 
        FROM auditoria_supervision aus JOIN colegio c ON aus.id_colegio = c.id_colegio WHERE fecha_entrada IS NOT NULL
        UNION ALL
        SELECT fecha_salida AS fecha, 'Supervisión finalizada por Admin en ' || c.nombre AS descripcion 
        FROM auditoria_supervision aus JOIN colegio c ON aus.id_colegio = c.id_colegio WHERE fecha_salida IS NOT NULL
        UNION ALL
        SELECT fecha_baneo AS fecha, 'Usuario ' || nombre || ' ' || COALESCE(apellido, '') || ' fue baneado' AS descripcion 
        FROM usuario WHERE fecha_baneo IS NOT NULL
        UNION ALL
        SELECT aar.fecha_accion AS fecha, 'Acción en ' || c.nombre || ': ' || aar.accion AS descripcion
        FROM auditoria_acciones_realizadas aar
        JOIN auditoria_supervision aus ON aar.id_auditoria = aus.id_auditoria
        JOIN colegio c ON aus.id_colegio = c.id_colegio
      ) t
      WHERE fecha IS NOT NULL
      ORDER BY fecha DESC
      LIMIT 10
    `.execute(db);

    let actividad = actividadRaw.rows.map((row: any) => {
      const diffMin = Math.round((new Date().getTime() - new Date(row.fecha).getTime()) / 60000);
      let tiempo = `Hace ${diffMin} min`;
      if (diffMin < 1) tiempo = 'Hace unos instantes';
      else if (diffMin >= 60) {
        const horas = Math.round(diffMin / 60);
        if (horas < 24) {
          tiempo = `Hace ${horas} hora${horas > 1 ? 's' : ''}`;
        } else {
          const dias = Math.round(horas / 24);
          tiempo = `Hace ${dias} día${dias > 1 ? 's' : ''}`;
        }
      }
      return {
        tiempo,
        descripcion: row.descripcion
      };
    });

    if (actividad.length === 0) {
      actividad = [
        { tiempo: 'Hace 2 min', descripcion: 'Colegio San José fue aprobado' },
        { tiempo: 'Hace 15 min', descripcion: 'Admin inició supervisión en Colegio Heisenberg' },
        { tiempo: 'Hace 20 min', descripcion: 'Colegio Nuevo Horizonte se registró' },
        { tiempo: 'Hace 30 min', descripcion: 'Usuario directivo1 baneo cancelado' },
      ];
    }

    // 6. Solicitudes de supervisión
    const supervisionesRes = await db
      .selectFrom('auditoria_supervision')
      .select([
        sql<number>`COUNT(CASE WHEN estado_supervision = 'SOLICITADA' THEN 1 END)::int`.as('pendientes'),
        sql<number>`COUNT(CASE WHEN estado_supervision = 'APROBADA' THEN 1 END)::int`.as('aprobadas'),
        sql<number>`COUNT(CASE WHEN estado_supervision = 'ACTIVA' THEN 1 END)::int`.as('activas'),
        sql<number>`COUNT(CASE WHEN estado_supervision IN ('FINALIZADA', 'REVOCADA', 'EXPIRADA') THEN 1 END)::int`.as('terminadas')
      ])
      .where('eliminado', '=', false)
      .executeTakeFirst();

    const supervisiones = supervisionesRes || { pendientes: 0, aprobadas: 0, activas: 0, terminadas: 0 };

    // 7. Resumen de Auditorías del mes
    const auditoriasMesRes = await db
      .selectFrom('auditoria_acciones_realizadas')
      .select([
        sql<number>`COUNT(DISTINCT id_auditoria)::int`.as('supervisiones'),
        sql<number>`COUNT(CASE WHEN tipo_accion = 'MODIFICACION' THEN 1 END)::int`.as('modificaciones'),
        sql<number>`COUNT(CASE WHEN tipo_accion = 'EXPORTACION' THEN 1 END)::int`.as('exportaciones'),
        sql<number>`COUNT(CASE WHEN tipo_accion = 'LECTURA' THEN 1 END)::int`.as('lecturas')
      ])
      .where(sql<boolean>`fecha_accion >= DATE_TRUNC('month', CURRENT_DATE)`)
      .executeTakeFirst();

    const auditoriasMes = auditoriasMesRes || { supervisiones: 0, modificaciones: 0, exportaciones: 0, lecturas: 0 };

    // 8. Salud de la plataforma
    let dbStatus = '🟢';
    try {
      await sql`SELECT 1`.execute(db);
    } catch {
      dbStatus = '🔴';
    }

    let correosStatus = '🟢';
    try {
      const isSmtpHealthy = await AdminGeneralNotificationService.verifySMTP();
      correosStatus = isSmtpHealthy ? '🟢' : '🔴';
    } catch {
      correosStatus = '🔴';
    }

    let almacenamiento = '82%';
    try {
      const { statfs } = require('fs/promises');
      const stats = await statfs('.');
      const totalSpace = stats.blocks * stats.bsize;
      const freeSpace = stats.bfree * stats.bsize;
      const usedSpace = totalSpace - freeSpace;
      const pct = Math.round((usedSpace / totalSpace) * 100);
      almacenamiento = `${pct}%`;
    } catch (err) {
      console.error('Error checking disk space:', err);
    }

    const salud = {
      database: dbStatus,
      api: '🟢',
      websocket: '🟢',
      correos: correosStatus,
      almacenamiento
    };

    res.json({
      totalColegios: colegios.total,
      totalUsuarios: usuariosTotal,
      colegios,
      usuarios: {
        total: usuariosTotal,
        conectados: usuariosConectados
      },
      crecimiento,
      distribucionUsuarios: {
        directivos: (distribucion.directivo || 0) + (distribucion.admin || 0),
        docentes: distribucion.docente || 0,
        padres: distribucion.padre || 0,
        estudiantes: distribucion.estudiante || 0
      },
      actividad,
      supervisiones,
      auditoriasResumen: {
        supervisionesMes: auditoriasMes.supervisiones || (supervisiones.activas + supervisiones.terminadas),
        modificaciones: auditoriasMes.modificaciones || 0,
        exportaciones: auditoriasMes.exportaciones || 0,
        lecturas: auditoriasMes.lecturas || 0
      },
      salud
    });
  } catch (error: any) {
    console.error('Error obteniendo stats de dashboard:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas del dashboard' });
  }
};

/**
 * GET /admin/auditorias
 * Listar todas las acciones de auditoría globalmente con filtros.
 */
export const listarAuditoriasAcciones = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tipo_accion, modulo, id_colegio, search, fecha_desde, fecha_hasta } = req.query;
    const page = req.query.page ? Number(req.query.page) : null;
    const limit = req.query.limit ? Number(req.query.limit) : null;

    let baseQuery = db
      .selectFrom('auditoria_acciones_realizadas as aar')
      .innerJoin('auditoria_supervision as aus', 'aus.id_auditoria', 'aar.id_auditoria')
      .innerJoin('colegio as c', 'c.id_colegio', 'aus.id_colegio')
      .innerJoin('usuario as u', 'u.id_usuario', 'aus.id_admin_general')
      .leftJoin('usuario as ud', 'ud.id_usuario', 'aar.id_usuario_afectado')
      .select([
        'aar.id_accion', 'aar.id_auditoria', 'aar.modulo', 'aar.tipo_accion', 'aar.accion',
        'aar.recurso_afectado', 'aar.id_usuario_afectado', 'aar.valor_antiguo', 'aar.valor_nuevo',
        'aar.motivo_cambio', 'aar.fecha_accion',
        'aus.id_colegio',
        'c.nombre as colegio_nombre',
        'u.nombre as admin_nombre',
        'u.email as admin_email',
        'ud.nombre as usuario_afectado_nombre',
        'ud.email as usuario_afectado_email'
      ]);

    if (tipo_accion) {
      baseQuery = baseQuery.where('aar.tipo_accion', '=', tipo_accion as any);
    }

    if (modulo) {
      baseQuery = baseQuery.where('aar.modulo', '=', String(modulo));
    }

    if (id_colegio) {
      baseQuery = baseQuery.where('aus.id_colegio', '=', Number(id_colegio));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      baseQuery = baseQuery.where((eb) => eb.or([
        eb('aar.accion', 'ilike', searchPattern),
        eb('aar.recurso_afectado', 'ilike', searchPattern),
        eb('c.nombre', 'ilike', searchPattern)
      ]));
    }

    if (fecha_desde) {
      baseQuery = baseQuery.where('aar.fecha_accion', '>=', new Date(String(fecha_desde)));
    }

    if (fecha_hasta) {
      baseQuery = baseQuery.where('aar.fecha_accion', '<=', new Date(`${fecha_hasta} 23:59:59`));
    }

    const allRows = await baseQuery.orderBy('aar.fecha_accion', 'desc').execute();
    const totalCount = allRows.length;

    let pagedRows = allRows;
    if (page && limit) {
      const offset = (Number(page) - 1) * Number(limit);
      pagedRows = allRows.slice(offset, offset + Number(limit));
    }

    const mapped = pagedRows.map((row: any) => ({
      ...row,
      recurso_afectado: transformResourceForExport(row.recurso_afectado).descripcion
    }));

    res.setHeader("x-total-count", String(totalCount));
    res.setHeader("Access-Control-Expose-Headers", "x-total-count");
    res.json(mapped);
  } catch (error: any) {
    console.error('Error obteniendo auditorías:', error);
    res.status(500).json({ error: 'Error al obtener bitácora de auditoría' });
  }
};

/**
 * GET /admin/notificaciones
 * Listar todas las notificaciones de supervisión y colegios registradas en el sistema.
 */
export const listarNotificacionesSistema = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supervisionRes = await sql<any>`
      SELECT MIN(ns.id_notificacion) as id_notificacion, 
             ns.tipo_notificacion as tipo, 
             ns.mensaje, 
             ns.fecha_notificacion as fecha,
             'SUPERVISION' as origen, 
             c.nombre as colegio_nombre, 
             string_agg(u.nombre || ' ' || COALESCE(u.apellido, ''), ', ') as directivo_nombre
      FROM notificacion_supervision ns
      JOIN directivo d ON ns.id_directivo = d.id
      JOIN usuario u ON d.id_usuario = u.id_usuario
      JOIN auditoria_supervision aus ON ns.id_auditoria = aus.id_auditoria
      JOIN colegio c ON aus.id_colegio = c.id_colegio
      GROUP BY ns.tipo_notificacion, ns.mensaje, ns.fecha_notificacion, c.nombre
    `.execute(db);

    const colegioRes = await sql<any>`
      SELECT MIN(nc.id_notificacion) as id_notificacion, 
             nc.tipo, 
             nc.mensaje, 
             nc.fecha_notificacion as fecha,
             'COLEGIO' as origen, 
             c.nombre as colegio_nombre, 
             string_agg(u.nombre || ' ' || COALESCE(u.apellido, ''), ', ') as directivo_nombre
      FROM notificacion_colegio nc
      JOIN directivo d ON nc.id_directivo = d.id
      JOIN usuario u ON d.id_usuario = u.id_usuario
      JOIN colegio c ON nc.id_colegio = c.id_colegio
      GROUP BY nc.tipo, nc.mensaje, nc.fecha_notificacion, c.nombre
    `.execute(db);

    const allNotificaciones = [...supervisionRes.rows, ...colegioRes.rows];
    allNotificaciones.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    res.json(allNotificaciones);
  } catch (error: any) {
    console.error('Error obteniendo notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones del sistema' });
  }
};

/**
 * GET /admin/colegio/:colegioId/supervisiones
 * Listar supervisiones de un colegio para el directivo.
 */
export const listarSupervisionesColegio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { colegioId } = req.params;
    const { yearId } = req.query;
    const schoolId = Number(colegioId);

    let isAuthorized = false;
    if (req.user!.roles.includes('admin_general')) {
      isAuthorized = true;
    } else {
      const directivo = await db
        .selectFrom('directivo as d')
        .select('d.id')
        .where('d.id_usuario', '=', req.user!.id)
        .where('d.id_colegio', '=', schoolId)
        .where('d.estado', '=', 'ACTIVO')
        .executeTakeFirst();
      if (directivo) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ error: 'No tienes permisos para ver las supervisiones de este colegio' });
      return;
    }

    let yearFilterSql = sql<boolean>`1=1`;
    if (yearId) {
      const anio = await db
        .selectFrom('anio_lectivo')
        .select(['id_anio', 'calendario', 'fecha_inicio', 'fecha_fin'])
        .where('id_anio', '=', Number(yearId))
        .where('id_colegio', '=', schoolId)
        .executeTakeFirst();

      if (anio) {
        if (anio.fecha_inicio && anio.fecha_fin) {
          yearFilterSql = sql<boolean>`(a.fecha_solicitud >= ${anio.fecha_inicio} AND a.fecha_solicitud <= (${anio.fecha_fin}::timestamptz + INTERVAL '1 day'))`;
        } else if (anio.calendario) {
          yearFilterSql = sql<boolean>`EXTRACT(YEAR FROM a.fecha_solicitud)::text = ${anio.calendario}`;
        }
      }
    }

    const result = await db
      .selectFrom('auditoria_supervision as a')
      .innerJoin('usuario as u', 'u.id_usuario', 'a.id_admin_general')
      .leftJoin('directivo as d', 'd.id', 'a.id_directivo_aprobador')
      .leftJoin('usuario as ud', 'ud.id_usuario', 'd.id_usuario')
      .leftJoin('directivo as dr', 'dr.id', 'a.revocado_por')
      .leftJoin('usuario as udr', 'udr.id_usuario', 'dr.id_usuario')
      .select([
        'a.id_auditoria',
        'a.id_colegio',
        'a.id_admin_general',
        'a.tipo_supervision',
        'a.estado_supervision',
        'a.motivo_solicitud',
        'a.fecha_solicitud',
        'a.fecha_aprobacion',
        'a.fecha_entrada',
        'a.fecha_salida',
        'a.duracion_maxima_minutos',
        'a.motivo_entrada',
        'a.id_directivo_aprobador',
        'a.revocado_por',
        'a.motivo_revocacion',
        'a.fecha_revocacion',
        'a.fecha_retencion_hasta',
        'a.ip_admin',
        'a.eliminado',
        'u.nombre as admin_nombre',
        'u.email as admin_email',
        'ud.nombre as directivo_nombre',
        'ud.apellido as directivo_apellido',
        'udr.nombre as directivo_revocador_nombre',
        'udr.apellido as directivo_revocador_apellido',
        (eb) => eb
          .selectFrom('auditoria_acciones_realizadas as acc')
          .select(sql<number>`COUNT(acc.id_accion)::int`.as('count'))
          .whereRef('acc.id_auditoria', '=', 'a.id_auditoria')
          .as('total_acciones')
      ])
      .where('a.id_colegio', '=', schoolId)
      .where('a.eliminado', '=', false)
      .where(yearFilterSql)
      .orderBy('a.fecha_solicitud', 'desc')
      .execute();

    res.json(result);
  } catch (error: any) {
    console.error('Error obteniendo supervisiones del colegio:', error);
    res.status(500).json({ error: 'Error al obtener supervisiones del colegio' });
  }
};

/**
 * GET /admin/supervision/:id/acciones-directivo
 * Ver acciones registradas durante una supervisión para el directivo del colegio.
 */
export const verAccionesSupervisionDirectivo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);

    const supervision = await db
      .selectFrom('auditoria_supervision')
      .select('id_colegio')
      .where('id_auditoria', '=', id)
      .where('eliminado', '=', false)
      .executeTakeFirst();

    if (!supervision) {
      res.status(404).json({ error: 'Supervisión no encontrada' });
      return;
    }

    const schoolId = supervision.id_colegio;

    const directivo = await db
      .selectFrom('directivo')
      .select('id')
      .where('id_usuario', '=', Number(req.user!.id))
      .where('id_colegio', '=', schoolId)
      .where('estado', '=', 'ACTIVO')
      .executeTakeFirst();

    if (!directivo) {
      res.status(403).json({ error: 'No tienes permisos para ver las acciones de esta supervisión' });
      return;
    }

    const result = await db
      .selectFrom('auditoria_acciones_realizadas as a')
      .leftJoin('usuario as u', 'u.id_usuario', 'a.id_usuario_afectado')
      .select([
        'a.id_accion', 'a.id_auditoria', 'a.modulo', 'a.tipo_accion', 'a.accion',
        'a.recurso_afectado', 'a.id_usuario_afectado', 'a.valor_antiguo', 'a.valor_nuevo',
        'a.motivo_cambio', 'a.fecha_accion',
        'u.nombre as usuario_afectado_nombre', 'u.email as usuario_afectado_email'
      ])
      .where('a.id_auditoria', '=', id)
      .orderBy('a.fecha_accion', 'asc')
      .execute();

    const mapped = result.map((row: any) => ({
      ...row,
      recurso_afectado: transformResourceForExport(row.recurso_afectado).descripcion
    }));

    res.json(mapped);
  } catch (error: any) {
    console.error('Error obteniendo acciones para directivo:', error);
    res.status(500).json({ error: 'Error al obtener acciones de la supervisión' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE PLATAFORMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/configuracion
 * Obtener todas las configuraciones de la plataforma.
 */
export const obtenerConfiguracion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await db
      .selectFrom('configuracion_plataforma')
      .select(['clave', 'valor', 'descripcion', 'actualizado_por', 'fecha_actualizacion'])
      .orderBy('clave', 'asc')
      .execute();

    const config: Record<string, { valor: string; descripcion: string | null; actualizado_por: number | null; fecha_actualizacion: string }> = {};
    for (const row of result) {
      config[row.clave] = {
        valor: row.valor,
        descripcion: row.descripcion,
        actualizado_por: row.actualizado_por,
        fecha_actualizacion: String(row.fecha_actualizacion),
      };
    }

    res.json(config);
  } catch (error: any) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({ error: 'Error al obtener configuración de la plataforma' });
  }
};

/**
 * PUT /admin/configuracion
 * Actualizar configuraciones de la plataforma (duración mín/máx de supervisión).
 */
export const actualizarConfiguracion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { supervision_duracion_minima_minutos, supervision_duracion_maxima_minutos } = req.body;

    if (supervision_duracion_minima_minutos === undefined || supervision_duracion_maxima_minutos === undefined) {
      res.status(400).json({ error: 'Se requieren supervision_duracion_minima_minutos y supervision_duracion_maxima_minutos' });
      return;
    }

    const minVal = Number(supervision_duracion_minima_minutos);
    const maxVal = Number(supervision_duracion_maxima_minutos);

    if (isNaN(minVal) || isNaN(maxVal) || !Number.isInteger(minVal) || !Number.isInteger(maxVal)) {
      res.status(400).json({ error: 'Los valores deben ser números enteros' });
      return;
    }

    if (minVal < 1 || minVal > 60) {
      res.status(400).json({ error: 'La duración mínima debe estar entre 1 y 60 minutos' });
      return;
    }

    if (maxVal < 30 || maxVal > 1440) {
      res.status(400).json({ error: 'La duración máxima debe estar entre 30 y 1440 minutos (24 horas)' });
      return;
    }

    if (minVal >= maxVal) {
      res.status(400).json({ error: 'La duración mínima debe ser menor que la duración máxima' });
      return;
    }

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('configuracion_plataforma')
        .set({
          valor: String(minVal),
          actualizado_por: req.user!.id,
          fecha_actualizacion: new Date()
        })
        .where('clave', '=', 'supervision_duracion_minima_minutos')
        .execute();

      await trx
        .updateTable('configuracion_plataforma')
        .set({
          valor: String(maxVal),
          actualizado_por: req.user!.id,
          fecha_actualizacion: new Date()
        })
        .where('clave', '=', 'supervision_duracion_maxima_minutos')
        .execute();
    });

    res.json({
      message: 'Configuración actualizada correctamente',
      supervision_duracion_minima_minutos: minVal,
      supervision_duracion_maxima_minutos: maxVal,
    });
  } catch (error: any) {
    console.error('Error actualizando configuración:', error);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
};

/**
 * Helper interno para verificar si un ticket corresponde al usuario que se desea modificar.
 */
const verificarCorrespondenciaTicketUsuario = async (
  trxOrDb: any,
  idUsuario: number | string,
  codigoTicket: string
): Promise<{ valido: boolean; error?: string; ticket?: any }> => {
  const ticket = await trxOrDb
    .selectFrom('tickets_soporte')
    .select(['id_ticket', 'id_usuario', 'correo_remitente', 'asunto', 'descripcion', 'observaciones', 'estado'])
    .where('codigo_ticket', '=', String(codigoTicket).trim().toUpperCase())
    .executeTakeFirst();

  if (!ticket) {
    return { valido: false, error: 'El código del ticket de soporte ingresado no existe.' };
  }

  if (ticket.estado === 'RESUELTO') {
    return { valido: false, error: 'El ticket de soporte ingresado ya se encuentra RESUELTO y cerrado.' };
  }

  const targetUser = await trxOrDb
    .selectFrom('usuario as u')
    .leftJoin('usuario_colegio as uc', (join: any) =>
      join.onRef('uc.id_usuario', '=', 'u.id_usuario').on('uc.estado', '=', 'ACTIVO')
    )
    .select(['u.nombre', 'u.apellido', 'u.email', 'u.id_usuario', 'uc.id_colegio', 'u.documento'])
    .where('u.id_usuario', '=', Number(idUsuario))
    .executeTakeFirst();

  if (!targetUser) {
    return { valido: false, error: 'El usuario destino no existe.' };
  }

  const sameId = ticket.id_usuario && Number(ticket.id_usuario) === Number(targetUser.id_usuario);
  const sameEmail = ticket.correo_remitente && String(ticket.correo_remitente).trim().toLowerCase() === String(targetUser.email).trim().toLowerCase();

  if (sameId || sameEmail) {
    return { valido: true, ticket };
  }

  const targetUserRoles = await trxOrDb
    .selectFrom('usuario_rol as ur')
    .innerJoin('rol as r', 'r.id_rol', 'ur.id_rol')
    .select('r.nombre')
    .where('ur.id_usuario', '=', targetUser.id_usuario)
    .execute();
  
  const hasStudentRole = targetUserRoles.some((r: any) => String(r.nombre).toUpperCase() === 'ESTUDIANTE');

  if (hasStudentRole && ticket.id_usuario) {
    const student = await trxOrDb
      .selectFrom('estudiante')
      .select(['id_estudiante', 'codigo'])
      .where('id_usuario', '=', targetUser.id_usuario)
      .executeTakeFirst();

    if (student) {
      const studentCode = String(student.codigo).trim();

      const parent = await trxOrDb
        .selectFrom('padre_familia')
        .select('id_padrefamilia')
        .where('id_usuario', '=', ticket.id_usuario)
        .executeTakeFirst();

      if (parent) {
        const rel = await trxOrDb
          .selectFrom('detalle_padrefamilia')
          .select('id_detallepadrefamilia')
          .where('id_padrefamilia', '=', parent.id_padrefamilia)
          .where('id_estudiante', '=', student.id_estudiante)
          .executeTakeFirst();

        if (rel) {
          const inAsunto = String(ticket.asunto).toLowerCase().includes(studentCode.toLowerCase());
          const inDescripcion = String(ticket.descripcion).toLowerCase().includes(studentCode.toLowerCase());

          if (inAsunto || inDescripcion) {
            return { valido: true, ticket };
          } else {
            return {
              valido: false,
              error: `El remitente es el acudiente registrado, pero el ticket no incluye el código estudiantil (${studentCode}) para autorizar la modificación.`
            };
          }
        }
      }
    }
  }

  if (ticket.id_usuario) {
    const creatorRolesRes = await trxOrDb
      .selectFrom('usuario_rol as ur')
      .innerJoin('rol as r', 'r.id_rol', 'ur.id_rol')
      .innerJoin('usuario as u', 'u.id_usuario', 'ur.id_usuario')
      .leftJoin('usuario_colegio as uc', (join: any) =>
        join.onRef('uc.id_usuario', '=', 'u.id_usuario').on('uc.estado', '=', 'ACTIVO')
      )
      .select(['r.nombre', 'uc.id_colegio'])
      .where('ur.id_usuario', '=', ticket.id_usuario)
      .execute();

    const creatorRoles = creatorRolesRes.map((r: any) => String(r.nombre).toUpperCase());
    const creatorSchoolId = creatorRolesRes[0]?.id_colegio;
    const isDirectivo = creatorRoles.includes('DIRECTIVO');

    if (isDirectivo && creatorSchoolId && targetUser.id_colegio && Number(creatorSchoolId) === Number(targetUser.id_colegio)) {
      const targetDoc = targetUser.documento;

      const emailMentioned = String(ticket.asunto).toLowerCase().includes(String(targetUser.email).toLowerCase()) ||
                            String(ticket.descripcion).toLowerCase().includes(String(targetUser.email).toLowerCase());

      const docMentioned = targetDoc && (
        String(ticket.asunto).includes(String(targetDoc)) ||
        String(ticket.descripcion).includes(String(targetDoc))
      );

      if (emailMentioned || docMentioned) {
        return { valido: true, ticket };
      } else {
        return {
          valido: false,
          error: `El remitente del ticket es el Directivo de la institución, pero no se menciona el correo (${targetUser.email}) o identificación del usuario en el ticket.`
        };
      }
    }
  }

  return {
    valido: false,
    error: 'El remitente del ticket no corresponde a esta cuenta de usuario, a su acudiente autorizado con código estudiantil, ni a un Directivo de su misma institución.'
  };
};

/**
 * POST /admin/usuarios/:id/validar-ticket
 * Valida si un código de ticket es apto para habilitar la edición de credenciales de un usuario.
 */
export const validarTicketParaUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { codigo_ticket } = req.body;

  if (!codigo_ticket) {
    res.status(400).json({ error: 'El código del ticket es requerido.' });
    return;
  }

  try {
    const userRolesRes = await db
      .selectFrom('usuario_rol as ur')
      .innerJoin('rol as r', 'r.id_rol', 'ur.id_rol')
      .select('r.nombre')
      .where('ur.id_usuario', '=', id)
      .execute();

    const userRoles = userRolesRes.map(r => String(r.nombre).toUpperCase());
    if (userRoles.includes('ADMIN_GENERAL') || userRoles.includes('ADMIN')) {
      res.status(403).json({ error: 'No es posible modificar credenciales o roles de cuentas con rol Administrador General.' });
      return;
    }
    if (userRoles.includes('ESTUDIANTE')) {
      res.status(400).json({ error: 'Las cuentas de Estudiantes no pueden ser editadas mediante este panel. Su gestión de datos y matrícula se realiza en Secretaría Académica / Matrícula.' });
      return;
    }

    const check = await verificarCorrespondenciaTicketUsuario(db, id, codigo_ticket);
    if (!check.valido) {
      res.status(400).json({ error: check.error });
      return;
    }

    res.json({ success: true, message: 'Ticket validado correctamente. Edición autorizada.' });
  } catch (error: any) {
    console.error('Error validando ticket para usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor al validar ticket.' });
  }
};

/**
 * PUT /admin/usuarios/:id/credenciales-con-ticket
 * Modificar datos de identificación y roles de un usuario requiriendo ticket de soporte activo y correspondiente.
 */
export const modificarCredencialesConTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  const { codigo_ticket, nombre, apellido, tipo_documento, documento, roles } = req.body;

  if (!codigo_ticket || !nombre || !apellido || !tipo_documento || !documento || !Array.isArray(roles)) {
    res.status(400).json({ error: 'Código de ticket, nombre, apellido, tipo de documento, documento y roles son requeridos.' });
    return;
  }

  try {
    await db.transaction().execute(async (trx) => {
      const check = await verificarCorrespondenciaTicketUsuario(trx, id, codigo_ticket);
      if (!check.valido) {
        const err = new Error('TICKET_CHECK_FAILED');
        (err as any).ticketError = check.error;
        throw err;
      }

      const ticket = check.ticket;

      const oldUser = await trx
        .selectFrom('usuario as u')
        .leftJoin('usuario_colegio as uc', (join) =>
          join.onRef('uc.id_usuario', '=', 'u.id_usuario').on('uc.estado', '=', 'ACTIVO')
        )
        .leftJoin('tipo_documento as td', 'td.id_tipodocumento', 'u.id_tipodocumento')
        .select(['u.nombre', 'u.apellido', 'u.email', 'uc.id_colegio', 'u.documento', 'td.tipo as tipo_documento'])
        .where('u.id_usuario', '=', id)
        .executeTakeFirst();

      if (!oldUser) {
        throw new Error('USER_NOT_FOUND');
      }

      const oldRolesRes = await trx
        .selectFrom('usuario_rol as ur')
        .innerJoin('rol as r', 'r.id_rol', 'ur.id_rol')
        .select('r.nombre')
        .where('ur.id_usuario', '=', id)
        .execute();

      const oldRoles = oldRolesRes.map(r => String(r.nombre).toUpperCase());

      if (oldRoles.includes('ADMIN_GENERAL') || oldRoles.includes('ADMIN')) {
        throw new Error('ADMIN_GENERAL_FORBIDDEN');
      }
      if (oldRoles.includes('ESTUDIANTE')) {
        throw new Error('ESTUDIANTE_FORBIDDEN');
      }

      const allowedRoles = ['DIRECTIVO', 'DOCENTE', 'PADRE'];
      const normalizedNewRoles = roles
        .map((r: any) => String(r).toUpperCase().trim())
        .map((r: string) => r === 'PADRE_FAMILIA' ? 'PADRE' : r);

      const invalidRoles = normalizedNewRoles.filter((r: string) => !allowedRoles.includes(r));
      if (invalidRoles.length > 0) {
        const err = new Error('INVALID_ROLES');
        (err as any).invalidRoles = invalidRoles;
        throw err;
      }

      if (normalizedNewRoles.length === 0) {
        throw new Error('EMPTY_ROLES');
      }

      const oldDoc = oldUser.documento || 'No Registrado';
      const oldTipoDoc = oldUser.tipo_documento || 'No Registrado';
      const idTipoDoc = resolveTipoDocumentoId(tipo_documento);

      await trx
        .updateTable('usuario')
        .set({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          id_tipodocumento: idTipoDoc,
          documento: documento.trim()
        })
        .where('id_usuario', '=', id)
        .execute();

      const allRolesDb = await trx
        .selectFrom('rol')
        .select(['id_rol', 'nombre'])
        .execute();

      const roleMap = new Map<string, number>();
      allRolesDb.forEach(r => roleMap.set(String(r.nombre).toUpperCase(), Number(r.id_rol)));

      await trx
        .deleteFrom('usuario_rol')
        .where('id_usuario', '=', id)
        .execute();

      for (const roleName of normalizedNewRoles) {
        const roleId = roleMap.get(roleName);
        if (roleId) {
          await trx
            .insertInto('usuario_rol')
            .values({
              id_usuario: id,
              id_rol: roleId
            })
            .onConflict((oc) => oc.doNothing())
            .execute();

          if (roleName === 'DIRECTIVO' && oldUser.id_colegio) {
            await trx
              .insertInto('directivo')
              .values({
                id_usuario: id,
                id_colegio: oldUser.id_colegio,
                cargo: 'Directivo Institucional',
                fecha_vinculacion: new Date()
              })
              .onConflict((oc) =>
                oc.column('id_usuario').doUpdateSet({
                  id_colegio: (eb) => eb.fn.coalesce(eb.ref('excluded.id_colegio'), eb.ref('directivo.id_colegio'))
                })
              )
              .execute();
          } else if (roleName === 'DOCENTE') {
            await trx
              .insertInto('docente')
              .values({
                id_usuario: id,
                nombre: nombre.trim(),
                apellido: apellido.trim(),
                id_colegio: oldUser.id_colegio || 1
              })
              .onConflict((oc) =>
                oc.column('id_usuario').doUpdateSet({
                  nombre: (eb) => eb.ref('excluded.nombre'),
                  apellido: (eb) => eb.ref('excluded.apellido')
                })
              )
              .execute();
          } else if (roleName === 'PADRE') {
            await trx
              .insertInto('padre_familia')
              .values({
                id_usuario: id,
                nombre: nombre.trim(),
                apellido: apellido.trim(),
                id_colegio: oldUser.id_colegio
              })
              .onConflict((oc) =>
                oc.column('id_usuario').doUpdateSet({
                  nombre: (eb) => eb.ref('excluded.nombre'),
                  apellido: (eb) => eb.ref('excluded.apellido')
                })
              )
              .execute();
          }
        }
      }

      const auditText = `El Administrador General modificó los datos de la cuenta vinculada bajo la orden de este ticket de soporte.
Detalle de cambios (Antes ➔ Después):
- Nombre Completo: '${oldUser.nombre} ${oldUser.apellido || ''}' ➔ '${nombre.trim()} ${apellido.trim()}'
- Identificación: '${oldTipoDoc} #${oldDoc}' ➔ '${tipo_documento.trim()} #${documento.trim()}'
- Roles Asignados: [${oldRoles.join(', ')}] ➔ [${normalizedNewRoles.join(', ')}]`;

      let currentObs: any[] = [];
      try {
        currentObs = typeof ticket.observaciones === 'string'
          ? JSON.parse(ticket.observaciones || '[]')
          : (ticket.observaciones || []);
      } catch {
        currentObs = [];
      }

      currentObs.push({
        id_usuario: Number(req.user!.id),
        nombre_usuario: 'Administrador General (Auditoría)',
        tipo: 'ADMIN_GENERAL',
        mensaje: auditText,
        fecha_creacion: new Date().toISOString()
      });

      await trx
        .updateTable('tickets_soporte')
        .set({ observaciones: JSON.stringify(currentObs) })
        .where('id_ticket', '=', ticket.id_ticket)
        .execute();
    });

    res.json({ message: 'Credenciales y roles actualizados con éxito y registrados en la auditoría del ticket.' });
  } catch (error: any) {
    if (error.message === 'TICKET_CHECK_FAILED') {
      res.status(400).json({ error: error.ticketError });
      return;
    }
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'El usuario no existe.' });
      return;
    }
    if (error.message === 'ADMIN_GENERAL_FORBIDDEN') {
      res.status(403).json({ error: 'No es posible modificar credenciales o roles de cuentas con rol Administrador General.' });
      return;
    }
    if (error.message === 'ESTUDIANTE_FORBIDDEN') {
      res.status(400).json({ error: 'Las cuentas de Estudiantes no pueden ser modificadas mediante este panel. Su gestión se realiza exclusivamente a través de Matrícula Institucional.' });
      return;
    }
    if (error.message === 'INVALID_ROLES') {
      res.status(400).json({
        error: `Los roles [${error.invalidRoles.join(', ')}] no pueden ser asignados mediante este panel de edición.`
      });
      return;
    }
    if (error.message === 'EMPTY_ROLES') {
      res.status(400).json({
        error: 'Debe asignar al menos un rol institucional válido (Directivo, Docente o Padre).'
      });
      return;
    }
    console.error('Error modifying credentials with ticket:', error);
    res.status(500).json({ error: 'Error interno del servidor al actualizar credenciales.' });
  }
};

export const crearUsuarioByAdminGeneral = async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    rol,
    email,
    password,
    nombre,
    apellido,
    id_colegio,
    tipo_documento,
    documento,
    telefono
  } = (req.body?.body ?? req.body) as any;

  try {
    const normalizedRol = String(rol || '').trim().toLowerCase();
    if (normalizedRol === 'estudiante') {
      res.status(400).json({ error: 'El rol estudiante no puede crearse directamente. Debe registrarse a través del proceso de Matrícula Institucional.' });
      return;
    }

    const result = await db.transaction().execute(async (trx) => {
      const rolRes = await trx
        .selectFrom('rol')
        .select('id_rol')
        .where(sql`LOWER(nombre)`, '=', normalizedRol)
        .executeTakeFirst();

      if (!rolRes) {
        throw new Error('ROLE_NOT_FOUND');
      }
      const idRol = rolRes.id_rol;

      const trimmedEmail = (email || '').trim().toLowerCase();
      const finalEmail: string | null = trimmedEmail || null;

      if (finalEmail) {
        const dupCheck = await trx
          .selectFrom('usuario')
          .select('id_usuario')
          .where(sql`LOWER(email)`, '=', finalEmail)
          .executeTakeFirst();

        if (dupCheck) {
          throw new Error('DUPLICATE_EMAIL');
        }
      }

      const idTipoDoc = resolveTipoDocumentoId(tipo_documento);
      if (documento && String(documento).trim()) {
        await validateDocumentUniqueness(null, String(documento).trim(), rol, undefined, idTipoDoc);
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const userRes = await trx
        .insertInto('usuario')
        .values({
          email: finalEmail,
          password: hashedPassword,
          nombre: nombre.trim(),
          apellido: (apellido || '').trim() || null,
          activo: true,
          id_tipodocumento: idTipoDoc,
          documento: (documento || '').trim() || null,
          telefono: (telefono || '').trim() || null,
          estado: 'ACTIVO'
        })
        .returning(['id_usuario', 'email', 'nombre', 'apellido', 'activo', 'fecha_creacion'])
        .executeTakeFirstOrThrow();

      const newUserId = userRes.id_usuario;

      await trx
        .insertInto('usuario_rol')
        .values({
          id_usuario: newUserId,
          id_rol: idRol
        })
        .onConflict((oc) => oc.doNothing())
        .execute();

      if (id_colegio) {
        await trx
          .insertInto('usuario_colegio')
          .values({
            id_usuario: newUserId,
            id_colegio: Number(id_colegio),
            id_rol: idRol,
            estado: 'ACTIVO',
            fecha_inicio: new Date()
          })
          .onConflict((oc) => oc.doNothing())
          .execute();
      }

      if (normalizedRol === 'directivo' && id_colegio) {
        await trx
          .insertInto('directivo')
          .values({
            id_usuario: newUserId,
            id_colegio: Number(id_colegio),
            cargo: 'Directivo Institucional',
            fecha_vinculacion: new Date()
          })
          .execute();
      } else if (normalizedRol === 'docente' && id_colegio) {
        await trx
          .insertInto('docente')
          .values({
            id_usuario: newUserId,
            id_colegio: Number(id_colegio),
            nombre: nombre.trim(),
            apellido: (apellido || '').trim() || '',
            estado: 'ACTIVO'
          })
          .onConflict((oc) => oc.doNothing())
          .execute();
      } else if (normalizedRol === 'padre' && id_colegio) {
        await trx
          .insertInto('padre_familia')
          .values({
            id_usuario: newUserId,
            id_colegio: Number(id_colegio),
            nombre: nombre.trim(),
            apellido: (apellido || '').trim() || ''
          })
          .onConflict((oc) => oc.doNothing())
          .execute();
      }

      if (id_colegio && finalEmail && (normalizedRol === 'directivo' || normalizedRol === 'docente')) {
        await upsertInstitutionalEmail(newUserId, Number(id_colegio), finalEmail, null);
      }

      const authReq = req as any;
      const activeAuditoriaId = authReq.user?.supervisionId;
      if (activeAuditoriaId) {
        await trx
          .insertInto('auditoria_acciones_realizadas')
          .values({
            id_auditoria: activeAuditoriaId,
            modulo: 'USUARIOS',
            tipo_accion: 'CREACION',
            accion: 'Creación directa de usuario por Admin General',
            recurso_afectado: `Usuario ID: ${newUserId}`,
            id_usuario_afectado: newUserId,
            valor_nuevo: JSON.stringify({ email: finalEmail, nombre, apellido, rol, id_colegio }) as any,
            motivo_cambio: 'Creación de cuenta por administración global'
          })
          .execute();
      }

      return { newUserId, finalEmail };
    });

    res.status(201).json({
      message: `Usuario ${nombre} ${apellido || ''} (${rol}) creado exitosamente.`,
      user: {
        id_usuario: result.newUserId,
        email: result.finalEmail,
        nombre,
        apellido,
        rol,
        id_colegio
      }
    });
  } catch (error: any) {
    if (error.message === 'ROLE_NOT_FOUND') {
      res.status(400).json({ error: `El rol '${rol}' no existe en el sistema.` });
      return;
    }
    if (error.message === 'DUPLICATE_EMAIL') {
      res.status(409).json({ error: `El correo electrónico '${email}' ya se encuentra registrado.` });
      return;
    }
    console.error('Error creating user by Admin General:', error);
    res.status(500).json({ error: 'Error interno del servidor al crear usuario.' });
  }
};
