import { Request, Response } from "express";
import { db } from "../config/kysely";
import { sql } from "kysely";
import { NotificationService } from "../services/notificationService";

export const getStudentHistoryForReingreso = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const schoolId = authReq.user?.schoolId;
  const { idEstudiante } = req.params;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del usuario" });
    return;
  }

  try {
    // 1. Fetch student info
    const student = await db
      .selectFrom("estudiante as e")
      .leftJoin("usuario as u", "e.id_usuario", "u.id_usuario")
      .leftJoin("tipo_documento as td", "u.id_tipodocumento", "td.id_tipodocumento")
      .selectAll("e")
      .select([
        "u.documento",
        "u.id_tipodocumento",
        "td.tipo as tipo_documento_nombre",
      ])
      .where("e.id_estudiante", "=", Number(idEstudiante))
      .where("e.id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!student) {
      res.status(404).json({ error: "Estudiante no encontrado en esta institución" });
      return;
    }

    if (student.estado === "EXPULSADO" || student.estado === "GRADUADO" || student.estado === "SANCIONADO") {
      res.status(400).json({
        error: `El estudiante se encuentra en estado '${student.estado}'${
          student.estado === "SANCIONADO" ? " (Sanción disciplinaria activa)" : ""
        } y no es elegible para reingreso hasta que la situación se resuelva.`,
      });
      return;
    }

    // 2. Fetch last active/cancelled enrollment
    const lastEnrollment =
      (await db
        .selectFrom("matricula as m")
        .leftJoin("grupos as g", "m.id_grupo", "g.id_grupo")
        .leftJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
        .leftJoin("secciones as s", "g.id_seccion", "s.id_seccion")
        .leftJoin("nivel_escolar as n", "m.id_nivel", "n.id_nivel")
        .leftJoin("anio_lectivo as a", "m.id_anio", "a.id_anio")
        .selectAll("m")
        .select([
          "g.id_tipo_grado",
          sql<string>`COALESCE(CONCAT(tg.nombre, ' - ', s.nombre), 'Grupo Asignado')`.as("nombre_grupo"),
          "n.nombre as nombre_nivel",
          "a.calendario as anio_lectivo",
        ])
        .where("m.id_estudiante", "=", Number(idEstudiante))
        .where("m.id_colegio", "=", schoolId)
        .orderBy("m.id_matricula", "desc")
        .limit(1)
        .executeTakeFirst()) || null;

    // 3. Fetch latest documents for student
    let documents: any[] = [];
    if (lastEnrollment) {
      documents = await db
        .selectFrom("documento_matriculas as d")
        .selectAll("d")
        .where("d.id_matricula", "=", lastEnrollment.id_matricula)
        .orderBy("d.tipo_documento", "asc")
        .orderBy("d.version", "desc")
        .execute();
    }

    // 4. Calculate system default suggestions for document renewal
    const now = new Date();
    const evaluatedDocs = documents.map((doc) => {
      let suggestedState:
        | "VIGENTE"
        | "RECOMENDADO_ACTUALIZAR"
        | "OBLIGATORIO_ACTUALIZAR"
        | "DESACTUALIZADO_POR_FECHA" = "VIGENTE";
      let motivoSugerencia = "Documento válido conservado en archivo";

      const tipo = String(doc.tipo_documento || "").toLowerCase();
      const docDate = doc.fecha ? new Date(doc.fecha) : null;
      const yearsElapsed = docDate
        ? (now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
        : 99;

      if (tipo.includes("salud") || tipo.includes("paz") || tipo.includes("laboral")) {
        suggestedState = "OBLIGATORIO_ACTUALIZAR";
        motivoSugerencia = "Debe actualizarse cada año lectivo";
      } else if (tipo.includes("foto")) {
        if (yearsElapsed >= 2) {
          suggestedState = "RECOMENDADO_ACTUALIZAR";
          motivoSugerencia = "Fotografía con más de 2 años de antigüedad";
        }
      } else if (tipo.includes("identidad") || tipo.includes("documento")) {
        if (doc.fecha_expedicion) {
          const expDate = new Date(doc.fecha_expedicion);
          if (expDate < now) {
            suggestedState = "DESACTUALIZADO_POR_FECHA";
            motivoSugerencia = "Documento vencido o requiriendo actualización de tipo de documento";
          }
        }
      }

      return {
        ...doc,
        estado_sugerido: suggestedState,
        estado_renovacion_sugerido: suggestedState,
        motivo_sugerencia: motivoSugerencia,
      };
    });

    // 4.5. Motor de Sugerencia Pedagógica de Grado Destino (Smart Auto-Suggestion)
    let suggestedGrade: {
      id_nivel: number | null;
      id_tipo_grado: number | null;
      grado_nombre: string;
      motivo: string;
    } = {
      id_nivel: lastEnrollment?.id_nivel || null,
      id_tipo_grado: lastEnrollment?.id_tipo_grado || null,
      grado_nombre: "",
      motivo: "",
    };

    if (lastEnrollment && lastEnrollment.id_tipo_grado) {
      const isPromoted =
        ["PROMOVIDO", "APROBADO"].includes(String(lastEnrollment.estado || "").toUpperCase()) ||
        ["PROMOVIDO", "APROBADO"].includes(String((lastEnrollment as any).estado_promocion || "").toUpperCase());

      if (isPromoted) {
        const nextGrade = await db
          .selectFrom("tipo_grado as tg")
          .select(["tg.id_tipo_grado", "tg.nombre as grado_nombre", "tg.id_nivel"])
          .where("tg.id_tipo_grado", ">", lastEnrollment.id_tipo_grado)
          .orderBy("tg.id_tipo_grado", "asc")
          .limit(1)
          .executeTakeFirst();

        if (nextGrade) {
          suggestedGrade = {
            id_nivel: nextGrade.id_nivel || lastEnrollment.id_nivel,
            id_tipo_grado: nextGrade.id_tipo_grado,
            grado_nombre: nextGrade.grado_nombre,
            motivo: "Estudiante promovido en el año lectivo anterior. Sugerido: Grado Siguiente.",
          };
        } else {
          suggestedGrade.motivo = "Estudiante promovido en el grado máximo registrado.";
        }
      } else {
        const currentGrade = await db
          .selectFrom("tipo_grado as tg")
          .select("tg.nombre as grado_nombre")
          .where("tg.id_tipo_grado", "=", lastEnrollment.id_tipo_grado)
          .executeTakeFirst();

        suggestedGrade.grado_nombre = currentGrade?.grado_nombre || "";
        suggestedGrade.motivo = "Reingreso al mismo grado por retiro a mitad de año o no promoción.";
      }
    }

    // 5. Fetch parent info
    const parent =
      (await db
        .selectFrom("detalle_padrefamilia as dp")
        .innerJoin("padre_familia as pf", "dp.id_padrefamilia", "pf.id_padrefamilia")
        .innerJoin("usuario as u", "pf.id_usuario", "u.id_usuario")
        .selectAll("pf")
        .select("u.email")
        .where("dp.id_estudiante", "=", Number(idEstudiante))
        .where("dp.id_colegio", "=", schoolId)
        .limit(1)
        .executeTakeFirst()) || null;

    res.json({
      student,
      lastEnrollment,
      parent,
      documents: evaluatedDocs,
      suggestedGrade,
    });
  } catch (error: any) {
    console.error("Error in getStudentHistoryForReingreso:", error);
    res.status(500).json({ error: "Error interno al consultar historial del estudiante" });
  }
};

export const getTicketContextForReingreso = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const schoolId = authReq.user?.schoolId;
  const { ticketId } = req.params;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  try {
    const ticket = await db
      .selectFrom("tickets_soporte")
      .selectAll()
      .where("id_ticket", "=", Number(ticketId))
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!ticket) {
      res.status(404).json({ error: "Ticket de soporte no encontrado" });
      return;
    }

    // Find linked students by parent email or user ID
    const suggestedStudents = await db
      .selectFrom("estudiante as e")
      .leftJoin("usuario as u_e", "e.id_usuario", "u_e.id_usuario")
      .leftJoin("tipo_documento as td", "u_e.id_tipodocumento", "td.id_tipodocumento")
      .leftJoin("detalle_padrefamilia as dp", "e.id_estudiante", "dp.id_estudiante")
      .leftJoin("padre_familia as pf", "dp.id_padrefamilia", "pf.id_padrefamilia")
      .leftJoin("usuario as u", "pf.id_usuario", "u.id_usuario")
      .selectAll("e")
      .select([
        "u_e.documento",
        "u_e.id_tipodocumento",
        "td.tipo as tipo_documento_nombre",
      ])
      .distinct()
      .where("e.id_colegio", "=", schoolId)
      .where((eb) =>
        eb.or([
          eb("e.id_estudiante", "=", ticket.id_estudiante || -1),
          eb("u.email", "=", ticket.correo_remitente),
          eb("u.documento", "=", ticket.correo_remitente),
          eb("u.id_usuario", "=", ticket.id_usuario || -1),
        ])
      )
      .where("e.estado", "=", "RETIRADO")
      .execute();

    let gradoPretendido: { id_tipo_grado: number; nombre: string } | null = null;
    try {
      if (ticket.observaciones) {
        const obsArr =
          typeof ticket.observaciones === "string"
            ? JSON.parse(ticket.observaciones)
            : ticket.observaciones;
        if (Array.isArray(obsArr)) {
          const foundObs = obsArr.find((o: any) => o.id_tipo_grado_pretendido);
          if (foundObs && foundObs.id_tipo_grado_pretendido) {
            const grRow = await db
              .selectFrom("tipo_grado")
              .select(["id_tipo_grado", "nombre"])
              .where("id_tipo_grado", "=", Number(foundObs.id_tipo_grado_pretendido))
              .executeTakeFirst();

            if (grRow) {
              gradoPretendido = {
                id_tipo_grado: grRow.id_tipo_grado,
                nombre: grRow.nombre,
              };
            }
          }
        }
      }
    } catch (e) {
      // Ignore JSON parse errors
    }

    res.json({
      ticket,
      suggestedStudents,
      gradoPretendido,
    });
  } catch (error: any) {
    console.error("Error in getTicketContextForReingreso:", error);
    res.status(500).json({ error: "Error al obtener contexto del ticket para reingreso" });
  }
};

export const sendReingresoParentLink = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  const {
    id_estudiante,
    id_nivel,
    id_grupo,
    id_anio,
    id_ticket,
    declaracion_presencial,
    document_config,
    correo_padre,
    observaciones,
  } = req.body;

  if (!id_estudiante || !id_nivel || !id_grupo || !id_anio || !correo_padre) {
    res.status(400).json({
      error: "Los campos id_estudiante, id_nivel, id_grupo, id_anio y correo_padre son obligatorios",
    });
    return;
  }

  if (!id_ticket && !declaracion_presencial) {
    res.status(400).json({
      error:
        "Por gobernanza de consentimiento, el trámite debe originarse desde un Ticket de solicitud del acudiente o contar con la declaración de atención presencial en secretaría.",
    });
    return;
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      // Check student status
      const student = await trx
        .selectFrom("estudiante")
        .select(["estado", "nombre", "apellido"])
        .where("id_estudiante", "=", Number(id_estudiante))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!student) {
        throw { statusCode: 404, message: "Estudiante no encontrado en la institución" };
      }

      if (student.estado === "EXPULSADO" || student.estado === "GRADUADO" || student.estado === "SANCIONADO") {
        throw {
          statusCode: 400,
          message: `El estudiante se encuentra en estado '${student.estado}'${
            student.estado === "SANCIONADO" ? " (Sanción disciplinaria activa)" : ""
          } y no es elegible para reingreso hasta que la situación se resuelva.`,
        };
      }

      // Auto-create audit ticket if processing presencial atención without existing ticket
      let finalTicketId = id_ticket ? Number(id_ticket) : null;
      if (!finalTicketId && declaracion_presencial) {
        const presencialTicket = await trx
          .insertInto("tickets_soporte")
          .values({
            id_usuario: authReq.user!.id,
            nombre_remitente: "Atención Presencial (Secretaría)",
            correo_remitente: correo_padre,
            tipo_incidencia: "REINGRESO",
            asunto: "Atención Presencial en Secretaría - Reingreso",
            descripcion: `Trámite de reingreso iniciado directamente en secretaría para ${student.nombre} ${student.apellido}. Declaración de consentimiento confirmada por el directivo.`,
            id_colegio: schoolId,
            estado: "EN_PROCESO",
            id_estudiante: Number(id_estudiante),
          })
          .returning("id_ticket")
          .executeTakeFirstOrThrow();
        finalTicketId = presencialTicket.id_ticket;
      }

      // Auto-update student state to RETIRADO if currently active, to prepare for re-admission
      if (student.estado !== "RETIRADO") {
        await trx
          .updateTable("estudiante")
          .set({
            estado: "RETIRADO",
            motivo_estado: "Trámite de reingreso lectivo iniciado",
          })
          .where("id_estudiante", "=", Number(id_estudiante))
          .execute();
      }

      // Check duplicate active/pending enrollment
      const dupRes = await trx
        .selectFrom("matricula")
        .select("id_matricula")
        .where("id_estudiante", "=", Number(id_estudiante))
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", Number(id_anio))
        .where("estado", "in", ["ACTIVA", "PENDIENTE", "CORRECCION"])
        .executeTakeFirst();

      if (dupRes) {
        throw {
          statusCode: 400,
          message: "El estudiante ya posee un trámite de matrícula activo para este año lectivo",
        };
      }

      // Insert matricula with PENDIENTE status and REINGRESO type
      const newMat = await trx
        .insertInto("matricula")
        .values({
          id_estudiante: Number(id_estudiante),
          id_nivel: Number(id_nivel),
          id_grupo: Number(id_grupo),
          id_colegio: schoolId,
          id_anio: Number(id_anio),
          estado: "PENDIENTE",
          correo_padre,
          tipo: "REINGRESO",
          observaciones: observaciones || "Matrícula de reingreso autorizada por directivo",
          id_usuario_responsable: authReq.user!.id,
          id_ticket: finalTicketId,
          fecha_creacion: sql`NOW()` as any,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // Save document configuration matrix
      if (Array.isArray(document_config)) {
        for (const item of document_config) {
          await trx
            .insertInto("documento_matriculas")
            .values({
              id_matricula: newMat.id_matricula,
              tipo_documento: item.tipo_documento,
              url: item.url || "PENDIENTE",
              estado: item.estado_renovacion === "VIGENTE" ? "VALIDADO" : "PENDIENTE",
              fecha: sql`NOW()` as any,
              id_colegio: schoolId,
              version: 1,
              estado_renovacion: item.estado_renovacion || "VIGENTE",
            })
            .execute();
        }
      }

      // Update support ticket if attached
      if (id_ticket) {
        await trx
          .updateTable("tickets_soporte")
          .set({ estado: "EN_PROCESO" })
          .where("id_ticket", "=", Number(id_ticket))
          .where("id_colegio", "=", schoolId)
          .execute();
      }

      return {
        newMat,
        studentName: `${student.nombre} ${student.apellido}`,
      };
    });

    // Send email to parent
    await NotificationService.sendReingresoApprovalEmail(
      correo_padre,
      result.studentName,
      result.newMat.token_seguimiento
    );

    res.json({
      message: "Solicitud de reingreso preparada exitosamente y notificación enviada al acudiente.",
      matricula: result.newMat,
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error("Error in sendReingresoParentLink:", error);
    res.status(500).json({ error: "Error en el servidor al enviar enlace de reingreso" });
  }
};

export const notifyNonExistentStudent = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const { id } = req.params; // ticketId
  const { motivo } = req.body;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  try {
    await db.transaction().execute(async (trx) => {
      const ticket = await trx
        .selectFrom("tickets_soporte")
        .selectAll()
        .where("id_ticket", "=", Number(id))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!ticket) {
        throw { statusCode: 404, message: "Ticket de soporte no encontrado" };
      }

      // Send notification email explaining that student is not found and must register as new
      await NotificationService.sendNonExistentStudentEmail(
        ticket.correo_remitente,
        ticket.nombre_remitente,
        motivo || "No se encontraron antecedentes académicos del estudiante en el plantel."
      );

      // Update ticket status to RESUELTO
      await trx
        .updateTable("tickets_soporte")
        .set({ estado: "RESUELTO" })
        .where("id_ticket", "=", Number(id))
        .execute();
    });

    res.json({ message: "Notificación enviada exitosamente al usuario y ticket resuelto." });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error("Error in notifyNonExistentStudent:", error);
    res.status(500).json({ error: "Error al enviar notificación de estudiante no existente" });
  }
};

export const getReingresoCatalogs = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const schoolId = (req.query.schoolId ? Number(req.query.schoolId) : null) || authReq.user?.schoolId;

  try {
    let years: any[] = [];
    let levels: any[] = [];

    if (schoolId) {
      years = await db
        .selectFrom("anio_lectivo")
        .select(["id_anio", "calendario as anio", "estado"])
        .where("id_colegio", "=", schoolId)
        .orderBy(sql`CASE WHEN estado = 'ABIERTO' THEN 0 ELSE 1 END`, "asc")
        .orderBy("id_anio", "desc")
        .execute();

      levels = await db
        .selectFrom("nivel_escolar")
        .select(["id_nivel", "nombre"])
        .where((eb) => eb.or([eb("id_colegio", "=", schoolId), eb("id_colegio", "is", null)]))
        .orderBy("id_nivel", "asc")
        .execute();
    }

    const rawGrados = await db
      .selectFrom("tipo_grado")
      .select(["id_tipo_grado", "nombre", "id_nivel"])
      .orderBy("id_tipo_grado", "asc")
      .execute();

    const gradeOrderMap: Record<string, number> = {
      PARVULOS: 1,
      PREJARDIN: 2,
      "PRE-JARDIN": 2,
      JARDIN: 3,
      TRANSICION: 4,
      TRANSICIÓN: 4,
      PRIMERO: 5,
      SEGUNDO: 6,
      TERCERO: 7,
      CUARTO: 8,
      QUINTO: 9,
      SEXTO: 10,
      SEPTIMO: 11,
      SÉPTIMO: 11,
      OCTAVO: 12,
      NOVENO: 13,
      DECIMO: 14,
      DÉCIMO: 14,
      ONCE: 15,
      DOCE: 16,
    };

    const seenNames = new Set<string>();
    const uniqueGrados: any[] = [];

    for (const g of rawGrados) {
      const normalizedName = (g.nombre || "").trim().toUpperCase();
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        uniqueGrados.push(g);
      }
    }

    uniqueGrados.sort((a, b) => {
      const orderA = gradeOrderMap[(a.nombre || "").trim().toUpperCase()] || 99;
      const orderB = gradeOrderMap[(b.nombre || "").trim().toUpperCase()] || 99;
      return orderA - orderB;
    });

    res.json({
      anios: years,
      years: years,
      niveles: levels,
      grados: uniqueGrados,
    });
  } catch (error: any) {
    console.error("Error in getReingresoCatalogs:", error);
    res.status(500).json({ error: "Error al consultar catálogos para reingreso" });
  }
};

export const getReingresoGroups = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const schoolId = (req.query.schoolId ? Number(req.query.schoolId) : null) || authReq.user?.schoolId;
  const { nivelId } = req.query;

  if (!schoolId || !nivelId) {
    res.status(400).json({ error: "Parámetros schoolId y nivelId son requeridos" });
    return;
  }

  try {
    const groups = await db
      .selectFrom("grupos as g")
      .innerJoin("tipo_grado as tg", "g.id_tipo_grado", "tg.id_tipo_grado")
      .innerJoin("secciones as s", "g.id_seccion", "s.id_seccion")
      .leftJoin(
        db
          .selectFrom("matricula")
          .select(["id_grupo", sql<number>`COUNT(*)::int`.as("cnt")])
          .where("estado", "in", ["ACTIVA", "PENDIENTE"])
          .groupBy("id_grupo")
          .as("m_cnt"),
        "g.id_grupo",
        "m_cnt.id_grupo"
      )
      .select([
        "g.id_grupo",
        "g.id_tipo_grado",
        "g.id_nivel",
        "tg.nombre as grado_nombre",
        "s.nombre as seccion_nombre",
        sql<string>`CONCAT(tg.nombre, ' - ', s.nombre)`.as("nombre"),
        sql<number>`COALESCE(g.cupos_totales, 35)`.as("cupos_totales"),
        sql<number>`COALESCE(m_cnt.cnt, 0)::int`.as("matriculados"),
        sql<number>`GREATEST(0, COALESCE(g.cupos_totales, 35) - COALESCE(m_cnt.cnt, 0)::int)`.as(
          "cupos_disponibles"
        ),
      ])
      .where("g.id_colegio", "=", schoolId)
      .where("g.id_nivel", "=", Number(nivelId))
      .orderBy("tg.id_tipo_grado", "asc")
      .orderBy("s.nombre", "asc")
      .execute();

    res.json(groups);
  } catch (error: any) {
    console.error("Error in getReingresoGroups:", error);
    res.status(500).json({ error: "Error al consultar grupos para reingreso" });
  }
};
