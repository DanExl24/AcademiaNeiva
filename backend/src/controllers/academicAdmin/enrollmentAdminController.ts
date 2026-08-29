import { Request, Response } from "express";
import { PoolClient } from "pg";
import { pool } from "../../config/db";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { NotificationService } from "../../services/notificationService";
import { validateDocumentUniqueness, normalizeDocument, validateDocumentFormatByTipo } from "../../utils/documentValidation";
import { formatFriendlyErrorMessage } from "../../utils/errorHelper";
import { normalizeGradeName, isDuplicateOrSimilarGrade } from "../../utils/gradeNormalization";
import { getDefaultMonthsLabelForPeriodOrder, getAcademicYearLabel } from "../../config/academicCalendarDefaults";
import {
  DEFAULT_COMPETENCY_TEXT,
  ensureCompetencySchema,
  harmonizeCompetenciesForSchoolYear,
  syncCompetencyAcrossGrade,
  TeachingContext,
} from "../../config/competencyMigration";
import {
  AuthRequest,
  path,
  parseSchoolId,
  ensureTeacherStatusColumn,
  autoSwitchPeriodsForYear,
  ensureAcademicYearForSchool,
  ensureSchoolSettingsTable,
  ensureAcademicPeriodTrimesterColumn,
  ensureAcademicPeriodDayColumns,
  ensureAcademicPeriodMonthColumns,
  ensureAcademicPeriodPendingStatus,
  ensureSchoolDefaultSettings,
  roundToOne,
  syncSchoolScalesAndGrades,
  getUserEligibleAcademicYears
} from "./helpers";

export const lookupUserIdentity = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.query.schoolId);
  const documento = String(req.query.documento || "").trim();
  const email = String(req.query.email || "").trim().toLowerCase();

  if (!documento && !email) {
    res.json({ found: false });
    return;
  }

  try {
    let query = `
      SELECT u.id_usuario, u.email,
             u.nombre,
             u.apellido,
             u.documento,
             u.id_tipodocumento
      FROM usuario u
      LEFT JOIN usuario_colegio uc ON uc.id_usuario = u.id_usuario
      WHERE 1=1
    `;
    const params: any[] = [];

    if (documento) {
      params.push(documento);
      query += ` AND u.documento = $${params.length}`;
    } else if (email) {
      params.push(email);
      query += ` AND LOWER(u.email) = $${params.length}`;
    }

    if (schoolId) {
      params.push(schoolId);
      query += ` AND uc.id_colegio = $${params.length}`;
    }
    query += ` LIMIT 1`;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      res.json({ found: false });
      return;
    }

    const row = result.rows[0];
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Validar o registrar ticket de soporte
    if (finalTicketId) {
      const ticketRes = await client.query(
        "SELECT * FROM tickets_soporte WHERE id_ticket = $1 AND id_colegio = $2",
        [finalTicketId, schoolId]
      );

      if (ticketRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Ticket de soporte no encontrado en esta institución." });
        return;
      }

      const ticket = ticketRes.rows[0];
      if (ticket.tipo_incidencia !== 'MATRICULA_EXTRAORDINARIA') {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "El ticket seleccionado debe ser de tipo MATRICULA_EXTRAORDINARIA." });
        return;
      }

      finalSenderName = ticket.nombre_remitente || finalSenderName;
    } else {
      // Registrar ticket de trazabilidad originado directamente en secretaría
      const ticketInsertRes = await client.query(
        `INSERT INTO tickets_soporte 
         (id_usuario, nombre_remitente, correo_remitente, telefono, tipo_incidencia, asunto, descripcion, id_colegio, estado, id_estudiante)
         VALUES ($1, $2, $3, $4, 'MATRICULA_EXTRAORDINARIA', $5, $6, $7, 'EN_PROCESO', $8)
         RETURNING id_ticket`,
        [
          authReq.user!.id,
          finalSenderName,
          finalCorreoPadre,
          req.body.telefono || null,
          'Autorización de Matrícula Extraordinaria por Secretaría',
          actualMotivo || 'Autorización directa por directivo en gestión de matrículas',
          schoolId,
          id_estudiante ? Number(id_estudiante) : null
        ]
      );
      finalTicketId = ticketInsertRes.rows[0].id_ticket;
    }

    // 2. Obtener el año lectivo activo de la institución
    const activeYearRes = await client.query(
      "SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 AND estado = 'ACTIVO' LIMIT 1",
      [schoolId]
    );

    if (activeYearRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "No hay un año lectivo ACTIVO configurado en la institución." });
      return;
    }
    const finalAnioId = activeYearRes.rows[0].id_anio;

    // 2.1. Validar que el período de inscripción ordinario NO esté vigente
    const configRes = await client.query(
      `SELECT habilitada, fecha_inicio, fecha_cierre 
       FROM configuracion_matricula 
       WHERE id_colegio = $1 AND id_anio = $2`,
      [schoolId, finalAnioId]
    );

    if (configRes.rows.length > 0) {
      const cfg = configRes.rows[0];
      if (cfg.habilitada && cfg.fecha_inicio && cfg.fecha_cierre) {
        const now = new Date();
        const start = new Date(cfg.fecha_inicio);
        const end = new Date(cfg.fecha_cierre);
        end.setHours(23, 59, 59, 999);

        if (now >= start && now <= end) {
          await client.query("ROLLBACK");
          res.status(400).json({
            error: "No es posible registrar matrículas extraordinarias mientras el período de inscripción ordinario se encuentre ABIERTO y vigente."
          });
          return;
        }
      }
    }

    // 3. Validar estado del estudiante si es existente
    if (id_estudiante) {
      const studentRes = await client.query(
        "SELECT estado FROM estudiante WHERE id_estudiante = $1 AND id_colegio = $2",
        [id_estudiante, schoolId]
      );
      if (studentRes.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "El estudiante especificado no pertenece a esta institución." });
        return;
      }
      const studentStatus = studentRes.rows[0].estado;
      if (studentStatus === 'EXPULSADO' || studentStatus === 'GRADUADO') {
        await client.query("ROLLBACK");
        res.status(400).json({ error: `El estudiante se encuentra en estado ${studentStatus} y no puede ser matriculado.` });
        return;
      }
    }

    // 4. Crear la matrícula extraordinaria con token único
    const tokenSeguimiento = randomUUID();
    const matRes = await client.query(
      `INSERT INTO matricula 
         (id_estudiante, id_colegio, id_anio, estado, correo_padre, tiene_discapacidad, es_extranjero, tipo, motivo, observaciones, id_usuario_responsable, id_ticket, token_seguimiento, fecha_creacion)
       VALUES ($1, $2, $3, 'PENDIENTE', $4, $5, $6, 'EXTRAORDINARIA', $7, $8, $9, $10, $11, NOW())
       RETURNING *`,
      [
        id_estudiante || null,
        schoolId,
        finalAnioId,
        finalCorreoPadre,
        tiene_discapacidad === true || tiene_discapacidad === 'true',
        es_extranjero === true || es_extranjero === 'true',
        actualMotivo || 'Autorización de Matrícula Extraordinaria por Secretaría',
        actualObservaciones || null,
        authReq.user!.id,
        finalTicketId,
        tokenSeguimiento
      ]
    );

    const newMat = matRes.rows[0];

    // 5. Actualizar el estado del ticket a EN_PROCESO
    await client.query(
      `UPDATE tickets_soporte 
       SET estado = 'EN_PROCESO', respuesta = 'Matrícula Extraordinaria autorizada y en curso' 
       WHERE id_ticket = $1`,
      [finalTicketId]
    );

    await client.query("COMMIT");

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
    await client.query("ROLLBACK");
    console.error("Error en createExtraordinaryEnrollment:", error);
    res.status(500).json({ error: "Error interno al crear matrícula extraordinaria" });
  } finally {
    client.release();
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch the matricula
    const matRes = await client.query(
      "SELECT * FROM matricula WHERE id_matricula = $1 AND id_colegio = $2",
      [id, schoolId]
    );
    if (matRes.rows.length === 0) {
      res.status(404).json({ error: "Matrícula no encontrada" });
      return;
    }

    const mat = matRes.rows[0];
    if (mat.tipo !== 'EXTRAORDINARIA' || mat.estado !== 'PENDIENTE') {
      res.status(400).json({ error: "Solo se pueden aprobar excepciones de matrículas extraordinarias en estado PENDIENTE." });
      return;
    }

    // Update state to APROBADA
    const updatedRes = await client.query(
      "UPDATE matricula SET estado = 'APROBADA' WHERE id_matricula = $1 RETURNING *",
      [id]
    );
    const updatedMat = updatedRes.rows[0];

    // Notification: send email to parent with tracking token
    await NotificationService.sendExtraordinaryApprovalEmail(
      mat.correo_padre,
      'Acudiente',
      mat.token_seguimiento
    );

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'MODIFICACION', 'Aprobación de Excepción de Matrícula Extraordinaria', $2, $3, $4, $5)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${id}`,
            JSON.stringify(mat),
            JSON.stringify(updatedMat),
            motivo_cambio || 'Acción bajo supervisión de Admin General'
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Excepción aprobada exitosamente y notificación enviada al acudiente.", matricula: updatedMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in approveExtraordinaryEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch the matricula
    const matRes = await client.query(
      "SELECT * FROM matricula WHERE id_matricula = $1 AND id_colegio = $2",
      [id, schoolId]
    );
    if (matRes.rows.length === 0) {
      res.status(404).json({ error: "Matrícula no encontrada" });
      return;
    }

    const mat = matRes.rows[0];
    if (mat.tipo !== 'EXTRAORDINARIA' || mat.estado !== 'PENDIENTE') {
      res.status(400).json({ error: "Solo se pueden cancelar excepciones de matrículas extraordinarias en estado PENDIENTE." });
      return;
    }

    const finalMotivo = motivo_cambio || req.body.motivo || 'Solicitud de matrícula extraordinaria cancelada por la institución';

    // Update state to CANCELADA
    const updatedRes = await client.query(
      "UPDATE matricula SET estado = 'CANCELADA', motivo_cancelacion = $1, detalles_cancelacion = $1 WHERE id_matricula = $2 RETURNING *",
      [finalMotivo, id]
    );
    const updatedMat = updatedRes.rows[0];

    // Notification: Send cancellation email to parent
    await NotificationService.sendCancellationEmail(
      mat.correo_padre,
      'Acudiente',
      finalMotivo,
      finalMotivo
    );

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'MODIFICACION', 'Cancelación de Excepción de Matrícula Extraordinaria', $2, $3, $4, $5)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${id}`,
            JSON.stringify(mat),
            JSON.stringify(updatedMat),
            motivo_cambio || finalMotivo
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Excepción cancelada exitosamente.", matricula: updatedMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in rejectExtraordinaryEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check student status
    const studentRes = await client.query(
      "SELECT estado FROM estudiante WHERE id_estudiante = $1 AND id_colegio = $2",
      [id_estudiante, schoolId]
    );

    if (studentRes.rows.length === 0) {
      res.status(400).json({ error: "El estudiante especificado no pertenece a esta institución." });
      return;
    }

    const studentStatus = studentRes.rows[0].estado;
    if (studentStatus === 'EXPULSADO' || studentStatus === 'GRADUADO' || studentStatus === 'SANCIONADO') {
      res.status(400).json({ error: `El estudiante se encuentra en estado ${studentStatus} y no es elegible para reingreso.` });
      return;
    }

    if (studentStatus !== 'RETIRADO') {
      res.status(400).json({ error: `Solo estudiantes con estado 'RETIRADO' pueden solicitar reingreso.` });
      return;
    }

    // Check if there is already an active or pending enrollment for this student in the current year
    const existingEnrollmentRes = await client.query(
      `SELECT id_matricula, estado FROM matricula 
       WHERE id_estudiante = $1 AND id_colegio = $2 AND id_anio = $3 AND estado IN ('ACTIVA', 'TRASLADADA', 'PENDIENTE', 'CORRECCION')`,
      [id_estudiante, schoolId, id_anio]
    );
    if (existingEnrollmentRes.rows.length > 0) {
      res.status(400).json({ error: "El estudiante ya cuenta con una matrícula activa, trasladada o pendiente para este año lectivo." });
      return;
    }

    // Fetch the parent's email
    const parentRes = await client.query(
      `SELECT u.email FROM detalle_padrefamilia dp
       JOIN padre_familia pf ON dp.id_padrefamilia = pf.id_padrefamilia
       JOIN usuario u ON pf.id_usuario = u.id_usuario
       WHERE dp.id_estudiante = $1 AND dp.id_colegio = $2
       LIMIT 1`,
      [id_estudiante, schoolId]
    );

    if (parentRes.rows.length === 0) {
      res.status(400).json({ error: "No se encontró un acudiente asociado al estudiante para notificar." });
      return;
    }

    const correo_padre = parentRes.rows[0].email;

    // Insert matricula
    const matRes = await client.query(
      `INSERT INTO matricula 
         (id_estudiante, id_nivel, id_grupo, id_colegio, id_anio, estado, correo_padre, tiene_discapacidad, es_extranjero, tipo, motivo, observaciones, id_usuario_responsable, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, 'PENDIENTE', $6, $7, $8, 'REINGRESO', $9, $10, $11, NOW())
       RETURNING *`,
      [
        id_estudiante,
        id_nivel,
        id_grupo,
        schoolId,
        id_anio,
        correo_padre,
        tiene_discapacidad === true || tiene_discapacidad === 'true',
        es_extranjero === true || es_extranjero === 'true',
        motivo,
        observaciones || null,
        authReq.user!.id
      ]
    );

    const newMat = matRes.rows[0];
    const idMatricula = newMat.id_matricula;

    // Retrieve level name to determine required documents
    const levelRes = await client.query('SELECT nombre FROM nivel_escolar WHERE id_nivel = $1', [id_nivel]);
    if (levelRes.rows.length === 0) throw new Error("Nivel escolar no válido");
    const levelName = levelRes.rows[0].nombre;

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

    for (const doc of requiredDocs) {
      await client.query(
        `INSERT INTO documento_matriculas (id_matricula, tipo_documento, url, estado, fecha, id_colegio)
         VALUES ($1, $2, 'PENDIENTE', 'PENDIENTE', NOW(), $3)`,
        [idMatricula, doc, schoolId]
      );
    }

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'CREACION', 'Creación de Solicitud de Reingreso', $2, NULL, $3, $4)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${idMatricula}`,
            JSON.stringify(newMat),
            motivo_cambio || 'Acción bajo supervisión de Admin General'
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Solicitud de reingreso creada exitosamente", matricula: newMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in createReingresoEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch the matricula
    const matRes = await client.query(
      "SELECT * FROM matricula WHERE id_matricula = $1 AND id_colegio = $2",
      [id, schoolId]
    );
    if (matRes.rows.length === 0) {
      res.status(404).json({ error: "Matrícula no encontrada" });
      return;
    }

    const mat = matRes.rows[0];
    if (mat.tipo !== 'REINGRESO' || mat.estado !== 'PENDIENTE') {
      res.status(400).json({ error: "Solo se pueden aprobar solicitudes de reingreso en estado PENDIENTE." });
      return;
    }

    // Update state to APROBADA
    const updatedRes = await client.query(
      "UPDATE matricula SET estado = 'APROBADA' WHERE id_matricula = $1 RETURNING *",
      [id]
    );
    const updatedMat = updatedRes.rows[0];

    // Notification: send email to parent with tracking token for reingreso
    await NotificationService.sendReingresoApprovalEmail(
      mat.correo_padre,
      'Acudiente',
      mat.token_seguimiento
    );

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'MODIFICACION', 'Aprobación de Solicitud de Reingreso', $2, $3, $4, $5)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${id}`,
            JSON.stringify(mat),
            JSON.stringify(updatedMat),
            motivo_cambio || 'Acción bajo supervisión de Admin General'
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Solicitud de reingreso aprobada exitosamente y notificación enviada al acudiente.", matricula: updatedMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in approveReingresoEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch the matricula
    const matRes = await client.query(
      "SELECT * FROM matricula WHERE id_matricula = $1 AND id_colegio = $2",
      [id, schoolId]
    );
    if (matRes.rows.length === 0) {
      res.status(404).json({ error: "Matrícula no encontrada" });
      return;
    }

    const mat = matRes.rows[0];
    if (mat.tipo !== 'REINGRESO' || (mat.estado !== 'PENDIENTE' && mat.estado !== 'CORREGIDA' && mat.estado !== 'CORRECCION')) {
      res.status(400).json({ error: "Solo se pueden rechazar solicitudes de reingreso en estado PENDIENTE, CORREGIDA o CORRECCION." });
      return;
    }

    const finalMotivo = motivo || observaciones || motivo_cambio || 'Solicitud de reingreso no aprobada';

    // Update state to CANCELADA
    const updatedRes = await client.query(
      "UPDATE matricula SET estado = 'CANCELADA', observaciones = $1, motivo_cancelacion = $2, detalles_cancelacion = $3 WHERE id_matricula = $4 RETURNING *",
      [finalMotivo, finalMotivo, finalMotivo, id]
    );
    const updatedMat = updatedRes.rows[0];

    // If linked to a support ticket, mark ticket as RESUELTO
    if (mat.id_ticket) {
      await client.query(
        "UPDATE tickets_soporte SET estado = 'RESUELTO', observaciones = $1 WHERE id_ticket = $2",
        [`Solicitud de reingreso cancelada por directivo: ${finalMotivo}`, mat.id_ticket]
      );
    }

    // Notification: Send cancellation email to parent
    await NotificationService.sendCancellationEmail(
      mat.correo_padre,
      'Acudiente',
      finalMotivo,
      finalMotivo
    );

    // Supervision Logging if admin_general
    const isSupervised = authReq.user?.roles.includes("admin_general");
    if (isSupervised) {
      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'MODIFICACION', 'Rechazo de Solicitud de Reingreso', $2, $3, $4, $5)`,
          [
            activeAuditoriaId,
            `Matricula ID: ${id}`,
            JSON.stringify(mat),
            JSON.stringify(updatedMat),
            motivo_cambio || finalMotivo
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Solicitud de reingreso rechazada exitosamente y correo enviado al acudiente.", matricula: updatedMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in rejectReingresoEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const matRes = await client.query(
      "SELECT * FROM matricula WHERE id_matricula = $1 AND id_colegio = $2",
      [id, schoolId]
    );
    if (matRes.rows.length === 0) {
      res.status(404).json({ error: "Matrícula no encontrada" });
      return;
    }

    const mat = matRes.rows[0];
    if (mat.tipo !== 'REINGRESO') {
      res.status(400).json({ error: "Solo aplica a solicitudes de reingreso." });
      return;
    }

    // Update state to CORRECCION
    const updatedRes = await client.query(
      "UPDATE matricula SET estado = 'CORRECCION', observaciones = $1 WHERE id_matricula = $2 RETURNING *",
      [finalObservaciones, id]
    );
    const updatedMat = updatedRes.rows[0];

    // Notification: Send email to parent with link to correct/upload documents
    await NotificationService.sendRejectionEmail(
      mat.correo_padre,
      'Acudiente',
      finalObservaciones,
      mat.token_seguimiento
    );

    await client.query("COMMIT");
    res.json({ message: "Solicitud enviada a corrección exitosamente y notificación enviada al acudiente.", matricula: updatedMat });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in correctReingresoEnrollment:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// RENAME SINGLE COURSE
// PATCH /api/academic-admin/groups/:id/rename
// ─────────────────────────────────────────────────────────────────────────────

