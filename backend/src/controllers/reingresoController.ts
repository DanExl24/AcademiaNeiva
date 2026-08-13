import { Request, Response } from "express";
import { pool } from "../config/db";
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
    const studentRes = await pool.query(
      `SELECT e.*, u.documento, u.id_tipodocumento, td.tipo AS tipo_documento_nombre
       FROM estudiante e
       LEFT JOIN usuario u ON e.id_usuario = u.id_usuario
       LEFT JOIN tipo_documento td ON u.id_tipodocumento = td.id_tipodocumento
       WHERE e.id_estudiante = $1 AND e.id_colegio = $2`,
      [idEstudiante, schoolId]
    );

    if (studentRes.rows.length === 0) {
      res.status(404).json({ error: "Estudiante no encontrado en esta institución" });
      return;
    }

    const student = studentRes.rows[0];

    if (student.estado === 'EXPULSADO' || student.estado === 'GRADUADO' || student.estado === 'SANCIONADO') {
      res.status(400).json({ 
        error: `El estudiante se encuentra en estado '${student.estado}'${student.estado === 'SANCIONADO' ? ' (Sanción disciplinaria activa)' : ''} y no es elegible para reingreso hasta que la situación se resuelva.` 
      });
      return;
    }

    // 2. Fetch last active/cancelled enrollment
    const lastMatRes = await pool.query(
      `SELECT m.*, 
              COALESCE(CONCAT(tg.nombre, ' - ', s.nombre), 'Grupo Asignado') AS nombre_grupo, 
              n.nombre AS nombre_nivel, 
              a.calendario AS anio_lectivo
       FROM matricula m
       LEFT JOIN grupos g ON m.id_grupo = g.id_grupo
       LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       LEFT JOIN secciones s ON g.id_seccion = s.id_seccion
       LEFT JOIN nivel_escolar n ON m.id_nivel = n.id_nivel
       LEFT JOIN anio_lectivo a ON m.id_anio = a.id_anio
       WHERE m.id_estudiante = $1 AND m.id_colegio = $2
       ORDER BY m.id_matricula DESC LIMIT 1`,
      [idEstudiante, schoolId]
    );

    const lastEnrollment = lastMatRes.rows.length > 0 ? lastMatRes.rows[0] : null;

    // 3. Fetch latest documents for student
    let documents: any[] = [];
    if (lastEnrollment) {
      const docsRes = await pool.query(
        `SELECT d.*
         FROM documento_matriculas d
         WHERE d.id_matricula = $1
         ORDER BY d.tipo_documento, d.version DESC`,
        [lastEnrollment.id_matricula]
      );
      documents = docsRes.rows;
    }

    // 4. Calculate system default suggestions for document renewal
    const now = new Date();
    const evaluatedDocs = documents.map(doc => {
      let suggestedState: 'VIGENTE' | 'RECOMENDADO_ACTUALIZAR' | 'OBLIGATORIO_ACTUALIZAR' | 'DESACTUALIZADO_POR_FECHA' = 'VIGENTE';
      let motivoSugerencia = "Documento válido conservado en archivo";

      const tipo = doc.tipo_documento.toLowerCase();
      const docDate = doc.fecha ? new Date(doc.fecha) : null;
      const yearsElapsed = docDate ? (now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25) : 99;

      if (tipo.includes('salud') || tipo.includes('paz') || tipo.includes('laboral')) {
        suggestedState = 'OBLIGATORIO_ACTUALIZAR';
        motivoSugerencia = "Debe actualizarse cada año lectivo";
      } else if (tipo.includes('foto')) {
        if (yearsElapsed >= 2) {
          suggestedState = 'RECOMENDADO_ACTUALIZAR';
          motivoSugerencia = "Fotografía con más de 2 años de antigüedad";
        }
      } else if (tipo.includes('identidad') || tipo.includes('documento')) {
        if (doc.fecha_expedicion) {
          const expDate = new Date(doc.fecha_expedicion);
          if (expDate < now) {
            suggestedState = 'DESACTUALIZADO_POR_FECHA';
            motivoSugerencia = "Documento vencido o requiriendo actualización de tipo de documento";
          }
        }
      }

      return {
        ...doc,
        estado_sugerido: suggestedState,
        estado_renovacion_sugerido: suggestedState,
        motivo_sugerencia: motivoSugerencia
      };
    });

    // 4.5. Motor de Sugerencia Pedagógica de Grado Destino (Smart Auto-Suggestion)
    let suggestedGrade: { id_nivel: number | null; id_tipo_grado: number | null; grado_nombre: string; motivo: string } = {
      id_nivel: lastEnrollment?.id_nivel || null,
      id_tipo_grado: lastEnrollment?.id_tipo_grado || null,
      grado_nombre: '',
      motivo: ''
    };

    if (lastEnrollment && lastEnrollment.id_tipo_grado) {
      const isPromoted = ['PROMOVIDO', 'APROBADO'].includes(String(lastEnrollment.estado || '').toUpperCase()) ||
                        ['PROMOVIDO', 'APROBADO'].includes(String(lastEnrollment.estado_promocion || '').toUpperCase());

      if (isPromoted) {
        const nextGradeRes = await pool.query(
          `SELECT tg.id_tipo_grado, tg.nombre AS grado_nombre, tg.id_nivel
           FROM tipo_grado tg
           WHERE tg.id_tipo_grado > $1
           ORDER BY tg.id_tipo_grado ASC
           LIMIT 1`,
          [lastEnrollment.id_tipo_grado]
        );
        if (nextGradeRes.rows.length > 0) {
          const ng = nextGradeRes.rows[0];
          suggestedGrade = {
            id_nivel: ng.id_nivel || lastEnrollment.id_nivel,
            id_tipo_grado: ng.id_tipo_grado,
            grado_nombre: ng.grado_nombre,
            motivo: 'Estudiante promovido en el año lectivo anterior. Sugerido: Grado Siguiente.'
          };
        } else {
          suggestedGrade.motivo = 'Estudiante promovido en el grado máximo registrado.';
        }
      } else {
        const currentGradeRes = await pool.query(
          `SELECT tg.nombre AS grado_nombre FROM tipo_grado tg WHERE tg.id_tipo_grado = $1`,
          [lastEnrollment.id_tipo_grado]
        );
        suggestedGrade.grado_nombre = currentGradeRes.rows[0]?.grado_nombre || '';
        suggestedGrade.motivo = 'Reingreso al mismo grado por retiro a mitad de año o no promoción.';
      }
    }

    // 5. Fetch parent info
    const parentRes = await pool.query(
      `SELECT pf.*, u.email
       FROM detalle_padrefamilia dp
       JOIN padre_familia pf ON dp.id_padrefamilia = pf.id_padrefamilia
       JOIN usuario u ON pf.id_usuario = u.id_usuario
       WHERE dp.id_estudiante = $1 AND dp.id_colegio = $2
       LIMIT 1`,
      [idEstudiante, schoolId]
    );

    const parent = parentRes.rows.length > 0 ? parentRes.rows[0] : null;

    res.json({
      student,
      lastEnrollment,
      parent,
      documents: evaluatedDocs,
      suggestedGrade
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
    const ticketRes = await pool.query(
      `SELECT * FROM tickets_soporte WHERE id_ticket = $1 AND id_colegio = $2`,
      [ticketId, schoolId]
    );

    if (ticketRes.rows.length === 0) {
      res.status(404).json({ error: "Ticket de soporte no encontrado" });
      return;
    }

    const ticket = ticketRes.rows[0];

    // Find linked students by parent email or user ID
    const studentsRes = await pool.query(
      `SELECT DISTINCT e.*, u_e.documento, u_e.id_tipodocumento, td.tipo AS tipo_documento_nombre
       FROM estudiante e
       LEFT JOIN usuario u_e ON e.id_usuario = u_e.id_usuario
       LEFT JOIN tipo_documento td ON u_e.id_tipodocumento = td.id_tipodocumento
       LEFT JOIN detalle_padrefamilia dp ON e.id_estudiante = dp.id_estudiante
       LEFT JOIN padre_familia pf ON dp.id_padrefamilia = pf.id_padrefamilia
       LEFT JOIN usuario u ON pf.id_usuario = u.id_usuario
       WHERE e.id_colegio = $1 
         AND (e.id_estudiante = $3 OR u.email = $2 OR u.documento = $2 OR u.id_usuario = $4)
         AND e.estado = 'RETIRADO'`,
      [schoolId, ticket.correo_remitente, ticket.id_estudiante || null, ticket.id_usuario || null]
    );

    let gradoPretendido: { id_tipo_grado: number; nombre: string } | null = null;
    try {
      if (ticket.observaciones) {
        const obsArr = typeof ticket.observaciones === 'string' ? JSON.parse(ticket.observaciones) : ticket.observaciones;
        if (Array.isArray(obsArr)) {
          const foundObs = obsArr.find((o: any) => o.id_tipo_grado_pretendido);
          if (foundObs && foundObs.id_tipo_grado_pretendido) {
            const grRes = await pool.query(
              `SELECT id_tipo_grado, nombre FROM tipo_grado WHERE id_tipo_grado = $1`,
              [foundObs.id_tipo_grado_pretendido]
            );
            if (grRes.rows.length > 0) {
              gradoPretendido = {
                id_tipo_grado: grRes.rows[0].id_tipo_grado,
                nombre: grRes.rows[0].nombre
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
      suggestedStudents: studentsRes.rows,
      gradoPretendido
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
    observaciones
  } = req.body;

  if (!id_estudiante || !id_nivel || !id_grupo || !id_anio || !correo_padre) {
    res.status(400).json({ error: "Los campos id_estudiante, id_nivel, id_grupo, id_anio y correo_padre son obligatorios" });
    return;
  }

  if (!id_ticket && !declaracion_presencial) {
    res.status(400).json({ 
      error: "Por gobernanza de consentimiento, el trámite debe originarse desde un Ticket de solicitud del acudiente o contar con la declaración de atención presencial en secretaría." 
    });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check student status
    const studentRes = await client.query(
      "SELECT estado, nombre, apellido FROM estudiante WHERE id_estudiante = $1 AND id_colegio = $2",
      [id_estudiante, schoolId]
    );

    if (studentRes.rows.length === 0) {
      res.status(404).json({ error: "Estudiante no encontrado en la institución" });
      return;
    }

    const student = studentRes.rows[0];

    if (student.estado === 'EXPULSADO' || student.estado === 'GRADUADO' || student.estado === 'SANCIONADO') {
      res.status(400).json({ error: `El estudiante se encuentra en estado '${student.estado}'${student.estado === 'SANCIONADO' ? ' (Sanción disciplinaria activa)' : ''} y no es elegible para reingreso hasta que la situación se resuelva.` });
      return;
    }

    // Auto-create audit ticket if processing presencial atención without existing ticket
    let finalTicketId = id_ticket ? Number(id_ticket) : null;
    if (!finalTicketId && declaracion_presencial) {
      const presencialTicketRes = await client.query(
        `INSERT INTO tickets_soporte
           (id_usuario, nombre_remitente, correo_remitente, tipo_incidencia, asunto, descripcion, id_colegio, estado, id_estudiante)
         VALUES ($1, $2, $3, 'REINGRESO', 'Atención Presencial en Secretaría - Reingreso', $4, $5, 'EN_PROCESO', $6)
         RETURNING id_ticket`,
        [
          authReq.user!.id,
          'Atención Presencial (Secretaría)',
          correo_padre,
          `Trámite de reingreso iniciado directamente en secretaría para ${student.nombre} ${student.apellido}. Declaración de consentimiento confirmada por el directivo.`,
          schoolId,
          id_estudiante
        ]
      );
      finalTicketId = presencialTicketRes.rows[0].id_ticket;
    }

    // Auto-update student state to RETIRADO if currently active, to prepare for re-admission
    if (student.estado !== 'RETIRADO') {
      await client.query(
        "UPDATE estudiante SET estado = 'RETIRADO', motivo_estado = 'Trámite de reingreso lectivo iniciado' WHERE id_estudiante = $1",
        [id_estudiante]
      );
    }

    // Check duplicate active/pending enrollment
    const dupRes = await client.query(
      `SELECT id_matricula FROM matricula 
       WHERE id_estudiante = $1 AND id_colegio = $2 AND id_anio = $3 AND estado IN ('ACTIVA', 'PENDIENTE', 'CORRECCION')`,
      [id_estudiante, schoolId, id_anio]
    );

    if (dupRes.rows.length > 0) {
      res.status(400).json({ error: "El estudiante ya posee un trámite de matrícula activo para este año lectivo" });
      return;
    }

    // Insert matricula with PENDIENTE status and REINGRESO type
    const matRes = await client.query(
      `INSERT INTO matricula 
         (id_estudiante, id_nivel, id_grupo, id_colegio, id_anio, estado, correo_padre, tipo, observaciones, id_usuario_responsable, id_ticket, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, 'PENDIENTE', $6, 'REINGRESO', $7, $8, $9, NOW())
       RETURNING *`,
      [
        id_estudiante,
        id_nivel,
        id_grupo,
        schoolId,
        id_anio,
        correo_padre,
        observaciones || 'Matrícula de reingreso autorizada por directivo',
        authReq.user!.id,
        finalTicketId
      ]
    );

    const newMat = matRes.rows[0];

    // Save document configuration matrix
    if (Array.isArray(document_config)) {
      for (const item of document_config) {
        await client.query(
          `INSERT INTO documento_matriculas 
             (id_matricula, tipo_documento, url, estado, fecha, id_colegio, version, estado_renovacion)
           VALUES ($1, $2, $3, $4, NOW(), $5, 1, $6)`,
          [
            newMat.id_matricula,
            item.tipo_documento,
            item.url || 'PENDIENTE',
            item.estado_renovacion === 'VIGENTE' ? 'VALIDADO' : 'PENDIENTE',
            schoolId,
            item.estado_renovacion || 'VIGENTE'
          ]
        );
      }
    }

    // Update support ticket if attached
    if (id_ticket) {
      await client.query(
        `UPDATE tickets_soporte SET estado = 'EN_PROCESO' WHERE id_ticket = $1 AND id_colegio = $2`,
        [id_ticket, schoolId]
      );
    }

    // Send email to parent
    await NotificationService.sendReingresoApprovalEmail(
      correo_padre,
      `${student.nombre} ${student.apellido}`,
      newMat.token_seguimiento
    );

    await client.query("COMMIT");

    res.json({
      message: "Solicitud de reingreso preparada exitosamente y notificación enviada al acudiente.",
      matricula: newMat
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in sendReingresoParentLink:", error);
    res.status(500).json({ error: "Error en el servidor al enviar enlace de reingreso" });
  } finally {
    client.release();
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ticketRes = await client.query(
      `SELECT * FROM tickets_soporte WHERE id_ticket = $1 AND id_colegio = $2`,
      [id, schoolId]
    );

    if (ticketRes.rows.length === 0) {
      res.status(404).json({ error: "Ticket de soporte no encontrado" });
      return;
    }

    const ticket = ticketRes.rows[0];

    // Send notification email explaining that student is not found and must register as new
    await NotificationService.sendNonExistentStudentEmail(
      ticket.correo_remitente,
      ticket.nombre_remitente,
      motivo || 'No se encontraron antecedentes académicos del estudiante en el plantel.'
    );

    // Update ticket status to RESUELTO
    await client.query(
      `UPDATE tickets_soporte SET estado = 'RESUELTO' WHERE id_ticket = $1`,
      [id]
    );

    await client.query("COMMIT");

    res.json({ message: "Notificación enviada exitosamente al usuario y ticket resuelto." });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in notifyNonExistentStudent:", error);
    res.status(500).json({ error: "Error al enviar notificación de estudiante no existente" });
  } finally {
    client.release();
  }
};

export const getReingresoCatalogs = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as any;
  const schoolId = (req.query.schoolId ? Number(req.query.schoolId) : null) || authReq.user?.schoolId;

  try {
    let yearsRes = { rows: [] as any[] };
    let levelsRes = { rows: [] as any[] };

    if (schoolId) {
      yearsRes = await pool.query(
        `SELECT id_anio, calendario AS anio, estado 
         FROM anio_lectivo 
         WHERE id_colegio = $1 
         ORDER BY CASE WHEN estado = 'ABIERTO' THEN 0 ELSE 1 END, id_anio DESC`,
        [schoolId]
      );

      levelsRes = await pool.query(
        `SELECT id_nivel, nombre 
         FROM nivel_escolar 
         WHERE id_colegio = $1 OR id_colegio IS NULL 
         ORDER BY id_nivel`,
        [schoolId]
      );
    }

    const rawGradosRes = await pool.query(
      `SELECT id_tipo_grado, nombre, id_nivel 
       FROM tipo_grado 
       ORDER BY id_tipo_grado`
    );

    const gradeOrderMap: Record<string, number> = {
      'PARVULOS': 1,
      'PREJARDIN': 2,
      'PRE-JARDIN': 2,
      'JARDIN': 3,
      'TRANSICION': 4,
      'TRANSICIÓN': 4,
      'PRIMERO': 5,
      'SEGUNDO': 6,
      'TERCERO': 7,
      'CUARTO': 8,
      'QUINTO': 9,
      'SEXTO': 10,
      'SEPTIMO': 11,
      'SÉPTIMO': 11,
      'OCTAVO': 12,
      'NOVENO': 13,
      'DECIMO': 14,
      'DÉCIMO': 14,
      'ONCE': 15,
      'DOCE': 16
    };

    const seenNames = new Set<string>();
    const uniqueGrados: any[] = [];

    for (const g of rawGradosRes.rows) {
      const normalizedName = (g.nombre || '').trim().toUpperCase();
      if (!seenNames.has(normalizedName)) {
        seenNames.add(normalizedName);
        uniqueGrados.push(g);
      }
    }

    uniqueGrados.sort((a, b) => {
      const orderA = gradeOrderMap[(a.nombre || '').trim().toUpperCase()] || 99;
      const orderB = gradeOrderMap[(b.nombre || '').trim().toUpperCase()] || 99;
      return orderA - orderB;
    });

    res.json({
      anios: yearsRes.rows,
      years: yearsRes.rows,
      niveles: levelsRes.rows,
      grados: uniqueGrados
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
    const groupsRes = await pool.query(
      `SELECT g.id_grupo, 
              g.id_tipo_grado,
              g.id_nivel,
              tg.nombre AS grado_nombre,
              s.nombre AS seccion_nombre,
              CONCAT(tg.nombre, ' - ', s.nombre) AS nombre,
              COALESCE(g.cupos_totales, 35) AS cupos_totales,
              COALESCE(m_cnt.cnt, 0)::int AS matriculados,
              GREATEST(0, COALESCE(g.cupos_totales, 35) - COALESCE(m_cnt.cnt, 0)::int) AS cupos_disponibles
       FROM grupos g
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       JOIN secciones s ON g.id_seccion = s.id_seccion
       LEFT JOIN (
         SELECT id_grupo, COUNT(*)::int AS cnt 
         FROM matricula 
         WHERE estado IN ('ACTIVA', 'PENDIENTE') 
         GROUP BY id_grupo
       ) m_cnt ON g.id_grupo = m_cnt.id_grupo
       WHERE g.id_colegio = $1 AND g.id_nivel = $2
       ORDER BY tg.id_tipo_grado, s.nombre`,
      [schoolId, nivelId]
    );

    res.json(groupsRes.rows);
  } catch (error: any) {
    console.error("Error in getReingresoGroups:", error);
    res.status(500).json({ error: "Error al consultar grupos para reingreso" });
  }
};
