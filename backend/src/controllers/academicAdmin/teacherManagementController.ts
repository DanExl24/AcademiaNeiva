import { Request, Response } from "express";
import { PoolClient } from "pg";
import { z } from "zod";
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
import { upsertInstitutionalEmail } from "../../utils/emailResolver";
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

export const CreateTeacherSchema = z.object({
  schoolId: z.coerce.number({ message: "ID de colegio inválido" }),
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  documento: z.string().min(4, "El documento es obligatorio"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  id_tipodocumento: z.coerce.number({ message: "Tipo de documento obligatorio" }),
  telefono: z.string().regex(/^[0-9+() -]*$/, "Formato de teléfono inválido").optional().nullable(),
  addRoleIfParent: z.boolean().optional()
});

export const UpdateTeacherSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  documento: z.string().min(4, "El documento es obligatorio"),
  email: z.string().email("Correo electrónico inválido"),
  id_tipodocumento: z.coerce.number({ message: "Tipo de documento obligatorio" }),
  schoolId: z.coerce.number({ message: "ID de colegio inválido" }),
  telefono: z.string().regex(/^[0-9+() -]*$/, "Formato de teléfono inválido").optional().nullable()
});

export const createTeacher = async (req: Request, res: Response): Promise<void> => {
  const parseResult = CreateTeacherSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0]?.message || "Datos del docente inválidos";
    res.status(400).json({ error: firstError, details: parseResult.error.issues });
    return;
  }

  const { schoolId, nombre, apellido, documento: rawDoc, email, password, id_tipodocumento: documentTypeId, telefono } = parseResult.data;
  const documento = normalizeDocument(rawDoc);
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
        "u.telefono"
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
        "u.telefono"
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
      // PRINCIPIO DE MÍNIMA DIVULGACIÓN DE INFORMACIÓN E INMUTABILIDAD DE DATOS PERSONALES:
      // Si el usuario ya existe en la plataforma por documento o email:
      // 1. No se modifica su nombre, apellido ni documento original (se preservan intactos).
      // 2. No se revelan los colegios a los que pertenece ni otros roles de manera indiscreta.
      // 3. Se asigna únicamente la vinculación con este colegio (schoolId) como Docente.

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

      // Verificar si el usuario ya es docente en ESTA institución
      const teacherInSchool = await client.query(
        `SELECT id_docente FROM docente WHERE id_usuario = $1 AND id_colegio = $2`,
        [existingUser.id_usuario, schoolId]
      );
      if (teacherInSchool.rows.length > 0) {
        await client.query("ROLLBACK");
        res.status(409).json({ error: `El usuario con documento ${existingUser.documento || documento} ya está registrado como docente en esta institución.` });
        return;
      }

      const parentInThisSchoolRes = await client.query(
        `SELECT 1 
         FROM padre_familia pf
         JOIN detalle_padrefamilia dp ON dp.id_padrefamilia = pf.id_padrefamilia
         JOIN estudiante e ON e.id_estudiante = dp.id_estudiante
         WHERE pf.id_usuario = $1 AND e.id_colegio = $2
         LIMIT 1`,
        [existingUser.id_usuario, schoolId]
      );
      const isParentInThisSchool = parentInThisSchoolRes.rows.length > 0;

      const addRoleIfParent = Boolean(req.body.addRoleIfParent);
      const userFullName = `${existingUser.nombre} ${existingUser.apellido}`.trim();

      if (isParentInThisSchool && !addRoleIfParent && email === (existingUser.email || "").toLowerCase().trim()) {
        await client.query("ROLLBACK");
        res.status(409).json({
          isParent: true,
          message: `El usuario ya se encuentra registrado en esta institución como Padre de Familia. ¿Desea vincular esta cuenta existente también como Docente?`
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

      // Guardar docente asociando los datos personales preservados del usuario
      const teacherRes = await client.query(
        `INSERT INTO docente (nombre, apellido, id_colegio, id_usuario, estado)
         VALUES ($1, $2, $3, $4, 'ACTIVO')
         RETURNING id_docente, nombre, apellido, estado`,
        [existingUser.nombre, existingUser.apellido, schoolId, existingUser.id_usuario]
      );
      if (telefono) {
        await client.query(
          `UPDATE usuario SET telefono = COALESCE(telefono, $1) WHERE id_usuario = $2`,
          [telefono.trim(), existingUser.id_usuario]
        );
      }

      // Persistir correo institucional en usuario_colegio_email si difiere del personal
      await upsertInstitutionalEmail(existingUser.id_usuario, schoolId, email, existingUser.email, client);

      await client.query("COMMIT");

      await NotificationService.sendTeacherWelcomeEmail(
        email,
        userFullName,
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
        telefono: existingUser.telefono || telefono || null,
        activo: existingUser.activo,
        estado: teacherRes.rows[0].estado,
        asignaciones_count: 0,
        userReused: true,
        infoMessage: "El usuario ya se encuentra registrado en el sistema. Sus datos personales existentes fueron preservados y no fueron sobrescritos. Se agregó únicamente su asignación a esta institución."
      });
      return;
    }

    // CASO 2: Persona y usuario completamente nuevos
    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await client.query(
      `INSERT INTO usuario (email, password, nombre, apellido, id_tipodocumento, documento, telefono)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_usuario, email, activo, telefono`,
      [email, passwordHash, nombre, apellido, documentTypeId, documento, telefono?.trim() || null]
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

    // Crear docente sin email_institucional (la columna ya no existe)
    const teacherRes = await client.query(
      `INSERT INTO docente (nombre, apellido, id_colegio, id_usuario, estado)
       VALUES ($1, $2, $3, $4, 'ACTIVO')
       RETURNING id_docente, nombre, apellido, estado`,
      [nombre, apellido, schoolId, userRes.rows[0].id_usuario]
    );

    // Persistir correo institucional — para usuario nuevo el email ya ES el institucional
    // Se guarda siempre para que quede registrado el correo de este colegio
    await upsertInstitutionalEmail(userRes.rows[0].id_usuario, schoolId, email, null, client);

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
      telefono: userRes.rows[0].telefono || null,
      activo: userRes.rows[0].activo,
      estado: teacherRes.rows[0].estado,
      asignaciones_count: 0,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error en createTeacher:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error, "Error al crear docente") });
  } finally {
    client.release();
  }
};

export const updateTeacher = async (req: Request, res: Response): Promise<void> => {
  const teacherId = Number(req.params.id);
  const parseResult = UpdateTeacherSchema.safeParse(req.body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0]?.message || "Datos del docente inválidos";
    res.status(400).json({ error: firstError, details: parseResult.error.issues });
    return;
  }

  const { schoolId, nombre, apellido, documento: rawDoc, email, id_tipodocumento: documentTypeId, telefono } = parseResult.data;
  const documento = normalizeDocument(rawDoc);

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

    // Verificar si el usuario es también Padre de Familia en ESTA institución
    const isParentRes = await client.query(
      `SELECT 1 
       FROM padre_familia pf
       JOIN detalle_padrefamilia dp ON dp.id_padrefamilia = pf.id_padrefamilia
       JOIN estudiante e ON e.id_estudiante = dp.id_estudiante
       WHERE pf.id_usuario = $1 AND e.id_colegio = $2
       LIMIT 1`,
      [id_usuario, schoolId]
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

    // Actualizar datos del usuario
    if (id_usuario) {
      if (!isParent) {
        await client.query(
          `UPDATE usuario 
           SET nombre = $1, apellido = $2, id_tipodocumento = $3, documento = $4, telefono = $5
           WHERE id_usuario = $6`,
          [nombre, apellido, documentTypeId, documento, telefono?.trim() || null, id_usuario]
        );
      } else {
        await client.query(
          `UPDATE usuario 
           SET telefono = $1
           WHERE id_usuario = $2`,
          [telefono?.trim() || null, id_usuario]
        );
      }
    }

    // Actualizar datos del docente (solo nombre/apellido — email ya no va en docente)
    await client.query(
      `UPDATE docente 
       SET nombre = $1, apellido = $2
       WHERE id_docente = $3`,
      [
        isParent ? currentTeacher.nombre : nombre,
        isParent ? currentTeacher.apellido : apellido,
        teacherId
      ]
    );

    // Upsert correo institucional en usuario_colegio_email
    if (id_usuario) {
      const userEmailRes = await client.query(
        `SELECT email FROM usuario WHERE id_usuario = $1`,
        [id_usuario]
      );
      const personalEmail = userEmailRes.rows[0]?.email || null;
      await upsertInstitutionalEmail(id_usuario, schoolId, email, personalEmail, client);
    }

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
         COALESCE(uce.email_institucional, u.email) AS email,
         c.nombre AS colegio_nombre
       FROM docente d
       JOIN usuario u ON u.id_usuario = d.id_usuario
       JOIN colegio c ON c.id_colegio = d.id_colegio
       LEFT JOIN usuario_colegio_email uce ON uce.id_usuario = d.id_usuario AND uce.id_colegio = d.id_colegio
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
        .orderBy("id_tipodocumento", "asc")
        .execute(),
      db
        .selectFrom("docente as d")
        .leftJoin("usuario as u", "u.id_usuario", "d.id_usuario")
        .leftJoin("tipo_documento as td", "td.id_tipodocumento", "u.id_tipodocumento")
        .leftJoin("detalle_grados as dg", "dg.id_docente", "d.id_docente")
        .leftJoin("usuario_colegio_email as uce", (join) =>
          join
            .onRef("uce.id_usuario", "=", "d.id_usuario")
            .on("uce.id_colegio", "=", schoolId)
        )
        .select([
          "d.id_docente",
          "d.nombre",
          "d.apellido",
          "u.documento",
          "u.id_tipodocumento",
          "td.tipo as tipo_documento",
          "d.estado",
          "u.id_usuario",
          "u.telefono",
          // email_institucional toma precedencia sobre el email personal
          sql<string>`COALESCE(uce.email_institucional, u.email)`.as("email"),
          "uce.email_institucional",
          sql<boolean>`COALESCE(u.activo, true)`.as("activo"),
          sql<string | null>`(
            SELECT u_parent.email
            FROM padre_familia pf
            JOIN detalle_padrefamilia dp ON dp.id_padrefamilia = pf.id_padrefamilia
            JOIN estudiante e ON e.id_estudiante = dp.id_estudiante
            JOIN usuario u_parent ON u_parent.id_usuario = pf.id_usuario
            WHERE pf.id_usuario = d.id_usuario AND e.id_colegio = ${schoolId}
            LIMIT 1
          )`.as("email_padre"),
          sql<boolean>`EXISTS (
            SELECT 1 
            FROM padre_familia pf
            JOIN detalle_padrefamilia dp ON dp.id_padrefamilia = pf.id_padrefamilia
            JOIN estudiante e ON e.id_estudiante = dp.id_estudiante
            WHERE pf.id_usuario = d.id_usuario AND e.id_colegio = ${schoolId}
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
          "u.telefono",
          "u.email",
          "u.activo",
          "uce.email_institucional"
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
      tipos_documento: documentTypesRes,
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
    const teacher_ok = await db
      .selectFrom("docente")
      .select("id_docente")
      .where("id_docente", "=", teacherId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    const subject_ok = await db
      .selectFrom("materias")
      .select("id_materia")
      .where("id_materia", "=", subjectId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    const group_ok = await db
      .selectFrom("grupos")
      .select("id_grupo")
      .where("id_grupo", "=", groupId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!teacher_ok || !subject_ok || !group_ok) {
      res.status(400).json({ error: "La asignación solicitada no es válida para este colegio" });
      return;
    }

    const context = await db
      .selectFrom("docente as d")
      .innerJoin("usuario as u", "u.id_usuario", "d.id_usuario")
      .innerJoin("colegio as c", "c.id_colegio", "d.id_colegio")
      .innerJoin("materias as m", (join) => join.on("m.id_materia", "=", subjectId))
      .innerJoin("grupos as g", (join) => join.on("g.id_grupo", "=", groupId))
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .leftJoin("usuario_colegio_email as uce", (join) =>
        join
          .onRef("uce.id_usuario", "=", "d.id_usuario")
          .onRef("uce.id_colegio", "=", "d.id_colegio")
      )
      .select([
        "c.nombre as colegio_nombre",
        // Usar email institucional si existe, de lo contrario el email personal
        sql<string>`COALESCE(uce.email_institucional, u.email)`.as("email"),
        "d.nombre",
        "d.apellido",
        "m.nombre as materia_nombre",
        "ne.nombre as nivel_nombre",
        "tg.nombre as tipo_grado_nombre",
        "s.nombre as seccion_nombre",
        "j.nombre as jornada_nombre",
      ])
      .where("d.id_docente", "=", teacherId)
      .where("d.id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!context) {
      res.status(400).json({ error: "La información del docente o del curso no fue encontrada." });
      return;
    }

    if (context.tipo_grado_nombre === "TRANSICION" && 
        context.materia_nombre !== "Desarrollo Integral" && 
        context.materia_nombre !== "Desarrollo Integral (Transición)") {
      res.status(400).json({ error: "El grado Transición únicamente puede tener asignada la materia Desarrollo Integral." });
      return;
    }
    const courseName = `${context.tipo_grado_nombre} ${context.seccion_nombre} - ${context.jornada_nombre} - ${context.nivel_nombre}`;

    const activeYearRow = await db
      .selectFrom("anio_lectivo")
      .select("id_anio")
      .where("id_colegio", "=", schoolId)
      .where("estado", "=", "ABIERTO")
      .executeTakeFirst();

    const activeYearId = activeYearRow?.id_anio;
    if (!activeYearId) {
      res.status(400).json({ error: "No hay un año lectivo abierto configurado para el colegio." });
      return;
    }

    const existingRes = await db
      .selectFrom("detalle_grados as dg")
      .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
      .select([
        "dg.id_detallegrado",
        "dg.id_docente",
        "d.nombre",
        "d.apellido",
      ])
      .where("dg.id_colegio", "=", schoolId)
      .where("dg.id_materia", "=", subjectId)
      .where("dg.id_grupo", "=", groupId)
      .where((eb) =>
        eb.or([
          eb("dg.id_anio", "=", activeYearId),
          eb("dg.id_anio", "is", null),
        ])
      )
      .orderBy("dg.id_anio", "desc")
      .orderBy("dg.id_detallegrado", "desc")
      .execute();

    if (existingRes.length > 0) {
      const existing = existingRes[0];
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

      const updated = await db
        .updateTable("detalle_grados")
        .set({
          id_docente: teacherId,
          id_anio: sql`COALESCE(id_anio, ${activeYearId})`,
        })
        .where("id_detallegrado", "=", existing.id_detallegrado)
        .returning(["id_detallegrado", "id_docente", "id_materia", "id_grupo"])
        .executeTakeFirst();

      // Consolidar cualquier detalle_grados duplicado existente para este mismo año/grupo/materia
      const duplicateRes = await db
        .selectFrom("detalle_grados")
        .select("id_detallegrado")
        .where("id_colegio", "=", schoolId)
        .where("id_materia", "=", subjectId)
        .where("id_grupo", "=", groupId)
        .where((eb) => eb.or([eb("id_anio", "=", activeYearId), eb("id_anio", "is", null)]))
        .where("id_detallegrado", "!=", existing.id_detallegrado)
        .execute();

      const duplicateIds = duplicateRes.map((r) => Number(r.id_detallegrado));

      if (duplicateIds.length > 0) {
        await db
          .updateTable("actividad_materia")
          .set({ id_detallegrado: existing.id_detallegrado })
          .where("id_detallegrado", "in", duplicateIds)
          .execute();
        await db
          .updateTable("resultado_academico")
          .set({ id_detallegrado: existing.id_detallegrado })
          .where("id_detallegrado", "in", duplicateIds)
          .execute();
        await db
          .updateTable("cierre_materia")
          .set({ id_detallegrado: existing.id_detallegrado })
          .where("id_detallegrado", "in", duplicateIds)
          .execute();
        await db
          .updateTable("observacion_estudiante")
          .set({ id_detallegrado: existing.id_detallegrado })
          .where("id_detallegrado", "in", duplicateIds)
          .execute();
        await db
          .updateTable("registro_asistencia")
          .set({ id_detallegrado: existing.id_detallegrado })
          .where("id_detallegrado", "in", duplicateIds)
          .execute();
        await db
          .deleteFrom("detalle_grados")
          .where("id_detallegrado", "in", duplicateIds)
          .execute();
      }

      await NotificationService.sendTeacherAssignmentEmail(
        context.email || "",
        `${context.nombre} ${context.apellido}`,
        context.colegio_nombre || "",
        context.materia_nombre || "",
        courseName,
        "assigned"
      );

      res.json(updated);
      return;
    }

    const created = await db
      .insertInto("detalle_grados")
      .values({
        id_materia: subjectId,
        id_docente: teacherId,
        id_colegio: schoolId,
        id_grupo: groupId,
        id_anio: activeYearId,
      })
      .returning(["id_detallegrado", "id_docente", "id_materia", "id_grupo"])
      .executeTakeFirst();

    await NotificationService.sendTeacherAssignmentEmail(
      context.email || "",
      `${context.nombre} ${context.apellido}`,
      context.colegio_nombre || "",
      context.materia_nombre || "",
      courseName,
      "assigned"
    );

    res.status(201).json(created);
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
    const assignment = await db
      .selectFrom("detalle_grados as dg")
      .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
      .innerJoin("usuario as u", "u.id_usuario", "d.id_usuario")
      .innerJoin("colegio as c", "c.id_colegio", "dg.id_colegio")
      .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
      .innerJoin("grupos as g", "g.id_grupo", "dg.id_grupo")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .leftJoin("usuario_colegio_email as uce", (join) =>
        join
          .onRef("uce.id_usuario", "=", "d.id_usuario")
          .onRef("uce.id_colegio", "=", "dg.id_colegio")
      )
      .select([
        "dg.id_detallegrado",
        sql<string>`COALESCE(uce.email_institucional, u.email)`.as("email"),
        "d.nombre",
        "d.apellido",
        "c.nombre as colegio_nombre",
        "m.nombre as materia_nombre",
        "ne.nombre as nivel_nombre",
        "tg.nombre as tipo_grado_nombre",
        "s.nombre as seccion_nombre",
        "j.nombre as jornada_nombre",
      ])
      .where("dg.id_detallegrado", "=", assignmentId)
      .where("dg.id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!assignment) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }

    const actividadesCount = await db
      .selectFrom("actividad_materia")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("id_detallegrado", "=", assignmentId)
      .executeTakeFirst();

    const asistenciasCount = await db
      .selectFrom("registro_asistencia")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("id_detallegrado", "=", assignmentId)
      .executeTakeFirst();

    const cierresCount = await db
      .selectFrom("cierre_materia")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("id_detallegrado", "=", assignmentId)
      .executeTakeFirst();

    const notasCount = await db
      .selectFrom("resultado_academico")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("id_detallegrado", "=", assignmentId)
      .executeTakeFirst();

    const observacionesCount = await db
      .selectFrom("observacion_estudiante")
      .select(sql<number>`count(*)::int`.as("count"))
      .where("id_detallegrado", "=", assignmentId)
      .executeTakeFirst();

    const actividades_count = actividadesCount?.count || 0;
    const asistencias_count = asistenciasCount?.count || 0;
    const cierres_count = cierresCount?.count || 0;
    const notas_count = notasCount?.count || 0;
    const observaciones_count = observacionesCount?.count || 0;

    if (actividades_count > 0 || asistencias_count > 0 || cierres_count > 0 || notas_count > 0 || observaciones_count > 0) {
      res.status(409).json({
        error: "No se puede eliminar esta asignación académica porque contiene evaluaciones, asistencias, notas o cierres de materia registrados."
      });
      return;
    }

    const deleted = await db
      .deleteFrom("detalle_grados")
      .where("id_detallegrado", "=", assignmentId)
      .where("id_colegio", "=", schoolId)
      .returning("id_detallegrado")
      .executeTakeFirst();

    if (!deleted) {
      res.status(404).json({ error: "Asignación no encontrada" });
      return;
    }

    await NotificationService.sendTeacherAssignmentEmail(
      assignment.email || "",
      `${assignment.nombre} ${assignment.apellido}`,
      assignment.colegio_nombre || "",
      assignment.materia_nombre || "",
      `${assignment.tipo_grado_nombre} ${assignment.seccion_nombre} - ${assignment.jornada_nombre} - ${assignment.nivel_nombre}`,
      "unassigned"
    );

    res.json({ message: "Asignación eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting teacher assignment:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error, "Error al eliminar la asignación académica") });
  }
};

