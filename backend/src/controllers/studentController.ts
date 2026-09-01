import { Request, Response } from "express";
import { pool } from "../config/db";
import { db } from "../config/kysely";
import { sql } from "kysely";
import { NotificationService } from "../services/notificationService";
import { validateDocumentUniqueness } from "../utils/documentValidation";
import { formatFriendlyErrorMessage } from "../utils/errorHelper";
import { generateDocumentAccessToken } from "../middleware/documentSecurity";

export const getAllStudents = async (req: Request, res: Response) => {
  try {
    const { idColegio } = req.params;
    const { estado, id_nivel, id_tipo_grado, id_jornada, grado, busqueda, yearId } = req.query;

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== Number(idColegio)) {
      res.status(403).json({ error: "No tiene permiso para acceder a la lista de estudiantes de este colegio." });
      return;
    }

    const schoolIdNum = Number(idColegio);
    const yearIdNum = yearId ? Number(yearId) : null;

    let query = db
      .selectFrom("estudiante as e")
      .leftJoin("usuario as u", "e.id_usuario", "u.id_usuario")
      .leftJoin("tipo_documento as td", "u.id_tipodocumento", "td.id_tipodocumento")
      .leftJoin("matricula as m", (join) => {
        let j = join
          .onRef("e.id_estudiante", "=", "m.id_estudiante")
          .on("m.id_colegio", "=", schoolIdNum)
          .on("m.estado", "in", ["ACTIVA", "APROBADA", "CULMINADA", "TRASLADADA"]);
        if (yearIdNum) {
          j = j.on("m.id_anio", "=", yearIdNum);
        }
        return j;
      })
      .leftJoin("grupos as g", "m.id_grupo", "g.id_grupo")
      .leftJoin("nivel_escolar as n", (join) =>
        join.onRef("n.id_nivel", "=", sql<number>`COALESCE(m.id_nivel, g.id_nivel)`)
      )
      .leftJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
      .leftJoin("secciones as s", "g.id_seccion", "s.id_seccion")
      .leftJoin("jornada as j", "g.id_jornada", "j.id_jornada")
      .leftJoin(
        db
          .selectFrom("detalle_padrefamilia")
          .distinctOn("id_estudiante")
          .select(["id_estudiante", "id_padrefamilia"])
          .as("dp"),
        "e.id_estudiante",
        "dp.id_estudiante"
      )
      .leftJoin("padre_familia as pf", "dp.id_padrefamilia", "pf.id_padrefamilia")
      .leftJoin("usuario as u_pf", "pf.id_usuario", "u_pf.id_usuario")
      .select([
        "e.id_estudiante",
        "e.nombre",
        "e.apellido",
        "e.codigo",
        "e.id_colegio",
        "e.id_usuario",
        "e.estado",
        "e.motivo_estado",
        "u.email",
        "u.documento as documento",
        "u.documento as numero_documento",
        "u.id_tipodocumento as id_tipodocumento",
        "td.tipo as tipo_documento_nombre",
        "n.nombre as nivel_nombre",
        "m.id_grupo",
        "m.id_matricula as matricula_id",
        "m.estado as matricula_estado",
        "tg.nombre as grado_nombre",
        "s.nombre as seccion_nombre",
        "j.nombre as jornada_nombre",
        sql<string>`CASE 
          WHEN tg.nombre IS NOT NULL AND s.nombre IS NOT NULL THEN CONCAT(tg.nombre, ' ', s.nombre)
          WHEN tg.nombre IS NOT NULL THEN tg.nombre
          ELSE NULL 
        END`.as("grado_seccion"),
        "pf.nombre as acudiente_nombre",
        "pf.apellido as acudiente_apellido",
        sql<string>`TRIM(CONCAT(COALESCE(pf.nombre, ''), ' ', COALESCE(pf.apellido, '')))`.as("nombre_acudiente"),
        "u_pf.documento as acudiente_documento",
        sql<string>`COALESCE(u_pf.email, m.correo_padre)`.as("acudiente_email"),
        sql<string>`COALESCE(u_pf.email, m.correo_padre)`.as("correo_acudiente"),
        "u_pf.telefono as acudiente_telefono",
        "u_pf.telefono as telefono_acudiente",
        sql<string>`${
          yearIdNum
            ? sql`CASE
                WHEN m.id_matricula IS NOT NULL AND m.estado = 'TRASLADADA' THEN 'TRASLADADO'
                WHEN m.id_matricula IS NOT NULL AND e.estado::text NOT IN ('EXPULSADO','RETIRADO','GRADUADO') THEN e.estado::text
                WHEN e.estado::text IN ('EXPULSADO','RETIRADO','GRADUADO','SANCIONADO') THEN e.estado::text
                ELSE 'INACTIVO'
              END`
            : sql`CASE
                WHEN m.id_matricula IS NOT NULL AND m.estado = 'TRASLADADA' THEN 'TRASLADADO'
                ELSE e.estado::text
              END`
        }`.as("estado_vigente")
      ])
      .where((eb) =>
        eb.or([
          eb("e.id_colegio", "=", schoolIdNum),
          eb.exists(
            eb
              .selectFrom("matricula as m_hist")
              .select("m_hist.id_matricula")
              .whereRef("m_hist.id_estudiante", "=", "e.id_estudiante")
              .where("m_hist.id_colegio", "=", schoolIdNum)
          )
        ])
      );

    if (yearIdNum) {
      query = query.where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("anio_lectivo as al")
              .select("al.id_anio")
              .where("al.id_anio", "=", yearIdNum)
              .where((subEb) =>
                subEb.or([
                  sql<boolean>`EXTRACT(YEAR FROM u.fecha_creacion) > NULLIF(regexp_replace(al.calendario, '\\D', '', 'g'), '')::int`,
                  sql<boolean>`(al.fecha_fin IS NOT NULL AND DATE(u.fecha_creacion) > al.fecha_fin)`
                ])
              )
          )
        )
      );
    }

    if (estado && estado !== "TODOS") {
      if (estado === "INACTIVO") {
        if (yearIdNum) {
          query = query
            .where("m.id_matricula", "is", null)
            .where("e.estado", "not in", ["EXPULSADO", "RETIRADO", "GRADUADO", "SANCIONADO"]);
        } else {
          query = query.where(sql<boolean>`1 = 0`);
        }
      } else if (estado === "ACTIVO" && yearIdNum) {
        query = query
          .where("e.estado", "=", "ACTIVO")
          .where("m.id_matricula", "is not", null)
          .where("m.estado", "in", ["ACTIVA", "APROBADA"]);
      } else if (estado === "TRASLADADO") {
        query = query
          .where("m.id_matricula", "is not", null)
          .where("m.estado", "=", "TRASLADADA");
      } else {
        query = query.where("e.estado", "=", estado as any);
      }
    }

    const levelId = id_nivel || grado;
    if (levelId) {
      query = query.where(sql<number>`COALESCE(m.id_nivel, g.id_nivel)`, "=", Number(levelId));
    }

    if (id_tipo_grado) {
      query = query.where("g.id_tipo_grado", "=", Number(id_tipo_grado));
    }

    if (id_jornada) {
      query = query.where("g.id_jornada", "=", Number(id_jornada));
    }

    if (busqueda) {
      const term = `%${String(busqueda)}%`;
      query = query.where((eb) =>
        eb.or([
          eb("e.nombre", "ilike", term),
          eb("e.apellido", "ilike", term),
          eb("u.documento", "ilike", term),
          eb("e.codigo", "ilike", term),
          eb("tg.nombre", "ilike", term),
          eb("s.nombre", "ilike", term),
          sql<boolean>`j.nombre::text ILIKE ${term}`,
          sql<boolean>`(tg.nombre || '-' || s.nombre) ILIKE ${term}`,
          sql<boolean>`(tg.nombre || ' ' || s.nombre) ILIKE ${term}`
        ])
      );
    }

    query = query.orderBy("e.apellido", "asc").orderBy("e.nombre", "asc");

    const rows = await query.execute();
    res.json(rows);
  } catch (error: any) {
    console.error("Error al obtener estudiantes:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

const checkClosedYearForStudent = async (trxOrDb: any, studentId: number) => {
  const checkRes = await trxOrDb
    .selectFrom("matricula as m")
    .innerJoin("anio_lectivo as al", "m.id_anio", "al.id_anio")
    .select(["al.estado", "al.calendario"])
    .where("m.id_estudiante", "=", studentId)
    .where("m.estado", "in", ["ACTIVA", "APROBADA"])
    .orderBy("m.id_matricula", "desc")
    .limit(1)
    .executeTakeFirst();

  if (checkRes && checkRes.estado === "CERRADO") {
    return checkRes.calendario;
  }
  return null;
};

export const updateStudent = async (req: Request, res: Response) => {
  const authReq = req as any;
  const userRoles = authReq.user?.roles || [];
  const userRole = authReq.user?.role;
  const isDirectivo = userRoles.includes("directivo") || userRole === "directivo";
  const isAdminGeneral = userRoles.includes("admin_general") || userRole === "admin_general";

  if (isDirectivo && !isAdminGeneral) {
    return res.status(403).json({ 
      error: "Los directivos no tienen autorización para modificar los datos personales básicos de los estudiantes por integridad del sistema." 
    });
  }

  try {
    const { id } = req.params;
    const { nombre, apellido, documento, id_tipodocumento, codigo, motivo_cambio } = req.body;
    const numId = Number(id);

    const updatedStudent = await db.transaction().execute(async (trx) => {
      const closedYearLabel = await checkClosedYearForStudent(trx, numId);
      if (closedYearLabel) {
        throw new Error(`AÑO_CERRADO:${closedYearLabel}`);
      }

      // Fetch old student state
      const oldStudent = await trx
        .selectFrom("estudiante as e")
        .leftJoin("usuario as u", "e.id_usuario", "u.id_usuario")
        .select([
          "e.nombre",
          "e.apellido",
          "u.documento",
          "u.id_tipodocumento",
          "e.codigo",
          "e.id_usuario"
        ])
        .where("e.id_estudiante", "=", numId)
        .executeTakeFirst();

      if (!oldStudent) {
        throw new Error("NOT_FOUND:Estudiante no encontrado");
      }

      if (documento) {
        await validateDocumentUniqueness(pool, documento, "estudiante", { excludeUsuarioId: oldStudent.id_usuario }, id_tipodocumento);
      }

      const result = await trx
        .updateTable("estudiante")
        .set({ nombre, apellido, codigo })
        .where("id_estudiante", "=", numId)
        .returningAll()
        .executeTakeFirstOrThrow();

      if (oldStudent.id_usuario) {
        await trx
          .updateTable("usuario")
          .set({
            nombre,
            apellido,
            documento,
            id_tipodocumento: id_tipodocumento ? Number(id_tipodocumento) : null
          })
          .where("id_usuario", "=", Number(oldStudent.id_usuario))
          .execute();
      }

      // Audit logging
      const activeAuditoriaId = (req as any).user?.supervisionId;
      if (activeAuditoriaId) {
        (req as any).auditLogged = true;
        await trx
          .insertInto("auditoria_acciones_realizadas")
          .values({
            id_auditoria: Number(activeAuditoriaId),
            modulo: "ESTUDIANTES",
            tipo_accion: "MODIFICACION",
            accion: "Modificación de datos básicos del estudiante",
            recurso_afectado: `Estudiante ID: ${id} (${nombre} ${apellido})`,
            id_usuario_afectado: oldStudent.id_usuario ? Number(oldStudent.id_usuario) : null,
            valor_antiguo: JSON.stringify({
              nombre: oldStudent.nombre,
              apellido: oldStudent.apellido,
              documento: oldStudent.documento,
              id_tipodocumento: oldStudent.id_tipodocumento,
              codigo: oldStudent.codigo
            }),
            valor_nuevo: JSON.stringify({ nombre, apellido, documento, id_tipodocumento, codigo }),
            motivo_cambio: motivo_cambio || "Modificación de datos básicos del estudiante"
          })
          .execute();
      }

      return result;
    });

    res.json(updatedStudent);
  } catch (error: any) {
    if (error.message?.startsWith("AÑO_CERRADO:")) {
      const yearLabel = error.message.split(":")[1];
      return res.status(403).json({ 
        error: `El año lectivo ${yearLabel} se encuentra CERRADO. Los datos son de solo lectura y no se permiten modificaciones.` 
      });
    }
    if (error.message?.startsWith("NOT_FOUND:")) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

export const updateStudentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // id_estudiante
    const { estado, motivo, id_tipo_sancion, fecha_inicio, fecha_fin, observaciones, motivo_cambio } = req.body;
    const numId = Number(id);

    if (!estado) {
      return res.status(400).json({ error: "El estado es obligatorio" });
    }

    const currentUserId = (req as any).user?.id;
    if (!currentUserId) {
      return res.status(401).json({ error: "No autorizado" });
    }

    if (estado === "SANCIONADO") {
      if (!id_tipo_sancion) {
        return res.status(400).json({ error: "El tipo de sanción es obligatorio" });
      }
      if (!fecha_inicio || !fecha_fin) {
        return res.status(400).json({ error: "Las fechas de inicio y fin son obligatorias" });
      }
      if (new Date(fecha_fin) < new Date(fecha_inicio)) {
        return res.status(400).json({ error: "La fecha de fin no puede ser anterior a la de inicio" });
      }
      if (!motivo || motivo.trim().length < 10) {
        return res.status(400).json({ error: "El motivo es requerido y debe tener al menos 10 caracteres" });
      }
    } else if (estado === "EXPULSADO") {
      if (!motivo || motivo.trim().length < 10) {
        return res.status(400).json({ error: "El motivo de la expulsión es obligatorio y debe tener al menos 10 caracteres" });
      }
    } else if (estado === "RETIRADO") {
      if (!motivo || !motivo.trim()) {
        return res.status(400).json({ error: "El motivo del retiro es obligatorio." });
      }
    }

    const updated = await db.transaction().execute(async (trx) => {
      const closedYearLabel = await checkClosedYearForStudent(trx, numId);
      if (closedYearLabel) {
        throw new Error(`AÑO_CERRADO:${closedYearLabel}`);
      }

      // Fetch old student state
      const oldStudent = await trx
        .selectFrom("estudiante")
        .select(["estado", "motivo_estado", "id_usuario"])
        .where("id_estudiante", "=", numId)
        .executeTakeFirst();

      if (!oldStudent) {
        throw new Error("NOT_FOUND:Estudiante no encontrado");
      }

      const directivo = await trx
        .selectFrom("directivo")
        .select("id")
        .where("id_usuario", "=", Number(currentUserId))
        .executeTakeFirst();

      if (!directivo) {
        throw new Error("FORBIDDEN:El usuario actual no está registrado como directivo");
      }

      const id_directivo = directivo.id;

      if (estado === "SANCIONADO") {
        await trx
          .insertInto("sancion")
          .values({
            id_estudiante: numId,
            id_tipo_sancion: Number(id_tipo_sancion),
            motivo: motivo.trim(),
            fecha_inicio: new Date(fecha_inicio),
            fecha_fin: new Date(fecha_fin),
            estado: "ACTIVA",
            observaciones: observaciones ? observaciones.trim() : null,
            id_directivo: Number(id_directivo)
          })
          .execute();
      } else if (estado === "EXPULSADO") {
        // Revoke existing active sanctions
        await trx
          .updateTable("sancion")
          .set({
            estado: "REVOCADA",
            observaciones: sql<string>`COALESCE(observaciones, '') || '\nSanción revocada por expulsión del estudiante.'`
          })
          .where("id_estudiante", "=", numId)
          .where("estado", "=", "ACTIVA")
          .execute();

        const typeRow = await trx
          .selectFrom("tipo_sancion")
          .select("id_tipo_sancion")
          .where("nombre", "=", "EXPULSION")
          .limit(1)
          .executeTakeFirst();

        if (!typeRow) {
          throw new Error("INTERNAL:No se encontró el tipo de sanción EXPULSION en el sistema.");
        }

        await trx
          .insertInto("sancion")
          .values({
            id_estudiante: numId,
            id_tipo_sancion: typeRow.id_tipo_sancion,
            motivo: motivo.trim(),
            fecha_inicio: new Date(),
            fecha_fin: new Date("9999-12-31"),
            estado: "ACTIVA",
            observaciones: null,
            id_directivo: Number(id_directivo)
          })
          .execute();
      } else {
        // Revoke any active sanctions
        await trx
          .updateTable("sancion")
          .set({
            estado: "REVOCADA",
            observaciones: sql<string>`COALESCE(observaciones, '') || '\nSanción revocada por cambio de estado del estudiante.'`
          })
          .where("id_estudiante", "=", numId)
          .where("estado", "=", "ACTIVA")
          .execute();
      }

      if (estado === "RETIRADO") {
        await trx
          .updateTable("matricula")
          .set({
            estado: "CANCELADA",
            motivo_cancelacion: "Retiro de Estudiante",
            detalles_cancelacion: motivo.trim()
          })
          .where("id_estudiante", "=", numId)
          .where("estado", "in", ["ACTIVA", "PENDIENTE"])
          .execute();
      }

      const motivoValue = (estado === "SANCIONADO" || estado === "EXPULSADO" || estado === "RETIRADO") ? motivo.trim() : null;

      const result = await trx
        .updateTable("estudiante")
        .set({
          estado: estado as any,
          motivo_estado: motivoValue
        })
        .where("id_estudiante", "=", numId)
        .returningAll()
        .executeTakeFirstOrThrow();

      // Inactivar/activar usuario según estado
      if ((estado === "RETIRADO" || estado === "EXPULSADO") && oldStudent.id_usuario) {
        await trx
          .updateTable("usuario")
          .set({
            activo: false
          })
          .where("id_usuario", "=", Number(oldStudent.id_usuario))
          .execute();
      } else if (estado === "ACTIVO" && oldStudent.id_usuario) {
        await trx
          .updateTable("usuario")
          .set({
            activo: true
          })
          .where("id_usuario", "=", Number(oldStudent.id_usuario))
          .execute();
      }

      // Si el estudiante pasa a estado ACTIVO, resolver tickets de reingreso
      if (estado === "ACTIVO") {
        const studentTicketIds = await trx
          .selectFrom("matricula")
          .select("id_ticket")
          .where("id_estudiante", "=", numId)
          .where("id_ticket", "is not", null)
          .execute();

        const ticketIds = studentTicketIds.map(t => t.id_ticket).filter(Boolean) as number[];
        if (ticketIds.length > 0) {
          await trx
            .updateTable("tickets_soporte")
            .set({ estado: "RESUELTO" })
            .where("id_ticket", "in", ticketIds)
            .where("estado", "=", "EN_PROCESO")
            .execute();
        }
      }

      // Audit logging
      const activeAuditoriaId = (req as any).user?.supervisionId;
      if (activeAuditoriaId) {
        (req as any).auditLogged = true;
        await trx
          .insertInto("auditoria_acciones_realizadas")
          .values({
            id_auditoria: Number(activeAuditoriaId),
            modulo: "ESTUDIANTES",
            tipo_accion: "MODIFICACION",
            accion: "Cambio de estado del estudiante",
            recurso_afectado: `Estudiante ID: ${id}`,
            id_usuario_afectado: oldStudent.id_usuario ? Number(oldStudent.id_usuario) : null,
            valor_antiguo: JSON.stringify({ estado: oldStudent.estado, motivo_estado: oldStudent.motivo_estado }),
            valor_nuevo: JSON.stringify({ estado, motivo_estado: motivoValue }),
            motivo_cambio: motivo_cambio || motivo || "Cambio de estado del estudiante"
          })
          .execute();
      }

      return result;
    });

    res.json(updated);
  } catch (error: any) {
    if (error.message?.startsWith("AÑO_CERRADO:")) {
      const yearLabel = error.message.split(":")[1];
      return res.status(403).json({ 
        error: `El año lectivo ${yearLabel} se encuentra CERRADO. Los datos son de solo lectura y no se permiten modificaciones.` 
      });
    }
    if (error.message?.startsWith("NOT_FOUND:")) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }
    if (error.message?.startsWith("FORBIDDEN:")) {
      return res.status(403).json({ error: error.message.split(":")[1] });
    }
    if (error.message?.startsWith("INTERNAL:")) {
      return res.status(500).json({ error: error.message.split(":")[1] });
    }
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

export const getTipoSanciones = async (req: Request, res: Response) => {
  try {
    const result = await db
      .selectFrom("tipo_sancion")
      .selectAll()
      .orderBy("id_tipo_sancion", "asc")
      .execute();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

export const changeStudentGrade = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { id_grupo, id_nivel, motivo, motivo_cambio } = req.body;
    const numId = Number(id);

    if (!motivo) {
      return res.status(400).json({ error: "El motivo del traslado es obligatorio" });
    }

    const { emailInfo, newGradeName } = await db.transaction().execute(async (trx) => {
      // 0. Obtener información necesaria para el correo ANTES del cambio
      const infoRes = await trx
        .selectFrom("estudiante as e")
        .innerJoin("colegio as c", "e.id_colegio", "c.id_colegio")
        .innerJoin("detalle_padrefamilia as dp", "e.id_estudiante", "dp.id_estudiante")
        .innerJoin("padre_familia as pf", "dp.id_padrefamilia", "pf.id_padrefamilia")
        .innerJoin("usuario as u_padre", "pf.id_usuario", "u_padre.id_usuario")
        .leftJoin("matricula as m", (join) =>
          join
            .onRef("e.id_estudiante", "=", "m.id_estudiante")
            .onRef("m.id_colegio", "=", "e.id_colegio")
            .on("m.estado", "in", ["ACTIVA", "APROBADA"])
        )
        .leftJoin("grupos as g_old", "m.id_grupo", "g_old.id_grupo")
        .leftJoin("tipo_grado as tg_old", "g_old.id_tipo_grado", "tg_old.id_tipo_grado")
        .leftJoin("secciones as s_old", "g_old.id_seccion", "s_old.id_seccion")
        .select([
          "e.nombre as student_name",
          "e.apellido as student_lastname",
          "c.nombre as school_name",
          "u_padre.nombre as parent_name",
          "u_padre.email as parent_email",
          "tg_old.nombre as old_grade_name",
          "s_old.nombre as old_section_name"
        ])
        .where("e.id_estudiante", "=", numId)
        .limit(1)
        .executeTakeFirst();

      if (!infoRes) {
        throw new Error("NOT_FOUND:No se pudo encontrar la información del estudiante o su acudiente");
      }

      // Obtener nombre del NUEVO grado
      const newGrade = await trx
        .selectFrom("grupos as g")
        .innerJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
        .innerJoin("secciones as s", "g.id_seccion", "s.id_seccion")
        .select(["tg.nombre", "s.nombre as seccion"])
        .where("g.id_grupo", "=", Number(id_grupo))
        .executeTakeFirst();

      const newGradeFullName = newGrade ? `${newGrade.nombre} - ${newGrade.seccion}` : "Nuevo Grado";

      // Fetch old grading level and group
      const oldGrading = await trx
        .selectFrom("estudiante as e")
        .leftJoin("matricula as m", (join) =>
          join
            .onRef("e.id_estudiante", "=", "m.id_estudiante")
            .onRef("m.id_colegio", "=", "e.id_colegio")
            .on("m.estado", "in", ["ACTIVA", "APROBADA"])
        )
        .select([
          "m.id_nivel",
          "m.id_grupo",
          "e.id_usuario"
        ])
        .where("e.id_estudiante", "=", numId)
        .executeTakeFirst();

      // 1. Actualizar la matrícula activa
      await trx
        .updateTable("matricula")
        .set({
          id_grupo: Number(id_grupo),
          id_nivel: Number(id_nivel)
        })
        .where("id_estudiante", "=", numId)
        .where("estado", "in", ["ACTIVA", "APROBADA"])
        .execute();

      // Audit logging
      const activeAuditoriaId = (req as any).user?.supervisionId;
      if (activeAuditoriaId && oldGrading) {
        (req as any).auditLogged = true;
        await trx
          .insertInto("auditoria_acciones_realizadas")
          .values({
            id_auditoria: Number(activeAuditoriaId),
            modulo: "ESTUDIANTES",
            tipo_accion: "MODIFICACION",
            accion: "Traslado de grado del estudiante",
            recurso_afectado: `Estudiante ID: ${id} (${infoRes.student_name} ${infoRes.student_lastname})`,
            id_usuario_afectado: oldGrading.id_usuario ? Number(oldGrading.id_usuario) : null,
            valor_antiguo: JSON.stringify({ id_nivel: oldGrading.id_nivel, id_grupo: oldGrading.id_grupo }),
            valor_nuevo: JSON.stringify({ id_nivel, id_grupo }),
            motivo_cambio: motivo_cambio || motivo || "Traslado de grado del estudiante"
          })
          .execute();
      }

      return { emailInfo: infoRes, newGradeName: newGradeFullName };
    });

    // Enviar notificación por correo fuera de la transacción
    if (emailInfo.parent_email) {
      NotificationService.sendStudentTransferEmail(
        emailInfo.parent_email,
        emailInfo.parent_name,
        `${emailInfo.student_name} ${emailInfo.student_lastname}`,
        `${emailInfo.old_grade_name || "N/A"} - ${emailInfo.old_section_name || "N/A"}`,
        newGradeName,
        motivo,
        emailInfo.school_name
      ).catch((err: any) => console.error("Error enviando email tras compromiso:", err));
    }

    res.json({ message: "Cambio de grado realizado y notificación enviada" });
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND:")) {
      return res.status(404).json({ error: error.message.split(":")[1] });
    }
    console.error("Error en changeStudentGrade:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo_cambio } = req.body;
    const numId = Number(id);

    await db.transaction().execute(async (trx) => {
      // Fetch student info
      const student = await trx
        .selectFrom("estudiante as e")
        .leftJoin("usuario as u", "e.id_usuario", "u.id_usuario")
        .select(["e.id_usuario", "e.nombre", "e.apellido", "u.documento", "e.codigo", "e.id_colegio"])
        .where("e.id_estudiante", "=", numId)
        .executeTakeFirst();

      if (!student) {
        throw new Error("NOT_FOUND:Estudiante no encontrado");
      }

      await trx
        .deleteFrom("estudiante")
        .where("id_estudiante", "=", numId)
        .execute();

      // Audit deletion
      const activeAuditoriaId = (req as any).user?.supervisionId;
      if (activeAuditoriaId) {
        (req as any).auditLogged = true;
        await trx
          .insertInto("auditoria_acciones_realizadas")
          .values({
            id_auditoria: Number(activeAuditoriaId),
            modulo: "ESTUDIANTES",
            tipo_accion: "ELIMINACION",
            accion: "Eliminación física de estudiante",
            recurso_afectado: `Estudiante ID: ${id} (${student.nombre} ${student.apellido})`,
            id_usuario_afectado: student.id_usuario ? Number(student.id_usuario) : null,
            valor_antiguo: JSON.stringify(student),
            valor_nuevo: null,
            motivo_cambio: motivo_cambio || "Eliminación física del estudiante"
          })
          .execute();
      }
    });

    res.json({ message: "Estudiante eliminado exitosamente" });
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND:")) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }
    if (error.code === "23503") {
      res.status(400).json({ 
        error: "No se puede eliminar el estudiante porque tiene registros académicos asociados. Use 'Retirar' o 'Expulsar' en su lugar." 
      });
    } else {
      res.status(500).json({ error: formatFriendlyErrorMessage(error) });
    }
  }
};

export const getStudentSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const numId = Number(id);

    // 1. Basic Student and Group Info
    const student = await db
      .selectFrom("estudiante as e")
      .leftJoin("usuario as u", "e.id_usuario", "u.id_usuario")
      .leftJoin("matricula as m", (join) =>
        join
          .onRef("e.id_estudiante", "=", "m.id_estudiante")
          .onRef("m.id_colegio", "=", "e.id_colegio")
          .on("m.estado", "in", ["ACTIVA", "APROBADA", "CULMINADA"])
      )
      .leftJoin("grupos as g", "m.id_grupo", "g.id_grupo")
      .leftJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
      .leftJoin("secciones as s", "g.id_seccion", "s.id_seccion")
      .leftJoin("nivel_escolar as n", (join) =>
        join.onRef("n.id_nivel", "=", sql<number>`COALESCE(m.id_nivel, g.id_nivel)`)
      )
      .select([
        "e.id_estudiante",
        "e.nombre",
        "e.apellido",
        "u.documento",
        "u.id_tipodocumento",
        "e.codigo",
        "e.estado",
        "e.id_usuario",
        "e.id_colegio",
        "e.motivo_estado",
        "tg.nombre as grado_nombre",
        "s.nombre as seccion_nombre",
        "n.nombre as nivel_nombre",
        "m.id_grupo",
        "u.email as student_email",
        "u.fecha_creacion as user_created_at"
      ])
      .where("e.id_estudiante", "=", numId)
      .executeTakeFirst();

    if (!student) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    const { id_colegio, id_grupo } = student;

    // 2. Parent Contact Details
    const parent = await db
      .selectFrom("detalle_padrefamilia as dpf")
      .innerJoin("padre_familia as pf", "dpf.id_padrefamilia", "pf.id_padrefamilia")
      .leftJoin("usuario as u", "pf.id_usuario", "u.id_usuario")
      .select(["pf.nombre", "pf.apellido", "u.email"])
      .where("dpf.id_estudiante", "=", numId)
      .limit(1)
      .executeTakeFirst();

    // 3. Find active period (state = 'ABIERTO') or fallback to latest period
    let periodRes = await db
      .selectFrom("periodo_academico")
      .select(["id_periodo", "nombre"])
      .where("id_colegio", "=", Number(id_colegio))
      .where("estado", "=", "ABIERTO")
      .limit(1)
      .executeTakeFirst();

    if (!periodRes) {
      periodRes = await db
        .selectFrom("periodo_academico")
        .select(["id_periodo", "nombre"])
        .where("id_colegio", "=", Number(id_colegio))
        .orderBy("id_periodo", "desc")
        .limit(1)
        .executeTakeFirst();
    }

    const periodId = periodRes?.id_periodo || null;
    const periodName = periodRes?.nombre || "Sin Periodo Activo";

    // 4. Failed subjects and overall average
    let grades: any[] = [];
    let promedioGeneral: number | null = null;
    let materiasReprobadas: any[] = [];

    if (id_grupo && periodId) {
      const calcSubquery = db
        .selectFrom("notas_actividad as na")
        .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
        .select([
          "am.id_detallegrado",
          "am.id_periodo",
          sql<number>`ROUND(SUM(na.nota * (am.porcentaje / 100.0))::numeric, 2)`.as("promedio_calculado")
        ])
        .where("na.id_estudiante", "=", numId)
        .groupBy(["am.id_detallegrado", "am.id_periodo"])
        .as("calc");

      const latestAnioSubquery = db
        .selectFrom("periodo_academico")
        .select("id_anio")
        .where("id_colegio", "=", Number(id_colegio))
        .where("estado", "in", ["ABIERTO", "CERRADO"])
        .orderBy("id_periodo", "desc")
        .limit(1);

      const periodGradesCte = db
        .selectFrom("detalle_grados as dg")
        .innerJoin("periodo_academico as p", (join) =>
          join
            .on("p.id_colegio", "=", Number(id_colegio))
            .on("p.id_anio", "=", latestAnioSubquery)
        )
        .leftJoin("resultado_academico as ra", (join) =>
          join
            .onRef("ra.id_detallegrado", "=", "dg.id_detallegrado")
            .onRef("ra.id_periodo", "=", "p.id_periodo")
            .on("ra.id_estudiante", "=", numId)
        )
        .leftJoin(calcSubquery, (join) =>
          join
            .onRef("calc.id_detallegrado", "=", "dg.id_detallegrado")
            .onRef("calc.id_periodo", "=", "p.id_periodo")
        )
        .select([
          "dg.id_materia",
          "p.id_periodo",
          sql<number>`COALESCE(ra.promedio, calc.promedio_calculado)`.as("nota_periodo")
        ])
        .where("dg.id_grupo", "=", Number(id_grupo));

      const gradesRes = await db
        .with("period_grades", () => periodGradesCte)
        .selectFrom("period_grades as pg")
        .innerJoin("materias as m", "m.id_materia", "pg.id_materia")
        .select([
          "m.id_materia",
          "m.nombre as materia",
          sql<number>`ROUND(AVG(pg.nota_periodo), 2)::numeric`.as("calificacion")
        ])
        .groupBy(["m.id_materia", "m.nombre"])
        .orderBy("m.nombre", "asc")
        .execute();

      grades = gradesRes.map(g => ({
        id_materia: g.id_materia,
        materia: g.materia,
        calificacion: (g.calificacion !== null && g.calificacion !== undefined) ? parseFloat(String(g.calificacion)) : null
      }));

      const gradedList = grades.filter(g => g.calificacion !== null && g.calificacion !== undefined);

      if (gradedList.length > 0) {
        const sum = gradedList.reduce((acc, curr) => acc + curr.calificacion, 0);
        promedioGeneral = parseFloat((sum / gradedList.length).toFixed(2));
      } else {
        promedioGeneral = null;
      }

      materiasReprobadas = gradedList.filter(g => g.calificacion < 3.0);
    }

    // 5. Total Absences
    const absencesRes = await db
      .selectFrom("registro_asistencia")
      .select(sql<number>`COUNT(*)::int`.as("count"))
      .where("id_estudiante", "=", numId)
      .where("estado", "=", "AUSENTE")
      .executeTakeFirst();
    const totalInasistencias = absencesRes?.count || 0;

    // 6. Disciplinary observations count
    const observationsRes = await db
      .selectFrom("observacion_estudiante")
      .select(sql<number>`COUNT(*)::int`.as("count"))
      .where("id_estudiante", "=", numId)
      .where("tipo", "=", "DISCIPLINARIA")
      .executeTakeFirst();
    const totalObservacionesDisciplinarias = observationsRes?.count || 0;

    // 7. Last system activity logic
    let ultimaActividad = "No registrada";
    if (student.id_usuario) {
      ultimaActividad = student.user_created_at 
        ? new Date(student.user_created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
        : "Reciente";
    }

    // 8. Academic State classification
    let estadoAcademico = "Sin Notas";
    const gradedCount = grades.filter(g => g.calificacion !== null && g.calificacion !== undefined).length;

    if (gradedCount > 0) {
      if (materiasReprobadas.length >= 3 || (promedioGeneral !== null && promedioGeneral < 3.0)) {
        estadoAcademico = "Crítico";
      } else if (materiasReprobadas.length > 0) {
        estadoAcademico = "En riesgo";
      } else {
        estadoAcademico = "Normal";
      }
    }

    // 9. Fetch graduation registry if graduated
    let graduationInfo: any = null;
    if (student.estado === "GRADUADO") {
      graduationInfo = await db
        .selectFrom("registro_graduados")
        .select(["fecha_graduacion", "observaciones"])
        .where("id_estudiante", "=", numId)
        .executeTakeFirst() || null;
    }

    // 10. Fetch active sanction details if student is SANCIONADO or EXPULSADO
    let sanctionInfo: any = null;
    if (student.estado === "SANCIONADO" || student.estado === "EXPULSADO") {
      sanctionInfo = await db
        .selectFrom("sancion as s")
        .innerJoin("tipo_sancion as ts", "s.id_tipo_sancion", "ts.id_tipo_sancion")
        .innerJoin("directivo as d", "s.id_directivo", "d.id")
        .innerJoin("usuario as u", "d.id_usuario", "u.id_usuario")
        .select([
          "s.id_sancion",
          "s.motivo",
          "s.fecha_inicio",
          "s.fecha_fin",
          "s.estado",
          "s.observaciones",
          "ts.nombre as tipo_nombre",
          "ts.descripcion as tipo_descripcion",
          sql<string>`u.nombre || ' ' || u.apellido`.as("directivo_nombre")
        ])
        .where("s.id_estudiante", "=", numId)
        .where("s.estado", "=", "ACTIVA")
        .orderBy("s.id_sancion", "desc")
        .limit(1)
        .executeTakeFirst() || null;
    }

    // 11. Fetch directive promotion decisions
    const decisionsRes = await db
      .selectFrom("decision_promocion_directivo as dpd")
      .innerJoin("anio_lectivo as al", "dpd.id_anio_anterior", "al.id_anio")
      .leftJoin("tipo_grado as tg_ant", "dpd.id_grado_anterior", "tg_ant.id_tipo_grado")
      .leftJoin("tipo_grado as tg_asig", "dpd.id_grado_asignado", "tg_asig.id_tipo_grado")
      .leftJoin("usuario as u", "dpd.id_usuario_decision", "u.id_usuario")
      .select([
        "dpd.id_decision",
        "dpd.resultado_calculado",
        "dpd.decision_tomada",
        "dpd.fecha_decision",
        "dpd.observacion",
        "al.calendario as anio_calendario",
        "tg_ant.nombre as grado_anterior_nombre",
        "tg_asig.nombre as grado_asignado_nombre",
        sql<string>`u.nombre || ' ' || u.apellido`.as("directivo_nombre")
      ])
      .where("dpd.id_estudiante", "=", numId)
      .orderBy("dpd.fecha_decision", "desc")
      .execute();

    res.json({
      id_estudiante: student.id_estudiante,
      nombre_completo: `${student.nombre} ${student.apellido}`,
      nombre: student.nombre,
      apellido: student.apellido,
      id_usuario: student.id_usuario,
      documento: student.documento,
      codigo: student.codigo,
      curso: student.grado_nombre && student.seccion_nombre ? `${student.grado_nombre}-${student.seccion_nombre}` : "Sin Grupo",
      nivel: student.nivel_nombre || "Sin Nivel",
      estado_estudiante: student.estado, 
      motivo_estado: student.motivo_estado,
      estado_academico: estadoAcademico, 
      gpa: promedioGeneral,
      periodo_nombre: periodName,
      total_inasistencias: totalInasistencias,
      total_disciplinarias: totalObservacionesDisciplinarias,
      parent: parent ? {
        nombre: `${parent.nombre} ${parent.apellido}`,
        email: parent.email || "Sin correo registrado"
      } : null,
      failed_subjects_count: materiasReprobadas.length,
      failed_subjects: materiasReprobadas,
      ultima_actividad: ultimaActividad,
      graduation: graduationInfo,
      sanction: sanctionInfo,
      directive_decisions: decisionsRes || []
    });

  } catch (error: any) {
    console.error("Error in getStudentSummary:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

export const graduateStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fecha_graduacion, observaciones, registrar_por } = req.body;
    const numId = Number(id);

    await db.transaction().execute(async (trx) => {
      // 1. Check student and active grade
      const student = await trx
        .selectFrom("estudiante as e")
        .leftJoin("matricula as m", (join) =>
          join
            .onRef("e.id_estudiante", "=", "m.id_estudiante")
            .onRef("m.id_colegio", "=", "e.id_colegio")
            .on("m.estado", "in", ["ACTIVA", "APROBADA"])
        )
        .leftJoin("grupos as g", "m.id_grupo", "g.id_grupo")
        .leftJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
        .select([
          "e.id_estudiante",
          "e.nombre",
          "e.apellido",
          "e.id_colegio",
          "e.id_usuario",
          "tg.nombre as grado_nombre",
          "m.id_matricula",
          "m.id_grupo"
        ])
        .where("e.id_estudiante", "=", numId)
        .executeTakeFirst();

      if (!student) {
        throw new Error("NOT_FOUND:Estudiante no encontrado");
      }

      // RN-01: Only student of 11th grade (ONCE) can graduate
      if (student.grado_nombre !== "ONCE") {
        throw new Error("BAD_REQUEST:Solo los estudiantes de grado Undécimo (ONCE) pueden ser graduados");
      }

      // 2. Academic check (RN-02)
      let periodRes = await trx
        .selectFrom("periodo_academico")
        .select("id_periodo")
        .where("id_colegio", "=", Number(student.id_colegio))
        .where("estado", "=", "ABIERTO")
        .limit(1)
        .executeTakeFirst();

      if (!periodRes) {
        periodRes = await trx
          .selectFrom("periodo_academico")
          .select("id_periodo")
          .where("id_colegio", "=", Number(student.id_colegio))
          .orderBy("id_periodo", "desc")
          .limit(1)
          .executeTakeFirst();
      }

      const periodId = periodRes?.id_periodo || null;

      if (!periodId || !student.id_grupo) {
        throw new Error("BAD_REQUEST:El estudiante no tiene matrícula activa o no hay periodo académico configurado");
      }

      // Fetch cumulative grades for the current school year
      const calcSubquery = trx
        .selectFrom("notas_actividad as na")
        .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
        .select([
          "am.id_detallegrado",
          "am.id_periodo",
          sql<number>`ROUND(SUM(na.nota * (am.porcentaje / 100.0))::numeric, 2)`.as("promedio_calculado")
        ])
        .where("na.id_estudiante", "=", numId)
        .groupBy(["am.id_detallegrado", "am.id_periodo"])
        .as("calc");

      const latestAnioSubquery = trx
        .selectFrom("periodo_academico")
        .select("id_anio")
        .where("id_colegio", "=", Number(student.id_colegio))
        .where("estado", "in", ["ABIERTO", "CERRADO"])
        .orderBy("id_periodo", "desc")
        .limit(1);

      const periodGradesCte = trx
        .selectFrom("detalle_grados as dg")
        .innerJoin("periodo_academico as p", (join) =>
          join
            .on("p.id_colegio", "=", Number(student.id_colegio))
            .on("p.id_anio", "=", latestAnioSubquery)
        )
        .leftJoin("resultado_academico as ra", (join) =>
          join
            .onRef("ra.id_detallegrado", "=", "dg.id_detallegrado")
            .onRef("ra.id_periodo", "=", "p.id_periodo")
            .on("ra.id_estudiante", "=", numId)
        )
        .leftJoin(calcSubquery, (join) =>
          join
            .onRef("calc.id_detallegrado", "=", "dg.id_detallegrado")
            .onRef("calc.id_periodo", "=", "p.id_periodo")
        )
        .select([
          "dg.id_materia",
          "p.id_periodo",
          sql<number>`COALESCE(ra.promedio, calc.promedio_calculado)`.as("nota_periodo")
        ])
        .where("dg.id_grupo", "=", Number(student.id_grupo));

      const gradesRes = await trx
        .with("period_grades", () => periodGradesCte)
        .selectFrom("period_grades as pg")
        .innerJoin("materias as m", "m.id_materia", "pg.id_materia")
        .select([
          "m.id_materia",
          "m.nombre as materia",
          sql<number>`COALESCE(ROUND(AVG(pg.nota_periodo), 2), 0)::numeric`.as("calificacion")
        ])
        .groupBy(["m.id_materia", "m.nombre"])
        .orderBy("m.nombre", "asc")
        .execute();

      const grades = gradesRes.map(g => ({
        id_materia: g.id_materia,
        materia: g.materia,
        calificacion: parseFloat(String(g.calificacion || 0))
      }));

      let promedioGeneral = 0;
      if (grades.length > 0) {
        const sum = grades.reduce((acc, curr) => acc + curr.calificacion, 0);
        promedioGeneral = parseFloat((sum / grades.length).toFixed(2));
      }

      const materiasReprobadas = grades.filter(g => g.calificacion < 3.0);

      // RN-02: Must have approved academic requirements (GPA >= 3.0, 0 failed subjects)
      if (promedioGeneral < 3.0 || materiasReprobadas.length > 0) {
        throw new Error(JSON.stringify({
          type: "ACADEMIC_REQUIREMENTS",
          error: "El estudiante no cumple con los requisitos académicos para graduarse",
          gpa: promedioGeneral,
          failed_subjects_count: materiasReprobadas.length,
          failed_subjects: materiasReprobadas
        }));
      }

      // 3. Update student status to GRADUADO
      await trx
        .updateTable("estudiante")
        .set({ estado: "GRADUADO" })
        .where("id_estudiante", "=", numId)
        .execute();

      // 4. Change active enrollment (matricula) state to CULMINADA
      if (student.id_matricula) {
        await trx
          .updateTable("matricula")
          .set({ estado: "CULMINADA" })
          .where("id_matricula", "=", Number(student.id_matricula))
          .execute();
      }

      // 5. Insert record to registro_graduados
      const gradDate = fecha_graduacion ? new Date(fecha_graduacion) : new Date();
      await trx
        .insertInto("registro_graduados")
        .values({
          id_estudiante: numId,
          fecha_graduacion: gradDate,
          observaciones: observaciones || null,
          id_usuario_registro: registrar_por ? Number(registrar_por) : null
        })
        .onConflict((oc) =>
          oc.column("id_estudiante").doUpdateSet({
            fecha_graduacion: gradDate,
            observaciones: observaciones || null,
            id_usuario_registro: registrar_por ? Number(registrar_por) : null
          })
        )
        .execute();

      // Audit log for active supervision
      const activeAuditoriaId = (req as any).user?.supervisionId;
      if (activeAuditoriaId) {
        (req as any).auditLogged = true;
        await trx
          .insertInto("auditoria_acciones_realizadas")
          .values({
            id_auditoria: Number(activeAuditoriaId),
            modulo: "ESTUDIANTES",
            tipo_accion: "MODIFICACION",
            accion: "Graduación de estudiante",
            recurso_afectado: `Estudiante ID: ${id} (${student.nombre} ${student.apellido})`,
            id_usuario_afectado: student.id_usuario ? Number(student.id_usuario) : null,
            valor_antiguo: JSON.stringify({ estado: "ACTIVO", matricula_estado: "ACTIVA" }),
            valor_nuevo: JSON.stringify({ estado: "GRADUADO", matricula_estado: "CULMINADA" }),
            motivo_cambio: observaciones || "Graduación de estudiante"
          })
          .execute();
      }

      console.log(`[AUDIT] Estudiante ${student.nombre} ${student.apellido} (ID: ${id}) cambiado a estado GRADUADO por usuario ID ${registrar_por || "sistema"} en fecha ${gradDate.toISOString()}.`);
    });

    res.json({ message: "Estudiante graduado exitosamente" });
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND:")) {
      res.status(404).json({ error: error.message.split(":")[1] });
      return;
    }
    if (error.message?.startsWith("BAD_REQUEST:")) {
      res.status(400).json({ error: error.message.split(":")[1] });
      return;
    }
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.type === "ACADEMIC_REQUIREMENTS") {
        res.status(400).json(parsed);
        return;
      }
    } catch {}
    console.error("Error in graduateStudent:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

export const getParentStudentEnrollment = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const authUser = (req as any).user;
    const userId = authUser?.id_usuario || authUser?.id;

    if (!userId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const isStaff = authUser?.roles?.some((r: string) => ['admin', 'directivo', 'admin_general'].includes(r));

    if (!isStaff) {
      const parentUser = await db
        .selectFrom("padre_familia as pf")
        .innerJoin("detalle_padrefamilia as dp", "dp.id_padrefamilia", "pf.id_padrefamilia")
        .select("dp.id_estudiante")
        .where("pf.id_usuario", "=", Number(userId))
        .where("dp.id_estudiante", "=", Number(studentId))
        .executeTakeFirst();

      if (!parentUser) {
        const userEmailRes = await db
          .selectFrom("usuario")
          .select("email")
          .where("id_usuario", "=", Number(userId))
          .executeTakeFirst();

        const matMatch = userEmailRes ? await db
          .selectFrom("matricula")
          .select("id_matricula")
          .where("id_estudiante", "=", Number(studentId))
          .where("correo_padre", "=", userEmailRes.email)
          .executeTakeFirst() : null;

        if (!matMatch) {
          res.status(403).json({ error: "No tiene autorización para ver los documentos de este estudiante" });
          return;
        }
      }
    }

    const matriculaIdQuery = req.query.matriculaId ? Number(req.query.matriculaId) : null;

    const allMatriculas = await db
      .selectFrom("matricula as m")
      .leftJoin("grupos as g", "m.id_grupo", "g.id_grupo")
      .leftJoin("colegio as col", "col.id_colegio", "m.id_colegio")
      .leftJoin("anio_lectivo as al", "al.id_anio", "m.id_anio")
      .leftJoin("nivel_escolar as ne", "g.id_nivel", "ne.id_nivel")
      .leftJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
      .leftJoin("secciones as s", "g.id_seccion", "s.id_seccion")
      .leftJoin("jornada as j", "g.id_jornada", "j.id_jornada")
      .leftJoin("estudiante as e", "e.id_estudiante", "m.id_estudiante")
      .leftJoin("usuario as u_est", "e.id_usuario", "u_est.id_usuario")
      .select([
        "m.id_matricula",
        "m.id_estudiante",
        "m.id_colegio",
        "m.id_anio",
        "m.estado",
        "m.tipo",
        "m.es_traslado",
        "m.correo_padre",
        "m.token_seguimiento",
        "m.fecha_creacion",
        "m.fecha_aprobacion",
        "col.nombre as school_name",
        "col.escudo_url",
        "al.calendario as year_label",
        "ne.nombre as grado_nivel",
        "tg.nombre as tipo_grado",
        "s.nombre as seccion",
        "j.nombre as jornada",
        "e.nombre as student_firstname",
        "e.apellido as student_lastname",
        "e.codigo as student_code",
        "u_est.documento as student_document"
      ])
      .where("m.id_estudiante", "=", Number(studentId))
      .orderBy("m.id_matricula", "desc")
      .execute();

    if (allMatriculas.length === 0) {
      res.status(404).json({ error: "Matrícula no encontrada para este estudiante" });
      return;
    }

    let mat = allMatriculas[0];
    if (matriculaIdQuery) {
      const found = allMatriculas.find(m => m.id_matricula === matriculaIdQuery);
      if (found) mat = found;
    } else {
      const activeMat = allMatriculas.find(m => m.estado === 'ACTIVA' || m.estado === 'APROBADA');
      if (activeMat) mat = activeMat;
    }

    let rawDocs = await db
      .selectFrom("documento_matriculas as d")
      .select([
        "d.id_documento",
        "d.id_matricula",
        "d.tipo_documento",
        "d.url",
        "d.estado",
        "d.fecha",
        "d.version",
        "d.mime_type",
        "d.nombre_original",
        "d.tamano_bytes"
      ])
      .where("d.id_matricula", "=", mat.id_matricula)
      .orderBy("d.tipo_documento", "asc")
      .orderBy("d.version", "desc")
      .execute();

    if (rawDocs.length === 0 && allMatriculas.length > 0) {
      const allMatIds = allMatriculas.map(m => m.id_matricula);
      rawDocs = await db
        .selectFrom("documento_matriculas as d")
        .select([
          "d.id_documento",
          "d.id_matricula",
          "d.tipo_documento",
          "d.url",
          "d.estado",
          "d.fecha",
          "d.version",
          "d.mime_type",
          "d.nombre_original",
          "d.tamano_bytes"
        ])
        .where("d.id_matricula", "in", allMatIds)
        .orderBy("d.tipo_documento", "asc")
        .orderBy("d.version", "desc")
        .execute();
    }

    const docsGroupedMap = new Map<string, any>();
    for (const docRow of rawDocs) {
      const docWithToken = {
        ...docRow,
        token_acceso: generateDocumentAccessToken(docRow.id_documento)
      };
      const key = docRow.tipo_documento;
      if (!docsGroupedMap.has(key)) {
        docsGroupedMap.set(key, {
          ...docWithToken,
          versiones_anteriores: []
        });
      } else {
        const parentDoc = docsGroupedMap.get(key);
        parentDoc.versiones_anteriores.push(docWithToken);
      }
    }
    const groupedDocs = Array.from(docsGroupedMap.values());

    res.json({
      matricula: mat,
      matriculas: allMatriculas,
      documentos: groupedDocs
    });
  } catch (error: any) {
    console.error("Error in getParentStudentEnrollment:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

