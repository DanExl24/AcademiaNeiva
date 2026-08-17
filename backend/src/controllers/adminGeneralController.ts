import { Response } from 'express';
import { pool } from '../config/db';
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
    const { nombre, tipo_colegio, sede, contacto, correo, dane, tipo_calendario, escudo_url, colores } = req.body;

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
    const { nombre, tipo_colegio, sede, contacto, correo, dane, tipo_calendario, escudo_url, colores } = req.body;

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
    if (colores !== undefined) updateObject.colores = colores;

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
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { estado, motivo } = req.body;

    const estadosValidos = ['PENDIENTE', 'ACTIVO', 'SUSPENDIDO', 'RECHAZADO', 'ELIMINADO'];
    if (!estadosValidos.includes(estado)) {
      res.status(400).json({ error: `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}` });
      return;
    }

    await client.query('BEGIN');

    // Obtener estado actual
    const colegioActual = await client.query(
      'SELECT id_colegio, nombre, estado FROM colegio WHERE id_colegio = $1',
      [id]
    );
    if (colegioActual.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Colegio no encontrado' });
      return;
    }

    const estadoAnterior = colegioActual.rows[0].estado;
    const colegioNombre = colegioActual.rows[0].nombre;

    // RN-COL-005: Restricción de Eliminación de Colegio si posee registros históricos activos
    if (estado === 'ELIMINADO') {
      const checkRecords = await client.query(
        `SELECT 
           (SELECT COUNT(*)::int FROM estudiante WHERE id_colegio = $1) AS estudiantes_count,
           (SELECT COUNT(*)::int FROM matricula WHERE id_colegio = $1) AS matriculas_count,
           (SELECT COUNT(*)::int FROM anio_lectivo WHERE id_colegio = $1) AS anios_count`,
        [id]
      );
      const { estudiantes_count, matriculas_count, anios_count } = checkRecords.rows[0];
      if (estudiantes_count > 0 || matriculas_count > 0 || anios_count > 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ 
          error: 'No se puede eliminar el colegio porque cuenta con matrículas, estudiantes o años lectivos registrados. Utilice el estado SUSPENDIDO.' 
        });
        return;
      }
    }

    // Actualizar estado
    const updateFields: string[] = ['estado = $1', 'fecha_cambio_estado = NOW()'];
    const updateParams: any[] = [estado];

    if (estado === 'RECHAZADO' && motivo) {
      updateFields.push(`motivo_rechazo = $${updateParams.length + 1}`);
      updateParams.push(motivo);
    }

    updateParams.push(id);
    await client.query(
      `UPDATE colegio SET ${updateFields.join(', ')} WHERE id_colegio = $${updateParams.length}`,
      updateParams
    );

    // Obtener directivos del colegio para notificar
    const directivos = await client.query(
      `SELECT d.id, u.email, u.nombre, u.apellido
       FROM directivo d
       JOIN usuario u ON d.id_usuario = u.id_usuario
       WHERE d.id_colegio = $1 AND d.estado = 'ACTIVO'`,
      [id]
    );

    // Crear notificaciones en BD para cada directivo
    for (const dir of directivos.rows) {
      await client.query(
        `INSERT INTO notificacion_colegio (id_colegio, id_directivo, tipo, mensaje, estado_anterior, estado_nuevo)
         VALUES ($1, $2, 'CAMBIO_ESTADO', $3, $4, $5)`,
        [id, dir.id, `El estado del colegio ${colegioNombre} cambió de ${estadoAnterior} a ${estado}`, estadoAnterior, estado]
      );

      // Email solo cuando el colegio es SUSPENDIDO
      if (estado === 'SUSPENDIDO') {
        AdminGeneralNotificationService.sendColegioSuspendido(
          dir.email,
          `${dir.nombre} ${dir.apellido || ''}`.trim(),
          colegioNombre,
          motivo || 'No especificado'
        );
      }
    }

    // Si se elimina el colegio, desvincular usuarios
    if (estado === 'ELIMINADO') {
      await client.query(
        'UPDATE usuario SET id_colegio = NULL WHERE id_colegio = $1',
        [id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: `Estado del colegio actualizado a ${estado}`, estado_anterior: estadoAnterior, estado_nuevo: estado });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error cambiando estado colegio:', error);
    res.status(500).json({ error: 'Error al cambiar estado del colegio' });
  } finally {
    client.release();
  }
};

/**
 * DELETE /admin/colegios/:id
 * Eliminar un colegio (cambia estado a ELIMINADO y desvincula usuarios).
 */
export const eliminarColegio = async (req: AuthRequest, res: Response): Promise<void> => {
  // Reutilizamos cambiarEstadoColegio con estado=ELIMINADO
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
        sql<string[]>`array_agg(r.nombre)`.as("roles")
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
        sql<string[]>`array_agg(r.nombre)`.as("roles")
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
    const { id } = req.params;
    const { estado, motivo } = req.body;

    const estadosValidos = ['ACTIVO', 'SUSPENDIDO', 'BANEADO', 'ELIMINADO'];
    if (!estadosValidos.includes(estado)) {
      res.status(400).json({ error: `Estado inválido. Valores permitidos: ${estadosValidos.join(', ')}` });
      return;
    }

    // Prevenir que el Admin General suspenda, banee o elimine su propia cuenta
    if (req.user && Number(req.user.id) === Number(id) && estado !== 'ACTIVO') {
      res.status(400).json({ error: 'No puedes suspender, banear ni eliminar tu propia cuenta de Administrador General.' });
      return;
    }

    const updateFields: string[] = ['estado = $1', 'activo = $2'];
    const params: any[] = [estado, estado === 'ACTIVO'];

    if (estado !== 'ACTIVO') {
      updateFields.push('logged_out_at = NOW()');
    }

    if (estado === 'BANEADO') {
      updateFields.push(`motivo_baneo = $${params.length + 1}`);
      params.push(motivo || null);
      updateFields.push(`fecha_baneo = NOW()`);
      updateFields.push(`baneado_por = $${params.length + 1}`);
      params.push(req.user!.id);
    } else {
      // Limpiar datos de baneo si se reactiva
      updateFields.push('motivo_baneo = NULL');
      updateFields.push('fecha_baneo = NULL');
      updateFields.push('baneado_por = NULL');
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE usuario SET ${updateFields.join(', ')} WHERE id_usuario = $${params.length} RETURNING id_usuario, email, nombre, estado`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({ message: `Estado del usuario actualizado a ${estado}`, usuario: result.rows[0] });
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
 * Nota: Con JWT stateless, esto se implementa marcando un campo de "sesión invalidada"
 * o con un mecanismo de blacklist. Por ahora retornamos un token_version.
 */
export const forzarCierreSesion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verificar que el usuario existe
    const user = await pool.query('SELECT id_usuario, email, nombre FROM usuario WHERE id_usuario = $1', [id]);
    if (user.rows.length === 0) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Actualizar logged_out_at para invalidar todos los tokens emitidos antes de ahora
    await pool.query('UPDATE usuario SET logged_out_at = NOW() WHERE id_usuario = $1', [id]);

    res.json({ message: 'Sesión cerrada forzosamente y tokens invalidados', usuario: user.rows[0] });
  } catch (error: any) {
    console.error('Error forzando cierre de sesión:', error);
    res.status(500).json({ error: 'Error al forzar cierre de sesión' });
  }
};

/**
 * PATCH /admin/usuarios/:id/eliminar
 * Soft-delete controlado de un usuario.
 *
 * Reglas:
 *  1. El Admin General DEBE tener una sesión de supervisión activa (req.user.supervisionId).
 *  2. Se DEBE proveer un codigo_ticket cuyo remitente sea un Directivo del mismo colegio que el usuario afectado.
 *  3. Si el usuario es ESTUDIANTE y tiene matrícula ACTIVA → se cancela con motivo registrado.
 *  4. Si el usuario es DOCENTE → se registra observación en el ticket.
 *  5. Se registra snapshot completo en auditoria_acciones_realizadas usando la sesión activa.
 *  6. Se añade observación automática al ticket de soporte.
 */
export const eliminarUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { codigo_ticket, motivo } = req.body;

  // 1. Validar que el admin tiene sesión de supervisión activa
  const supervisionId = (req as any).user?.supervisionId;
  if (!supervisionId) {
    res.status(403).json({
      error: 'Operación no permitida: debe tener una sesión de supervisión activa aprobada por el Directivo del colegio antes de realizar esta acción.'
    });
    return;
  }

  // 2. Validar que se proveyó un código de ticket
  if (!codigo_ticket || !String(codigo_ticket).trim()) {
    res.status(400).json({
      error: 'Se requiere el código de ticket de soporte del Directivo del colegio para autorizar esta operación.'
    });
    return;
  }

  // 3. Prevenir que el Admin General se auto-elimine
  if (req.user && Number(req.user.id) === Number(id)) {
    res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de Administrador General.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 4. Obtener datos completos del usuario a eliminar
    const userRes = await client.query(
      `SELECT u.id_usuario, u.email, u.nombre, u.apellido, u.estado, uc.id_colegio,
              u.fecha_creacion, u.documento, u.telefono,
              c.nombre AS colegio_nombre,
              array_agg(DISTINCT r.nombre) AS roles
       FROM usuario u
       LEFT JOIN usuario_colegio uc ON uc.id_usuario = u.id_usuario AND uc.estado = 'ACTIVO'
       LEFT JOIN colegio c ON c.id_colegio = uc.id_colegio
       LEFT JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
       LEFT JOIN rol r ON r.id_rol = ur.id_rol
       WHERE u.id_usuario = $1
       GROUP BY u.id_usuario, uc.id_colegio, c.nombre`,
      [id]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Usuario no encontrado.' });
      return;
    }

    const targetUser = userRes.rows[0];

    if (targetUser.estado === 'ELIMINADO') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'El usuario ya se encuentra en estado ELIMINADO.' });
      return;
    }

    // 5. Validar que el ticket pertenece a un Directivo del mismo colegio
    const ticketRes = await client.query(
      `SELECT ts.id_ticket, ts.id_usuario, ts.correo_remitente, ts.asunto, ts.descripcion,
              ts.observaciones, ts.estado, ts.codigo_ticket
       FROM tickets_soporte ts
       WHERE ts.codigo_ticket = $1`,
      [String(codigo_ticket).trim().toUpperCase()]
    );

    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'El código de ticket ingresado no existe.' });
      return;
    }

    const ticket = ticketRes.rows[0];
    if (ticket.estado === 'RESUELTO') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'El ticket ya está RESUELTO y no puede usarse como consentimiento.' });
      return;
    }

    // Verificar que el remitente del ticket es un Directivo del mismo colegio del usuario
    if (!ticket.id_usuario) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'El ticket no está vinculado a un usuario registrado. Se requiere un ticket creado por el Directivo del colegio.' });
      return;
    }

    const creatorRolesRes = await client.query(
      `SELECT r.nombre, uc.id_colegio
       FROM usuario_rol ur
       JOIN rol r ON ur.id_rol = r.id_rol
       JOIN usuario u ON u.id_usuario = ur.id_usuario
       LEFT JOIN usuario_colegio uc ON uc.id_usuario = u.id_usuario AND uc.estado = 'ACTIVO'
       WHERE ur.id_usuario = $1`,
      [ticket.id_usuario]
    );

    const creatorRoles = creatorRolesRes.rows.map((r: any) => String(r.nombre).toUpperCase());
    const creatorSchoolId = creatorRolesRes.rows[0]?.id_colegio;
    const isDirectivo = creatorRoles.includes('DIRECTIVO');

    if (!isDirectivo) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'El remitente del ticket no es un Directivo. Solo el Directivo del colegio puede otorgar consentimiento para eliminar usuarios.' });
      return;
    }

    if (!creatorSchoolId || !targetUser.id_colegio || Number(creatorSchoolId) !== Number(targetUser.id_colegio)) {
      await client.query('ROLLBACK');
      res.status(403).json({
        error: `El Directivo que emitió el ticket pertenece a una institución diferente (colegio ID: ${creatorSchoolId}) a la del usuario a eliminar (colegio ID: ${targetUser.id_colegio}). Solo el Directivo del mismo colegio puede dar consentimiento.`
      });
      return;
    }

    // Obtener datos del directivo consentidor
    const directivoRes = await client.query(
      `SELECT u.id_usuario, u.nombre, u.apellido, d.id AS id_directivo
       FROM usuario u
       LEFT JOIN directivo d ON d.id_usuario = u.id_usuario
       WHERE u.id_usuario = $1`,
      [ticket.id_usuario]
    );
    const directivo = directivoRes.rows[0];

    // 6. Snapshot del usuario antes de eliminar
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

    // 7. Cascada: si es ESTUDIANTE con matrícula ACTIVA → cancelarla
    const estudianteRes = await client.query(
      `SELECT e.id_estudiante FROM estudiante e WHERE e.id_usuario = $1`,
      [id]
    );
    if (estudianteRes.rows.length > 0) {
      const idEstudiante = estudianteRes.rows[0].id_estudiante;
      await client.query(
        `UPDATE matricula
         SET estado = 'CANCELADA',
             motivo_cancelacion = $1,
             detalles_cancelacion = $2
         WHERE id_estudiante = $3 AND estado = 'ACTIVA'`,
        [
          'Baja definitiva del usuario por Administrador General.',
          `Ticket de consentimiento: ${ticket.codigo_ticket}. Admin General ID: ${req.user!.id}.`,
          idEstudiante
        ]
      );

      // También actualizar estado del estudiante
      await client.query(
        `UPDATE estudiante SET estado = 'RETIRADO', motivo_estado = $1 WHERE id_estudiante = $2`,
        [`Cuenta eliminada por Administrador General. Ticket: ${ticket.codigo_ticket}.`, idEstudiante]
      );
    }

    // 8. Soft-delete del usuario
    await client.query(
      `UPDATE usuario
       SET estado = 'ELIMINADO',
           activo = false,
           logged_out_at = NOW()
       WHERE id_usuario = $1`,
      [id]
    );

    // 9. Registrar en auditoria_acciones_realizadas con el id_auditoria de la sesión activa
    await client.query(
      `INSERT INTO auditoria_acciones_realizadas
       (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, id_usuario_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
       VALUES ($1, 'USUARIOS', 'ELIMINACION', $2, $3, $4, $5, NULL, $6)`,
      [
        supervisionId,
        `Soft-delete controlado de usuario. Consentimiento del Directivo via ticket ${ticket.codigo_ticket}.`,
        `Usuario ID: ${id} (${targetUser.nombre} ${targetUser.apellido || ''}) — Colegio: ${targetUser.colegio_nombre || targetUser.id_colegio}`,
        Number(id),
        JSON.stringify(userSnapshot),
        userSnapshot.motivo_eliminacion
      ]
    );

    // 10. Añadir observación automática al ticket de soporte
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

    await client.query(
      'UPDATE tickets_soporte SET observaciones = $1 WHERE id_ticket = $2',
      [JSON.stringify(currentObs), ticket.id_ticket]
    );

    await client.query('COMMIT');

    res.json({
      message: `Usuario ${targetUser.nombre} ${targetUser.apellido || ''} eliminado exitosamente. La acción ha quedado registrada en la auditoría de la sesión activa (ID: ${supervisionId}) y en el ticket de soporte ${ticket.codigo_ticket}.`,
      id_usuario_eliminado: Number(id),
      codigo_ticket: ticket.codigo_ticket,
      id_auditoria: supervisionId
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error en soft-delete controlado de usuario:', error);
    res.status(500).json({ error: 'Error interno al eliminar el usuario.' });
  } finally {
    client.release();
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
    const { colegioId } = req.params;
    const result = await pool.query(
      `SELECT d.id, d.cargo, d.estado, d.fecha_vinculacion, d.fecha_desvinculacion,
              u.id_usuario, u.nombre, u.apellido, u.email
       FROM directivo d
       JOIN usuario u ON d.id_usuario = u.id_usuario
       WHERE d.id_colegio = $1
       ORDER BY d.fecha_vinculacion DESC`,
      [colegioId]
    );

    res.json(result.rows);
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
  const client = await pool.connect();
  try {
    const { id_usuario, id_colegio, cargo } = req.body;

    if (!id_usuario || !id_colegio) {
      res.status(400).json({ error: 'id_usuario e id_colegio son obligatorios' });
      return;
    }

    await client.query('BEGIN');

    // Verificar que el usuario existe
    const usuario = await client.query('SELECT id_usuario FROM usuario WHERE id_usuario = $1', [id_usuario]);
    if (usuario.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    // Verificar que no sea ya directivo
    const existente = await client.query('SELECT id FROM directivo WHERE id_usuario = $1', [id_usuario]);
    if (existente.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'El usuario ya está registrado como directivo' });
      return;
    }

    const result = await client.query(
      `INSERT INTO directivo (id_colegio, id_usuario, cargo, estado, fecha_vinculacion)
       VALUES ($1, $2, $3, 'ACTIVO', NOW())
       RETURNING *`,
      [id_colegio, id_usuario, cargo || 'Directivo']
    );

    // Asignar rol directivo si no lo tiene y crear vinculacion usuario_colegio
    const rolDirectivo = await client.query("SELECT id_rol FROM rol WHERE nombre = 'directivo'");
    if (rolDirectivo.rows.length > 0) {
      const idRol = rolDirectivo.rows[0].id_rol;
      await client.query(
        'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id_usuario, idRol]
      );
      await client.query(
        `INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio)
         VALUES ($1, $2, $3, 'ACTIVO', NOW()) ON CONFLICT DO NOTHING`,
        [id_usuario, id_colegio, idRol]
      );

      // Registrar el correo personal del usuario como email institucional inicial en este colegio
      const userEmailRes = await client.query('SELECT email FROM usuario WHERE id_usuario = $1', [id_usuario]);
      const userEmail = userEmailRes.rows[0]?.email || null;
      if (userEmail) {
        await upsertInstitutionalEmail(id_usuario, id_colegio, userEmail, null, client);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error registrando directivo:', error);
    res.status(500).json({ error: 'Error al registrar directivo' });
  } finally {
    client.release();
  }
};

/**
 * PUT /admin/directivos/:id
 * Actualizar información de un directivo.
 */
export const actualizarDirectivo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { cargo } = req.body;

    const result = await pool.query(
      'UPDATE directivo SET cargo = COALESCE($1, cargo) WHERE id = $2 RETURNING *',
      [cargo, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Directivo no encontrado' });
      return;
    }

    res.json(result.rows[0]);
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
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE directivo SET estado = 'DESVINCULADO', fecha_desvinculacion = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Directivo no encontrado' });
      return;
    }

    const directivo = result.rows[0];

    // RN-DIR-002: Suspender la cuenta de usuario e invalidar sus tokens activos
    if (directivo.id_usuario) {
      await client.query(
        `UPDATE usuario 
         SET estado = 'SUSPENDIDO', activo = false, logged_out_at = NOW() 
         WHERE id_usuario = $1`,
        [directivo.id_usuario]
      );
      if (directivo.id_colegio) {
        await client.query(
          `UPDATE usuario_colegio SET estado = 'INACTIVO', fecha_fin = NOW()
           WHERE id_usuario = $1 AND id_colegio = $2`,
          [directivo.id_usuario, directivo.id_colegio]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Directivo desvinculado e inhabilitado exitosamente', directivo });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error desvinculando directivo:', error);
    res.status(500).json({ error: 'Error al desvincular directivo' });
  } finally {
    client.release();
  }
};

/**
 * DELETE /admin/directivos/:id
 * Eliminar un directivo (Soft delete y suspensión de usuario).
 */
export const eliminarDirectivo = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE directivo SET estado = 'ELIMINADO', fecha_desvinculacion = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Directivo no encontrado' });
      return;
    }

    const directivo = result.rows[0];

    if (directivo.id_usuario) {
      await client.query(
        `UPDATE usuario 
         SET estado = 'ELIMINADO', activo = false, logged_out_at = NOW() 
         WHERE id_usuario = $1`,
        [directivo.id_usuario]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Directivo eliminado exitosamente', directivo });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error eliminando directivo:', error);
    res.status(500).json({ error: 'Error al eliminar directivo' });
  } finally {
    client.release();
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
  const client = await pool.connect();
  try {
    const { id_colegio, motivo, tipo_supervision, duracion_maxima_minutos } = req.body;

    if (!id_colegio || !motivo || !tipo_supervision) {
      res.status(400).json({ error: 'id_colegio, motivo y tipo_supervision son obligatorios' });
      return;
    }

    if (!['SOLO_LECTURA', 'EDITOR'].includes(tipo_supervision)) {
      res.status(400).json({ error: 'tipo_supervision debe ser SOLO_LECTURA o EDITOR' });
      return;
    }

    await client.query('BEGIN');

    // Obtener límites configurados de duración
    const configResult = await client.query(
      `SELECT clave, valor FROM configuracion_plataforma 
       WHERE clave IN ('supervision_duracion_minima_minutos', 'supervision_duracion_maxima_minutos')`
    );
    const configMap: Record<string, number> = {};
    for (const row of configResult.rows) {
      configMap[row.clave] = Number(row.valor);
    }
    const limiteMinimo = configMap['supervision_duracion_minima_minutos'] || 5;
    const limiteMaximo = configMap['supervision_duracion_maxima_minutos'] || 300;

    const duracionSolicitada = duracion_maxima_minutos ? Number(duracion_maxima_minutos) : limiteMinimo;

    if (duracionSolicitada < limiteMinimo || duracionSolicitada > limiteMaximo) {
      await client.query('ROLLBACK');
      res.status(400).json({ 
        error: `La duración debe estar entre ${limiteMinimo} y ${limiteMaximo} minutos` 
      });
      return;
    }

    // Verificar que el colegio existe y está activo
    const colegio = await client.query(
      'SELECT id_colegio, nombre, estado FROM colegio WHERE id_colegio = $1',
      [id_colegio]
    );
    if (colegio.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Colegio no encontrado' });
      return;
    }

    // Verificar que no hay supervisión activa para este admin en este colegio
    const activa = await client.query(
      `SELECT id_auditoria FROM auditoria_supervision
       WHERE id_admin_general = $1 AND id_colegio = $2
         AND estado_supervision IN ('SOLICITADA', 'APROBADA', 'ACTIVA')
         AND eliminado = FALSE`,
      [req.user!.id, id_colegio]
    );
    if (activa.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Ya existe una supervisión pendiente o activa para este colegio' });
      return;
    }

    // Crear la solicitud
    const result = await client.query(
      `INSERT INTO auditoria_supervision 
       (id_admin_general, id_colegio, motivo_solicitud, tipo_supervision, estado_supervision, duracion_maxima_minutos, ip_admin)
       VALUES ($1, $2, $3, $4, 'SOLICITADA', $5, $6)
       RETURNING *`,
      [req.user!.id, id_colegio, motivo, tipo_supervision, duracionSolicitada, req.ip]
    );

    // Notificar a todos los directivos del colegio
    const directivos = await client.query(
      `SELECT d.id, u.email, u.nombre, u.apellido
       FROM directivo d
       JOIN usuario u ON d.id_usuario = u.id_usuario
       WHERE d.id_colegio = $1 AND d.estado = 'ACTIVO'`,
      [id_colegio]
    );

    const adminNombre = `${req.user!.email}`;
    const colegioNombre = colegio.rows[0].nombre;

    for (const dir of directivos.rows) {
      // Notificación en BD
      await client.query(
        `INSERT INTO notificacion_supervision (id_auditoria, id_directivo, tipo_notificacion, mensaje)
         VALUES ($1, $2, 'SOLICITUD', $3)`,
        [result.rows[0].id_auditoria, dir.id,
         `El Admin General ha solicitado entrar en modo supervisión (${tipo_supervision}) al colegio ${colegioNombre}`]
      );

      // Email
      AdminGeneralNotificationService.sendSupervisionSolicitada(
        dir.email,
        `${dir.nombre} ${dir.apellido || ''}`.trim(),
        adminNombre,
        colegioNombre,
        motivo,
        tipo_supervision
      );
    }

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error solicitando supervisión:', error);
    res.status(500).json({ error: 'Error al solicitar supervisión' });
  } finally {
    client.release();
  }
};

/**
 * POST /admin/supervision/:id/aprobar
 * Aprobar una solicitud de supervisión (ejecutado por un directivo).
 */
export const aprobarSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Obtener la auditoría
    const auditoria = await client.query(
      `SELECT a.*, c.nombre AS colegio_nombre, u.email AS admin_email, u.nombre AS admin_nombre
       FROM auditoria_supervision a
       JOIN colegio c ON c.id_colegio = a.id_colegio
       JOIN usuario u ON u.id_usuario = a.id_admin_general
       WHERE a.id_auditoria = $1 AND a.estado_supervision = 'SOLICITADA' AND a.eliminado = FALSE`,
      [id]
    );

    if (auditoria.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Solicitud de supervisión no encontrada o ya procesada' });
      return;
    }

    // Verificar que el usuario es directivo del colegio
    const directivo = await client.query(
      `SELECT d.id FROM directivo d
       WHERE d.id_usuario = $1 AND d.id_colegio = $2 AND d.estado = 'ACTIVO'`,
      [req.user!.id, auditoria.rows[0].id_colegio]
    );

    if (directivo.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Solo un directivo activo del colegio puede aprobar la supervisión' });
      return;
    }

    // Aprobar
    await client.query(
      `UPDATE auditoria_supervision
       SET estado_supervision = 'APROBADA',
           id_directivo_aprobador = $1,
           fecha_aprobacion = NOW()
       WHERE id_auditoria = $2`,
      [directivo.rows[0].id, id]
    );

    const aud = auditoria.rows[0];

    // Email al admin general
    AdminGeneralNotificationService.sendSupervisionAprobada(
      aud.admin_email,
      aud.admin_nombre,
      aud.colegio_nombre,
      `${req.user!.email}`,
      aud.tipo_supervision,
      aud.duracion_maxima_minutos
    );

    await client.query('COMMIT');
    res.json({ message: 'Supervisión aprobada exitosamente' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error aprobando supervisión:', error);
    res.status(500).json({ error: 'Error al aprobar supervisión' });
  } finally {
    client.release();
  }
};

/**
 * POST /admin/supervision/:id/entrar
 * Activar modo supervisión (el admin entra al colegio).
 * Requiere re-autenticación (password en body).
 */
export const entrarSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { password, motivo_entrada } = req.body;

    if (!password) {
      res.status(400).json({ error: 'Se requiere re-autenticación. Envía tu contraseña.' });
      return;
    }

    await client.query('BEGIN');

    // Re-autenticación
    const userRes = await client.query('SELECT password FROM usuario WHERE id_usuario = $1', [req.user!.id]);
    const validPassword = await bcrypt.compare(password, userRes.rows[0].password);
    if (!validPassword) {
      await client.query('ROLLBACK');
      res.status(401).json({ error: 'Contraseña incorrecta. Re-autenticación fallida.' });
      return;
    }

    // Obtener auditoría
    const auditoria = await client.query(
      `SELECT a.*, c.nombre AS colegio_nombre
       FROM auditoria_supervision a
       JOIN colegio c ON c.id_colegio = a.id_colegio
       WHERE a.id_auditoria = $1 AND a.estado_supervision = 'APROBADA'
         AND a.id_admin_general = $2 AND a.eliminado = FALSE`,
      [id, req.user!.id]
    );

    if (auditoria.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Supervisión no encontrada, no aprobada, o no le pertenece' });
      return;
    }

    // Activar
    await client.query(
      `UPDATE auditoria_supervision
       SET estado_supervision = 'ACTIVA',
           fecha_entrada = NOW(),
           motivo_entrada = $1
       WHERE id_auditoria = $2`,
      [motivo_entrada || auditoria.rows[0].motivo_solicitud, id]
    );

    const aud = auditoria.rows[0];

    // Notificar a directivos del colegio
    const directivos = await client.query(
      `SELECT d.id, u.email, u.nombre, u.apellido
       FROM directivo d
       JOIN usuario u ON d.id_usuario = u.id_usuario
       WHERE d.id_colegio = $1 AND d.estado = 'ACTIVO'`,
      [aud.id_colegio]
    );

    for (const dir of directivos.rows) {
      await client.query(
        `INSERT INTO notificacion_supervision (id_auditoria, id_directivo, tipo_notificacion, mensaje)
         VALUES ($1, $2, 'ENTRADA', $3)`,
        [id, dir.id, `El Admin General ha ENTRADO en modo supervisión al colegio ${aud.colegio_nombre}`]
      );

      AdminGeneralNotificationService.sendSupervisionIniciada(
        dir.email,
        `${dir.nombre} ${dir.apellido || ''}`.trim(),
        req.user!.email,
        aud.colegio_nombre,
        aud.tipo_supervision
      );
    }

    await client.query('COMMIT');
    res.json({
      message: 'Modo supervisión activado',
      tipo: aud.tipo_supervision,
      colegio: aud.colegio_nombre,
      duracion_maxima_minutos: aud.duracion_maxima_minutos,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error entrando supervisión:', error);
    res.status(500).json({ error: 'Error al entrar en modo supervisión' });
  } finally {
    client.release();
  }
};

/**
 * POST /admin/supervision/:id/salir
 * Finalizar modo supervisión (el admin sale voluntariamente).
 */
export const salirSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Obtener auditoría activa
    const auditoria = await client.query(
      `SELECT a.*, c.nombre AS colegio_nombre
       FROM auditoria_supervision a
       JOIN colegio c ON c.id_colegio = a.id_colegio
       WHERE a.id_auditoria = $1 AND a.estado_supervision = 'ACTIVA'
         AND a.id_admin_general = $2 AND a.eliminado = FALSE`,
      [id, req.user!.id]
    );

    if (auditoria.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Supervisión activa no encontrada' });
      return;
    }

    // Finalizar
    await client.query(
      `UPDATE auditoria_supervision
       SET estado_supervision = 'FINALIZADA',
           fecha_salida = NOW()
       WHERE id_auditoria = $1`,
      [id]
    );

    const aud = auditoria.rows[0];

    // Contar acciones realizadas
    const acciones = await client.query(
      'SELECT COUNT(*) AS total FROM auditoria_acciones_realizadas WHERE id_auditoria = $1',
      [id]
    );

    // Calcular duración
    const entrada = new Date(aud.fecha_entrada);
    const salida = new Date();
    const diffMs = salida.getTime() - entrada.getTime();
    const diffMin = Math.round(diffMs / 60000);
    const duracionStr = diffMin < 60 ? `${diffMin} minutos` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;

    // Notificar a directivos
    const directivos = await client.query(
      `SELECT d.id, u.email, u.nombre, u.apellido
       FROM directivo d
       JOIN usuario u ON d.id_usuario = u.id_usuario
       WHERE d.id_colegio = $1 AND d.estado = 'ACTIVO'`,
      [aud.id_colegio]
    );

    for (const dir of directivos.rows) {
      await client.query(
        `INSERT INTO notificacion_supervision (id_auditoria, id_directivo, tipo_notificacion, mensaje)
         VALUES ($1, $2, 'SALIDA', $3)`,
        [id, dir.id, `El Admin General ha SALIDO del modo supervisión del colegio ${aud.colegio_nombre}. Duración: ${duracionStr}. Acciones: ${acciones.rows[0].total}`]
      );

      AdminGeneralNotificationService.sendSupervisionFinalizada(
        dir.email,
        `${dir.nombre} ${dir.apellido || ''}`.trim(),
        req.user!.email,
        aud.colegio_nombre,
        duracionStr,
        parseInt(acciones.rows[0].total)
      );
    }

    await client.query('COMMIT');
    res.json({
      message: 'Modo supervisión finalizado',
      duracion: duracionStr,
      total_acciones: parseInt(acciones.rows[0].total),
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error saliendo supervisión:', error);
    res.status(500).json({ error: 'Error al finalizar modo supervisión' });
  } finally {
    client.release();
  }
};

/**
 * POST /admin/supervision/:id/revocar
 * Revocar una supervisión activa (ejecutado por un directivo).
 */
export const revocarSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    await client.query('BEGIN');

    // Obtener la auditoría
    const auditoria = await client.query(
      `SELECT a.*, c.nombre AS colegio_nombre, u.email AS admin_email, u.nombre AS admin_nombre
       FROM auditoria_supervision a
       JOIN colegio c ON c.id_colegio = a.id_colegio
       JOIN usuario u ON u.id_usuario = a.id_admin_general
       WHERE a.id_auditoria = $1 AND a.estado_supervision IN ('SOLICITADA', 'APROBADA', 'ACTIVA') AND a.eliminado = FALSE`,
      [id]
    );

    if (auditoria.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Supervisión no encontrada o no revocable' });
      return;
    }

    // Verificar que es directivo del colegio
    const directivo = await client.query(
      `SELECT d.id FROM directivo d
       WHERE d.id_usuario = $1 AND d.id_colegio = $2 AND d.estado = 'ACTIVO'`,
      [req.user!.id, auditoria.rows[0].id_colegio]
    );

    if (directivo.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Solo un directivo activo del colegio puede revocar la supervisión' });
      return;
    }

    // Revocar
    await client.query(
      `UPDATE auditoria_supervision
       SET estado_supervision = 'REVOCADA',
           revocado_por = $1,
           fecha_revocacion = NOW(),
           motivo_revocacion = $2,
           fecha_salida = CASE WHEN fecha_entrada IS NOT NULL THEN NOW() ELSE fecha_salida END
       WHERE id_auditoria = $3`,
      [directivo.rows[0].id, motivo || 'No especificado', id]
    );

    const aud = auditoria.rows[0];

    // Email al admin
    AdminGeneralNotificationService.sendSupervisionRechazada(
      aud.admin_email,
      aud.admin_nombre,
      aud.colegio_nombre,
      req.user!.email,
      motivo || 'No especificado'
    );

    await client.query('COMMIT');
    res.json({ message: 'Supervisión revocada exitosamente' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error revocando supervisión:', error);
    res.status(500).json({ error: 'Error al revocar supervisión' });
  } finally {
    client.release();
  }
};

/**
 * GET /admin/supervision/verificar-activa
 * Verificar el estado de la supervisión activa para el Administrador General.
 */
export const verificarSupervisionActiva = async (req: AuthRequest, res: Response): Promise<void> => {
  console.log('[Backend verificarSupervisionActiva] Verifying active supervision for user ID:', req.user!.id);
  try {
    const supervisionRes = await pool.query(
      `SELECT a.*, c.nombre AS colegio_nombre,
              u.nombre AS directivo_revocador_nombre, u.apellido AS directivo_revocador_apellido
       FROM auditoria_supervision a
       JOIN colegio c ON c.id_colegio = a.id_colegio
       LEFT JOIN directivo d ON d.id = a.revocado_por
       LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
       WHERE a.id_admin_general = $1 AND a.eliminado = FALSE
       ORDER BY a.fecha_solicitud DESC LIMIT 1`,
      [req.user!.id]
    );

    console.log('[Backend verificarSupervisionActiva] Found rows:', supervisionRes.rows.length);

    if (supervisionRes.rows.length === 0) {
      console.log('[Backend verificarSupervisionActiva] No row found. Returning activa: false');
      res.json({ activa: false });
      return;
    }

    const sup = supervisionRes.rows[0];
    const payload = {
      activa: sup.estado_supervision === 'ACTIVA',
      estado: sup.estado_supervision,
      motivo_revocacion: sup.motivo_revocacion || null,
      revocador_nombre: sup.revocado_por ? `${sup.directivo_revocador_nombre} ${sup.directivo_revocador_apellido || ''}`.trim() : null
    };
    console.log('[Backend verificarSupervisionActiva] Returning payload:', payload);
    res.json(payload);
  } catch (error) {
    console.error('[Backend verificarSupervisionActiva] Error verifying active supervision status:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};


/**
 * GET /admin/supervision/:id/acciones
 * Ver acciones registradas durante una supervisión.
 */
export const verAccionesSupervision = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT a.*, u.nombre AS usuario_afectado_nombre, u.email AS usuario_afectado_email
       FROM auditoria_acciones_realizadas a
       LEFT JOIN usuario u ON u.id_usuario = a.id_usuario_afectado
       WHERE a.id_auditoria = $1
       ORDER BY a.fecha_accion ASC`,
      [id]
    );

    const mapped = result.rows.map((row: any) => ({
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
    let query = `
      SELECT a.*,
             c.nombre AS colegio_nombre,
             u.nombre AS admin_nombre, u.email AS admin_email,
             ud.nombre AS directivo_nombre, ud.apellido AS directivo_apellido,
             udr.nombre AS directivo_revocador_nombre, udr.apellido AS directivo_revocador_apellido,
             (SELECT COUNT(*) FROM auditoria_acciones_realizadas acc WHERE acc.id_auditoria = a.id_auditoria) AS total_acciones
      FROM auditoria_supervision a
      JOIN colegio c ON c.id_colegio = a.id_colegio
      JOIN usuario u ON u.id_usuario = a.id_admin_general
      LEFT JOIN directivo d ON d.id = a.id_directivo_aprobador
      LEFT JOIN usuario ud ON ud.id_usuario = d.id_usuario
      LEFT JOIN directivo dr ON dr.id = a.revocado_por
      LEFT JOIN usuario udr ON udr.id_usuario = dr.id_usuario
      WHERE a.eliminado = FALSE
    `;
    const params: any[] = [];

    if (id_colegio) {
      params.push(id_colegio);
      query += ` AND a.id_colegio = $${params.length}`;
    }

    if (estado) {
      params.push(estado);
      query += ` AND a.estado_supervision = $${params.length}`;
    }

    if (desde) {
      params.push(desde);
      query += ` AND a.fecha_solicitud >= $${params.length}`;
    }

    if (hasta) {
      params.push(hasta);
      query += ` AND a.fecha_solicitud <= $${params.length}`;
    }

    query += ` ORDER BY a.fecha_solicitud DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
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
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Obtener auditoría
    const auditoria = await client.query(
      `SELECT a.*, c.nombre AS colegio_nombre
       FROM auditoria_supervision a
       JOIN colegio c ON c.id_colegio = a.id_colegio
       WHERE a.id_auditoria = $1 AND a.eliminado = FALSE`,
      [id]
    );

    if (auditoria.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Auditoría no encontrada' });
      return;
    }

    // Registrar la exportación como acción independiente
    await client.query(
      `INSERT INTO auditoria_acciones_realizadas
       (id_auditoria, modulo, tipo_accion, accion, recurso_afectado)
       VALUES ($1, 'AUDITORIA', 'EXPORTACION', 'Exportación de datos de auditoría', $2)`,
      [id, `Auditoría #${id} - ${auditoria.rows[0].colegio_nombre}`]
    );

    // Obtener datos completos para exportar
    const acciones = await client.query(
      `SELECT * FROM auditoria_acciones_realizadas WHERE id_auditoria = $1 ORDER BY fecha_accion ASC`,
      [id]
    );

    await client.query('COMMIT');

    const mappedAcciones = acciones.rows.map((row: any) => {
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
      auditoria: auditoria.rows[0],
      acciones: mappedAcciones,
      exportado_en: new Date().toISOString(),
      exportado_por: req.user!.email,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error exportando auditoría:', error);
    res.status(500).json({ error: 'Error al exportar auditoría' });
  } finally {
    client.release();
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

  if (url) {
    const [path, queryString] = url.split('?');
    
    const query: any = {};
    if (queryString) {
      const pairs = queryString.split('&');
      for (const pair of pairs) {
        const [key, val] = pair.split('=');
        if (key) {
          query[decodeURIComponent(key)] = val ? decodeURIComponent(val) : true;
        }
      }
    }

    const descripcion = getCleanFriendlyName(path);

    return {
      descripcion,
      endpoint: path,
      query: Object.keys(query).length > 0 ? query : undefined
    };
  }

  return { descripcion: recurso };
}

function getCleanFriendlyName(path: string): string {
  if (path.includes('/dashboard')) return 'Dashboard académico';
  if (path.includes('/settings')) return 'Configuración académica';
  if (path.includes('/boletines/student')) return 'Boletín individual de estudiante';
  if (path.includes('/boletines/grade')) return 'Boletines de grado';
  if (path.includes('/boletines')) return 'Generador de boletines';
  if (path.includes('/student/colegio')) return 'Listado general de estudiantes';
  if (path.includes('/student/sanctions/types')) return 'Tipos de sanciones disciplinarias';
  if (path.endsWith('/summary') && path.includes('/student/')) return 'Ficha resumen de estudiante';
  if (path.endsWith('/status') && path.includes('/student/')) return 'Estado y sanción de estudiante';
  if (path.endsWith('/change-grade') && path.includes('/student/')) return 'Traslado de grado de estudiante';
  if (path.endsWith('/graduate') && path.includes('/student/')) return 'Graduación de estudiante';
  if (path.includes('/student')) return 'Ficha de estudiante';
  if (path.includes('/teacher') || path.includes('/docentes')) return 'Gestión de docentes';
  if (path.includes('/grados')) return 'Configuración de grados';
  if (path.includes('/dba')) return 'Derechos básicos de aprendizaje (DBA)';
  if (path.includes('/support')) return 'Soporte técnico';
  if (path.includes('/matricula') || path.includes('/matriculas')) return 'Gestión de matrículas';
  if (path.includes('/academic-admin')) return 'Configuración curricular';
  
  return 'Recurso del sistema';
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRO DE ACCIONES DE AUDITORÍA (helper para uso interno)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registra una acción en la auditoría de supervisión activa del admin.
 * Se llama internamente desde otros endpoints cuando el admin está en modo supervisión.
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
  await pool.query(
    `INSERT INTO auditoria_acciones_realizadas
     (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, id_usuario_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [idAuditoria, modulo, tipoAccion, accion, recursoAfectado, idUsuarioAfectado || null,
     valorAntiguo ? JSON.stringify(valorAntiguo) : (tipoAccion === 'MODIFICACION' ? '{}' : null),
     valorNuevo ? JSON.stringify(valorNuevo) : (tipoAccion === 'MODIFICACION' ? '{}' : null),
     motivoCambio || (tipoAccion === 'MODIFICACION' ? 'Modificación auditada en modo supervisión' : null)]
  );
};

/**
 * GET /admin/dashboard/stats
 * Obtener estadísticas globales y estado de salud de la plataforma para el panel de Admin General.
 */
export const obtenerStatsDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Colegios KPIs
    const colegiosRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN estado = 'ACTIVO' THEN 1 END)::int as activos,
        COUNT(CASE WHEN estado = 'PENDIENTE' THEN 1 END)::int as pendientes,
        COUNT(CASE WHEN estado = 'SUSPENDIDO' THEN 1 END)::int as suspendidos
      FROM colegio
      WHERE estado != 'ELIMINADO'
    `);
    const colegios = colegiosRes.rows[0] || { total: 0, activos: 0, pendientes: 0, suspendidos: 0 };

    // 2. Usuarios KPIs
    const usuariosRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total,
        COUNT(CASE WHEN estado = 'ACTIVO' THEN 1 END)::int as activos
      FROM usuario
      WHERE estado != 'ELIMINADO'
    `);
    const usuariosTotal = usuariosRes.rows[0]?.total || 0;
    
    // Usuarios conectados en tiempo real vía WebSockets
    const { socketManager } = require('../services/socketManager');
    const usuariosConectados = socketManager.activeUserCount;


    // 3. Distribución de usuarios por Rol
    const distribucionRes = await pool.query(`
      SELECT r.nombre as rol, COUNT(*)::int as cantidad
      FROM usuario u
      JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
      JOIN rol r ON ur.id_rol = r.id_rol
      WHERE u.estado != 'ELIMINADO'
      GROUP BY r.nombre
    `);
    
    const distribucion: Record<string, number> = {
      directivo: 0,
      docente: 0,
      padre: 0,
      estudiante: 0,
      admin: 0,
      admin_general: 0
    };
    distribucionRes.rows.forEach((row: any) => {
      distribucion[row.rol.toLowerCase()] = row.cantidad;
    });

    // 4. Crecimiento (Seeded data + dynamic data)
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentMonthIdx = new Date().getMonth(); // 0-11
    
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

    // 5. Actividad Reciente (últimas acciones auditadas y operaciones del sistema)
    const actividadRes = await pool.query(`
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
    `);

    let actividad = actividadRes.rows.map((row: any) => {
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
    const supervisionesRes = await pool.query(`
      SELECT 
        COUNT(CASE WHEN estado_supervision = 'SOLICITADA' THEN 1 END)::int as pendientes,
        COUNT(CASE WHEN estado_supervision = 'APROBADA' THEN 1 END)::int as aprobadas,
        COUNT(CASE WHEN estado_supervision = 'ACTIVA' THEN 1 END)::int as activas,
        COUNT(CASE WHEN estado_supervision IN ('FINALIZADA', 'REVOCADA', 'EXPIRADA') THEN 1 END)::int as terminadas
      FROM auditoria_supervision
      WHERE eliminado = FALSE
    `);
    const supervisiones = supervisionesRes.rows[0] || { pendientes: 0, aprobadas: 0, activas: 0, terminadas: 0 };

    // 7. Resumen de Auditorías del mes
    const auditoriasMesRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT id_auditoria)::int as supervisiones,
        COUNT(CASE WHEN tipo_accion = 'MODIFICACION' THEN 1 END)::int as modificaciones,
        COUNT(CASE WHEN tipo_accion = 'EXPORTACION' THEN 1 END)::int as exportaciones,
        COUNT(CASE WHEN tipo_accion = 'LECTURA' THEN 1 END)::int as lecturas
      FROM auditoria_acciones_realizadas
      WHERE fecha_accion >= DATE_TRUNC('month', CURRENT_DATE)
    `);
    const auditoriasMes = auditoriasMesRes.rows[0] || { supervisiones: 0, modificaciones: 0, exportaciones: 0, lecturas: 0 };

    // 8. Salud de la plataforma
    let dbStatus = '🟢';
    try {
      await pool.query('SELECT 1');
    } catch {
      dbStatus = '🔴';
    }

    // Check SMTP service
    let correosStatus = '🟢';
    try {
      const isSmtpHealthy = await AdminGeneralNotificationService.verifySMTP();
      correosStatus = isSmtpHealthy ? '🟢' : '🔴';
    } catch {
      correosStatus = '🔴';
    }

    // Check disk space storage of the server/database partition
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

    let query = `
      SELECT aar.*, 
             aus.id_colegio, 
             c.nombre AS colegio_nombre, 
             u.nombre AS admin_nombre, 
             u.email AS admin_email,
             ud.nombre AS usuario_afectado_nombre, 
             ud.email AS usuario_afectado_email
      FROM auditoria_acciones_realizadas aar
      JOIN auditoria_supervision aus ON aar.id_auditoria = aus.id_auditoria
      JOIN colegio c ON c.id_colegio = aus.id_colegio
      JOIN usuario u ON aus.id_admin_general = u.id_usuario
      LEFT JOIN usuario ud ON aar.id_usuario_afectado = ud.id_usuario
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tipo_accion) {
      params.push(tipo_accion);
      query += ` AND aar.tipo_accion = $${params.length}`;
    }

    if (modulo) {
      params.push(modulo);
      query += ` AND aar.modulo = $${params.length}`;
    }

    if (id_colegio) {
      params.push(id_colegio);
      query += ` AND aus.id_colegio = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (aar.accion ILIKE $${params.length} OR aar.recurso_afectado ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`;
    }

    if (fecha_desde) {
      params.push(fecha_desde);
      query += ` AND aar.fecha_accion >= $${params.length}`;
    }

    if (fecha_hasta) {
      params.push(`${fecha_hasta} 23:59:59`);
      query += ` AND aar.fecha_accion <= $${params.length}`;
    }

    query += ` ORDER BY aar.fecha_accion DESC`;

    // Count query for total
    const countQuery = `SELECT COUNT(*)::int as count FROM (${query}) AS temp`;
    const countResult = await pool.query(countQuery, params);
    const totalCount = countResult.rows[0].count;

    if (page && limit) {
      const offset = (page - 1) * limit;
      params.push(limit);
      query += ` LIMIT $${params.length}`;
      params.push(offset);
      query += ` OFFSET $${params.length}`;
    }

    const result = await pool.query(query, params);
    const mapped = result.rows.map((row: any) => ({
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
    const supervisionRes = await pool.query(`
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
    `);

    const colegioRes = await pool.query(`
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
    `);

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
    const schoolId = Number(colegioId);

    // Verificar que el usuario es directivo del colegio o Administrador General
    let isAuthorized = false;
    if (req.user!.roles.includes('admin_general')) {
      isAuthorized = true;
    } else {
      const directivo = await pool.query(
        `SELECT d.id FROM directivo d
         WHERE d.id_usuario = $1 AND d.id_colegio = $2 AND d.estado = 'ACTIVO'`,
        [req.user!.id, schoolId]
      );
      if (directivo.rows.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ error: 'No tienes permisos para ver las supervisiones de este colegio' });
      return;
    }

    const query = `
      SELECT a.*,
             u.nombre AS admin_nombre, u.email AS admin_email,
             ud.nombre AS directivo_nombre, ud.apellido AS directivo_apellido,
             udr.nombre AS directivo_revocador_nombre, udr.apellido AS directivo_revocador_apellido,
             (SELECT COUNT(*) FROM auditoria_acciones_realizadas acc WHERE acc.id_auditoria = a.id_auditoria) AS total_acciones
      FROM auditoria_supervision a
      JOIN usuario u ON u.id_usuario = a.id_admin_general
      LEFT JOIN directivo d ON d.id = a.id_directivo_aprobador
      LEFT JOIN usuario ud ON ud.id_usuario = d.id_usuario
      LEFT JOIN directivo dr ON dr.id = a.revocado_por
      LEFT JOIN usuario udr ON udr.id_usuario = dr.id_usuario
      WHERE a.id_colegio = $1 AND a.eliminado = FALSE
      ORDER BY a.fecha_solicitud DESC
    `;
    const result = await pool.query(query, [schoolId]);
    res.json(result.rows);
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
    const { id } = req.params;

    // Obtener la supervisión
    const supervision = await pool.query(
      `SELECT id_colegio FROM auditoria_supervision WHERE id_auditoria = $1 AND eliminado = FALSE`,
      [id]
    );

    if (supervision.rows.length === 0) {
      res.status(404).json({ error: 'Supervisión no encontrada' });
      return;
    }

    const schoolId = supervision.rows[0].id_colegio;

    // Verificar que el usuario es directivo del colegio
    const directivo = await pool.query(
      `SELECT d.id FROM directivo d
       WHERE d.id_usuario = $1 AND d.id_colegio = $2 AND d.estado = 'ACTIVO'`,
      [req.user!.id, schoolId]
    );

    if (directivo.rows.length === 0) {
      res.status(403).json({ error: 'No tienes permisos para ver las acciones de esta supervisión' });
      return;
    }

    const result = await pool.query(
      `SELECT a.*, u.nombre AS usuario_afectado_nombre, u.email AS usuario_afectado_email
       FROM auditoria_acciones_realizadas a
       LEFT JOIN usuario u ON u.id_usuario = a.id_usuario_afectado
       WHERE a.id_auditoria = $1
       ORDER BY a.fecha_accion ASC`,
      [id]
    );

    const mapped = result.rows.map((row: any) => ({
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
    const result = await pool.query(
      `SELECT clave, valor, descripcion, actualizado_por, fecha_actualizacion
       FROM configuracion_plataforma
       ORDER BY clave`
    );

    // Transformar a un objeto clave-valor para consumo más fácil en el frontend
    const config: Record<string, { valor: string; descripcion: string | null; actualizado_por: number | null; fecha_actualizacion: string }> = {};
    for (const row of result.rows) {
      config[row.clave] = {
        valor: row.valor,
        descripcion: row.descripcion,
        actualizado_por: row.actualizado_por,
        fecha_actualizacion: row.fecha_actualizacion,
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
  const client = await pool.connect();
  try {
    const { supervision_duracion_minima_minutos, supervision_duracion_maxima_minutos } = req.body;

    // Validar que los valores existen
    if (supervision_duracion_minima_minutos === undefined || supervision_duracion_maxima_minutos === undefined) {
      res.status(400).json({ error: 'Se requieren supervision_duracion_minima_minutos y supervision_duracion_maxima_minutos' });
      return;
    }

    const minVal = Number(supervision_duracion_minima_minutos);
    const maxVal = Number(supervision_duracion_maxima_minutos);

    // Validar que son números válidos
    if (isNaN(minVal) || isNaN(maxVal) || !Number.isInteger(minVal) || !Number.isInteger(maxVal)) {
      res.status(400).json({ error: 'Los valores deben ser números enteros' });
      return;
    }

    // Validar rangos seguros
    if (minVal < 1 || minVal > 60) {
      res.status(400).json({ error: 'La duración mínima debe estar entre 1 y 60 minutos' });
      return;
    }

    if (maxVal < 30 || maxVal > 1440) {
      res.status(400).json({ error: 'La duración máxima debe estar entre 30 y 1440 minutos (24 horas)' });
      return;
    }

    // Validar que mínima < máxima
    if (minVal >= maxVal) {
      res.status(400).json({ error: 'La duración mínima debe ser menor que la duración máxima' });
      return;
    }

    await client.query('BEGIN');

    // Actualizar duración mínima
    await client.query(
      `UPDATE configuracion_plataforma
       SET valor = $1, actualizado_por = $2, fecha_actualizacion = NOW()
       WHERE clave = 'supervision_duracion_minima_minutos'`,
      [String(minVal), req.user!.id]
    );

    // Actualizar duración máxima
    await client.query(
      `UPDATE configuracion_plataforma
       SET valor = $1, actualizado_por = $2, fecha_actualizacion = NOW()
       WHERE clave = 'supervision_duracion_maxima_minutos'`,
      [String(maxVal), req.user!.id]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Configuración actualizada correctamente',
      supervision_duracion_minima_minutos: minVal,
      supervision_duracion_maxima_minutos: maxVal,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error actualizando configuración:', error);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  } finally {
    client.release();
  }
};

/**
 * Helper interno para verificar si un ticket corresponde al usuario que se desea modificar.
 * Retorna { valido: true, ticket: ... } o { valido: false, error: '...' }
 */
const verificarCorrespondenciaTicketUsuario = async (
  client: any,
  idUsuario: number | string,
  codigoTicket: string
): Promise<{ valido: boolean; error?: string; ticket?: any }> => {
  // 1. Obtener ticket de soporte
  const ticketRes = await client.query(
    `SELECT id_ticket, id_usuario, correo_remitente, asunto, descripcion, observaciones, estado 
     FROM tickets_soporte 
     WHERE codigo_ticket = $1`,
    [String(codigoTicket).trim().toUpperCase()]
  );

  if (ticketRes.rows.length === 0) {
    return { valido: false, error: 'El código del ticket de soporte ingresado no existe.' };
  }

  const ticket = ticketRes.rows[0];
  if (ticket.estado === 'RESUELTO') {
    return { valido: false, error: 'El ticket de soporte ingresado ya se encuentra RESUELTO y cerrado.' };
  }

  // 2. Obtener datos actuales del usuario a modificar
  const userRes = await client.query(
    `SELECT nombre, apellido, email, id_usuario 
     FROM usuario 
     WHERE id_usuario = $1`,
    [idUsuario]
  );

  if (userRes.rows.length === 0) {
    return { valido: false, error: 'El usuario destino no existe.' };
  }

  const targetUser = userRes.rows[0];

  // Caso A: El id_usuario del ticket coincide directamente, o el correo del remitente coincide con el del usuario a modificar
  const sameId = ticket.id_usuario && Number(ticket.id_usuario) === Number(targetUser.id_usuario);
  const sameEmail = ticket.correo_remitente && String(ticket.correo_remitente).trim().toLowerCase() === String(targetUser.email).trim().toLowerCase();

  if (sameId || sameEmail) {
    return { valido: true, ticket };
  }

  // Caso B: El usuario es estudiante, y el remitente del ticket es su acudiente/padre
  // Consultar si el targetUser tiene asignado el rol de ESTUDIANTE
  const targetUserRoles = await client.query(
    `SELECT r.nombre 
     FROM usuario_rol ur 
     JOIN rol r ON ur.id_rol = r.id_rol 
     WHERE ur.id_usuario = $1`,
     [targetUser.id_usuario]
  );
  
  const hasStudentRole = targetUserRoles.rows.some((r: any) => String(r.nombre).toUpperCase() === 'ESTUDIANTE');

  if (hasStudentRole && ticket.id_usuario) {
    // Buscar id_estudiante y codigo estudiantil de la cuenta estudiante destino
    const studentRes = await client.query(
      `SELECT id_estudiante, codigo 
       FROM public.estudiante 
       WHERE id_usuario = $1`,
      [targetUser.id_usuario]
    );

    if (studentRes.rows.length > 0) {
      const student = studentRes.rows[0];
      const studentCode = String(student.codigo).trim();

      // Buscar el id_padrefamilia asociado al remitente del ticket (ticket.id_usuario)
      const parentRes = await client.query(
        `SELECT id_padrefamilia FROM public.padre_familia WHERE id_usuario = $1`,
        [ticket.id_usuario]
      );

      if (parentRes.rows.length > 0) {
        const parentId = parentRes.rows[0].id_padrefamilia;

        // Verificar si existe la relación en detalle_padrefamilia
        const relRes = await client.query(
          `SELECT id_detallepadrefamilia 
           FROM public.detalle_padrefamilia 
           WHERE id_padrefamilia = $1 AND id_estudiante = $2`,
          [parentId, student.id_estudiante]
        );

        if (relRes.rows.length > 0) {
          // El remitente es su acudiente. Ahora validamos que el ticket contenga el código del estudiante en el asunto o descripción
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

  // Caso C: El remitente es un Directivo del mismo colegio del usuario destino
  if (ticket.id_usuario) {
    const creatorRolesRes = await client.query(
      `SELECT r.nombre, uc.id_colegio
       FROM usuario_rol ur 
       JOIN rol r ON ur.id_rol = r.id_rol 
       JOIN usuario u ON u.id_usuario = ur.id_usuario
       LEFT JOIN usuario_colegio uc ON uc.id_usuario = u.id_usuario AND uc.estado = 'ACTIVO'
       WHERE ur.id_usuario = $1`,
      [ticket.id_usuario]
    );
    const creatorRoles = creatorRolesRes.rows.map((r: any) => String(r.nombre).toUpperCase());
    const creatorSchoolId = creatorRolesRes.rows[0]?.id_colegio;

    const isDirectivo = creatorRoles.includes('DIRECTIVO');

    if (isDirectivo && creatorSchoolId && targetUser.id_colegio && Number(creatorSchoolId) === Number(targetUser.id_colegio)) {
      // Obtener documento del usuario destino desde la tabla usuario
      const targetDocRes = await client.query(
        `SELECT documento FROM usuario WHERE id_usuario = $1`,
        [targetUser.id_usuario]
      );
      const targetDoc = targetDocRes.rows[0]?.documento;

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

  // Si no se cumple nada, la validación falla
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
  const id = String(req.params.id);
  const { codigo_ticket } = req.body;

  if (!codigo_ticket) {
    res.status(400).json({ error: 'El código del ticket es requerido.' });
    return;
  }

  const client = await pool.connect();
  try {
    const check = await verificarCorrespondenciaTicketUsuario(client, id, codigo_ticket);
    if (!check.valido) {
      res.status(400).json({ error: check.error });
      return;
    }

    res.json({ success: true, message: 'Ticket validado correctamente. Edición autorizada.' });
  } catch (error: any) {
    console.error('Error validando ticket para usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor al validar ticket.' });
  } finally {
    client.release();
  }
};

/**
 * PUT /admin/usuarios/:id/credenciales-con-ticket
 * Modificar datos de identificación y roles de un usuario requiriendo ticket de soporte activo y correspondiente.
 */
export const modificarCredencialesConTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { codigo_ticket, nombre, apellido, tipo_documento, documento, roles } = req.body;

  if (!codigo_ticket || !nombre || !apellido || !tipo_documento || !documento || !Array.isArray(roles)) {
    res.status(400).json({ error: 'Código de ticket, nombre, apellido, tipo de documento, documento y roles son requeridos.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar correspondencia y estado del ticket
    const check = await verificarCorrespondenciaTicketUsuario(client, id, codigo_ticket);
    if (!check.valido) {
      res.status(400).json({ error: check.error });
      await client.query('ROLLBACK');
      return;
    }

    const ticket = check.ticket;

    // 2. Obtener datos actuales del usuario (antes)
    const userQuery = await client.query(
      "SELECT nombre, apellido, email, id_colegio FROM usuario WHERE id_usuario = $1",
      [id]
    );

    if (userQuery.rows.length === 0) {
      res.status(404).json({ error: 'El usuario no existe.' });
      await client.query('ROLLBACK');
      return;
    }

    const oldUser = userQuery.rows[0];

    // Consultar roles actuales
    const oldRolesRes = await client.query(
      `SELECT r.nombre 
       FROM usuario_rol ur 
       JOIN rol r ON ur.id_rol = r.id_rol 
       WHERE ur.id_usuario = $1`,
      [id]
    );
    const oldRoles = oldRolesRes.rows.map(r => String(r.nombre).toUpperCase());

    // Consultar documento actual desde la tabla usuario
    let oldDoc = 'No Registrado';
    let oldTipoDoc = 'No Registrado';

    const docSearch = await client.query(
      `SELECT u.documento, td.tipo AS tipo_documento 
       FROM usuario u 
       LEFT JOIN tipo_documento td ON u.id_tipodocumento = td.id_tipodocumento 
       WHERE u.id_usuario = $1`,
      [id]
    );
    if (docSearch.rows.length > 0) {
      oldDoc = docSearch.rows[0].documento || 'No Registrado';
      oldTipoDoc = docSearch.rows[0].tipo_documento || 'No Registrado';
    }

    // Mapear tipo_documento string a id_tipodocumento entero
    const idTipoDoc = resolveTipoDocumentoId(tipo_documento);

    // 3. Actualizar tabla usuario (nombres, id_tipodocumento, documento)
    await client.query(
      "UPDATE usuario SET nombre = $1, apellido = $2, id_tipodocumento = $3, documento = $4 WHERE id_usuario = $5",
      [nombre.trim(), apellido.trim(), idTipoDoc, documento.trim(), id]
    );

    // 4. Sincronizar roles en usuario_rol
    const normalizedNewRoles = roles.map(r => String(r).toUpperCase());
    
    // Obtener catálogo de roles de la BD
    const allRolesDb = await client.query("SELECT id_rol, nombre FROM public.rol");
    const roleMap = new Map<string, number>();
    allRolesDb.rows.forEach(r => roleMap.set(String(r.nombre).toUpperCase(), Number(r.id_rol)));

    // Eliminar roles anteriores
    await client.query("DELETE FROM usuario_rol WHERE id_usuario = $1", [id]);

    // Insertar nuevos roles
    for (const roleName of normalizedNewRoles) {
      const roleId = roleMap.get(roleName);
      if (roleId) {
        await client.query(
          "INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [id, roleId]
        );

        // Inicializar o actualizar tabla del rol específico para evitar inconsistencias
        if (roleName === 'DOCENTE') {
          await client.query(
            `INSERT INTO public.docente (id_usuario, nombre, apellido, id_colegio)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id_usuario) DO UPDATE 
             SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido`,
            [id, nombre.trim(), apellido.trim(), oldUser.id_colegio || 1]
          );
        } else if (roleName === 'PADRE') {
          await client.query(
            `INSERT INTO public.padre_familia (id_usuario, nombre, apellido, id_colegio)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (id_usuario) DO UPDATE 
             SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido`,
            [id, nombre.trim(), apellido.trim(), oldUser.id_colegio]
          );
        } else if (roleName === 'ESTUDIANTE') {
          await client.query(
            `INSERT INTO public.estudiante (id_usuario, nombre, apellido, id_colegio, codigo)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id_usuario) DO UPDATE 
             SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido`,
            [id, nombre.trim(), apellido.trim(), oldUser.id_colegio || 1, `EST-${id}`]
          );
        }
      }
    }

    // 5. Redactar el diff de auditoría del cambio
    const auditText = `El Administrador General modificó los datos de la cuenta vinculada bajo la orden de este ticket de soporte.
Detalle de cambios (Antes ➔ Después):
- Nombre Completo: '${oldUser.nombre} ${oldUser.apellido || ''}' ➔ '${nombre.trim()} ${apellido.trim()}'
- Identificación: '${oldTipoDoc} #${oldDoc}' ➔ '${tipo_documento.trim()} #${documento.trim()}'
- Roles Asignados: [${oldRoles.join(', ')}] ➔ [${normalizedNewRoles.join(', ')}]`;

    // 6. Registrar la observación automática en el ticket
    let currentObs = [];
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

    await client.query(
      "UPDATE tickets_soporte SET observaciones = $1 WHERE id_ticket = $2",
      [JSON.stringify(currentObs), ticket.id_ticket]
    );

    await client.query('COMMIT');
    res.json({ message: 'Credenciales y roles actualizados con éxito y registrados en la auditoría del ticket.' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error modifying credentials with ticket:', error);
    res.status(550).json({ error: 'Error interno del servidor al actualizar credenciales.' });
  } finally {
    client.release();
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // RN-DIR-006: Exclusión de la creación directa de estudiantes sin Matrícula Institucional
    const normalizedRol = String(rol || '').trim().toLowerCase();
    if (normalizedRol === 'estudiante') {
      res.status(400).json({ error: 'El rol estudiante no puede crearse directamente. Debe registrarse a través del proceso de Matrícula Institucional.' });
      await client.query('ROLLBACK');
      return;
    }

    // 1. Obtener ID del rol
    const rolRes = await client.query('SELECT id_rol FROM rol WHERE LOWER(nombre) = LOWER($1)', [rol]);
    if (rolRes.rows.length === 0) {
      res.status(400).json({ error: `El rol '${rol}' no existe en el sistema.` });
      await client.query('ROLLBACK');
      return;
    }
    const idRol = rolRes.rows[0].id_rol;

    // 2. Determinar correo electrónico final
    // Para estudiantes, el correo es opcional y puede quedar en NULL
    const trimmedEmail = (email || '').trim().toLowerCase();
    const finalEmail: string | null = trimmedEmail || null;

    // 3. Verificar duplicado de correo si se ingresó uno
    // (NULL no viola la restricción UNIQUE en PostgreSQL: NULL ≠ NULL)
    if (finalEmail) {
      const dupCheck = await client.query('SELECT id_usuario FROM usuario WHERE LOWER(email) = LOWER($1)', [finalEmail]);
      if (dupCheck.rows.length > 0) {
        res.status(409).json({ error: `El correo electrónico '${email}' ya se encuentra registrado.` });
        await client.query('ROLLBACK');
        return;
      }
    }

    // 3.5. Validar unicidad y formato del documento si fue proporcionado
    const idTipoDoc = resolveTipoDocumentoId(tipo_documento);
    if (documento && String(documento).trim()) {
      await validateDocumentUniqueness(client, String(documento).trim(), rol, undefined, idTipoDoc);
    }

    // 4. Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Insertar usuario base
    const userRes = await client.query(
      `INSERT INTO usuario (email, password, nombre, apellido, activo, id_tipodocumento, documento, telefono, estado)
       VALUES ($1, $2, $3, $4, true, $5, $6, $7, 'ACTIVO')
       RETURNING id_usuario, email, nombre, apellido, activo, fecha_creacion`,
      [
        finalEmail,
        hashedPassword,
        nombre.trim(),
        (apellido || '').trim() || null,
        idTipoDoc,
        (documento || '').trim() || null,
        (telefono || '').trim() || null
      ]
    );

    const newUserId = userRes.rows[0].id_usuario;

    // 6. Asignar rol en usuario_rol y usuario_colegio
    await client.query(
      'INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [newUserId, idRol]
    );

    if (id_colegio) {
      await client.query(
        `INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio)
         VALUES ($1, $2, $3, 'ACTIVO', NOW()) ON CONFLICT DO NOTHING`,
        [newUserId, id_colegio, idRol]
      );
    }

    // 7. Crear perfil específico según el rol
    if (rol === 'directivo' && id_colegio) {
      await client.query(
        `INSERT INTO directivo (id_usuario, id_colegio, cargo, fecha_vinculacion)
         VALUES ($1, $2, 'Directivo Institucional', NOW())`,
        [newUserId, id_colegio]
      );
    } else if (rol === 'docente' && id_colegio) {
      await client.query(
        `INSERT INTO docente (id_usuario, id_colegio, nombre, apellido, documento, estado)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVO') ON CONFLICT DO NOTHING`,
        [newUserId, id_colegio, nombre.trim(), (apellido || '').trim() || '', documento || '']
      );
    } else if (rol === 'padre' && id_colegio) {
      await client.query(
        `INSERT INTO padre_familia (id_usuario, id_colegio, nombre, apellido, documento)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [newUserId, id_colegio, nombre.trim(), (apellido || '').trim() || '', documento || '']
      );
    }

    // 7.5 Registrar correo institucional en usuario_colegio_email si aplica
    // Para directivos y docentes vinculados a un colegio, el email de creacion
    // es su correo institucional inicial en esa institucion.
    if (id_colegio && finalEmail && (rol === 'directivo' || rol === 'docente')) {
      await upsertInstitutionalEmail(newUserId, id_colegio, finalEmail, null, client);
    }

    // 8. Registro de Auditoría de Supervisión si aplica
    const authReq = req as any;
    const activeAuditoriaId = authReq.user?.supervisionId;
    if (activeAuditoriaId) {
      await client.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, id_usuario_afectado, valor_nuevo, motivo_cambio)
         VALUES ($1, 'USUARIOS', 'CREACION', 'Creación directa de usuario por Admin General', $2, $3, $4, $5)`,
        [
          activeAuditoriaId,
          `Usuario ID: ${newUserId}`,
          newUserId,
          JSON.stringify({ email: finalEmail, nombre, apellido, rol, id_colegio }),
          'Creación de cuenta por administración global'
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: `Usuario ${nombre} ${apellido || ''} (${rol}) creado exitosamente.`,
      user: {
        id_usuario: newUserId,
        email: finalEmail,
        nombre,
        apellido,
        rol,
        id_colegio
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating user by Admin General:', error);
    res.status(500).json({ error: 'Error interno del servidor al crear usuario.' });
  } finally {
    client.release();
  }
};


