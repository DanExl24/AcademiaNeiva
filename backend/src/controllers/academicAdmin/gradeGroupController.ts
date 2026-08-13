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
  getUserEligibleAcademicYears,
  isSchoolAccessAllowed
} from "./helpers";

export const createGradeType = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const levelId = Number(req.body.id_nivel);
  const rawNombre = String(req.body.nombre || "").trim();

  if (!schoolId || !levelId || !rawNombre) {
    res.status(400).json({ error: "Nivel y nombre del grado son obligatorios" });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para registrar grados en este colegio." });
    return;
  }

  const nombreNormalized = normalizeGradeName(rawNombre);
  if (!nombreNormalized) {
    res.status(400).json({ error: "Nombre de grado inválido" });
    return;
  }

  try {
    const levelRes = await pool.query(
      "SELECT id_nivel FROM nivel_escolar WHERE id_nivel = $1 AND id_colegio = $2",
      [levelId, schoolId]
    );

    if (levelRes.rows.length === 0) {
      res.status(404).json({ error: "Nivel académico no encontrado para este colegio" });
      return;
    }

    // Obtener todos los grados existentes en la institución para validación estricta de duplicados y variaciones
    const existingGradesRes = await pool.query(
      `SELECT tg.id_tipo_grado, tg.nombre, tg.id_nivel
       FROM tipo_grado tg
       JOIN nivel_escolar ne ON ne.id_nivel = tg.id_nivel
       WHERE ne.id_colegio = $1`,
      [schoolId]
    );

    const duplicate = existingGradesRes.rows.find((g: { id_tipo_grado: number; nombre: string; id_nivel: number }) => {
      return isDuplicateOrSimilarGrade(g.nombre, rawNombre);
    });

    if (duplicate) {
      res.status(409).json({ 
        error: `El nombre de grado '${rawNombre}' es equivalente o similar al grado existente '${duplicate.nombre}' en la institución. No se permiten grados duplicados o con variaciones ortográficas.` 
      });
      return;
    }

    const created = await pool.query(
      `INSERT INTO tipo_grado (nombre, id_nivel)
       VALUES ($1, $2)
       RETURNING id_tipo_grado, nombre, id_nivel`,
      [rawNombre.toUpperCase(), levelId]
    );

    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    console.error("Error creating grade type:", error);
    res.status(500).json({ error: "Error en el servidor al registrar el grado" });
  }
};

export const deleteGradeType = async (req: Request, res: Response): Promise<void> => {
  const gradeTypeId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId);

  if (!gradeTypeId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para eliminar grados de este colegio." });
    return;
  }

  try {
    const impactRes = await pool.query(
      `SELECT
         tg.id_tipo_grado,
         COUNT(DISTINCT g.id_grupo)::int AS cursos_count,
         COUNT(DISTINCT m.id_matricula)::int AS matriculas_count,
         COUNT(DISTINCT dg.id_detallegrado)::int AS asignaciones_count
       FROM tipo_grado tg
       JOIN nivel_escolar ne ON ne.id_nivel = tg.id_nivel
       LEFT JOIN grupos g ON g.id_tipo_grado = tg.id_tipo_grado AND g.id_colegio = ne.id_colegio
       LEFT JOIN matricula m ON m.id_grupo = g.id_grupo
       LEFT JOIN detalle_grados dg ON dg.id_grupo = g.id_grupo
       WHERE tg.id_tipo_grado = $1
         AND ne.id_colegio = $2
       GROUP BY tg.id_tipo_grado`,
      [gradeTypeId, schoolId]
    );

    if (impactRes.rows.length === 0) {
      res.status(404).json({ error: "Grado no encontrado" });
      return;
    }

    const impact = impactRes.rows[0];
    if (impact.cursos_count > 0 || impact.matriculas_count > 0 || impact.asignaciones_count > 0) {
      res.status(409).json({
        error: "No se puede eliminar el grado porque tiene relaciones académicas activas",
        impact,
      });
      return;
    }

    await pool.query("DELETE FROM tipo_grado WHERE id_tipo_grado = $1", [gradeTypeId]);
    res.json({ message: "Grado eliminado correctamente" });
  } catch (error: any) {
    console.error("Error deleting grade type:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const createGroup = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const idNivel = Number(req.body.id_nivel);
  const idJornada = Number(req.body.id_jornada);
  const idTipoGrado = Number(req.body.id_tipo_grado);
  const cuposTotales = Number(req.body.cupos_totales);
  const seccionNombre = (req.body.seccion_nombre || "").trim().toUpperCase();

  let idSeccion = Number(req.body.id_seccion);

  if (!schoolId || !idNivel || !idJornada || !idTipoGrado || cuposTotales < 0) {
    res.status(400).json({ error: "Todos los campos del curso son obligatorios" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // If seccionNombre is provided, find or create section
    if (seccionNombre) {
      if (seccionNombre.length > 10) {
        res.status(400).json({ error: "El nombre de la sección no puede superar los 10 caracteres" });
        await client.query("ROLLBACK");
        return;
      }

      const secRes = await client.query(
        `SELECT id_seccion FROM secciones WHERE UPPER(nombre) = $1`,
        [seccionNombre]
      );
      if (secRes.rows.length > 0) {
        idSeccion = secRes.rows[0].id_seccion;
      } else {
        const insertRes = await client.query(
          `INSERT INTO secciones (nombre) VALUES ($1) RETURNING id_seccion`,
          [seccionNombre]
        );
        idSeccion = insertRes.rows[0].id_seccion;
      }
    }

    if (!idSeccion) {
      res.status(400).json({ error: "La sección es obligatoria" });
      await client.query("ROLLBACK");
      return;
    }

    const validationRes = await client.query(
      `SELECT
         EXISTS(SELECT 1 FROM nivel_escolar WHERE id_nivel = $1 AND id_colegio = $2) AS nivel_ok,
         EXISTS(SELECT 1 FROM jornada WHERE id_jornada = $3 AND id_colegio = $2) AS jornada_ok,
         EXISTS(SELECT 1 FROM secciones WHERE id_seccion = $4) AS seccion_ok,
         EXISTS(
           SELECT 1
           FROM tipo_grado tg
           JOIN nivel_escolar ne ON ne.id_nivel = tg.id_nivel
           WHERE tg.id_tipo_grado = $5
             AND ne.id_colegio = $2
             AND tg.id_nivel = $1
         ) AS tipo_ok`,
      [idNivel, schoolId, idJornada, idSeccion, idTipoGrado]
    );

    const validation = validationRes.rows[0];
    if (!validation.nivel_ok || !validation.jornada_ok || !validation.seccion_ok || !validation.tipo_ok) {
      res.status(400).json({ error: "La combinación de nivel, jornada, sección y grado no es válida" });
      await client.query("ROLLBACK");
      return;
    }

    const duplicateRes = await client.query(
      `SELECT id_grupo
       FROM grupos
       WHERE id_colegio = $1
         AND id_nivel = $2
         AND id_jornada = $3
         AND id_seccion = $4
         AND id_tipo_grado = $5`,
      [schoolId, idNivel, idJornada, idSeccion, idTipoGrado]
    );

    if (duplicateRes.rows.length > 0) {
      res.status(409).json({ error: "Ya existe un curso con esta combinación de jornada, grado y sección" });
      await client.query("ROLLBACK");
      return;
    }

    const created = await client.query(
      `INSERT INTO grupos (id_nivel, id_jornada, id_colegio, id_seccion, cupos_totales, id_tipo_grado)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [idNivel, idJornada, schoolId, idSeccion, cuposTotales, idTipoGrado]
    );

    await client.query("COMMIT");
    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error creating group:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const deleteGroup = async (req: Request, res: Response): Promise<void> => {
  const groupId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId);

  if (!groupId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    const impactRes = await pool.query(
      `SELECT
         g.id_grupo,
         COUNT(DISTINCT m.id_matricula)::int AS matriculas_count,
         COUNT(DISTINCT dg.id_detallegrado)::int AS asignaciones_count,
         COUNT(DISTINCT c.id_competencia)::int AS competencias_count
       FROM grupos g
       LEFT JOIN matricula m ON m.id_grupo = g.id_grupo
       LEFT JOIN detalle_grados dg ON dg.id_grupo = g.id_grupo
       LEFT JOIN competencias c ON c.id_grupo = g.id_grupo
       WHERE g.id_grupo = $1
         AND g.id_colegio = $2
       GROUP BY g.id_grupo`,
      [groupId, schoolId]
    );

    if (impactRes.rows.length === 0) {
      res.status(404).json({ error: "Curso no encontrado" });
      return;
    }

    const impact = impactRes.rows[0];
    if (impact.matriculas_count > 0 || impact.asignaciones_count > 0 || impact.competencias_count > 0) {
      res.status(409).json({
        error: "No se puede eliminar el curso porque tiene relaciones académicas activas",
        impact,
      });
      return;
    }

    await pool.query("DELETE FROM grupos WHERE id_grupo = $1", [groupId]);
    res.json({ message: "Curso eliminado correctamente" });
  } catch (error: any) {
    console.error("Error deleting group:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const updateGroupCupos = async (req: Request, res: Response): Promise<void> => {
  const groupId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const newCupos = Number(req.body.cupos_totales);

  if (!groupId || !schoolId || isNaN(newCupos) || newCupos < 0) {
    res.status(400).json({ error: "Parámetros inválidos. Los cupos deben ser un número positivo." });
    return;
  }

  try {
    // 1. Verificar existencia y pertenencia al colegio
    const groupRes = await pool.query(
      "SELECT id_grupo FROM grupos WHERE id_grupo = $1 AND id_colegio = $2",
      [groupId, schoolId]
    );

    if (groupRes.rows.length === 0) {
      res.status(404).json({ error: "Curso no encontrado o no pertenece a su institución" });
      return;
    }

    // 2. Contar matrículas actuales
    const matriculasRes = await pool.query(
      "SELECT COUNT(*)::int as count FROM matricula WHERE id_grupo = $1",
      [groupId]
    );
    const matriculadosActuales = matriculasRes.rows[0].count;

    if (newCupos < matriculadosActuales) {
      res.status(400).json({ 
        error: `No se puede reducir el cupo a ${newCupos} porque ya existen ${matriculadosActuales} estudiantes matriculados en este curso.` 
      });
      return;
    }

    // 3. Actualizar
    await pool.query(
      "UPDATE grupos SET cupos_totales = $1 WHERE id_grupo = $2",
      [newCupos, groupId]
    );

    res.json({ message: "Capacidad del curso actualizada exitosamente", cupos_totales: newCupos });
  } catch (error: any) {
    console.error("Error updating group cupos:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getGradeManagementData = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para acceder a la estructura escolar de este colegio." });
    return;
  }

  try {
    const { yearId } = req.query;
    let yearMatriculaJoin = `LEFT JOIN matricula m ON m.id_grupo = g.id_grupo AND m.estado NOT IN ('CANCELADA', 'RECHAZADA')`;
    let yearDetalleJoin = `LEFT JOIN detalle_grados dg ON dg.id_grupo = g.id_grupo`;
    let yearCompetenciaJoin = `LEFT JOIN competencias c ON c.id_grupo = g.id_grupo`;
    const groupsParams: any[] = [schoolId];

    if (yearId) {
      groupsParams.push(Number(yearId));
      yearMatriculaJoin = `LEFT JOIN matricula m ON m.id_grupo = g.id_grupo AND m.id_anio = $2 AND m.estado NOT IN ('CANCELADA', 'RECHAZADA')`;
      yearDetalleJoin = `LEFT JOIN detalle_grados dg ON dg.id_grupo = g.id_grupo AND dg.id_anio = $2`;
      yearCompetenciaJoin = `LEFT JOIN competencias c ON c.id_grupo = g.id_grupo AND c.id_anio = $2`;
    }

    const [jornadasRes, levelsRes, gradeTypesRes, groupsRes] = await Promise.all([
      pool.query(
        `SELECT id_jornada, nombre
         FROM jornada
         WHERE id_colegio = $1
         ORDER BY nombre`,
        [schoolId]
      ),
      pool.query(
        `SELECT id_nivel, nombre
         FROM nivel_escolar
         WHERE id_colegio = $1
         ORDER BY nombre`,
        [schoolId]
      ),
      pool.query(
        `SELECT
           tg.id_tipo_grado,
           tg.nombre,
           tg.id_nivel,
           ne.nombre AS nivel_nombre,
           COUNT(DISTINCT g.id_grupo)::int AS cursos_count
         FROM tipo_grado tg
         JOIN nivel_escolar ne ON ne.id_nivel = tg.id_nivel
         LEFT JOIN grupos g
           ON g.id_tipo_grado = tg.id_tipo_grado
          AND g.id_colegio = ne.id_colegio
         WHERE ne.id_colegio = $1
         GROUP BY tg.id_tipo_grado, tg.nombre, tg.id_nivel, ne.nombre
         ORDER BY ne.nombre, tg.nombre`,
        [schoolId]
      ),
      pool.query(
        `SELECT
           g.id_grupo,
           g.id_nivel,
           g.id_jornada,
           g.id_seccion,
           g.id_tipo_grado,
           g.cupos_totales,
           ne.nombre AS nivel_nombre,
           tg.nombre AS tipo_grado_nombre,
           j.nombre AS jornada_nombre,
           s.nombre AS seccion_nombre,
           COUNT(DISTINCT m.id_matricula)::int AS matriculas_count,
           COUNT(DISTINCT dg.id_detallegrado)::int AS asignaciones_count,
           COUNT(DISTINCT c.id_competencia)::int AS competencias_count
         FROM grupos g
         JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
         JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
         JOIN jornada j ON j.id_jornada = g.id_jornada
         JOIN secciones s ON s.id_seccion = g.id_seccion
         ${yearMatriculaJoin}
         ${yearDetalleJoin}
         ${yearCompetenciaJoin}
         WHERE g.id_colegio = $1
         GROUP BY
           g.id_grupo, g.id_nivel, g.id_jornada, g.id_seccion, g.id_tipo_grado, g.cupos_totales,
           ne.nombre, tg.nombre, j.nombre, s.nombre
         ORDER BY ne.nombre, tg.nombre, LENGTH(s.nombre), s.nombre, j.nombre`,
        groupsParams
      ),
    ]);

    res.json({
      jornadas: jornadasRes.rows,
      niveles: levelsRes.rows,
      tiposGrado: gradeTypesRes.rows,
      grupos: groupsRes.rows,
      groups: groupsRes.rows,
      grados: groupsRes.rows
    });
  } catch (error: any) {
    console.error("Error fetching grade management data:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getGroupMembers = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.query.schoolId || req.body.schoolId);
  const groupId = Number(req.params.groupId);
  const yearId = req.query.yearId ? Number(req.query.yearId) : null;

  if (!schoolId || !groupId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    const groupRes = await pool.query(
      `SELECT
         g.id_grupo,
         g.cupos_totales,
         ne.nombre AS nivel_nombre,
         tg.nombre AS tipo_grado_nombre,
         j.nombre AS jornada_nombre,
         s.nombre AS seccion_nombre
       FROM grupos g
       JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
       JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
       JOIN jornada j ON j.id_jornada = g.id_jornada
       JOIN secciones s ON s.id_seccion = g.id_seccion
       WHERE g.id_grupo = $1 AND g.id_colegio = $2`,
      [groupId, schoolId]
    );

    if (groupRes.rows.length === 0) {
      res.status(404).json({ error: "Curso no encontrado" });
      return;
    }

    let studentQuery = `
      SELECT
        e.id_estudiante,
        e.nombre,
        e.apellido,
        e.codigo AS codigo_estudiantil,
        u.documento,
        td.tipo AS tipo_documento,
        m.id_matricula,
        m.estado AS estado_matricula,
        m.tipo AS tipo_matricula,
        u.email
      FROM matricula m
      JOIN estudiante e ON e.id_estudiante = m.id_estudiante
      LEFT JOIN usuario u ON u.id_usuario = e.id_usuario
      LEFT JOIN tipo_documento td ON td.id_tipodocumento = u.id_tipodocumento
      WHERE m.id_grupo = $1
        AND m.estado NOT IN ('CANCELADA', 'RECHAZADA')
    `;
    const studentParams: any[] = [groupId];

    if (yearId) {
      studentParams.push(yearId);
      studentQuery += ` AND m.id_anio = $2`;
    }

    studentQuery += ` ORDER BY e.apellido, e.nombre`;
    const studentsRes = await pool.query(studentQuery, studentParams);

    let teacherQuery = `
      SELECT
        dg.id_detallegrado,
        mat.id_materia,
        mat.nombre AS materia_nombre,
        doc.id_docente,
        doc.nombre AS docente_nombre,
        doc.apellido AS docente_apellido,
        u.documento AS docente_documento,
        u.email AS docente_email
      FROM detalle_grados dg
      JOIN materias mat ON mat.id_materia = dg.id_materia
      JOIN docente doc ON doc.id_docente = dg.id_docente
      LEFT JOIN usuario u ON u.id_usuario = doc.id_usuario
      WHERE dg.id_grupo = $1
    `;
    const teacherParams: any[] = [groupId];

    if (yearId) {
      teacherParams.push(yearId);
      teacherQuery += ` AND dg.id_anio = $2`;
    }

    teacherQuery += ` ORDER BY mat.nombre`;
    const teachersRes = await pool.query(teacherQuery, teacherParams);

    res.json({
      group: groupRes.rows[0],
      students: studentsRes.rows,
      teachers: teachersRes.rows,
    });
  } catch (error) {
    console.error("Error fetching group members:", error);
    res.status(500).json({ error: "Error en el servidor al obtener integrantes del curso" });
  }
};

export const renameSingleCourse = async (req: Request, res: Response): Promise<void> => {
  const idGrupo = Number(req.params.id);
  const { schoolId, nuevo_nombre } = req.body;

  if (!schoolId || !idGrupo) { res.status(400).json({ error: "Parámetros inválidos" }); return; }
  const nombre = (nuevo_nombre || "").trim();
  if (!nombre) { res.status(400).json({ error: "El nombre no puede estar vacío" }); return; }
  if (nombre.length > 10) { res.status(400).json({ error: "El nombre no puede superar los 10 caracteres" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Security: verify group belongs to school
    const groupRes = await client.query(
      `SELECT g.id_grupo, g.id_seccion FROM grupos g WHERE g.id_grupo = $1 AND g.id_colegio = $2`,
      [idGrupo, schoolId]
    );
    if (!groupRes.rows.length) { res.status(404).json({ error: "Curso no encontrado" }); await client.query("ROLLBACK"); return; }

    const { id_seccion } = groupRes.rows[0];

    // 1. Buscar si ya existe una sección con este nombre en el catálogo general 'secciones'
    const existingSecRes = await client.query(
      `SELECT id_seccion FROM secciones WHERE UPPER(nombre) = UPPER($1)`,
      [nombre]
    );

    if (existingSecRes.rows.length > 0) {
      // La sección ya existe -> simplemente vincular el grupo a la sección existente
      const targetSeccionId = existingSecRes.rows[0].id_seccion;
      if (targetSeccionId !== id_seccion) {
        await client.query(`UPDATE grupos SET id_seccion = $1 WHERE id_grupo = $2`, [targetSeccionId, idGrupo]);
      }
    } else {
      // La sección no existe aún -> verificar si la sección actual es compartida por otros grupos
      const shareRes = await client.query(
        `SELECT COUNT(*)::int AS total FROM grupos WHERE id_seccion = $1 AND id_colegio = $2`,
        [id_seccion, schoolId]
      );
      const shared = shareRes.rows[0].total;

      if (shared <= 1) {
        // Solo este grupo usa la sección actual -> renombrar directamente la sección
        await client.query(`UPDATE secciones SET nombre = $1 WHERE id_seccion = $2`, [nombre, id_seccion]);
      } else {
        // La sección actual es compartida -> crear la nueva sección e independizar el grupo
        const newSecRes = await client.query(
          `INSERT INTO secciones (nombre) VALUES ($1) RETURNING id_seccion`,
          [nombre]
        );
        const newSeccionId = newSecRes.rows[0].id_seccion;
        await client.query(`UPDATE grupos SET id_seccion = $1 WHERE id_grupo = $2`, [newSeccionId, idGrupo]);
      }
    }

    await client.query("COMMIT");
    res.json({ message: `Curso renombrado a "${nombre}" exitosamente.` });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in renameSingleCourse:", error);
    res.status(500).json({ error: "Error en el servidor al renombrar el curso." });
  } finally {
    client.release();
  }
};

// Helper to convert index to letter sequence: 0 -> A, 1 -> B ... 26 -> AA ...
const indexToLetter = (index: number): string => {
  let temp = index;
  let letter = "";
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
};

// ─────────────────────────────────────────────────────────────────────────────
// BULK RENAME ALL COURSES IN A GRADE
// PATCH /api/academic-admin/grade-types/:id/bulk-rename
// ─────────────────────────────────────────────────────────────────────────────

export const bulkRenameCourses = async (req: Request, res: Response): Promise<void> => {
  const idTipoGrado = Number(req.params.id);
  const { schoolId, prefijo, separador, tipo_ordinal } = req.body;

  if (!schoolId || !idTipoGrado) { res.status(400).json({ error: "Parámetros inválidos" }); return; }
  const base = (prefijo || "").trim();
  if (!base) { res.status(400).json({ error: "El prefijo no puede estar vacío" }); return; }
  if (base.length > 10) { res.status(400).json({ error: "El prefijo no puede superar los 10 caracteres" }); return; }

  // sep can be "-", ".", " ", or "" (empty = no separator)
  const sep: string = (separador !== undefined && separador !== null) ? String(separador) : "-";
  const isLetter = (tipo_ordinal === "LETRA");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verify grade type belongs to school
    const gtRes = await client.query(
      `SELECT tg.id_tipo_grado 
       FROM tipo_grado tg
       JOIN nivel_escolar ne ON tg.id_nivel = ne.id_nivel
       WHERE tg.id_tipo_grado = $1 AND ne.id_colegio = $2`,
      [idTipoGrado, schoolId]
    );
    if (!gtRes.rows.length) { res.status(404).json({ error: "Grado no encontrado" }); await client.query("ROLLBACK"); return; }

    // Get all groups for this grade ordered consistently
    const groupsRes = await client.query(
      `SELECT id_grupo, id_seccion FROM grupos WHERE id_tipo_grado = $1 AND id_colegio = $2 ORDER BY id_grupo ASC`,
      [idTipoGrado, schoolId]
    );
    const groups = groupsRes.rows;

    if (!groups.length) { res.status(400).json({ error: "Este grado no tiene cursos" }); await client.query("ROLLBACK"); return; }

    // Validate generated name length
    const lastOrdinal = isLetter ? indexToLetter(groups.length - 1) : String(groups.length);
    const maxGeneratedName = `${base}${sep}${lastOrdinal}`;
    if (maxGeneratedName.length > 10) {
      res.status(400).json({ error: `La estructura del nombre superaría los 10 caracteres (ej: ${maxGeneratedName})` });
      await client.query("ROLLBACK");
      return;
    }

    for (let i = 0; i < groups.length; i++) {
      const { id_grupo, id_seccion } = groups[i];
      const ordinal = isLetter ? indexToLetter(i) : String(i + 1);
      const nuevoNombre = `${base}${sep}${ordinal}`;

      // Check section sharing
      const shareRes = await client.query(
        `SELECT COUNT(*)::int AS total FROM grupos WHERE id_seccion = $1 AND id_colegio = $2`,
        [id_seccion, schoolId]
      );
      const shared = shareRes.rows[0].total;

      if (shared <= 1) {
        await client.query(`UPDATE secciones SET nombre = $1 WHERE id_seccion = $2`, [nuevoNombre, id_seccion]);
      } else {
        const newSecRes = await client.query(
          `INSERT INTO secciones (nombre) VALUES ($1) RETURNING id_seccion`,
          [nuevoNombre]
        );
        const newSeccionId = newSecRes.rows[0].id_seccion;
        await client.query(`UPDATE grupos SET id_seccion = $1 WHERE id_grupo = $2`, [newSeccionId, id_grupo]);
      }
    }

    await client.query("COMMIT");
    res.json({ message: `${groups.length} cursos renombrados exitosamente.`, renamed: groups.length });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error in bulkRenameCourses:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

// ============================================================================
// ─── Planeación y Gestión de DBA en Colegios (Fase 2) ────────────────────────
// ============================================================================

export const getAcademicCatalogs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [sectionsRes, levelsRes] = await Promise.all([
      pool.query("SELECT id_seccion, nombre FROM secciones ORDER BY nombre"),
      pool.query("SELECT id_nivel, nombre, id_colegio FROM nivel_escolar ORDER BY nombre"),
    ]);

    res.json({
      secciones: sectionsRes.rows,
      niveles: levelsRes.rows,
    });
  } catch (error: any) {
    console.error("Error fetching academic catalogs:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getAcademicSettingsData = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  const authReq = req as AuthRequest;
  if (!(await isSchoolAccessAllowed(authReq.user, schoolId))) {
    res.status(403).json({ error: "No tiene permiso para acceder a la configuración académica de este colegio." });
    return;
  }

  try {
    const targetYearId = req.query.yearId || req.query.targetYearId ? Number(req.query.yearId || req.query.targetYearId) : null;
    const currentYearId = targetYearId || await ensureAcademicYearForSchool(schoolId);

    const keysParam = req.query.keys ? String(req.query.keys) : null;
    const requestedKeys = keysParam ? keysParam.split(',').map(k => k.trim()) : null;

    const includeYears = !requestedKeys || requestedKeys.includes('years');
    const includePeriods = !requestedKeys || requestedKeys.includes('periods');
    const includeScales = !requestedKeys || requestedKeys.includes('scales');
    const includeAssignments = !requestedKeys || requestedKeys.includes('assignments');
    const includeCompetencies = !requestedKeys || requestedKeys.includes('competencies');
    const includeClosures = !requestedKeys || requestedKeys.includes('closures');
    const includeDimensions = !requestedKeys || requestedKeys.includes('dimensions');
    const includeDefaults = !requestedKeys || requestedKeys.includes('defaults');

    // Auto-switch periods based on current date if periods are requested
    const runPeriodSchedules = !requestedKeys || requestedKeys.includes('periods');
    if (runPeriodSchedules) {
      await autoSwitchPeriodsForYear(pool, schoolId, currentYearId);
    }

    // Only run heavy competency harmonization if competencies are explicitly requested or on full load
    const runCompetencyHarmonization = !requestedKeys || requestedKeys.includes('competencies');
    if (runCompetencyHarmonization) {
      const competencyClient = await pool.connect();
      try {
        await competencyClient.query("BEGIN");
        await harmonizeCompetenciesForSchoolYear(competencyClient, schoolId, currentYearId);
        await competencyClient.query("COMMIT");
      } catch (error) {
        await competencyClient.query("ROLLBACK");
        throw error;
      } finally {
        competencyClient.release();
      }
    }

    const queries: Promise<any>[] = [
      // 0: yearRes
      includeYears
        ? pool.query(
            `SELECT id_anio, calendario, tipo_calendario, estado
             FROM anio_lectivo
             WHERE id_anio = $1
               AND id_colegio = $2`,
            [currentYearId, schoolId]
          )
        : Promise.resolve({ rows: [] }),

      // 1: academicYearsRes
      includeYears
        ? pool.query(
            `SELECT id_anio, calendario, tipo_calendario, estado
             FROM anio_lectivo
             WHERE id_colegio = $1
             ORDER BY id_anio DESC`,
            [schoolId]
          )
        : Promise.resolve({ rows: [] }),

      // 2: defaultSettingsRes
      includeDefaults
        ? ensureSchoolDefaultSettings(schoolId)
        : Promise.resolve(null),

      // 3: periodsRes
      includePeriods
        ? pool.query(
            `SELECT id_periodo, nombre, estado, porcentaje, trimestre, dia_inicio, dia_fin, mes_inicio, mes_fin, id_anio
             FROM periodo_academico
             WHERE id_colegio = $1 AND id_anio = $2
             ORDER BY id_periodo`,
            [schoolId, currentYearId]
          )
        : Promise.resolve({ rows: [] }),

      // 4: scalesRes
      includeScales
        ? pool.query(
            `SELECT
               ev.id_escalavaloracion,
               ev.nivel,
               ev.valor_minimo,
               ev.valor_maximo,
               COUNT(DISTINCT n.id_notaactividad)::int AS notas_count
             FROM escala_valoracion ev
             LEFT JOIN notas_actividad n ON n.id_escalavaloracion = ev.id_escalavaloracion
             WHERE ev.id_colegio = $1
             GROUP BY ev.id_escalavaloracion
             ORDER BY ev.valor_minimo DESC, ev.valor_maximo DESC`,
            [schoolId]
          )
        : Promise.resolve({ rows: [] }),

      // 5: assignmentsRes
      includeAssignments
        ? pool.query(
            `SELECT
               dg.id_detallegrado,
               dg.id_grupo,
               dg.id_materia,
               m.nombre AS materia_nombre,
               ne.nombre AS nivel_nombre,
               tg.nombre AS tipo_grado_nombre,
               s.nombre AS seccion_nombre,
               j.nombre AS jornada_nombre
             FROM detalle_grados dg
             JOIN materias m ON m.id_materia = dg.id_materia
             JOIN grupos g ON g.id_grupo = dg.id_grupo
             JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
             JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
             JOIN secciones s ON s.id_seccion = g.id_seccion
             JOIN jornada j ON j.id_jornada = g.id_jornada
             WHERE dg.id_colegio = $1
               AND dg.id_grupo IS NOT NULL
               AND dg.id_anio = $2
             ORDER BY ne.nombre, tg.nombre, LENGTH(s.nombre), s.nombre, j.nombre, m.nombre`,
            [schoolId, currentYearId]
          )
        : Promise.resolve({ rows: [] }),

      // 6: competenciesRes
      includeCompetencies
        ? pool.query(
            `SELECT
               c.id_competencia,
               c.id_grupo,
               c.id_materia,
               c.id_periodo,
               c.descripcion,
               c.id_dimension,
               dp.nombre AS dimension_nombre,
               EXISTS (
                 SELECT 1 
                 FROM colegio_version_curricular cvc
                 WHERE cvc.id_colegio = c.id_colegio
                   AND (
                     cvc.area = m.nombre
                     OR (tg.nombre = 'TRANSICION' AND cvc.area = 'Desarrollo Integral' AND m.nombre = 'Desarrollo Integral (Transición)')
                     OR (tg.nombre = 'TRANSICION' AND cvc.area = 'Desarrollo Integral (Transición)' AND m.nombre = 'Desarrollo Integral')
                     OR (tg.nombre = 'TRANSICION' AND cvc.area = 'Transición' AND m.nombre = 'Desarrollo Integral')
                   )
                   AND cvc.grado = tg.nombre
               ) AS usa_dba,
               CASE
                 WHEN EXISTS (
                   SELECT 1
                   FROM competencias c2
                   JOIN grupos g2 ON g2.id_grupo = c2.id_grupo
                   WHERE c2.id_colegio = c.id_colegio
                     AND c2.id_materia = c.id_materia
                     AND c2.id_periodo = c.id_periodo
                     AND g2.id_nivel = g.id_nivel
                     AND g2.id_tipo_grado = g.id_tipo_grado
                     AND UPPER(TRIM(TRAILING '.' FROM c2.descripcion)) <> UPPER(TRIM(TRAILING '.' FROM $2))
                 ) THEN 'DEFINIDA'
                 ELSE 'PENDIENTE'
               END AS estado,
               m.nombre AS materia_nombre,
               p.nombre AS periodo_nombre,
               ne.nombre AS nivel_nombre,
               tg.nombre AS tipo_grado_nombre,
               s.nombre AS seccion_nombre,
               j.nombre AS jornada_nombre,
               COALESCE(
                 (
                   SELECT json_agg(
                     json_build_object(
                       'id_evidencia', ev.id_evidencia,
                       'descripcion',  ev.descripcion,
                       'orden',        ev.orden,
                       'id_evidencia_dba', ev.id_evidencia_dba,
                       'numero_dba',   d.numero_dba,
                       'dba_enunciado', d.enunciado
                     )
                     ORDER BY ev.orden, ev.id_evidencia
                   )
                   FROM evidencia_aprendizaje ev
                   LEFT JOIN evidencias_dba edba ON edba.id_evidencia_dba = ev.id_evidencia_dba
                   LEFT JOIN dba d ON d.id_dba = edba.id_dba
                   WHERE ev.id_competencia = c.id_competencia
                 ),
                 '[]'::json
               ) AS evidencias
             FROM competencias c
             JOIN materias m ON m.id_materia = c.id_materia
             JOIN periodo_academico p ON p.id_periodo = c.id_periodo
             JOIN grupos g ON g.id_grupo = c.id_grupo
             JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
             JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
             JOIN secciones s ON s.id_seccion = g.id_seccion
             JOIN jornada j ON j.id_jornada = g.id_jornada
             LEFT JOIN dimensiones_preescolar dp ON dp.id_dimension = c.id_dimension
             WHERE c.id_colegio = $1
               AND c.id_anio = $3
             ORDER BY p.id_periodo, ne.nombre, tg.nombre, m.nombre`,
            [schoolId, DEFAULT_COMPETENCY_TEXT, currentYearId]
          )
        : Promise.resolve({ rows: [] }),

      // 7: closureSummaryRes
      includeClosures
        ? pool.query(
            `SELECT
               p.id_periodo,
               p.nombre,
               p.estado,
               COUNT(DISTINCT dg.id_detallegrado)::int AS total_asignaciones,
               COUNT(DISTINCT CASE WHEN cm.estado = 'CERRADO' THEN cm.id_detallegrado END)::int AS asignaciones_cerradas
             FROM periodo_academico p
             LEFT JOIN detalle_grados dg
               ON dg.id_colegio = p.id_colegio
              AND dg.id_grupo IS NOT NULL
             LEFT JOIN cierre_materia cm
               ON cm.id_periodo = p.id_periodo
              AND cm.id_detallegrado = dg.id_detallegrado
             WHERE p.id_colegio = $1 AND p.id_anio = $2
             GROUP BY p.id_periodo
             ORDER BY p.id_periodo`,
            [schoolId, currentYearId]
          )
        : Promise.resolve({ rows: [] }),

      // 8: dimensionsRes
      includeDimensions
        ? pool.query(
            `SELECT id_dimension, nombre FROM dimensiones_preescolar ORDER BY id_dimension`
          )
        : Promise.resolve({ rows: [] }),
    ];

    const [
      yearRes,
      academicYearsRes,
      defaultSettingsRes,
      periodsRes,
      scalesRes,
      assignmentsRes,
      competenciesRes,
      closureSummaryRes,
      dimensionsRes
    ] = await Promise.all(queries);

    const periodsWithDefaults = periodsRes.rows.map((period: any, index: number) => ({
      ...period,
      meses_referencia: getDefaultMonthsLabelForPeriodOrder(index + 1),
    }));

    const authReq = req as AuthRequest;
    let availableYears = academicYearsRes.rows;

    if (authReq.user && includeYears && academicYearsRes.rows.length > 0) {
      const userRoles = authReq.user.roles || [];
      const eligibleYearIds = await getUserEligibleAcademicYears(
        authReq.user.id,
        authReq.user.email || '',
        userRoles,
        schoolId
      );
      availableYears = academicYearsRes.rows.filter((y: any) => eligibleYearIds.includes(Number(y.id_anio)));
    }

    res.json({
      currentYear: yearRes.rows[0] || null,
      activeYear: yearRes.rows[0] || null,
      academicYears: availableYears,
      defaultSettings: defaultSettingsRes,
      periods: periodsWithDefaults,
      scales: scalesRes.rows || [],
      assignments: assignmentsRes.rows || [],
      competencies: competenciesRes.rows || [],
      closureSummary: closureSummaryRes.rows || [],
      dimensions: dimensionsRes.rows || [],
    });
  } catch (error: any) {
    console.error("Error fetching academic settings:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

