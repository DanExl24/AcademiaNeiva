import { Request, Response } from "express";
import { db } from "../../config/kysely";
import { sql } from "kysely";
import { randomUUID } from "crypto";
import { NotificationService } from "../../services/notificationService";
import { parseSchoolId } from "./helpers";

export const lookupUserIdentity = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.query.schoolId);
  const documento = String(req.query.documento || "").trim();
  const email = String(req.query.email || "").trim().toLowerCase();

  if (!documento && !email) {
    res.json({ found: false });
    return;
  }

  try {
    let query = db
      .selectFrom("usuario as u")
      .leftJoin("usuario_colegio as uc", "uc.id_usuario", "u.id_usuario")
      .select([
        "u.id_usuario",
        "u.email",
        "u.nombre",
        "u.apellido",
        "u.documento",
        "u.id_tipodocumento"
      ]);

    if (documento) {
      query = query.where("u.documento", "=", documento);
    } else if (email) {
      query = query.where(sql`LOWER(u.email)`, "=", email);
    }

    if (schoolId) {
      query = query.where("uc.id_colegio", "=", schoolId);
    }

    const row = await query.limit(1).executeTakeFirst();
    if (!row) {
      res.json({ found: false });
      return;
    }

    res.json({
      found: true,
      user: {
        id_usuario: row.id_usuario,
        nombre: row.nombre,
        apellido: row.apellido,
        documento: row.documento,
        id_tipodocumento: row.id_tipodocumento,
        email: row.email
      }
    });
  } catch (error) {
    console.error("Error in lookupUserIdentity:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const createExtraordinaryEnrollment = async (req: Request, res: Response) => {
  const authReq = req as any;
  const schoolId = parseSchoolId(authReq.user?.schoolId || authReq.user?.id_colegio || req.body.schoolId || req.body.id_colegio);

  if (!schoolId) {
    res.status(400).json({ error: "No se encontró el colegio del usuario autenticado." });
    return;
  }

  const {
    id_ticket,
    correo_padre,
    id_estudiante,
    motivo,
    motivo_extraordinaria,
    observaciones,
    observaciones_extraordinaria,
    tiene_discapacidad,
    es_extranjero
  } = req.body;

  const actualMotivo = motivo || motivo_extraordinaria;
  const actualObservaciones = observaciones || observaciones_extraordinaria;

  let finalTicketId = id_ticket ? Number(id_ticket) : null;
  let finalSenderName = (req.body.nombre_acudiente || 'Acudiente').trim();
  const finalCorreoPadre = (correo_padre || '').trim();

  if (!finalTicketId && !finalCorreoPadre) {
    res.status(400).json({ error: "Debe especificar un ticket de soporte o el correo electrónico del acudiente." });
    return;
  }

  try {
    const tokenSeguimiento = randomUUID();

    const { newMat } = await db.transaction().execute(async (trx) => {
      let resolvedTicketId = finalTicketId;

      // 1. Validar o registrar ticket de soporte
      if (resolvedTicketId) {
        const ticket = await trx
          .selectFrom("tickets_soporte")
          .selectAll()
          .where("id_ticket", "=", resolvedTicketId)
          .where("id_colegio", "=", schoolId)
          .executeTakeFirst();

        if (!ticket) {
          throw new Error("TICKET_NOT_FOUND: Ticket de soporte no encontrado en esta institución.");
        }

        if (ticket.tipo_incidencia !== 'MATRICULA_EXTRAORDINARIA') {
          throw new Error("INVALID_TICKET_TYPE: El ticket seleccionado debe ser de tipo MATRICULA_EXTRAORDINARIA.");
        }

        finalSenderName = ticket.nombre_remitente || finalSenderName;
      } else {
        // Registrar ticket de trazabilidad originado directamente en secretaría
        const insertedTicket = await trx
          .insertInto("tickets_soporte")
          .values({
            id_usuario: authReq.user!.id,
            nombre_remitente: finalSenderName,
            correo_remitente: finalCorreoPadre,
            telefono: req.body.telefono || null,
            tipo_incidencia: 'MATRICULA_EXTRAORDINARIA',
            asunto: 'Autorización de Matrícula Extraordinaria por Secretaría',
            descripcion: actualMotivo || 'Autorización directa por directivo en gestión de matrículas',
            id_colegio: schoolId,
            estado: 'EN_PROCESO',
            id_estudiante: id_estudiante ? Number(id_estudiante) : null
          })
          .returning("id_ticket")
          .executeTakeFirstOrThrow();

        resolvedTicketId = insertedTicket.id_ticket;
      }

      // 2. Obtener el año lectivo abierto o vigente de la institución
      let activeYear = await trx
        .selectFrom("anio_lectivo")
        .select("id_anio")
        .where("id_colegio", "=", schoolId)
        .where("estado", "=", "ABIERTO")
        .orderBy("id_anio", "desc")
        .limit(1)
        .executeTakeFirst();

      if (!activeYear) {
        activeYear = await trx
          .selectFrom("anio_lectivo")
          .select("id_anio")
          .where("id_colegio", "=", schoolId)
          .orderBy("id_anio", "desc")
          .limit(1)
          .executeTakeFirst();
      }

      if (!activeYear) {
        throw new Error("NO_ACADEMIC_YEAR: No hay un año lectivo configurado en la institución.");
      }
      const finalAnioId = activeYear.id_anio;

      // 2.1. Validar que el período de inscripción ordinario NO esté vigente
      const cfg = await trx
        .selectFrom("configuracion_inscripcion")
        .select(["habilitada", "fecha_inicio", "fecha_cierre"])
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", finalAnioId)
        .executeTakeFirst();

      if (cfg && cfg.habilitada && cfg.fecha_inicio && cfg.fecha_cierre) {
        const now = new Date();
        const start = new Date(cfg.fecha_inicio);
        const end = new Date(cfg.fecha_cierre);
        end.setHours(23, 59, 59, 999);

        if (now >= start && now <= end) {
          throw new Error("ORDINARY_PERIOD_OPEN: No es posible registrar matrículas extraordinarias mientras el período de inscripción ordinario se encuentre ABIERTO y vigente.");
        }
      }

      // 3. Validar estado del estudiante si es existente
      if (id_estudiante) {
        const student = await trx
          .selectFrom("estudiante")
          .select("estado")
          .where("id_estudiante", "=", Number(id_estudiante))
          .where("id_colegio", "=", schoolId)
          .executeTakeFirst();

        if (!student) {
          throw new Error("STUDENT_NOT_FOUND: El estudiante especificado no pertenece a esta institución.");
        }
        if (student.estado === 'ACTIVO') {
          throw new Error("STUDENT_ALREADY_ACTIVE: El estudiante ya se encuentra ACTIVO con matrícula vigente en la institución.");
        }
        if (student.estado === 'SANCIONADO') {
          throw new Error("STUDENT_SANCTIONED: El estudiante presenta una sanción disciplinaria activa y no puede tramitar matrícula extraordinaria.");
        }
        if (student.estado === 'EXPULSADO' || student.estado === 'GRADUADO') {
          throw new Error(`STUDENT_INELIGIBLE: El estudiante se encuentra en estado ${student.estado} y no puede ser matriculado.`);
        }
      }

      // 4. Crear la matrícula extraordinaria con token único
      const insertedMat = await trx
        .insertInto("matricula")
        .values({
          id_estudiante: id_estudiante ? Number(id_estudiante) : null,
          id_colegio: schoolId,
          id_anio: finalAnioId,
          estado: 'PENDIENTE',
          correo_padre: finalCorreoPadre,
          tiene_discapacidad: tiene_discapacidad === true || tiene_discapacidad === 'true',
          es_extranjero: es_extranjero === true || es_extranjero === 'true',
          tipo: 'EXTRAORDINARIA',
          motivo: actualMotivo || 'Autorización de Matrícula Extraordinaria por Secretaría',
          observaciones: actualObservaciones || null,
          id_usuario_responsable: authReq.user!.id,
          id_ticket: resolvedTicketId,
          token_seguimiento: tokenSeguimiento,
          fecha_creacion: sql`NOW()`
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 5. Actualizar el estado del ticket a EN_PROCESO con observación en JSON
      try {
        const ticketObsRow = await trx
          .selectFrom("tickets_soporte")
          .select("observaciones")
          .where("id_ticket", "=", resolvedTicketId!)
          .executeTakeFirst();

        let currentObs: any[] = [];
        if (ticketObsRow?.observaciones) {
          try {
            currentObs = typeof ticketObsRow.observaciones === 'string'
              ? JSON.parse(ticketObsRow.observaciones)
              : ticketObsRow.observaciones;
            if (!Array.isArray(currentObs)) currentObs = [currentObs];
          } catch {
            currentObs = [];
          }
        }
        currentObs.push({
          id_usuario: authReq.user!.id,
          nombre_usuario: 'Secretaría / Directivo',
          tipo: 'DIRECTIVO',
          mensaje: 'Matrícula Extraordinaria autorizada y en curso',
          fecha_creacion: new Date().toISOString()
        });

        await trx
          .updateTable("tickets_soporte")
          .set({
            estado: 'EN_PROCESO',
            observaciones: JSON.stringify(currentObs) as any
          })
          .where("id_ticket", "=", resolvedTicketId!)
          .execute();
      } catch (ticketErr) {
        await trx
          .updateTable("tickets_soporte")
          .set({ estado: 'EN_PROCESO' })
          .where("id_ticket", "=", resolvedTicketId!)
          .execute();
      }

      return { newMat: insertedMat };
    });

    // 6. Notificar al padre con el token de seguimiento
    await NotificationService.sendExtraordinaryApprovalEmail(
      finalCorreoPadre,
      finalSenderName,
      tokenSeguimiento
    );

    res.json({
      message: "Matrícula extraordinaria autorizada exitosamente. Enlace enviado al acudiente.",
      matricula: newMat,
      token: tokenSeguimiento
    });
  } catch (error: any) {
    console.error("Error en createExtraordinaryEnrollment:", error);
    const msg = error.message || "";
    if (msg.includes("TICKET_NOT_FOUND:")) {
      res.status(404).json({ error: msg.split(": ")[1] });
      return;
    }
    if (
      msg.includes("INVALID_TICKET_TYPE:") || 
      msg.includes("NO_ACADEMIC_YEAR:") || 
      msg.includes("ORDINARY_PERIOD_OPEN:") || 
      msg.includes("STUDENT_NOT_FOUND:") || 
      msg.includes("STUDENT_INELIGIBLE:")
    ) {
      res.status(400).json({ error: msg.split(": ")[1] });
      return;
    }
    res.status(500).json({ error: "Error interno al crear matrícula extraordinaria" });
  }
};

export const approveExtraordinaryEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const { id } = req.params;
  const { motivo_cambio } = req.body;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  try {
    const updatedMat = await db.transaction().execute(async (trx) => {
      const mat = await trx
        .selectFrom("matricula")
        .selectAll()
        .where("id_matricula", "=", Number(id))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!mat) {
        throw new Error("NOT_FOUND: Matrícula no encontrada");
      }

      if (mat.tipo !== 'EXTRAORDINARIA' || mat.estado !== 'PENDIENTE') {
        throw new Error("INVALID_STATE: Solo se pueden aprobar excepciones de matrículas extraordinarias en estado PENDIENTE.");
      }

      const updated = await trx
        .updateTable("matricula")
        .set({ estado: 'APROBADA' })
        .where("id_matricula", "=", Number(id))
        .returningAll()
        .executeTakeFirstOrThrow();

      // Supervision Logging if admin_general
      const isSupervised = authReq.user?.roles.includes("admin_general");
      if (isSupervised) {
        const audit = await trx
          .selectFrom("auditoria_supervision")
          .select("id_auditoria")
          .where("id_colegio", "=", schoolId)
          .where("id_admin_general", "=", authReq.user!.id)
          .where("estado_supervision", "=", "ACTIVA")
          .limit(1)
          .executeTakeFirst();

        if (audit) {
          await trx
            .insertInto("auditoria_acciones_realizadas")
            .values({
              id_auditoria: audit.id_auditoria,
              modulo: 'MATRICULAS',
              tipo_accion: 'MODIFICACION',
              accion: 'Aprobación de Excepción de Matrícula Extraordinaria',
              recurso_afectado: `Matricula ID: ${id}`,
              valor_antiguo: JSON.stringify(mat),
              valor_nuevo: JSON.stringify(updated),
              motivo_cambio: motivo_cambio || 'Acción bajo supervisión de Admin General'
            })
            .execute();
        }
      }

      return updated;
    });

    // Notification: send email to parent with tracking token
    if (updatedMat.correo_padre) {
      await NotificationService.sendExtraordinaryApprovalEmail(
        updatedMat.correo_padre,
        'Acudiente',
        updatedMat.token_seguimiento
      );
    }

    res.json({ message: "Excepción aprobada exitosamente y notificación enviada al acudiente.", matricula: updatedMat });
  } catch (error: any) {
    console.error("Error in approveExtraordinaryEnrollment:", error);
    const msg = error.message || "";
    if (msg.includes("NOT_FOUND:")) {
      res.status(404).json({ error: msg.split(": ")[1] });
      return;
    }
    if (msg.includes("INVALID_STATE:")) {
      res.status(400).json({ error: msg.split(": ")[1] });
      return;
    }
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const rejectExtraordinaryEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const { id } = req.params;
  const { motivo_cambio } = req.body;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  const finalMotivo = motivo_cambio || req.body.motivo || 'Solicitud de matrícula extraordinaria cancelada por la institución';

  try {
    const updatedMat = await db.transaction().execute(async (trx) => {
      const mat = await trx
        .selectFrom("matricula")
        .selectAll()
        .where("id_matricula", "=", Number(id))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!mat) {
        throw new Error("NOT_FOUND: Matrícula no encontrada");
      }

      if (mat.tipo !== 'EXTRAORDINARIA' || mat.estado !== 'PENDIENTE') {
        throw new Error("INVALID_STATE: Solo se pueden cancelar excepciones de matrículas extraordinarias en estado PENDIENTE.");
      }

      const updated = await trx
        .updateTable("matricula")
        .set({
          estado: 'CANCELADA',
          motivo_cancelacion: finalMotivo,
          detalles_cancelacion: finalMotivo
        })
        .where("id_matricula", "=", Number(id))
        .returningAll()
        .executeTakeFirstOrThrow();

      // Supervision Logging if admin_general
      const isSupervised = authReq.user?.roles.includes("admin_general");
      if (isSupervised) {
        const audit = await trx
          .selectFrom("auditoria_supervision")
          .select("id_auditoria")
          .where("id_colegio", "=", schoolId)
          .where("id_admin_general", "=", authReq.user!.id)
          .where("estado_supervision", "=", "ACTIVA")
          .limit(1)
          .executeTakeFirst();

        if (audit) {
          await trx
            .insertInto("auditoria_acciones_realizadas")
            .values({
              id_auditoria: audit.id_auditoria,
              modulo: 'MATRICULAS',
              tipo_accion: 'MODIFICACION',
              accion: 'Cancelación de Excepción de Matrícula Extraordinaria',
              recurso_afectado: `Matricula ID: ${id}`,
              valor_antiguo: JSON.stringify(mat),
              valor_nuevo: JSON.stringify(updated),
              motivo_cambio: motivo_cambio || finalMotivo
            })
            .execute();
        }
      }

      return updated;
    });

    if (updatedMat.correo_padre) {
      await NotificationService.sendCancellationEmail(
        updatedMat.correo_padre,
        'Acudiente',
        finalMotivo,
        finalMotivo
      );
    }

    res.json({ message: "Excepción cancelada exitosamente.", matricula: updatedMat });
  } catch (error: any) {
    console.error("Error in rejectExtraordinaryEnrollment:", error);
    const msg = error.message || "";
    if (msg.includes("NOT_FOUND:")) {
      res.status(404).json({ error: msg.split(": ")[1] });
      return;
    }
    if (msg.includes("INVALID_STATE:")) {
      res.status(400).json({ error: msg.split(": ")[1] });
      return;
    }
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const createReingresoEnrollment = async (req: Request, res: Response): Promise<void> => {
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
    motivo,
    observaciones,
    tiene_discapacidad,
    es_extranjero,
    motivo_cambio
  } = req.body;

  if (!id_estudiante || !id_nivel || !id_grupo || !id_anio || !motivo) {
    res.status(400).json({ error: "Los campos id_estudiante, id_nivel, id_grupo, id_anio y motivo son obligatorios." });
    return;
  }

  try {
    const newMat = await db.transaction().execute(async (trx) => {
      // Check student status
      const student = await trx
        .selectFrom("estudiante")
        .select("estado")
        .where("id_estudiante", "=", Number(id_estudiante))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!student) {
        throw new Error("NOT_FOUND: El estudiante especificado no pertenece a esta institución.");
      }

      if (student.estado === 'EXPULSADO' || student.estado === 'GRADUADO' || student.estado === 'SANCIONADO') {
        throw new Error(`INELIGIBLE: El estudiante se encuentra en estado ${student.estado} y no es elegible para reingreso.`);
      }

      if (student.estado !== 'RETIRADO') {
        throw new Error("NOT_RETIRADO: Solo estudiantes con estado 'RETIRADO' pueden solicitar reingreso.");
      }

      // Check existing enrollment
      const existingEnrollment = await trx
        .selectFrom("matricula")
        .select(["id_matricula", "estado"])
        .where("id_estudiante", "=", Number(id_estudiante))
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", Number(id_anio))
        .where("estado", "in", ["ACTIVA", "TRASLADADA", "PENDIENTE", "CORRECCION"])
        .executeTakeFirst();

      if (existingEnrollment) {
        throw new Error("ALREADY_EXISTS: El estudiante ya cuenta con una matrícula activa, trasladada o pendiente para este año lectivo.");
      }

      // Fetch the parent's email
      const parent = await trx
        .selectFrom("detalle_padrefamilia as dp")
        .innerJoin("padre_familia as pf", "dp.id_padrefamilia", "pf.id_padrefamilia")
        .innerJoin("usuario as u", "pf.id_usuario", "u.id_usuario")
        .select("u.email")
        .where("dp.id_estudiante", "=", Number(id_estudiante))
        .where("dp.id_colegio", "=", schoolId)
        .limit(1)
        .executeTakeFirst();

      if (!parent?.email) {
        throw new Error("NO_PARENT: No se encontró un acudiente asociado al estudiante para notificar.");
      }

      const correo_padre = parent.email;

      // Insert matricula
      const insertedMat = await trx
        .insertInto("matricula")
        .values({
          id_estudiante: Number(id_estudiante),
          id_nivel: Number(id_nivel),
          id_grupo: Number(id_grupo),
          id_colegio: schoolId,
          id_anio: Number(id_anio),
          estado: 'PENDIENTE',
          correo_padre,
          tiene_discapacidad: tiene_discapacidad === true || tiene_discapacidad === 'true',
          es_extranjero: es_extranjero === true || es_extranjero === 'true',
          tipo: 'REINGRESO',
          motivo,
          observaciones: observaciones || null,
          id_usuario_responsable: authReq.user!.id,
          fecha_creacion: sql`NOW()`
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const idMatricula = insertedMat.id_matricula;

      // Retrieve level name
      const level = await trx
        .selectFrom("nivel_escolar")
        .select("nombre")
        .where("id_nivel", "=", Number(id_nivel))
        .executeTakeFirst();

      if (!level) throw new Error("INVALID_LEVEL: Nivel escolar no válido");
      const levelName = level.nombre;

      const ALWAYS_REQUIRED = ['documentoPadre', 'salud', 'foto', 'reciboPublico'];
      const REQUIRED_FOR_LOWER_LEVELS = ['registroCivil', 'vacunas'];
      const REQUIRED_NOT_INFANT = ['documentoIdentidad', 'certificadosEscolaridad'];

      const isHigher = levelName === 'SECUNDARIA' || levelName === 'MEDIA';
      const isPre    = levelName === 'PREESCOLAR';

      const requiredDocs: string[] = [...ALWAYS_REQUIRED];
      if (!isHigher) requiredDocs.push(...REQUIRED_FOR_LOWER_LEVELS);
      if (!isPre)    requiredDocs.push(...REQUIRED_NOT_INFANT);
      if (es_extranjero === true || es_extranjero === 'true') requiredDocs.push('visa');
      if (tiene_discapacidad === true || tiene_discapacidad === 'true') requiredDocs.push('certificadoDiscapacidad');

      const docRows = requiredDocs.map(doc => ({
        id_matricula: idMatricula,
        tipo_documento: doc,
        url: 'PENDIENTE',
        estado: 'PENDIENTE' as const,
        fecha: new Date(),
        id_colegio: schoolId
      }));

      if (docRows.length > 0) {
        await trx.insertInto("documento_matriculas").values(docRows).execute();
      }

      // Supervision Logging if admin_general
      const isSupervised = authReq.user?.roles.includes("admin_general");
      if (isSupervised) {
        const audit = await trx
          .selectFrom("auditoria_supervision")
          .select("id_auditoria")
          .where("id_colegio", "=", schoolId)
          .where("id_admin_general", "=", authReq.user!.id)
          .where("estado_supervision", "=", "ACTIVA")
          .limit(1)
          .executeTakeFirst();

        if (audit) {
          await trx
            .insertInto("auditoria_acciones_realizadas")
            .values({
              id_auditoria: audit.id_auditoria,
              modulo: 'MATRICULAS',
              tipo_accion: 'CREACION',
              accion: 'Creación de Solicitud de Reingreso',
              recurso_afectado: `Matricula ID: ${idMatricula}`,
              valor_antiguo: null,
              valor_nuevo: JSON.stringify(insertedMat),
              motivo_cambio: motivo_cambio || 'Acción bajo supervisión de Admin General'
            })
            .execute();
        }
      }

      return insertedMat;
    });

    res.json({ message: "Solicitud de reingreso creada exitosamente", matricula: newMat });
  } catch (error: any) {
    console.error("Error in createReingresoEnrollment:", error);
    const msg = error.message || "";
    if (
      msg.includes("NOT_FOUND:") || 
      msg.includes("INELIGIBLE:") || 
      msg.includes("NOT_RETIRADO:") || 
      msg.includes("ALREADY_EXISTS:") || 
      msg.includes("NO_PARENT:") || 
      msg.includes("INVALID_LEVEL:")
    ) {
      res.status(400).json({ error: msg.split(": ")[1] });
      return;
    }
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const approveReingresoEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const { id } = req.params;
  const { motivo_cambio } = req.body;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  try {
    const updatedMat = await db.transaction().execute(async (trx) => {
      const mat = await trx
        .selectFrom("matricula")
        .selectAll()
        .where("id_matricula", "=", Number(id))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!mat) {
        throw new Error("NOT_FOUND: Matrícula no encontrada");
      }

      if (mat.tipo !== 'REINGRESO' || mat.estado !== 'PENDIENTE') {
        throw new Error("INVALID_STATE: Solo se pueden aprobar solicitudes de reingreso en estado PENDIENTE.");
      }

      const updated = await trx
        .updateTable("matricula")
        .set({ estado: 'APROBADA' })
        .where("id_matricula", "=", Number(id))
        .returningAll()
        .executeTakeFirstOrThrow();

      // Supervision Logging if admin_general
      const isSupervised = authReq.user?.roles.includes("admin_general");
      if (isSupervised) {
        const audit = await trx
          .selectFrom("auditoria_supervision")
          .select("id_auditoria")
          .where("id_colegio", "=", schoolId)
          .where("id_admin_general", "=", authReq.user!.id)
          .where("estado_supervision", "=", "ACTIVA")
          .limit(1)
          .executeTakeFirst();

        if (audit) {
          await trx
            .insertInto("auditoria_acciones_realizadas")
            .values({
              id_auditoria: audit.id_auditoria,
              modulo: 'MATRICULAS',
              tipo_accion: 'MODIFICACION',
              accion: 'Aprobación de Solicitud de Reingreso',
              recurso_afectado: `Matricula ID: ${id}`,
              valor_antiguo: JSON.stringify(mat),
              valor_nuevo: JSON.stringify(updated),
              motivo_cambio: motivo_cambio || 'Acción bajo supervisión de Admin General'
            })
            .execute();
        }
      }

      return updated;
    });

    if (updatedMat.correo_padre) {
      await NotificationService.sendReingresoApprovalEmail(
        updatedMat.correo_padre,
        'Acudiente',
        updatedMat.token_seguimiento
      );
    }

    res.json({ message: "Solicitud de reingreso aprobada exitosamente y notificación enviada al acudiente.", matricula: updatedMat });
  } catch (error: any) {
    console.error("Error in approveReingresoEnrollment:", error);
    const msg = error.message || "";
    if (msg.includes("NOT_FOUND:")) {
      res.status(404).json({ error: msg.split(": ")[1] });
      return;
    }
    if (msg.includes("INVALID_STATE:")) {
      res.status(400).json({ error: msg.split(": ")[1] });
      return;
    }
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const rejectReingresoEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const { id } = req.params;
  const { motivo, observaciones, motivo_cambio } = req.body;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  const finalMotivo = motivo || observaciones || motivo_cambio || 'Solicitud de reingreso no aprobada';

  try {
    const updatedMat = await db.transaction().execute(async (trx) => {
      const mat = await trx
        .selectFrom("matricula")
        .selectAll()
        .where("id_matricula", "=", Number(id))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!mat) {
        throw new Error("NOT_FOUND: Matrícula no encontrada");
      }

      if (mat.tipo !== 'REINGRESO' || (mat.estado !== 'PENDIENTE' && mat.estado !== 'CORREGIDA' && mat.estado !== 'CORRECCION')) {
        throw new Error("INVALID_STATE: Solo se pueden rechazar solicitudes de reingreso en estado PENDIENTE, CORREGIDA o CORRECCION.");
      }

      const updated = await trx
        .updateTable("matricula")
        .set({
          estado: 'CANCELADA',
          observaciones: finalMotivo,
          motivo_cancelacion: finalMotivo,
          detalles_cancelacion: finalMotivo
        })
        .where("id_matricula", "=", Number(id))
        .returningAll()
        .executeTakeFirstOrThrow();

      // If linked to a support ticket, mark ticket as RESUELTO
      if (mat.id_ticket) {
        try {
          const ticketObsRow = await trx
            .selectFrom("tickets_soporte")
            .select("observaciones")
            .where("id_ticket", "=", mat.id_ticket)
            .executeTakeFirst();

          let currentObs: any[] = [];
          if (ticketObsRow?.observaciones) {
            try {
              currentObs = typeof ticketObsRow.observaciones === 'string'
                ? JSON.parse(ticketObsRow.observaciones)
                : ticketObsRow.observaciones;
              if (!Array.isArray(currentObs)) currentObs = [currentObs];
            } catch {
              currentObs = [];
            }
          }
          currentObs.push({
            id_usuario: authReq.user!.id,
            nombre_usuario: 'Secretaría / Directivo',
            tipo: 'DIRECTIVO',
            mensaje: `Solicitud de matrícula cancelada por directivo: ${finalMotivo}`,
            fecha_creacion: new Date().toISOString()
          });

          await trx
            .updateTable("tickets_soporte")
            .set({
              estado: 'RESUELTO',
              observaciones: JSON.stringify(currentObs) as any
            })
            .where("id_ticket", "=", mat.id_ticket)
            .execute();
        } catch (ticketErr) {
          await trx
            .updateTable("tickets_soporte")
            .set({ estado: 'RESUELTO' })
            .where("id_ticket", "=", mat.id_ticket)
            .execute();
        }
      }

      // Supervision Logging if admin_general
      const isSupervised = authReq.user?.roles.includes("admin_general");
      if (isSupervised) {
        const audit = await trx
          .selectFrom("auditoria_supervision")
          .select("id_auditoria")
          .where("id_colegio", "=", schoolId)
          .where("id_admin_general", "=", authReq.user!.id)
          .where("estado_supervision", "=", "ACTIVA")
          .limit(1)
          .executeTakeFirst();

        if (audit) {
          await trx
            .insertInto("auditoria_acciones_realizadas")
            .values({
              id_auditoria: audit.id_auditoria,
              modulo: 'MATRICULAS',
              tipo_accion: 'MODIFICACION',
              accion: 'Rechazo de Solicitud de Reingreso',
              recurso_afectado: `Matricula ID: ${id}`,
              valor_antiguo: JSON.stringify(mat),
              valor_nuevo: JSON.stringify(updated),
              motivo_cambio: motivo_cambio || finalMotivo
            })
            .execute();
        }
      }

      return updated;
    });

    if (updatedMat.correo_padre) {
      await NotificationService.sendCancellationEmail(
        updatedMat.correo_padre,
        'Acudiente',
        finalMotivo,
        finalMotivo
      );
    }

    res.json({ message: "Solicitud de reingreso rechazada exitosamente y correo enviado al acudiente.", matricula: updatedMat });
  } catch (error: any) {
    console.error("Error in rejectReingresoEnrollment:", error);
    const msg = error.message || "";
    if (msg.includes("NOT_FOUND:")) {
      res.status(404).json({ error: msg.split(": ")[1] });
      return;
    }
    if (msg.includes("INVALID_STATE:")) {
      res.status(400).json({ error: msg.split(": ")[1] });
      return;
    }
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const correctReingresoEnrollment = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const { id } = req.params;
  const { observaciones, motivo_cambio } = req.body;
  const schoolId = authReq.user?.schoolId;

  if (!schoolId) {
    res.status(400).json({ error: "No se pudo identificar el colegio del directivo" });
    return;
  }

  const finalObservaciones = (observaciones || motivo_cambio || '').trim();
  if (!finalObservaciones) {
    res.status(400).json({ error: "Debe especificar las observaciones o correcciones requeridas al acudiente." });
    return;
  }

  try {
    const updatedMat = await db.transaction().execute(async (trx) => {
      const mat = await trx
        .selectFrom("matricula")
        .selectAll()
        .where("id_matricula", "=", Number(id))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!mat) {
        throw new Error("NOT_FOUND: Matrícula no encontrada");
      }

      if (mat.tipo !== 'REINGRESO') {
        throw new Error("INVALID_TYPE: Solo aplica a solicitudes de reingreso.");
      }

      const updated = await trx
        .updateTable("matricula")
        .set({
          estado: 'CORRECCION',
          observaciones: finalObservaciones
        })
        .where("id_matricula", "=", Number(id))
        .returningAll()
        .executeTakeFirstOrThrow();

      return updated;
    });

    if (updatedMat.correo_padre) {
      await NotificationService.sendRejectionEmail(
        updatedMat.correo_padre,
        'Acudiente',
        finalObservaciones,
        updatedMat.token_seguimiento
      );
    }

    res.json({ message: "Solicitud enviada a corrección exitosamente y notificación enviada al acudiente.", matricula: updatedMat });
  } catch (error: any) {
    console.error("Error in correctReingresoEnrollment:", error);
    const msg = error.message || "";
    if (msg.includes("NOT_FOUND:")) {
      res.status(404).json({ error: msg.split(": ")[1] });
      return;
    }
    if (msg.includes("INVALID_TYPE:")) {
      res.status(400).json({ error: msg.split(": ")[1] });
      return;
    }
    res.status(500).json({ error: "Error en el servidor" });
  }
};
