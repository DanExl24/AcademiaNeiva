import { Request, Response } from "express";
import { pool } from "../config/db";
import { db } from "../config/kysely";
import { sql } from "kysely";
import { validateDocumentUniqueness } from "../utils/documentValidation";
import { formatFriendlyErrorMessage } from "../utils/errorHelper";

const parseSchoolId = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!parsed || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

const hasParentSchoolAccess = async (
  userSchoolId: number,
  parentId: number,
  parentUserId: number | null,
  parentSchoolId: number | null
): Promise<boolean> => {
  if (parentSchoolId === userSchoolId) return true;

  if (parentUserId) {
    const uc = await db
      .selectFrom("usuario_colegio")
      .select("id_usuario_colegio")
      .where("id_usuario", "=", parentUserId)
      .where("id_colegio", "=", userSchoolId)
      .executeTakeFirst();
    if (uc) return true;
  }

  const dp = await db
    .selectFrom("detalle_padrefamilia as dp")
    .innerJoin("estudiante as e", "dp.id_estudiante", "e.id_estudiante")
    .select("dp.id_detallepadrefamilia")
    .where("dp.id_padrefamilia", "=", parentId)
    .where("e.id_colegio", "=", userSchoolId)
    .executeTakeFirst();

  return !!dp;
};

/**
 * Lista todos los padres de familia del colegio con filtros avanzados:
 * busqueda, estadoCuenta, alertaHijo, id_nivel, id_tipo_grado, cantHijos, estadoMatricula
 */
export const getParentsManagementData = async (req: Request, res: Response): Promise<void> => {
  const { schoolId } = req.params;
  const {
    busqueda,
    estadoCuenta,
    alertaHijo,
    id_nivel,
    id_tipo_grado,
    cantHijos,
    estadoMatricula,
    yearId
  } = req.query;

  const id_colegio = parseSchoolId(schoolId);
  if (!id_colegio) {
    res.status(400).json({ error: "ID de colegio invalido" });
    return;
  }

  const authReq = req as any;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== id_colegio) {
    res.status(403).json({ error: "No tiene permiso para consultar los padres de familia de este colegio." });
    return;
  }

  try {
    const selectedYearId = yearId ? Number(yearId) : null;
    const params: any[] = [id_colegio, selectedYearId];
    let whereClauses = [];

    if (busqueda && typeof busqueda === "string" && busqueda.trim()) {
      params.push(`%${busqueda.trim()}%`);
      const idx = params.length;
      whereClauses.push(`(
        ps.nombre ILIKE $${idx}
        OR ps.apellido ILIKE $${idx}
        OR ps.documento ILIKE $${idx}
        OR ps.email ILIKE $${idx}
      )`);
    }

    const { soloDocentes } = req.query;

    if (estadoCuenta === "ACTIVO" || estadoCuenta === "CON_USUARIO") {
      whereClauses.push("ps.id_usuario IS NOT NULL AND ps.usuario_activo = true");
    } else if (estadoCuenta === "INACTIVO" || estadoCuenta === "SIN_USUARIO") {
      whereClauses.push("(ps.id_usuario IS NULL OR ps.usuario_activo = false)");
    }

    if (soloDocentes === "true" || soloDocentes === "1") {
      whereClauses.push("ps.es_docente = true");
    }

    if (alertaHijo === "RIESGO_ACADEMICO") {
      whereClauses.push("ps.tiene_hijo_riesgo = true");
    } else if (alertaHijo === "ALTA_INASISTENCIA") {
      whereClauses.push("ps.tiene_hijo_inasistencias = true");
    } else if (alertaHijo === "CON_SANCION") {
      whereClauses.push("ps.tiene_hijo_sancionado = true");
    }

    if (id_nivel) {
      params.push(Number(id_nivel));
      whereClauses.push(`EXISTS (
        SELECT 1 FROM nivel_escolar ne_ref
        WHERE ne_ref.id_nivel = $${params.length}
          AND ne_ref.nombre = ANY(ps.nombres_niveles_hijos)
      )`);
    }

    if (id_tipo_grado) {
      params.push(Number(id_tipo_grado));
      whereClauses.push(`EXISTS (
        SELECT 1 FROM tipo_grado tg_ref
        WHERE tg_ref.id_tipo_grado = $${params.length}
          AND tg_ref.nombre = ANY(ps.nombres_grados_hijos)
      )`);
    }

    if (cantHijos === "UN_HIJO") {
      whereClauses.push("ps.hijos_count = 1");
    } else if (cantHijos === "MULTIPLES") {
      whereClauses.push("ps.hijos_count >= 2");
    } else if (cantHijos === "SIN_HIJOS") {
      whereClauses.push("ps.hijos_count = 0");
    }

    if (estadoMatricula && estadoMatricula !== "TODAS") {
      params.push(String(estadoMatricula));
      whereClauses.push(`$${params.length} = ANY(ps.estados_matricula_hijos)`);
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
      WITH parent_stats AS (
        SELECT
          pf.id_padrefamilia,
          pf.nombre,
          pf.apellido,
          u.documento,
          u.id_tipodocumento,
          td.tipo AS tipo_documento,
          u.email,
          u.id_usuario,
          u.activo AS usuario_activo,
          COUNT(DISTINCT CASE WHEN $2::int IS NULL THEN dpf.id_estudiante ELSE m.id_estudiante END) AS hijos_count,
          (doc.id_docente IS NOT NULL) AS es_docente,
          u_doc.email AS email_docente,

          BOOL_OR(
            e.id_estudiante IS NOT NULL AND ($2::int IS NULL OR m.id_matricula IS NOT NULL) AND EXISTS (
              SELECT 1 FROM sancion sa 
              WHERE sa.id_estudiante = e.id_estudiante 
                AND sa.estado = 'ACTIVA'
                AND (
                  $2::int IS NULL OR EXISTS (
                    SELECT 1 FROM anio_lectivo al_s 
                    WHERE al_s.id_anio = $2::int 
                      AND EXTRACT(YEAR FROM sa.fecha_inicio) = NULLIF(regexp_replace(al_s.calendario, '\D', '', 'g'), '')::int
                  )
                )
            )
          ) AS tiene_hijo_sancionado,

          BOOL_OR(
            e.id_estudiante IS NOT NULL AND ($2::int IS NULL OR m.id_matricula IS NOT NULL) AND (
              (SELECT COUNT(*) FROM registro_asistencia ra 
               JOIN detalle_grados dg_ra ON dg_ra.id_detallegrado = ra.id_detallegrado 
               WHERE ra.id_estudiante = e.id_estudiante 
                 AND ra.estado = 'AUSENTE'
                 AND ($2::int IS NULL OR dg_ra.id_anio = $2::int)
              ) >= 3
            )
          ) AS tiene_hijo_inasistencias,

          BOOL_OR(
            e.id_estudiante IS NOT NULL AND ($2::int IS NULL OR m.id_matricula IS NOT NULL) AND (
              (SELECT AVG(ra_nota.promedio) FROM resultado_academico ra_nota 
               JOIN periodo_academico pa ON pa.id_periodo = ra_nota.id_periodo 
               WHERE ra_nota.id_estudiante = e.id_estudiante 
                 AND pa.estado != 'PENDIENTE'
                 AND ($2::int IS NULL OR pa.id_anio = $2::int)
              ) < 3.0
            )
          ) AS tiene_hijo_riesgo,

          ARRAY_REMOVE(ARRAY_AGG(DISTINCT COALESCE(m.id_nivel, g.id_nivel, tg.id_nivel)), NULL) AS niveles_hijos,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT ne.nombre), NULL) AS nombres_niveles_hijos,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT g.id_tipo_grado), NULL) AS grados_hijos,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT tg.nombre), NULL) AS nombres_grados_hijos,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT m.estado::text), NULL) AS estados_matricula_hijos

        FROM padre_familia pf
        LEFT JOIN usuario u ON pf.id_usuario = u.id_usuario
        LEFT JOIN tipo_documento td ON u.id_tipodocumento = td.id_tipodocumento
        LEFT JOIN docente doc ON (
          doc.id_usuario IS NOT NULL AND pf.id_usuario IS NOT NULL AND doc.id_usuario = pf.id_usuario AND doc.id_colegio = pf.id_colegio
        )
        LEFT JOIN usuario u_doc ON u_doc.id_usuario = doc.id_usuario
        LEFT JOIN detalle_padrefamilia dpf ON (dpf.id_padrefamilia = pf.id_padrefamilia AND (dpf.id_colegio = $1 OR dpf.id_colegio IS NULL))
        LEFT JOIN estudiante e ON (e.id_estudiante = dpf.id_estudiante AND e.id_colegio = $1)
        LEFT JOIN matricula m ON (m.id_estudiante = e.id_estudiante AND m.id_colegio = $1 AND ($2::int IS NULL OR m.id_anio = $2::int))
        LEFT JOIN grupos g ON g.id_grupo = m.id_grupo
        LEFT JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
        LEFT JOIN nivel_escolar ne ON ne.id_nivel = COALESCE(m.id_nivel, g.id_nivel, tg.id_nivel)
        WHERE (
          pf.id_colegio = $1 
          OR EXISTS (SELECT 1 FROM usuario_colegio uc WHERE uc.id_usuario = u.id_usuario AND uc.id_colegio = $1 AND uc.estado = 'ACTIVO')
          OR EXISTS (SELECT 1 FROM detalle_padrefamilia dpf_c JOIN estudiante e_c ON e_c.id_estudiante = dpf_c.id_estudiante WHERE dpf_c.id_padrefamilia = pf.id_padrefamilia AND (dpf_c.id_colegio = $1 OR e_c.id_colegio = $1))
        )
        GROUP BY pf.id_padrefamilia, pf.nombre, pf.apellido, u.documento,
                 u.id_tipodocumento, td.tipo, u.email, u.id_usuario, u.activo, doc.id_docente, u_doc.email
      )
      SELECT *
      FROM parent_stats ps
      ${whereString}
      ORDER BY ps.apellido ASC, ps.nombre ASC
    `;

    const result = await pool.query(query, params);

    // Catalogs for filters
    const nivelesRes = await pool.query(
      `SELECT MIN(id_nivel) AS id_nivel, nombre
       FROM nivel_escolar
       WHERE id_colegio = $1 OR id_colegio IS NULL
       GROUP BY nombre
       ORDER BY MIN(id_nivel) ASC`,
      [id_colegio]
    );
    const gradosRes = await pool.query(
      `SELECT MIN(id_tipo_grado) AS id_tipo_grado, nombre
       FROM tipo_grado
       GROUP BY nombre
       ORDER BY MIN(id_tipo_grado) ASC`
    );

    res.json({
      parents: result.rows,
      padres: result.rows,
      catalogs: {
        niveles: nivelesRes.rows,
        grados: gradosRes.rows
      }
    });
  } catch (error: any) {
    console.error("Error en getParentsManagementData:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

/**
 * Obtiene el detalle completo de un padre de familia con sus hijos vinculados
 * y estadisticas basicas de cada hijo filtrados estrictamente por la institución actual
 */
export const getParentDetail = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const parentId = parseInt(id as string);
  const selectedYearId = req.query.yearId ? Number(req.query.yearId) : null;

  if (isNaN(parentId)) {
    res.status(400).json({ error: "ID de padre de familia inválido" });
    return;
  }

  try {
    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    const targetSchoolId = (!isSupervision && authReq.user?.schoolId)
      ? authReq.user.schoolId
      : (req.query.id_colegio ? Number(req.query.id_colegio) : null);

    const parent = await db
      .selectFrom("padre_familia as pf")
      .leftJoin("usuario as u", "pf.id_usuario", "u.id_usuario")
      .leftJoin("tipo_documento as td", "u.id_tipodocumento", "td.id_tipodocumento")
      .leftJoin("docente as doc", (join) =>
        join
          .onRef("doc.id_usuario", "=", "pf.id_usuario")
          .onRef("doc.id_colegio", "=", "pf.id_colegio")
      )
      .leftJoin("usuario as u_doc", "u_doc.id_usuario", "doc.id_usuario")
      .select([
        "pf.id_padrefamilia",
        "pf.nombre",
        "pf.apellido",
        "u.documento",
        "u.id_tipodocumento",
        "pf.id_colegio",
        "td.tipo as tipo_documento",
        "u.email",
        "u.id_usuario",
        "u.activo as usuario_activo",
        "u.fecha_creacion as cuenta_creada",
        sql<boolean>`(doc.id_docente IS NOT NULL)`.as("es_docente"),
        "u_doc.email as email_docente"
      ])
      .where("pf.id_padrefamilia", "=", parentId)
      .executeTakeFirst();

    if (!parent) {
      res.status(404).json({ error: "Padre de familia no encontrado" });
      return;
    }

    if (!isSupervision && authReq.user?.schoolId) {
      const allowed = await hasParentSchoolAccess(authReq.user.schoolId, parentId, parent.id_usuario, parent.id_colegio);
      if (!allowed) {
        res.status(403).json({ error: "No tiene permiso para consultar el detalle de este acudiente." });
        return;
      }
    }

    // Subquery de matrícula para seleccionar la mejor matrícula de cada estudiante
    let matriculaSubquery = db
      .selectFrom("matricula as m_inner")
      .select(["id_matricula", "id_estudiante", "id_grupo", "id_anio", "id_nivel", "id_colegio", "estado"])
      .distinctOn("id_estudiante")
      .where("estado", "in", ["ACTIVA", "APROBADA", "CULMINADA", "PENDIENTE", "PENDIENTE_RENOVACION", "TRASLADADA"]);

    if (selectedYearId) {
      matriculaSubquery = matriculaSubquery.where("id_anio", "=", selectedYearId);
    }
    if (targetSchoolId) {
      matriculaSubquery = matriculaSubquery.where("id_colegio", "=", targetSchoolId);
    }

    const activeMatSub = matriculaSubquery
      .orderBy("id_estudiante")
      .orderBy(sql`CASE WHEN estado IN ('ACTIVA', 'APROBADA') THEN 1 WHEN estado = 'CULMINADA' THEN 2 ELSE 3 END`, "asc")
      .orderBy("id_anio", "desc")
      .orderBy("id_matricula", "desc")
      .as("m");

    let childrenQuery = db
      .selectFrom("detalle_padrefamilia as dpf")
      .innerJoin("estudiante as e", "dpf.id_estudiante", "e.id_estudiante")
      .leftJoin("usuario as u_e", "e.id_usuario", "u_e.id_usuario")
      .leftJoin(activeMatSub, "m.id_estudiante", "e.id_estudiante")
      .leftJoin("grupos as g", "g.id_grupo", "m.id_grupo")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .leftJoin("secciones as sec", "sec.id_seccion", "g.id_seccion")
      .leftJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .leftJoin("nivel_escolar as n", (join) =>
        join.onRef("n.id_nivel", "=", sql<number>`COALESCE(m.id_nivel, g.id_nivel, tg.id_nivel)`)
      )
      .leftJoin("anio_lectivo as al", "al.id_anio", "m.id_anio")
      .select([
        "e.id_estudiante",
        "e.nombre",
        "e.apellido",
        "u_e.documento",
        "e.codigo",
        "e.estado",
        "e.motivo_estado",
        "tg.nombre as grado_nombre",
        "sec.nombre as seccion_nombre",
        "n.nombre as nivel_nombre",
        "j.nombre as jornada_nombre",
        "m.estado as matricula_estado",
        "m.id_grupo",
        "m.id_anio",
        "al.calendario as anio_lectivo",
        "dpf.id_colegio as dpf_colegio",
        "e.id_colegio as e_colegio"
      ])
      .where("dpf.id_padrefamilia", "=", parentId);

    // Aislamiento: El colegio actual solo ve los estudiantes adscritos a su propia institución
    if (targetSchoolId && !isSupervision) {
      childrenQuery = childrenQuery.where((eb) =>
        eb.or([
          eb("dpf.id_colegio", "=", targetSchoolId),
          eb("e.id_colegio", "=", targetSchoolId),
          eb("m.id_colegio", "=", targetSchoolId)
        ])
      );
    }

    const children = await childrenQuery
      .orderBy("e.apellido", "asc")
      .orderBy("e.nombre", "asc")
      .execute();

    const childrenWithStats = await Promise.all(
      children.map(async (child: any) => {
        let promedio = null;
        let inasistencias = 0;
        let sanciones_activas = 0;

        if (child.id_anio) {
          const avgRes = await db
            .selectFrom("resultado_academico as ra")
            .innerJoin("periodo_academico as pa", "pa.id_periodo", "ra.id_periodo")
            .select(sql<number>`ROUND(AVG(ra.promedio)::numeric, 2)`.as("promedio"))
            .where("ra.id_estudiante", "=", child.id_estudiante)
            .where("pa.id_anio", "=", child.id_anio)
            .where("pa.estado", "!=", "PENDIENTE")
            .executeTakeFirst();

          promedio = avgRes?.promedio ?? null;

          const attRes = await db
            .selectFrom("registro_asistencia as ra")
            .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "ra.id_detallegrado")
            .select(sql<number>`COUNT(*)::int`.as("count"))
            .where("ra.id_estudiante", "=", child.id_estudiante)
            .where("ra.estado", "=", "AUSENTE")
            .where("dg.id_anio", "=", child.id_anio)
            .executeTakeFirst();

          inasistencias = attRes?.count ?? 0;
        }

        const sanctionRes = await db
          .selectFrom("sancion as sa")
          .select(sql<number>`COUNT(*)::int`.as("count"))
          .where("sa.id_estudiante", "=", child.id_estudiante)
          .where("sa.estado", "=", "ACTIVA")
          .executeTakeFirst();

        sanciones_activas = sanctionRes?.count ?? 0;

        return {
          ...child,
          promedio: promedio !== null ? parseFloat(String(promedio)) : null,
          inasistencias,
          sanciones_activas
        };
      })
    );

    const tiposDocRes = await db
      .selectFrom("tipo_documento")
      .select(["id_tipodocumento", "tipo"])
      .orderBy("id_tipodocumento", "asc")
      .execute();

    res.json({
      parent,
      children: childrenWithStats,
      tipos_documento: tiposDocRes
    });
  } catch (error: any) {
    console.error("Error en getParentDetail:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

/**
 * Actualiza los datos basicos de un padre de familia
 */
export const updateParent = async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const parentId = parseInt(id as string);

    if (isNaN(parentId)) {
      res.status(400).json({ error: "ID de padre de familia invalido" });
      return;
    }

    const { nombre, apellido, documento, id_tipodocumento, email } = req.body;

    await client.query("BEGIN");

    const checkRes = await client.query(
      `SELECT pf.id_padrefamilia, pf.id_colegio, pf.nombre, pf.apellido, pf.id_usuario, u.documento, u.id_tipodocumento, u.email 
       FROM padre_familia pf 
       LEFT JOIN usuario u ON pf.id_usuario = u.id_usuario 
       WHERE pf.id_padrefamilia = $1`,
      [parentId]
    );

    if (checkRes.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Padre de familia no encontrado" });
      return;
    }

    const oldParent = checkRes.rows[0];

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId) {
      const allowed = await hasParentSchoolAccess(authReq.user.schoolId, parentId, oldParent.id_usuario, oldParent.id_colegio);
      if (!allowed) {
        await client.query("ROLLBACK");
        res.status(403).json({ error: "No tiene permiso para actualizar acudientes de este colegio." });
        return;
      }
    }

    const finalNombre = isSupervision && nombre?.trim() ? nombre.trim() : oldParent.nombre;
    const finalApellido = isSupervision && apellido?.trim() ? apellido.trim() : oldParent.apellido;
    const finalDocumento = isSupervision && documento?.trim() ? documento.trim() : oldParent.documento;
    const finalTipoDoc = isSupervision && id_tipodocumento ? id_tipodocumento : oldParent.id_tipodocumento;
    const finalEmail = email?.trim() ? email.trim().toLowerCase() : oldParent.email;

    if (isSupervision && finalDocumento && finalDocumento !== oldParent.documento) {
      await validateDocumentUniqueness(client, finalDocumento, "acudiente", { excludeUsuarioId: oldParent.id_usuario }, finalTipoDoc);
    }

    const result = await client.query(
      `UPDATE padre_familia
       SET nombre = $1, apellido = $2
       WHERE id_padrefamilia = $3
       RETURNING *`,
      [finalNombre, finalApellido, parentId]
    );

    if (oldParent.id_usuario) {
      await client.query(
        `UPDATE usuario 
         SET nombre = $1, apellido = $2, documento = $3, id_tipodocumento = $4, email = $5 
         WHERE id_usuario = $6`,
        [finalNombre, finalApellido, finalDocumento, finalTipoDoc, finalEmail, oldParent.id_usuario]
      );
    }

    const activeAuditoriaId = (req as any).user?.supervisionId;
    if (activeAuditoriaId) {
      (req as any).auditLogged = true;
      await client.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, id_usuario_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'PADRES_FAMILIA', 'MODIFICACION', 'Actualizacion de datos del padre de familia', $2, NULL, $3, $4, $5)`,
        [
          activeAuditoriaId,
          `Padre ID: ${parentId} (${nombre} ${apellido})`,
          JSON.stringify({ nombre: oldParent.nombre, apellido: oldParent.apellido, documento: oldParent.documento }),
          JSON.stringify({ nombre: nombre.trim(), apellido: apellido.trim(), documento: documento.trim() }),
          "Actualizacion de datos del acudiente"
        ]
      );
    }

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error en updateParent:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  } finally {
    client.release();
  }
};

/**
 * Obtiene la lista de tipos de documento disponibles
 */
export const getDocumentTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      "SELECT id_tipodocumento, tipo FROM tipo_documento ORDER BY id_tipodocumento ASC"
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error en getDocumentTypes:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

/**
 * Activa o inactiva la cuenta de usuario de un padre de familia
 * PATCH /api/parents/:id/status
 * Body: { activo: boolean }
 */
export const updateParentAccountStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const parentId = parseInt(id as string);
  const { activo } = req.body;

  if (isNaN(parentId) || typeof activo !== "boolean") {
    res.status(400).json({ error: "Parámetros inválidos para la actualización del estado de la cuenta" });
    return;
  }

  try {
    const parentRes = await pool.query(
      `SELECT pf.id_padrefamilia, pf.id_usuario, pf.id_colegio, pf.nombre, pf.apellido, u.email
       FROM padre_familia pf
       JOIN usuario u ON u.id_usuario = pf.id_usuario
       WHERE pf.id_padrefamilia = $1`,
      [parentId]
    );

    if (parentRes.rows.length === 0 || !parentRes.rows[0].id_usuario) {
      res.status(404).json({ error: "El acudiente no tiene una cuenta de usuario registrada para modificar su estado" });
      return;
    }

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId) {
      const allowed = await hasParentSchoolAccess(authReq.user.schoolId, parentId, parentRes.rows[0].id_usuario, parentRes.rows[0].id_colegio);
      if (!allowed) {
        res.status(403).json({ error: "No tiene permiso para modificar acudientes de este colegio." });
        return;
      }
    }

    const userId = parentRes.rows[0].id_usuario;

    await pool.query(
      `UPDATE usuario 
       SET activo = $1, 
           estado = CASE WHEN $1 = TRUE THEN 'ACTIVO'::public.estado_usuario ELSE 'SUSPENDIDO'::public.estado_usuario END,
           logged_out_at = CASE WHEN $1 = FALSE THEN NOW() ELSE logged_out_at END
       WHERE id_usuario = $2`,
      [activo, userId]
    );

    await pool.query(
      `UPDATE padre_familia
       SET estado = CASE WHEN $1 = TRUE THEN 'ACTIVO' ELSE 'INACTIVO' END
       WHERE id_padrefamilia = $2`,
      [activo, parentId]
    );

    res.json({
      message: `La cuenta de usuario de ${parentRes.rows[0].nombre} ${parentRes.rows[0].apellido} ha sido ${activo ? "activada" : "inactivada"} exitosamente.`,
      activo
    });
  } catch (error: any) {
    console.error("Error en updateParentAccountStatus:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};
