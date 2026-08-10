import { Request, Response } from "express";
import { PoolClient } from "pg";
import { pool } from "../../config/db";
import { db } from "../../config/kysely";
import { sql } from "kysely";
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

export const createTeacher = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const nombre = String(req.body.nombre || "").trim();
  const apellido = String(req.body.apellido || "").trim();
  const documento = normalizeDocument(req.body.documento);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const documentTypeId = Number(req.body.id_tipodocumento);
  let schoolName = "la institución";

  if (!schoolId || !nombre || !apellido || !documento || !email || !password || !documentTypeId) {
    res.status(400).json({ error: "Todos los campos del docente son obligatorios" });
    return;
  }

  // 1. Validar formato de documento según el tipo (CC, TI, RC, CE, PEP, Pasaporte)
  const docFormatCheck = validateDocumentFormatByTipo(documento, documentTypeId);
  if (!docFormatCheck.isValid) {
    res.status(400).json({ error: docFormatCheck.error });
    return;
  }

  // 2. Validar formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: `El correo electrónico '${email}' no tiene un formato válido.` });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para registrar docentes en este colegio." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const documentTypeRes = await db
      .selectFrom("tipo_documento")
      .select(["id_tipodocumento", "tipo"])
      .where("id_tipodocumento", "=", documentTypeId)
      .executeTakeFirst();
    if (!documentTypeRes) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Tipo de documento no encontrado" });
      return;
    }

    const roleRes = await db
      .selectFrom("rol")
      .select("id_rol")
      .where(sql<string>`LOWER(nombre)`, "=", "docente")
      .executeTakeFirst();
    if (!roleRes) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "No existe el rol docente configurado en el sistema" });
      return;
    }

    const schoolRes = await db
      .selectFrom("colegio")
      .select("nombre")
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();
    schoolName = schoolRes?.nombre || schoolName;

    // Buscar si ya existe un registro de docente en la misma institución con ese documento
    const existingTeacherRes = await db
      .selectFrom("docente as d")
      .innerJoin("usuario as u", "u.id_usuario", "d.id_usuario")
      .select("d.id_docente")
      .where("d.id_colegio", "=", schoolId)
      .where(sql<string>`UPPER(TRIM(u.documento))`, "=", documento.toUpperCase().trim())
      .executeTakeFirst();

    if (existingTeacherRes) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: `Ya existe un docente registrado con el documento de identidad ${documento} en esta institución.` });
      return;
    }

    // Buscar usuario en el sistema por documento y por email
    const userByDoc = await db
      .selectFrom("usuario as u")
      .select([
        "u.id_usuario",
        "u.email",
        sql<boolean>`COALESCE(u.activo, true)`.as("activo"),
        "u.nombre",
        "u.apellido",
        "u.documento",
        "u.id_tipodocumento",
      ])
      .where(sql<string>`UPPER(TRIM(u.documento))`, "=", documento.toUpperCase().trim())
      .executeTakeFirst();

    const userByEmail = await db
      .selectFrom("usuario as u")
      .select([
        "u.id_usuario",
        "u.email",
        sql<boolean>`COALESCE(u.activo, true)`.as("activo"),
        "u.nombre",
        "u.apellido",
        "u.documento",
        "u.id_tipodocumento",
      ])
      .where(sql<string>`LOWER(TRIM(u.email))`, "=", email)
      .executeTakeFirst();

    // Si coinciden con dos usuarios distintos en el sistema: error de cruce de datos
    if (userByDoc && userByEmail && userByDoc.id_usuario !== userByEmail.id_usuario) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `El documento de identidad ${documento} pertenece a '${userByDoc.nombre} ${userByDoc.apellido}', mientras que el correo '${email}' pertenece a un usuario diferente ('${userByEmail.nombre} ${userByEmail.apellido}'). No se pueden asociar datos de dos personas distintas.`
      });
      return;
    }

    const existingUser = userByDoc || userByEmail;

    if (existingUser) {
      // VALIDACIÓN DE INTEGRIDAD DE DATOS PERSONALES
      // No se permite modificar Nombres, Apellidos, Tipo o Número de Documento de un usuario existente.
      const normNombreReq = nombre.toLowerCase().trim();
      const normApellidoReq = apellido.toLowerCase().trim();
      const normNombreExist = (existingUser.nombre || "").toLowerCase().trim();
      const normApellidoExist = (existingUser.apellido || "").toLowerCase().trim();
      const normDocExist = normalizeDocument(existingUser.documento);
      const tipoDocExist = Number(existingUser.id_tipodocumento);

      const nameMismatch = normNombreExist && normNombreReq !== normNombreExist;
      const surnameMismatch = normApellidoExist && normApellidoReq !== normApellidoExist;
      const docMismatch = normDocExist && documento !== normDocExist;
      const tipoDocMismatch = tipoDocExist && documentTypeId !== tipoDocExist;

      if (nameMismatch || surnameMismatch || docMismatch || tipoDocMismatch) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: `Los datos personales ingresados no coinciden con la persona registrada en el sistema (${existingUser.nombre} ${existingUser.apellido}, Doc: ${existingUser.documento}). No se permite alterar el nombre, apellido, tipo o número de documento de un usuario existente.`
        });
        return;
      }

      // Si el correo ingresado difiere del del usuario existente pero está en uso por otro usuario distinto
      if (email !== (existingUser.email || "").toLowerCase().trim() && userByEmail && userByEmail.id_usuario !== existingUser.id_usuario) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: `El correo '${email}' ya está registrado por otro usuario en la plataforma.` });
        return;
      }

      const userRolesRes = await client.query(
        `SELECT r.nombre 
         FROM usuario_rol ur
         JOIN rol r ON r.id_rol = ur.id_rol
         WHERE ur.id_usuario = $1`,
        [existingUser.id_usuario]
      );
      const roles = userRolesRes.rows.map((row: any) => row.nombre.toLowerCase().trim());
      const isParent = roles.includes("padre");
      const isDocente = roles.includes("docente");

      if (isDocente) {
        const teacherInSchool = await client.query(
          `SELECT id_docente FROM docente WHERE id_usuario = $1 AND id_colegio = $2`,
          [existingUser.id_usuario, schoolId]
        );
        if (teacherInSchool.rows.length > 0) {
          await client.query("ROLLBACK");
          res.status(409).json({ error: `El usuario (${existingUser.nombre} ${existingUser.apellido}) ya está registrado como docente en esta institución.` });
          return;
        }
      }

      const addRoleIfParent = Boolean(req.body.addRoleIfParent);
      const parentFullName = `${existingUser.nombre} ${existingUser.apellido}`.trim();

      if (isParent && !addRoleIfParent && email === (existingUser.email || "").toLowerCase().trim()) {
        await client.query("ROLLBACK");
        res.status(409).json({
          isParent: true,
          message: `El correo "${email}" pertenece a un Padre de Familia registrado (${parentFullName}). ¿Desea vincular esta cuenta existente también como Docente?`
        });
        return;
      }

      // Agregar rol 'docente' al usuario existente
      await client.query(
        `INSERT INTO usuario_rol (id_usuario, id_rol)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [existingUser.id_usuario, roleRes.id_rol]
      );

      await client.query(
        `INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio)
         VALUES ($1, $2, $3, 'ACTIVO', NOW()) ON CONFLICT DO NOTHING`,
        [existingUser.id_usuario, schoolId, roleRes.id_rol]
      );

      // Si el directivo especificó un correo institucional nuevo para sus funciones de docente, actualizamos su correo de acceso
      if (email !== (existingUser.email || "").toLowerCase().trim()) {
        await client.query(
          `UPDATE usuario SET email = $1 WHERE id_usuario = $2`,
          [email, existingUser.id_usuario]
        );
      }

      const teacherRes = await client.query(
        `INSERT INTO docente (nombre, apellido, id_colegio, id_usuario, estado)
         VALUES ($1, $2, $3, $4, 'ACTIVO')
         RETURNING id_docente, nombre, apellido, estado`,
        [existingUser.nombre, existingUser.apellido, schoolId, existingUser.id_usuario]
      );

      await client.query("COMMIT");

      await NotificationService.sendTeacherWelcomeEmail(
        email,
        parentFullName,
        schoolName,
        documentTypeRes.tipo,
        existingUser.documento || documento,
        password
      );

      res.status(201).json({
        ...teacherRes.rows[0],
        documento: existingUser.documento || documento,
        id_tipodocumento: existingUser.id_tipodocumento || documentTypeId,
        tipo_documento: documentTypeRes.tipo,
        email,
        activo: existingUser.activo,
        estado: teacherRes.rows[0].estado,
        asignaciones_count: 0
      });
      return;
    }

    // CASO 2: Persona y usuario completamente nuevos
    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, id_tipodocumento, documento)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_usuario, email, activo`,
      [email, passwordHash, nombre, apellido, schoolId, documentTypeId, documento]
    );

    await client.query(
      `INSERT INTO usuario_rol (id_usuario, id_rol)
       VALUES ($1, $2)`,
      [userRes.rows[0].id_usuario, roleRes.id_rol]
    );

    await client.query(
      `INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio)
       VALUES ($1, $2, $3, 'ACTIVO', NOW()) ON CONFLICT DO NOTHING`,
      [userRes.rows[0].id_usuario, schoolId, roleRes.id_rol]
    );

    const teacherRes = await client.query(
      `INSERT INTO docente (nombre, apellido, id_colegio, id_usuario, estado)
       VALUES ($1, $2, $3, $4, 'ACTIVO')
       RETURNING id_docente, nombre, apellido, estado`,
      [nombre, apellido, schoolId, userRes.rows[0].id_usuario]
    );

    await client.query("COMMIT");

    await NotificationService.sendTeacherWelcomeEmail(
      userRes.rows[0].email,
      `${nombre} ${apellido}`,
      schoolName,
      documentTypeRes.tipo,
      documento,
      password
    );

    res.status(201).json({
      ...teacherRes.rows[0],
      documento,
      id_tipodocumento: documentTypeId,
      tipo_documento: documentTypeRes.tipo,
      email: userRes.rows[0].email,
      activo: userRes.rows[0].activo,
      estado: teacherRes.rows[0].estado,
      asignaciones_count: 0,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error en createTeacher:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error, "Error al registrar el docente") });
  } finally {
    client.release();
  }
};

export const updateTeacher = async (req: Request, res: Response): Promise<void> => {
  const teacherId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const nombre = String(req.body.nombre || "").trim();
  const apellido = String(req.body.apellido || "").trim();
  const documento = normalizeDocument(req.body.documento);
  const email = String(req.body.email || "").trim().toLowerCase();
  const documentTypeId = Number(req.body.id_tipodocumento);

  if (!teacherId || !schoolId || !nombre || !apellido || !documento || !email || !documentTypeId) {
    res.status(400).json({ error: "Todos los campos son obligatorios" });
    return;
  }

  // 1. Validar formato del documento según su tipo
  const docCheck = validateDocumentFormatByTipo(documento, documentTypeId);
  if (!docCheck.isValid) {
    res.status(400).json({ error: docCheck.error });
    return;
  }

  // 2. Validar formato del email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: `El correo electrónico '${email}' no tiene un formato válido.` });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Obtenemos los datos del docente y su usuario asociado
    const teacherRes = await client.query(
      `SELECT d.id_docente, d.id_usuario, u.nombre, u.apellido, u.documento, u.id_tipodocumento, u.email
       FROM docente d
       JOIN usuario u ON u.id_usuario = d.id_usuario
       WHERE d.id_docente = $1 AND d.id_colegio = $2`,
      [teacherId, schoolId]
    );

    if (teacherRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Docente no encontrado" });
      return;
    }

    const currentTeacher = teacherRes.rows[0];
    const { id_usuario } = currentTeacher;

    // Verificar si el usuario es también Padre de Familia
    const isParentRes = await client.query(
      `SELECT 1 
       FROM usuario_rol ur 
       JOIN rol r ON r.id_rol = ur.id_rol 
       WHERE ur.id_usuario = $1 AND LOWER(r.nombre) = 'padre'
       LIMIT 1`,
      [id_usuario]
    );
    const isParent = isParentRes.rows.length > 0;

    if (isParent) {
      const normNombreReq = nombre.toLowerCase();
      const normApellidoReq = apellido.toLowerCase();
      const normNombreCur = (currentTeacher.nombre || "").toLowerCase().trim();
      const normApellidoCur = (currentTeacher.apellido || "").toLowerCase().trim();
      const normDocCur = normalizeDocument(currentTeacher.documento);
      const tipoDocCur = Number(currentTeacher.id_tipodocumento);

      if (
        (normNombreCur && normNombreReq !== normNombreCur) ||
        (normApellidoCur && normApellidoReq !== normApellidoCur) ||
        (normDocCur && documento !== normDocCur) ||
        (tipoDocCur && documentTypeId !== tipoDocCur)
      ) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: "Este docente también está registrado como Padre de Familia. Sus datos personales no pueden modificarse desde este módulo; debe realizar el cambio desde la Gestión de Padres de Familia."
        });
        return;
      }
    }

    // Verificar si otro docente en este colegio usa el mismo documento
    const duplicateDoc = await client.query(
      `SELECT d.id_docente 
       FROM docente d 
       JOIN usuario u ON d.id_usuario = u.id_usuario 
       WHERE d.id_colegio = $1 AND UPPER(TRIM(u.documento)) = $2 AND d.id_docente != $3`,
      [schoolId, documento, teacherId]
    );
    if (duplicateDoc.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Ya existe otro docente con ese número de documento en este colegio." });
      return;
    }

    // Verificar si otro usuario tiene el nuevo correo especificado
    if (id_usuario) {
      const duplicateEmail = await client.query(
        `SELECT id_usuario FROM usuario WHERE LOWER(TRIM(email)) = $1 AND id_usuario != $2`,
        [email, id_usuario]
      );
      if (duplicateEmail.rows.length > 0) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: `El correo '${email}' ya está registrado por otro usuario en la plataforma.` });
        return;
      }

      // Actualizar usuario (si es padre, nombre/apellido/doc se mantienen iguales, sólo se actualiza email)
      await client.query(
        `UPDATE usuario 
         SET nombre = $1, apellido = $2, email = $3, id_tipodocumento = $4, documento = $5
         WHERE id_usuario = $6`,
        [
          isParent ? currentTeacher.nombre : nombre,
          isParent ? currentTeacher.apellido : apellido,
          email,
          isParent ? currentTeacher.id_tipodocumento : documentTypeId,
          isParent ? currentTeacher.documento : documento,
          id_usuario
        ]
      );
    }

    // Actualizar tabla docente
    await client.query(
      `UPDATE docente 
       SET nombre = $1, apellido = $2
       WHERE id_docente = $3`,
      [isParent ? currentTeacher.nombre : nombre, isParent ? currentTeacher.apellido : apellido, teacherId]
    );

    await client.query("COMMIT");
    res.json({ message: "Docente actualizado con éxito." });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error en updateTeacher:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error, "Error al actualizar docente") });
  } finally {
    client.release();
  }
};

export const deleteTeacher = async (req: Request, res: Response): Promise<void> => {
  const teacherId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId);

  if (!teacherId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get teacher and their user id
    const teacherRes = await client.query(
      `SELECT id_usuario, nombre, apellido FROM docente WHERE id_docente = $1 AND id_colegio = $2`,
      [teacherId, schoolId]
    );

    if (teacherRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Docente no encontrado" });
      return;
    }

    const { id_usuario, nombre, apellido } = teacherRes.rows[0];

    // Check if the user has other roles (like 'padre')
    let hasOtherRoles = false;
    if (id_usuario) {
      const rolesRes = await client.query(
        `SELECT COUNT(*)::int AS count 
         FROM usuario_rol ur
         JOIN rol r ON r.id_rol = ur.id_rol
         WHERE ur.id_usuario = $1 AND LOWER(r.nombre) != 'docente'`,
        [id_usuario]
      );
      if (rolesRes.rows[0].count > 0) {
        hasOtherRoles = true;
      }
    }

    // Bypass period-closed triggers for this admin delete operation
    // This is safe because we are inside a transaction that will rollback on any error
    await client.query(`SET LOCAL session_replication_role = 'replica'`);

    // 1. Set id_docente to NULL in grupos (director de grupo)
    await client.query(`UPDATE grupos SET id_docente = NULL WHERE id_docente = $1`, [teacherId]);

    // 2. Fetch all assignments for this teacher
    const assignmentsRes = await client.query(
      `SELECT id_detallegrado FROM detalle_grados WHERE id_docente = $1`,
      [teacherId]
    );
    const detailIds = assignmentsRes.rows.map((row: any) => row.id_detallegrado);

    if (detailIds.length > 0) {
      // Fetch all actividad_materia IDs for these assignments
      const actividadRes = await client.query(
        `SELECT id_actividadmateria FROM actividad_materia WHERE id_detallegrado = ANY($1)`,
        [detailIds]
      );
      const actividadIds = actividadRes.rows.map((r: any) => r.id_actividadmateria);

      if (actividadIds.length > 0) {
        // 3a. Delete from notas_actividad (correct table name)
        await client.query(
          `DELETE FROM notas_actividad WHERE id_actividadmateria = ANY($1)`,
          [actividadIds]
        );

        // 3b. Delete from desempeno
        await client.query(
          `DELETE FROM desempeno WHERE id_actividadmateria = ANY($1)`,
          [actividadIds]
        );

        // 3c. Delete from criterio_evaluacion
        await client.query(
          `DELETE FROM criterio_evaluacion WHERE id_actividadmateria = ANY($1)`,
          [actividadIds]
        );

        // 3d. Delete from actividad_evidencia_dba
        await client.query(
          `DELETE FROM actividad_evidencia_dba WHERE id_actividadmateria = ANY($1)`,
          [actividadIds]
        );
      }

      // 4. Delete from actividad_materia
      await client.query(
        `DELETE FROM actividad_materia WHERE id_detallegrado = ANY($1)`,
        [detailIds]
      );

      // 5. Delete from cierre_materia
      await client.query(
        `DELETE FROM cierre_materia WHERE id_detallegrado = ANY($1)`,
        [detailIds]
      );

      // 6. Delete from observacion_estudiante
      await client.query(
        `DELETE FROM observacion_estudiante WHERE id_detallegrado = ANY($1)`,
        [detailIds]
      );

      // 7. Delete from registro_asistencia (no child tables)
      await client.query(
        `DELETE FROM registro_asistencia WHERE id_detallegrado = ANY($1)`,
        [detailIds]
      );

      // 8. Delete from resultado_academico
      await client.query(
        `DELETE FROM resultado_academico WHERE id_detallegrado = ANY($1)`,
        [detailIds]
      );

      // 9. Delete from detalle_grados
      await client.query(
        `DELETE FROM detalle_grados WHERE id_docente = $1`,
        [teacherId]
      );
    }

    // Delete teacher record
    await client.query(`DELETE FROM docente WHERE id_docente = $1`, [teacherId]);

    // Delete user record (which cascades to user roles)
    if (id_usuario) {
      if (hasOtherRoles) {
        // Just remove the 'docente' role from usuario_rol
        const roleRes = await client.query(`SELECT id_rol FROM rol WHERE LOWER(nombre) = 'docente' LIMIT 1`);
        if (roleRes.rows.length > 0) {
          await client.query(
            `DELETE FROM usuario_rol WHERE id_usuario = $1 AND id_rol = $2`,
            [id_usuario, roleRes.rows[0].id_rol]
          );
        }
      } else {
        await client.query(`DELETE FROM usuario WHERE id_usuario = $1`, [id_usuario]);
      }
    }

    await client.query("COMMIT");
    res.json({ message: `Docente ${nombre} ${apellido} eliminado con éxito.` });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error deleting teacher:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const updateTeacherStatus = async (req: Request, res: Response): Promise<void> => {
  const teacherId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const estado = String(req.body.estado || "").trim().toUpperCase();
  const reason = String(req.body.reason || "").trim();

  if (!teacherId || !schoolId || !["ACTIVO", "INACTIVO", "DESVINCULADO"].includes(estado)) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    await ensureTeacherStatusColumn();
    const teacherRes = await pool.query(
      `SELECT
         d.id_docente,
         d.nombre,
         d.apellido,
         d.estado,
         u.id_usuario,
         u.email,
         c.nombre AS colegio_nombre
       FROM docente d
       JOIN usuario u ON u.id_usuario = d.id_usuario
       JOIN colegio c ON c.id_colegio = d.id_colegio
       WHERE d.id_docente = $1
         AND d.id_colegio = $2`,
      [teacherId, schoolId]
    );

    if (teacherRes.rows.length === 0) {
      res.status(404).json({ error: "Docente no encontrado" });
      return;
    }

    const active = estado === "ACTIVO";

    await pool.query(
      `UPDATE usuario SET activo = $1 WHERE id_usuario = $2`,
      [active, teacherRes.rows[0].id_usuario]
    );

    await pool.query(
      `UPDATE docente
       SET estado = $1
       WHERE id_docente = $2`,
      [estado, teacherId]
    );

    if (estado === "DESVINCULADO") {
      await pool.query(
        `DELETE FROM detalle_grados
         WHERE id_docente = $1
           AND id_colegio = $2`,
        [teacherId, schoolId]
      );
    }

    await NotificationService.sendTeacherStatusEmail(
      teacherRes.rows[0].email,
      `${teacherRes.rows[0].nombre} ${teacherRes.rows[0].apellido}`,
      teacherRes.rows[0].colegio_nombre,
      estado,
      reason || undefined
    );

    res.json({
      message:
        estado === "ACTIVO"
          ? "Docente activado correctamente"
          : estado === "INACTIVO"
            ? "Docente inactivado correctamente"
            : "Docente desvinculado correctamente",
    });
  } catch (error: any) {
    console.error("Error updating teacher status:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getTeacherManagementData = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  const yearId = req.query.yearId ? Number(req.query.yearId) : null;
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para acceder a la gestión de docentes de este colegio." });
    return;
  }

  try {
    const [documentTypesRes, teachersRes, subjectsRes, groupsRes, assignmentsRes] = await Promise.all([
      db
        .selectFrom("tipo_documento")
        .select(["id_tipodocumento", "tipo"])
        .orderBy("tipo", "asc")
        .execute(),
      db
        .selectFrom("docente as d")
        .leftJoin("usuario as u", "u.id_usuario", "d.id_usuario")
        .leftJoin("tipo_documento as td", "td.id_tipodocumento", "u.id_tipodocumento")
        .leftJoin("detalle_grados as dg", "dg.id_docente", "d.id_docente")
        .select([
          "d.id_docente",
          "d.nombre",
          "d.apellido",
          "u.documento",
          "u.id_tipodocumento",
          "td.tipo as tipo_documento",
          "d.estado",
          "u.id_usuario",
          "u.email",
          sql<boolean>`COALESCE(u.activo, true)`.as("activo"),
          db
            .selectFrom("padre_familia as pf")
            .innerJoin("usuario as u_parent", "u_parent.id_usuario", "pf.id_usuario")
            .select("u_parent.email")
            .where(sql`pf.id_usuario = d.id_usuario`)
            .limit(1)
            .as("email_padre"),
          sql<boolean>`EXISTS (
            SELECT 1 
            FROM usuario_rol ur 
            JOIN rol r ON r.id_rol = ur.id_rol 
            WHERE ur.id_usuario = d.id_usuario AND LOWER(r.nombre) = 'padre'
          )`.as("es_padre"),
          sql<number>`COUNT(DISTINCT CASE WHEN ${yearId}::int IS NULL OR dg.id_anio = ${yearId} THEN dg.id_detallegrado END)::int`.as("asignaciones_count")
        ])
        .where("d.id_colegio", "=", schoolId)
        .groupBy([
          "d.id_docente",
          "u.documento",
          "u.id_tipodocumento",
          "td.tipo",
          "d.estado",
          "u.id_usuario",
          "u.email",
          "u.activo"
        ])
        .orderBy("d.nombre", "asc")
        .orderBy("d.apellido", "asc")
        .execute(),
      db
        .selectFrom("materias")
        .select(["id_materia", "nombre"])
        .where("id_colegio", "=", schoolId)
        .orderBy("nombre", "asc")
        .execute(),
      db
        .selectFrom("grupos as g")
        .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
        .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
        .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
        .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
        .select([
          "g.id_grupo",
          "ne.nombre as nivel_nombre",
          "tg.nombre as tipo_grado_nombre",
          "s.nombre as seccion_nombre",
          "j.nombre as jornada_nombre"
        ])
        .where("g.id_colegio", "=", schoolId)
        .orderBy("ne.nombre", "asc")
        .orderBy("tg.nombre", "asc")
        .orderBy(sql`LENGTH(s.nombre)`, "asc")
        .orderBy("s.nombre", "asc")
        .orderBy("j.nombre", "asc")
        .execute(),
      db
        .selectFrom("detalle_grados as dg")
        .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
        .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
        .innerJoin("grupos as g", "g.id_grupo", "dg.id_grupo")
        .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
        .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
        .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
        .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
        .select([
          "dg.id_detallegrado",
          "dg.id_docente",
          "dg.id_materia",
          "dg.id_grupo",
          "m.nombre as materia_nombre",
          "d.nombre as docente_nombre",
          "d.apellido as docente_apellido",
          "ne.nombre as nivel_nombre",
          "tg.nombre as tipo_grado_nombre",
          "s.nombre as seccion_nombre",
          "j.nombre as jornada_nombre"
        ])
        .where("dg.id_colegio", "=", schoolId)
        .where("dg.id_grupo", "is not", null)
        .where((eb) =>
          yearId ? eb("dg.id_anio", "=", yearId) : eb.val(true)
        )
        .orderBy("d.nombre", "asc")
        .orderBy("d.apellido", "asc")
        .orderBy("ne.nombre", "asc")
        .orderBy("tg.nombre", "asc")
        .orderBy("m.nombre", "asc")
        .execute(),
    ]);

    res.json({
      documentTypes: documentTypesRes,
      teachers: teachersRes,
      docentes: teachersRes,
      subjects: subjectsRes,
      groups: groupsRes,
      assignments: assignmentsRes,
    });
  } catch (error: any) {
    console.error("Error fetching teacher management data:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const assignTeacherCourseSubject = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const teacherId = Number(req.body.id_docente);
  const subjectId = Number(req.body.id_materia);
  const groupId = Number(req.body.id_grupo);
  const replaceExisting = Boolean(req.body.replaceExisting);

  if (!schoolId || !teacherId || !subjectId || !groupId) {
    res.status(400).json({ error: "Docente, materia y curso son obligatorios" });
    return;
  }

  try {
    const validationRes = await pool.query(
      `SELECT
         EXISTS(SELECT 1 FROM docente WHERE id_docente = $1 AND id_colegio = $4) AS teacher_ok,
         EXISTS(SELECT 1 FROM materias WHERE id_materia = $2 AND id_colegio = $4) AS subject_ok,
         EXISTS(SELECT 1 FROM grupos WHERE id_grupo = $3 AND id_colegio = $4) AS group_ok`,
      [teacherId, subjectId, groupId, schoolId]
    );

    const validation = validationRes.rows[0];
    if (!validation.teacher_ok || !validation.subject_ok || !validation.group_ok) {
      res.status(400).json({ error: "La asignación solicitada no es válida para este colegio" });
      return;
    }

    const contextRes = await pool.query(
      `SELECT
         c.nombre AS colegio_nombre,
         u.email,
         d.nombre,
         d.apellido,
         m.nombre AS materia_nombre,
         ne.nombre AS nivel_nombre,
         tg.nombre AS tipo_grado_nombre,
         s.nombre AS seccion_nombre,
         j.nombre AS jornada_nombre
       FROM docente d
       JOIN usuario u ON u.id_usuario = d.id_usuario
       JOIN colegio c ON c.id_colegio = d.id_colegio
       JOIN materias m ON m.id_materia = $2
       JOIN grupos g ON g.id_grupo = $3
       JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
       JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
       JOIN secciones s ON s.id_seccion = g.id_seccion
       JOIN jornada j ON j.id_jornada = g.id_jornada
       WHERE d.id_docente = $1
         AND d.id_colegio = $4`,
      [teacherId, subjectId, groupId, schoolId]
    );

    const context = contextRes.rows[0];
    if (context.tipo_grado_nombre === "TRANSICION" && 
        context.materia_nombre !== "Desarrollo Integral" && 
        context.materia_nombre !== "Desarrollo Integral (Transición)") {
      res.status(400).json({ error: "El grado Transición únicamente puede tener asignada la materia Desarrollo Integral." });
      return;
    }
    const courseName = `${context.tipo_grado_nombre} ${context.seccion_nombre} - ${context.jornada_nombre} - ${context.nivel_nombre}`;

    const activeYearRes = await pool.query(
      `SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 AND estado = 'ABIERTO' LIMIT 1`,
      [schoolId]
    );
    const activeYearId = activeYearRes.rows[0]?.id_anio;
    if (!activeYearId) {
      res.status(400).json({ error: "No hay un año lectivo abierto configurado para el colegio." });
      return;
    }

    const existingRes = await pool.query(
      `SELECT
         dg.id_detallegrado,
         dg.id_docente,
         d.nombre,
         d.apellido
       FROM detalle_grados dg
       JOIN docente d ON d.id_docente = dg.id_docente
       WHERE dg.id_colegio = $1
         AND dg.id_materia = $2
         AND dg.id_grupo = $3
         AND (dg.id_anio = $4 OR dg.id_anio IS NULL OR $4::int IS NULL)
       ORDER BY dg.id_anio DESC NULLS LAST, dg.id_detallegrado DESC`,
      [schoolId, subjectId, groupId, activeYearId]
    );

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      if (Number(existing.id_docente) === teacherId) {
        res.status(409).json({ error: "El docente ya tiene asignada esta materia en este curso" });
        return;
      }

      if (!replaceExisting) {
        res.status(409).json({
          error: "La combinación curso y materia ya está asignada a otro docente",
          currentTeacher: {
            id_docente: existing.id_docente,
            nombre: existing.nombre,
            apellido: existing.apellido,
          },
        });
        return;
      }

      const updated = await pool.query(
        `UPDATE detalle_grados
         SET id_docente = $1, id_anio = COALESCE(id_anio, $3)
         WHERE id_detallegrado = $2
         RETURNING id_detallegrado, id_docente, id_materia, id_grupo`,
        [teacherId, existing.id_detallegrado, activeYearId]
      );

      // Consolidar cualquier detalle_grados duplicado existente para este mismo año/grupo/materia
      const duplicateRes = await pool.query(
        `SELECT id_detallegrado FROM detalle_grados 
         WHERE id_colegio = $1 AND id_materia = $2 AND id_grupo = $3 
           AND (id_anio = $4 OR ($4::int IS NULL AND id_anio IS NULL))
           AND id_detallegrado != $5`,
        [schoolId, subjectId, groupId, activeYearId, existing.id_detallegrado]
      );
      const duplicateIds = duplicateRes.rows.map((r: any) => Number(r.id_detallegrado));

      if (duplicateIds.length > 0) {
        await pool.query(
          `UPDATE actividad_materia SET id_detallegrado = $1 WHERE id_detallegrado = ANY($2::int[])`,
          [existing.id_detallegrado, duplicateIds]
        );
        await pool.query(
          `UPDATE resultado_academico SET id_detallegrado = $1 WHERE id_detallegrado = ANY($2::int[])`,
          [existing.id_detallegrado, duplicateIds]
        );
        await pool.query(
          `UPDATE cierre_materia SET id_detallegrado = $1 WHERE id_detallegrado = ANY($2::int[])`,
          [existing.id_detallegrado, duplicateIds]
        );
        await pool.query(
          `UPDATE observacion_estudiante SET id_detallegrado = $1 WHERE id_detallegrado = ANY($2::int[])`,
          [existing.id_detallegrado, duplicateIds]
        );
        await pool.query(
          `UPDATE registro_asistencia SET id_detallegrado = $1 WHERE id_detallegrado = ANY($2::int[])`,
          [existing.id_detallegrado, duplicateIds]
        );
        await pool.query(
          `DELETE FROM detalle_grados WHERE id_detallegrado = ANY($1::int[])`,
          [duplicateIds]
        );
      }

      await NotificationService.sendTeacherAssignmentEmail(
        context.email,
        `${context.nombre} ${context.apellido}`,
        context.colegio_nombre,
        context.materia_nombre,
        courseName,
        "assigned"
      );

      res.json(updated.rows[0]);
      return;
    }

    const created = await pool.query(
      `INSERT INTO detalle_grados (id_materia, id_docente, id_colegio, id_grupo, id_anio)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id_detallegrado, id_docente, id_materia, id_grupo`,
      [subjectId, teacherId, schoolId, groupId, activeYearId]
    );

    await NotificationService.sendTeacherAssignmentEmail(
      context.email,
      `${context.nombre} ${context.apellido}`,
      context.colegio_nombre,
      context.materia_nombre,
      courseName,
      "assigned"
    );

    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    console.error("Error assigning teacher course subject:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error, "Error al realizar el traslado o asignación de la materia") });
  }
};

export const deleteTeacherAssignment = async (req: Request, res: Response): Promise<void> => {
  const assignmentId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId);

  if (!assignmentId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para eliminar asignaciones de este colegio." });
    return;
  }

  try {
    const assignmentRes = await pool.query(
      `SELECT
         dg.id_detallegrado,
         u.email,
         d.nombre,
         d.apellido,
         c.nombre AS colegio_nombre,
         m.nombre AS materia_nombre,
         ne.nombre AS nivel_nombre,
         tg.nombre AS tipo_grado_nombre,
         s.nombre AS seccion_nombre,
         j.nombre AS jornada_nombre
       FROM detalle_grados dg
       JOIN docente d ON d.id_docente = dg.id_docente
       JOIN usuario u ON u.id_usuario = d.id_usuario
       JOIN colegio c ON c.id_colegio = dg.id_colegio
       JOIN materias m ON m.id_materia = dg.id_materia
       JOIN grupos g ON g.id_grupo = dg.id_grupo
       JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
       JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
       JOIN secciones s ON s.id_seccion = g.id_seccion
       JOIN jornada j ON j.id_jornada = g.id_jornada
       WHERE dg.id_detallegrado = $1
         AND dg.id_colegio = $2`,
      [assignmentId, schoolId]
    );

    if (assignmentRes.rows.length === 0) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }

    // RN-DOC-005: Denegar eliminación si existen actividades evaluadas, asistencias, calificaciones o cierres de materia registrados
    const checkRelations = await pool.query(
      `SELECT 
         (SELECT COUNT(*)::int FROM actividad_materia WHERE id_detallegrado = $1) AS actividades_count,
         (SELECT COUNT(*)::int FROM registro_asistencia WHERE id_detallegrado = $1) AS asistencias_count,
         (SELECT COUNT(*)::int FROM cierre_materia WHERE id_detallegrado = $1) AS cierres_count,
         (SELECT COUNT(*)::int FROM resultado_academico WHERE id_detallegrado = $1) AS notas_count,
         (SELECT COUNT(*)::int FROM observacion_estudiante WHERE id_detallegrado = $1) AS observaciones_count`,
      [assignmentId]
    );

    const { actividades_count, asistencias_count, cierres_count, notas_count, observaciones_count } = checkRelations.rows[0];
    if (actividades_count > 0 || asistencias_count > 0 || cierres_count > 0 || notas_count > 0 || observaciones_count > 0) {
      res.status(409).json({
        error: "No se puede eliminar esta asignación académica porque contiene evaluaciones, asistencias, notas o cierres de materia registrados."
      });
      return;
    }

    const deleted = await pool.query(
      `DELETE FROM detalle_grados
       WHERE id_detallegrado = $1
         AND id_colegio = $2
       RETURNING id_detallegrado`,
      [assignmentId, schoolId]
    );

    if (deleted.rows.length === 0) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }

    const assignment = assignmentRes.rows[0];
    await NotificationService.sendTeacherAssignmentEmail(
      assignment.email,
      `${assignment.nombre} ${assignment.apellido}`,
      assignment.colegio_nombre,
      assignment.materia_nombre,
      `${assignment.tipo_grado_nombre} ${assignment.seccion_nombre} - ${assignment.jornada_nombre} - ${assignment.nivel_nombre}`,
      "unassigned"
    );

    res.json({ message: "Asignación eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting teacher assignment:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error, "Error al eliminar la asignación académica") });
  }
};

