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

export const createSubject = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const nombre = String(req.body.nombre || "").trim();

  if (!schoolId || !nombre) {
    res.status(400).json({ error: "El nombre de la materia es obligatorio" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('SET search_path TO public, "$user"');
    const trashId = req.body.trashId ? Number(req.body.trashId) : null;

    await client.query("BEGIN");

    // 1. Verificar duplicado dentro de la transacción
    const duplicateRes = await client.query(
      `SELECT id_materia FROM materias WHERE id_colegio = $1 AND UPPER(TRIM(nombre)) = UPPER(TRIM($2))`,
      [schoolId, nombre]
    );

    if (duplicateRes.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Se encontró una materia con el mismo nombre" });
      return;
    }

    // 2. Crear materia
    const created = await client.query(
      `INSERT INTO materias (nombre, id_colegio) VALUES ($1, $2) RETURNING *`,
      [nombre, schoolId]
    );

    const newSubjectId = created.rows[0].id_materia;

    if (trashId) {
      // RESTAURACIÓN PROFUNDA
      const trashRes = await client.query(
        "SELECT data_respaldo FROM papelera_materias WHERE id_papelera = $1 AND id_colegio = $2",
        [trashId, schoolId]
      );

      if (trashRes.rows.length > 0) {
        const backup = trashRes.rows[0].data_respaldo;

        // 1. Restaurar Asignaciones
        if (backup.assignments && Array.isArray(backup.assignments)) {
          for (const asig of backup.assignments) {
            await client.query(
              "INSERT INTO detalle_grados (id_materia, id_docente, id_grupo, id_colegio) VALUES ($1, $2, $3, $4)",
              [newSubjectId, asig.id_docente, asig.id_grupo, schoolId]
            );
          }
        }

        // 2. Restaurar Competencias
        if (backup.competencies && Array.isArray(backup.competencies)) {
          for (const comp of backup.competencies) {
            await client.query(
              'INSERT INTO competencias (descripcion, id_materia, id_periodo, id_anio, id_grupo, id_colegio) VALUES ($1, $2, $3, $4, $5, $6)',
              [comp.descripcion, newSubjectId, comp.id_periodo, comp.id_anio, comp.id_grupo, schoolId]
            );
          }
        }

        // 3. Limpiar papelera
        await client.query("DELETE FROM papelera_materias WHERE id_papelera = $1", [trashId]);
      }
    }

    await client.query("COMMIT");
    res.status(201).json(created.rows[0]);
  } catch (error: any) {
    if (client) await client.query("ROLLBACK");
    console.error("Error creating subject:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    if (client) client.release();
  }
};

export const deleteSubject = async (req: Request, res: Response): Promise<void> => {
  const subjectId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId);
  const force = req.query.force === "true";

  if (!subjectId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const client = await pool.connect();

  try {
    // Asegurar visibilidad del esquema public
    await client.query('SET search_path TO public, "$user"');

    // 1. Obtener información básica de la materia
    const subjectRes = await client.query(
      "SELECT nombre FROM materias WHERE id_materia = $1 AND id_colegio = $2",
      [subjectId, schoolId]
    );

    if (subjectRes.rows.length === 0) {
      res.status(404).json({ error: "Materia no encontrada" });
      return;
    }

    const subjectName = subjectRes.rows[0].nombre;

    // 2. Analizar impacto (Recolección de datos con subconsultas independientes para evitar duplicados)
    const impactRes = await client.query(
      `SELECT
         (SELECT COUNT(DISTINCT id_detallegrado)::int FROM detalle_grados WHERE id_materia = $1) as asignaciones_count,
         (SELECT COUNT(DISTINCT id_competencia)::int FROM competencias WHERE id_materia = $1) as competencias_count,
         (SELECT COUNT(DISTINCT aa.id_actividadmateria)::int FROM actividad_materia aa 
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1) as actividades_count,
         (SELECT COUNT(DISTINCT na.id_notaactividad)::int FROM notas_actividad na
          JOIN actividad_materia aa ON aa.id_actividadmateria = na.id_actividadmateria
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1) as notas_count
      `,
      [subjectId]
    );

    const impact = impactRes.rows[0];
    const hasRelations = (impact.asignaciones_count > 0) || (impact.competencias_count > 0);

    if (hasRelations && !force) {
      res.status(409).json({
        error: "No se puede eliminar la materia porque tiene relaciones académicas activas",
        impact
      });
      return;
    }

    if (force) {
      await client.query("BEGIN");
      // Permitir bypass administrativo de triggers para cascada limpia y respaldo
      await client.query("SET LOCAL my.app.bypass_triggers = 'true'");

      // OBTENER DATOS PARA RESPALDO DETALLADO ANTES DE BORRAR (Granularidad mejorada con Grado y Sección)
      const assignmentsBackupRes = await client.query(`
        SELECT DISTINCT dg.id_docente, dg.id_grupo, n.nombre as nivel_nombre,
               tg.nombre as grado_nombre, s.nombre as seccion_nombre,
               d.nombre || ' ' || d.apellido as docente_nombre
        FROM detalle_grados dg
        JOIN grupos gr ON gr.id_grupo = dg.id_grupo
        JOIN nivel_escolar n ON n.id_nivel = gr.id_nivel
        JOIN tipo_grado tg ON tg.id_tipo_grado = gr.id_tipo_grado
        JOIN secciones s ON s.id_seccion = gr.id_seccion
        JOIN docente d ON d.id_docente = dg.id_docente
        WHERE dg.id_materia = $1
      `, [subjectId]);

      const competenciesBackupRes = await client.query(`
        SELECT DISTINCT descripcion, id_periodo, id_anio, id_grupo
        FROM competencias
        WHERE id_materia = $1
      `, [subjectId]);

      const detailedBackup = {
        impact,
        assignments: assignmentsBackupRes.rows,
        competencies: competenciesBackupRes.rows
      };

      // 1. Notas y Criterios
      await client.query(`
        DELETE FROM nota_criterio 
        WHERE id_criterio IN (
          SELECT c.id_criterio FROM criterio_evaluacion c
          JOIN actividad_materia aa ON aa.id_actividadmateria = c.id_actividadmateria
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1
        )
      `, [subjectId]);

      await client.query(`
        DELETE FROM notas_actividad 
        WHERE id_actividadmateria IN (
          SELECT aa.id_actividadmateria FROM actividad_materia aa
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1
        )
      `, [subjectId]);

      // 2. Desempeños, Criterios y Actividades
      await client.query(`
        DELETE FROM desempeno 
        WHERE id_actividadmateria IN (
          SELECT aa.id_actividadmateria FROM actividad_materia aa
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1
        )
      `, [subjectId]);

      await client.query(`
        DELETE FROM criterio_evaluacion 
        WHERE id_actividadmateria IN (
          SELECT aa.id_actividadmateria FROM actividad_materia aa
          JOIN detalle_grados dg ON dg.id_detallegrado = aa.id_detallegrado
          WHERE dg.id_materia = $1
        )
      `, [subjectId]);

      await client.query(`
        DELETE FROM actividad_materia 
        WHERE id_detallegrado IN (
          SELECT id_detallegrado FROM detalle_grados WHERE id_materia = $1
        )
      `, [subjectId]);

      // 3. Competencias y Evidencias
      await client.query(`
        DELETE FROM evidencia_aprendizaje 
        WHERE id_competencia IN (
          SELECT id_competencia FROM competencias WHERE id_materia = $1
        )
      `, [subjectId]);

      await client.query("DELETE FROM competencias WHERE id_materia = $1", [subjectId]);

      // 4. Observación y Resultados Académicos
      await client.query(`
        DELETE FROM observacion_estudiante 
        WHERE id_detallegrado IN (
          SELECT id_detallegrado FROM detalle_grados WHERE id_materia = $1
        )
      `, [subjectId]);

      await client.query(`
        DELETE FROM resultado_academico 
        WHERE id_detallegrado IN (
          SELECT id_detallegrado FROM detalle_grados WHERE id_materia = $1
        )
      `, [subjectId]);

      // 5. Cierres de materia y Asistencia
      await client.query(`
        DELETE FROM registro_asistencia 
        WHERE id_detallegrado IN (
          SELECT id_detallegrado FROM detalle_grados WHERE id_materia = $1
        )
      `, [subjectId]);

      await client.query(`
        DELETE FROM cierre_materia 
        WHERE id_detallegrado IN (
          SELECT id_detallegrado FROM detalle_grados WHERE id_materia = $1
        )
      `, [subjectId]);

      // 6. Asignaciones (detalle_grados)
      await client.query("DELETE FROM detalle_grados WHERE id_materia = $1", [subjectId]);

      // 7. La materia en sí
      await client.query("DELETE FROM materias WHERE id_materia = $1", [subjectId]);

      // 8. Crear respaldo en papelera con DATA DETALLADA
      await client.query(
        "INSERT INTO papelera_materias (id_colegio, nombre_materia, data_respaldo) VALUES ($1, $2, $3)",
        [schoolId, subjectName, JSON.stringify(detailedBackup)]
      );

      await client.query("COMMIT");

      res.json({
        message: "Materia y todas sus relaciones eliminadas correctamente",
        report: {
          subjectName,
          timestamp: new Date().toISOString(),
          details: impact
        }
      });
    } else {
      await client.query("DELETE FROM materias WHERE id_materia = $1", [subjectId]);
      res.json({ message: "Materia eliminada correctamente" });
    }
  } catch (error: any) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rbErr) {
        console.error("Error on rollback:", rbErr);
      }
    }
    console.error("Error deleting subject:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  } finally {
    if (client) client.release();
  }
};

export const getSubjects = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    const rawYearId = req.query.yearId ? Number(req.query.yearId) : null;
    const yearId = rawYearId && !isNaN(rawYearId) ? rawYearId : null;

    const subjects = await db
      .selectFrom("materias as m")
      .select([
        "m.id_materia",
        "m.nombre",
        (eb) => {
          let asigSubquery = eb
            .selectFrom("detalle_grados as dg")
            .select(sql<number>`COALESCE(COUNT(DISTINCT dg.id_detallegrado), 0)::int`.as("count"))
            .whereRef("dg.id_materia", "=", "m.id_materia");

          if (yearId) {
            asigSubquery = asigSubquery.where("dg.id_anio", "=", yearId);
          }
          return asigSubquery.as("asignaciones_count");
        },
        (eb) => {
          let compSubquery = eb
            .selectFrom("competencias as c")
            .select(sql<number>`COALESCE(COUNT(DISTINCT c.id_competencia), 0)::int`.as("count"))
            .whereRef("c.id_materia", "=", "m.id_materia");

          if (yearId) {
            compSubquery = compSubquery.where("c.id_anio", "=", yearId);
          }
          return compSubquery.as("competencias_count");
        },
      ])
      .where("m.id_colegio", "=", schoolId)
      .orderBy("m.nombre", "asc")
      .execute();

    res.json(subjects);
  } catch (error: any) {
    console.error("Error fetching subjects:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getSubjectTrash = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);

  if (!schoolId) {
    res.status(400).json({ error: "Colegio inválido" });
    return;
  }

  try {
    const result = await pool.query(
      "SELECT id_papelera, nombre_materia, data_respaldo, fecha_borrado FROM papelera_materias WHERE id_colegio = $1 ORDER BY fecha_borrado DESC",
      [schoolId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching subject trash:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};





export const getSubjectCurriculumDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const subjectId = Number(req.params.id);
    const schoolId = parseSchoolId(req.query.schoolId as string);
    const yearId = req.query.yearId ? Number(req.query.yearId) : null;

    if (!subjectId || !schoolId) {
      res.status(400).json({ error: "ID de materia y colegio son obligatorios" });
      return;
    }

    // 1. Materia info
    const subRes = await pool.query(
      "SELECT * FROM materias WHERE id_materia = $1 AND id_colegio = $2",
      [subjectId, schoolId]
    );
    if (subRes.rows.length === 0) {
      res.status(404).json({ error: "Materia no encontrada" });
      return;
    }
    const subject = subRes.rows[0];

    // 2. Target academic year (specified by yearId, or default to open year, or fallback to latest year)
    let activeYear = null;
    if (yearId) {
      const yearRes = await pool.query(
        "SELECT id_anio, calendario, estado FROM anio_lectivo WHERE id_anio = $1 AND id_colegio = $2",
        [yearId, schoolId]
      );
      if (yearRes.rows.length > 0) {
        activeYear = yearRes.rows[0];
      }
    }

    if (!activeYear) {
      const yearRes = await pool.query(
        "SELECT id_anio, calendario, estado FROM anio_lectivo WHERE id_colegio = $1 AND estado = 'ABIERTO' ORDER BY id_anio DESC LIMIT 1",
        [schoolId]
      );
      if (yearRes.rows.length > 0) {
        activeYear = yearRes.rows[0];
      } else {
        const fallbackRes = await pool.query(
          "SELECT id_anio, calendario, estado FROM anio_lectivo WHERE id_colegio = $1 ORDER BY id_anio DESC LIMIT 1",
          [schoolId]
        );
        if (fallbackRes.rows.length > 0) {
          activeYear = fallbackRes.rows[0];
        }
      }
    }

    if (!activeYear) {
      res.status(400).json({ error: "No hay un año lectivo disponible para este colegio" });
      return;
    }

    // 3. Periods for the target year
    const periodsRes = await pool.query(
      "SELECT id_periodo, nombre, estado, porcentaje FROM periodo_academico WHERE id_anio = $1 ORDER BY id_periodo ASC",
      [activeYear.id_anio]
    );
    const periods = periodsRes.rows;

    // 4. Assignments for this subject in the target year
    const assignmentsRes = await pool.query(
      `SELECT dg.id_detallegrado, dg.id_docente, dg.id_grupo,
              d.nombre || ' ' || d.apellido as docente_nombre,
              tg.nombre as grado_nombre, ne.nombre as nivel_nombre, tg.nombre as tipo_grado_nombre, tg.id_tipo_grado,
              sec.nombre as seccion_nombre, j.nombre as jornada_nombre
       FROM detalle_grados dg
       JOIN docente d ON dg.id_docente = d.id_docente
       JOIN grupos g ON dg.id_grupo = g.id_grupo
       JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       JOIN secciones sec ON g.id_seccion = sec.id_seccion
       JOIN jornada j ON g.id_jornada = j.id_jornada
       WHERE dg.id_materia = $1 AND dg.id_colegio = $2 AND dg.id_anio = $3
       ORDER BY tg.nombre, ne.nombre, sec.nombre, d.nombre`,
      [subjectId, schoolId, activeYear.id_anio]
    );
    const assignments = assignmentsRes.rows;

    // 5. Competencies and learning evidences for this subject in the target year
    const compsRes = await pool.query(
      `SELECT c.id_competencia, c.id_grupo, c.id_periodo, c.descripcion, c.nombre as competencia_nombre,
              tg.nombre as grado_nombre, ne.nombre as nivel_nombre, tg.id_tipo_grado, tg.nombre as tipo_grado_nombre,
              sec.nombre as seccion_nombre, p.nombre as periodo_nombre, g.id_jornada, j.nombre as jornada_nombre
       FROM competencias c
       JOIN grupos g ON c.id_grupo = g.id_grupo
       JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       JOIN secciones sec ON g.id_seccion = sec.id_seccion
       JOIN jornada j ON g.id_jornada = j.id_jornada
       JOIN periodo_academico p ON c.id_periodo = p.id_periodo
       WHERE c.id_materia = $1 AND c.id_anio = $2 AND c.id_colegio = $3
       ORDER BY p.id_periodo ASC, tg.nombre ASC, ne.nombre ASC, sec.nombre ASC`,
      [subjectId, activeYear.id_anio, schoolId]
    );
    
    const compIds = compsRes.rows.map(c => c.id_competencia);
    let evidences: any[] = [];
    if (compIds.length > 0) {
      const evRes = await pool.query(
        `SELECT ea.id_evidencia, ea.id_competencia, ea.descripcion, ea.orden, ea.id_evidencia_dba,
                ('DBA ' || d.numero_dba) as dba_codigo, ed.descripcion as dba_descripcion
         FROM evidencia_aprendizaje ea
         LEFT JOIN evidencias_dba ed ON ea.id_evidencia_dba = ed.id_evidencia_dba
         LEFT JOIN dba d ON ed.id_dba = d.id_dba
         WHERE ea.id_competencia = ANY($1::int[]) AND ea.id_colegio = $2
         ORDER BY ea.id_competencia ASC, ea.orden ASC`,
        [compIds, schoolId]
      );
      evidences = evRes.rows;
    }

    // Deduplicate competencies with identical id_grupo, id_periodo, and descripcion, preferring the row with evidences
    const uniqueCompsMap = new Map<string, any>();
    compsRes.rows.forEach(comp => {
      const compEvs = evidences.filter(e => e.id_competencia === comp.id_competencia);
      const key = `${comp.id_grupo}_${comp.id_periodo}_${(comp.descripcion || '').trim()}`;
      
      if (!uniqueCompsMap.has(key)) {
        uniqueCompsMap.set(key, {
          ...comp,
          evidencias: compEvs
        });
      } else {
        const existing = uniqueCompsMap.get(key);
        if ((!existing.evidencias || existing.evidencias.length === 0) && compEvs.length > 0) {
          uniqueCompsMap.set(key, {
            ...comp,
            evidencias: compEvs
          });
        }
      }
    });

    const competencies = Array.from(uniqueCompsMap.values());

    // 6. School groups
    const groupsRes = await pool.query(
      `SELECT g.id_grupo, tg.nombre as grado_nombre, ne.nombre as nivel_nombre, tg.id_tipo_grado, tg.nombre as tipo_grado_nombre,
              sec.nombre as seccion_nombre, j.nombre as jornada_nombre
       FROM grupos g
       JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       JOIN secciones sec ON g.id_seccion = sec.id_seccion
       JOIN jornada j ON g.id_jornada = j.id_jornada
       WHERE g.id_colegio = $1
       ORDER BY tg.nombre ASC, ne.nombre ASC, sec.nombre ASC`,
      [schoolId]
    );

    res.json({
      subject,
      activeYear,
      periods,
      assignments,
      competencies,
      groups: groupsRes.rows
    });
  } catch (error: any) {
    console.error("Error fetching subject curriculum details:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createScale = async (req: Request, res: Response): Promise<void> => {
  res.status(409).json({
    error: "Las escalas de valoración se generan automáticamente desde la configuración predeterminada del colegio",
  });
};

export const updateScale = async (req: Request, res: Response): Promise<void> => {
  res.status(409).json({
    error: "Las escalas de valoración se actualizan automáticamente desde la configuración predeterminada del colegio",
  });
};

export const deleteScale = async (req: Request, res: Response): Promise<void> => {
  res.status(409).json({
    error: "Las escalas de valoración se administran automáticamente desde la configuración predeterminada del colegio",
  });
};

export const updateManualScaleConfiguration = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const basicoMax = roundToOne(Number(req.body.basico_max));
  const altoMax = roundToOne(Number(req.body.alto_max));

  if (!schoolId || Number.isNaN(basicoMax) || Number.isNaN(altoMax)) {
    res.status(400).json({ error: "Los cortes manuales de las escalas son obligatorios" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureSchoolSettingsTable();

    const settingsRes = await client.query(
      `SELECT nota_minima, nota_maxima, nota_aprobacion
       FROM configuracion_colegio
       WHERE id_colegio = $1
       FOR UPDATE`,
      [schoolId]
    );

    const settings = settingsRes.rows[0] ?? (await ensureSchoolDefaultSettings(schoolId));
    const notaMinima = Number(settings.nota_minima);
    const notaMaxima = Number(settings.nota_maxima);
    const notaAprobacion = Number(settings.nota_aprobacion);

    if (basicoMax < notaAprobacion || basicoMax > notaMaxima - 0.2) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "El máximo de BASICO deja sin espacio válido al resto de escalas" });
      return;
    }

    if (altoMax < basicoMax + 0.1 || altoMax > notaMaxima - 0.1) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "El máximo de ALTO debe quedar por encima de BASICO y por debajo de SUPERIOR" });
      return;
    }

    await client.query(
      `UPDATE configuracion_colegio
       SET escala_modo = 'MANUAL'
       WHERE id_colegio = $1`,
      [schoolId]
    );

    const syncedScales = await syncSchoolScalesAndGrades(
      client,
      schoolId,
      notaMinima,
      notaMaxima,
      notaMinima,
      notaMaxima,
      notaAprobacion,
      "MANUAL",
      { basicMax: basicoMax, altoMax }
    );

    await client.query("COMMIT");
    res.json({
      message: "Escalas manuales actualizadas correctamente",
      scales: syncedScales,
      escala_modo: "MANUAL",
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error updating manual scale configuration:", error);
    res.status(500).json({ error: error.message || "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const upsertCompetencyByAdmin = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const groupId = Number(req.body.id_grupo);
  const subjectId = Number(req.body.id_materia);
  const periodId = Number(req.body.id_periodo);
  const descripcion = String(req.body.descripcion || "").trim();
  const idEvidenciasDba = req.body.id_evidencias_dba;
  const idDimension = req.body.id_dimension ? Number(req.body.id_dimension) : null;

  if (!schoolId || !groupId || !subjectId || !periodId || !descripcion) {
    res.status(400).json({ error: "Curso, materia, periodo y descripción son obligatorios" });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para gestionar competencias de este colegio." });
    return;
  }

  try {
    const contextRes = await pool.query(
      `SELECT p.id_anio, p.estado
       FROM periodo_academico p
       WHERE p.id_periodo = $1
         AND p.id_colegio = $2`,
      [periodId, schoolId]
    );

    if (contextRes.rows.length === 0) {
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    if (contextRes.rows[0].estado === "CERRADO") {
      res.status(409).json({ error: "No se pueden asignar ni modificar competencias en periodos cerrados." });
      return;
    }

    const client = await pool.connect();
    try {
      const context: TeachingContext = {
        idDetalleGrado: 0,
        idGrupo: groupId,
        idMateria: subjectId,
        idColegio: schoolId,
        idAnio: Number(contextRes.rows[0].id_anio),
      };

      await client.query("BEGIN");
      const created = await syncCompetencyAcrossGrade(client, context, periodId, descripcion, undefined, idDimension);

      // Si se proporcionó id_evidencias_dba, vincularlas a las competencias de todo el grado
      if (idEvidenciasDba !== undefined && Array.isArray(idEvidenciasDba)) {
        // Obtener únicamente las competencias hermanas que pertenecen a esta misma competencia (mismo sync_uuid)
        const sisterCompsRes = await client.query(
          `SELECT id_competencia 
           FROM competencias 
           WHERE id_colegio = $1 
             AND (id_competencia = $2 OR (sync_uuid IS NOT NULL AND sync_uuid = $3))`,
          [schoolId, created.id_competencia, created.sync_uuid]
        );
        const sisterCompIds = sisterCompsRes.rows.map(r => r.id_competencia);

        if (idEvidenciasDba.length === 0) {
          // Desvincular todas
          await client.query(
            `DELETE FROM evidencia_aprendizaje 
             WHERE id_competencia = ANY($1::int[]) AND id_evidencia_dba IS NOT NULL`,
            [sisterCompIds]
          );
        } else {
          // Validar que ninguna de las evidencias oficiales seleccionadas esté vinculada a otra competencia del mismo año, asignatura y grupo (o paralelos) en un periodo diferente
          const alreadyAssignedRes = await client.query(
            `SELECT ea.id_evidencia_dba, c.id_periodo, p.nombre AS periodo_nombre
             FROM evidencia_aprendizaje ea
             JOIN competencias c ON c.id_competencia = ea.id_competencia
             JOIN periodo_academico p ON p.id_periodo = c.id_periodo
             WHERE c.id_colegio = $1
               AND c.id_anio = $2
               AND c.id_materia = $3
               AND c.id_grupo IN (
                 SELECT g2.id_grupo
                 FROM grupos g1
                 JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
                 WHERE g1.id_grupo = $4 AND g1.id_colegio = $1
               )
               AND c.id_periodo != $5
               AND ea.id_evidencia_dba = ANY($6::int[])`,
            [schoolId, created.id_anio, created.id_materia, created.id_grupo, periodId, idEvidenciasDba]
          );

          if (alreadyAssignedRes.rows.length > 0) {
            await client.query("ROLLBACK");
            const names = alreadyAssignedRes.rows.map(r => `Evidencia ID ${r.id_evidencia_dba} en periodo ${r.periodo_nombre}`).join(", ");
            res.status(400).json({ error: `Una o más evidencias ya están asignadas a otra competencia: ${names}` });
            return;
          }

          const officialEvsRes = await client.query(
            `SELECT id_evidencia_dba, descripcion, orden 
             FROM evidencias_dba 
             WHERE id_evidencia_dba = ANY($1::int[]) AND estado = 'ACTIVO'`,
            [idEvidenciasDba]
          );

          if (officialEvsRes.rows.length > 0) {
            // Eliminar evidencias por defecto generadas automáticamente (sin DBA) al vincular evidencias de DBA
            await client.query(
              `DELETE FROM evidencia_aprendizaje 
               WHERE id_competencia = ANY($1::int[]) AND id_evidencia_dba IS NULL`,
              [sisterCompIds]
            );

            for (const targetCompId of sisterCompIds) {
              const existingRes = await client.query(
                `SELECT id_evidencia, id_evidencia_dba FROM evidencia_aprendizaje 
                 WHERE id_competencia = $1 AND id_evidencia_dba IS NOT NULL`,
                [targetCompId]
              );

              const existingMap = new Map<number, number>();
              existingRes.rows.forEach(r => existingMap.set(r.id_evidencia_dba, r.id_evidencia));

              const activeDbaIds = officialEvsRes.rows.map(r => r.id_evidencia_dba);

              const deleteIds: number[] = [];
              existingRes.rows.forEach(r => {
                if (!activeDbaIds.includes(r.id_evidencia_dba)) {
                  deleteIds.push(r.id_evidencia);
                }
              });

              if (deleteIds.length > 0) {
                await client.query(
                  `DELETE FROM evidencia_aprendizaje WHERE id_evidencia = ANY($1::int[])`,
                  [deleteIds]
                );
              }

              for (const offEv of officialEvsRes.rows) {
                if (existingMap.has(offEv.id_evidencia_dba)) {
                  await client.query(
                    `UPDATE evidencia_aprendizaje 
                     SET descripcion = $1, orden = $2 
                     WHERE id_evidencia = $3`,
                    [offEv.descripcion, offEv.orden, existingMap.get(offEv.id_evidencia_dba)]
                  );
                } else {
                  await client.query(
                    `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio, id_evidencia_dba)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [targetCompId, offEv.descripcion, offEv.orden, schoolId, offEv.id_evidencia_dba]
                  );
                }
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      res.json(created);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error upserting competency by admin:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const deleteCompetencyByAdmin = async (req: Request, res: Response): Promise<void> => {
  const competencyId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId as string);

  if (!competencyId || !schoolId) {
    res.status(400).json({ error: "ID de competencia y colegio son obligatorios" });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para eliminar competencias de este colegio." });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const check = await client.query(
      `SELECT c.id_competencia, c.sync_uuid, p.estado AS period_estado 
       FROM competencias c
       JOIN periodo_academico p ON p.id_periodo = c.id_periodo
       WHERE c.id_competencia = $1 AND c.id_colegio = $2`,
      [competencyId, schoolId]
    );

    if (check.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    if (check.rows[0].period_estado === "CERRADO") {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "No se puede eliminar una competencia en un periodo cerrado" });
      return;
    }

    const { sync_uuid } = check.rows[0];

    const targetCompIdsRes = await client.query(
      `SELECT id_competencia FROM competencias 
       WHERE id_colegio = $1 AND (id_competencia = $2 OR (sync_uuid IS NOT NULL AND sync_uuid = $3))`,
      [schoolId, competencyId, sync_uuid]
    );
    const compIds = targetCompIdsRes.rows.map(r => r.id_competencia);

    if (compIds.length > 0) {
      // RN-COM-005: Verificar uso evaluativo antes de eliminar
      const usageRes = await client.query(
        `SELECT COUNT(*)::int as count 
         FROM actividad_materia 
         WHERE id_competencia = ANY($1::int[])`,
        [compIds]
      );

      const activitiesCount = usageRes.rows[0]?.count || 0;
      if (activitiesCount > 0) {
        await client.query("ROLLBACK");
        res.status(409).json({ 
          error: `No se puede eliminar la competencia porque tiene ${activitiesCount} actividad(es) evaluativa(s) asignada(s) por docentes en el aula.` 
        });
        return;
      }

      // 1. Delete associated evidencia_aprendizaje
      await client.query(
        `DELETE FROM evidencia_aprendizaje WHERE id_competencia = ANY($1::int[])`,
        [compIds]
      );

      // 2. Unlink activities in actividad_materia (set id_competencia = NULL)
      await client.query(
        `UPDATE actividad_materia SET id_competencia = NULL WHERE id_competencia = ANY($1::int[])`,
        [compIds]
      );

      // 3. Delete competencies
      await client.query(
        `DELETE FROM competencias WHERE id_competencia = ANY($1::int[]) AND id_colegio = $2`,
        [compIds, schoolId]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true, message: "Competencia y relaciones eliminadas exitosamente" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error deleting competency:", error);
    res.status(500).json({ error: "Error en el servidor al eliminar competencia" });
  } finally {
    client.release();
  }
};

// ─── Evidencias de Aprendizaje ────────────────────────────────────────────────

export const checkCompetenciaUsage = async (req: Request, res: Response): Promise<void> => {
  const competencyId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId as string);

  if (!competencyId || !schoolId) {
    res.status(400).json({ error: "ID de competencia y colegio son obligatorios" });
    return;
  }

  try {
    const compRes = await pool.query(
      `SELECT c.id_competencia, c.sync_uuid, c.descripcion
       FROM competencias c
       WHERE c.id_competencia = $1 AND c.id_colegio = $2`,
      [competencyId, schoolId]
    );

    if (compRes.rows.length === 0) {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    const { sync_uuid, descripcion } = compRes.rows[0];

    const usageRes = await pool.query(
      `SELECT 
         COALESCE(u.nombre || ' ' || COALESCE(u.apellido, ''), 'Docente Asignado') AS docente_nombre,
         m.nombre AS materia_nombre,
         ne.nombre || ' - ' || tg.nombre || ' (' || s.nombre || ')' AS grupo_nombre,
         COUNT(DISTINCT am.id_actividadmateria) AS total_actividades,
         COUNT(DISTINCT nc.id_nota_criterio) AS total_notas
       FROM competencias c
       JOIN actividad_materia am ON am.id_competencia = c.id_competencia
       LEFT JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
       LEFT JOIN materias m ON m.id_materia = c.id_materia
       LEFT JOIN grupos g ON g.id_grupo = c.id_grupo
       LEFT JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
       LEFT JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
       LEFT JOIN secciones s ON s.id_seccion = g.id_seccion
       LEFT JOIN docente d ON d.id_docente = dg.id_docente
       LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
       LEFT JOIN criterio_evaluacion ce ON ce.id_actividadmateria = am.id_actividadmateria
       LEFT JOIN nota_criterio nc ON nc.id_criterio = ce.id_criterio
       WHERE c.id_colegio = $1
         AND (c.id_competencia = $2 OR ($3::uuid IS NOT NULL AND c.sync_uuid = $3::uuid))
       GROUP BY u.nombre, u.apellido, m.nombre, ne.nombre, tg.nombre, s.nombre`,
      [schoolId, competencyId, sync_uuid || null]
    );

    res.json({
      isUsed: usageRes.rows.length > 0,
      descripcion,
      teachersUsage: usageRes.rows
    });
  } catch (error: any) {
    console.error("Error checking competency usage:", error);
    res.status(500).json({ error: "Error en el servidor al verificar uso de competencia" });
  }
};

export const createEvidencia = async (req: Request, res: Response): Promise<void> => {
  const competenciaId = Number(req.params.competenciaId);
  const descripcion = String(req.body.descripcion || "").trim();
  const schoolId = parseSchoolId(req.body.schoolId);

  if (!competenciaId || !descripcion || !schoolId) {
    res.status(400).json({ error: "Competencia, descripción y colegio son obligatorios" });
    return;
  }

  try {
    // Verificar que la competencia pertenece a este colegio y obtener estado del periodo
    const check = await pool.query(
      `SELECT c.id_competencia, p.estado AS period_estado 
       FROM competencias c
       JOIN periodo_academico p ON p.id_periodo = c.id_periodo
       WHERE c.id_competencia = $1 AND c.id_colegio = $2`,
      [competenciaId, schoolId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    if (check.rows[0].period_estado === "CERRADO") {
      res.status(409).json({ error: "No se pueden agregar evidencias a una competencia en un periodo cerrado" });
      return;
    }

    // Calcular el siguiente orden
    const ordenRes = await pool.query(
      `SELECT COALESCE(MAX(orden), -1) + 1 AS next_orden FROM evidencia_aprendizaje WHERE id_competencia = $1`,
      [competenciaId]
    );
    const orden = Number(ordenRes.rows[0].next_orden);

    const result = await pool.query(
      `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [competenciaId, descripcion, orden, schoolId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating evidencia:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const updateEvidencia = async (req: Request, res: Response): Promise<void> => {
  const evidenciaId = Number(req.params.evidenciaId);
  const descripcion = String(req.body.descripcion || "").trim();
  const schoolId = parseSchoolId(req.body.schoolId);

  if (!evidenciaId || !descripcion || !schoolId) {
    res.status(400).json({ error: "ID, descripción y colegio son obligatorios" });
    return;
  }

  try {
    // Verificar estado del periodo de la competencia
    const check = await pool.query(
      `SELECT ea.id_evidencia, p.estado AS period_estado 
       FROM evidencia_aprendizaje ea
       JOIN competencias c ON c.id_competencia = ea.id_competencia
       JOIN periodo_academico p ON p.id_periodo = c.id_periodo
       WHERE ea.id_evidencia = $1 AND ea.id_colegio = $2`,
      [evidenciaId, schoolId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: "Evidencia no encontrada" });
      return;
    }
    if (check.rows[0].period_estado === "CERRADO") {
      res.status(409).json({ error: "No se puede modificar evidencias de una competencia en un periodo cerrado" });
      return;
    }

    const result = await pool.query(
      `UPDATE evidencia_aprendizaje
       SET descripcion = $1
       WHERE id_evidencia = $2 AND id_colegio = $3
       RETURNING *`,
      [descripcion, evidenciaId, schoolId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Evidencia no encontrada" });
      return;
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating evidencia:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const deleteEvidencia = async (req: Request, res: Response): Promise<void> => {
  const evidenciaId = Number(req.params.evidenciaId);
  const schoolId = parseSchoolId(req.query.schoolId as string);

  if (!evidenciaId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    // Verificar estado del periodo de la competencia
    const check = await pool.query(
      `SELECT ea.id_evidencia, p.estado AS period_estado 
       FROM evidencia_aprendizaje ea
       JOIN competencias c ON c.id_competencia = ea.id_competencia
       JOIN periodo_academico p ON p.id_periodo = c.id_periodo
       WHERE ea.id_evidencia = $1 AND ea.id_colegio = $2`,
      [evidenciaId, schoolId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: "Evidencia no encontrada" });
      return;
    }
    if (check.rows[0].period_estado === "CERRADO") {
      res.status(409).json({ error: "No se puede eliminar evidencias de una competencia en un periodo cerrado" });
      return;
    }

    const result = await pool.query(
      `DELETE FROM evidencia_aprendizaje
       WHERE id_evidencia = $1 AND id_colegio = $2
       RETURNING id_evidencia`,
      [evidenciaId, schoolId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Evidencia no encontrada" });
      return;
    }
    res.json({ message: "Evidencia eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting evidencia:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getDbaPlaneacionDisponibles = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  const groupId = Number(req.query.id_grupo);
  const subjectId = Number(req.query.id_materia);
  const competencyId = req.query.id_competencia ? Number(req.query.id_competencia) : null;

  if (!schoolId || !groupId || !subjectId) {
    res.status(400).json({ error: "Colegio, grupo y materia son obligatorios" });
    return;
  }

  try {
    // Obtener el grado del grupo para aplicar reglas especiales de preescolar
    const gradeRes = await pool.query<{ nombre: string }>(
      `SELECT tg.nombre 
       FROM grupos g
       JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
       WHERE g.id_grupo = $1`,
      [groupId]
    );

    if (gradeRes.rows.length === 0) {
      res.status(404).json({ error: "Grupo no encontrado" });
      return;
    }

    const gradeName = gradeRes.rows[0].nombre;

    // Prejardín y Jardín no tienen DBA oficiales del MEN
    if (gradeName === "PREJARDIN" || gradeName === "JARDIN") {
      res.json({ dba: [], versionCurricular: null });
      return;
    }

    const cvcRes = await pool.query(
      `SELECT cvc.version_curricular
       FROM colegio_version_curricular cvc
       WHERE cvc.id_colegio = $1
         AND (
           cvc.area = (SELECT nombre FROM materias WHERE id_materia = $2)
           OR (
             $3 = 'TRANSICION'
             AND cvc.area IN ('Desarrollo Integral', 'Transición', 'Desarrollo Integral (Transición)')
             AND (SELECT nombre FROM materias WHERE id_materia = $2) = 'Desarrollo Integral'
           )
         )
         AND cvc.grado = $3`,
      [schoolId, subjectId, gradeName]
    );

    if (cvcRes.rows.length === 0) {
      // Retornar vacío si no hay asignación, indicando que no usa catálogo oficial
      res.json({ dba: [], versionCurricular: null });
      return;
    }

    const versionCurricular = cvcRes.rows[0].version_curricular;

    // 2. Obtener los DBA y evidencias oficiales activos
    const dbaRes = await pool.query(
      `SELECT d.id_dba, d.numero_dba, d.enunciado, d.area, d.grado, d.version_curricular,
              COALESCE(
                (SELECT json_agg(
                   json_build_object(
                     'id_evidencia_dba', e.id_evidencia_dba,
                     'descripcion', e.descripcion,
                     'orden', e.orden
                   ) ORDER BY e.orden, e.id_evidencia_dba
                 )
                 FROM evidencias_dba e
                 WHERE e.id_dba = d.id_dba AND e.estado = 'ACTIVO'
                ), '[]'::json
              ) AS evidencias
       FROM dba d
       WHERE (
         d.area = (SELECT nombre FROM materias WHERE id_materia = $1)
         OR (
           $3 = 'TRANSICION'
           AND d.area IN ('Desarrollo Integral', 'Transición', 'Desarrollo Integral (Transición)')
           AND (SELECT nombre FROM materias WHERE id_materia = $1) = 'Desarrollo Integral'
         )
       )
         AND d.grado = $3
         AND d.version_curricular = $2
         AND d.estado = 'ACTIVO'
       ORDER BY d.numero_dba`,
      [subjectId, versionCurricular, gradeName]
    );

    // 3. Obtener las evidencias ya asignadas a competencias (separando propia vs otras)
    let assignedMap: Map<number, { competencia_descripcion: string; periodo_nombre: string }> = new Map();
    let ownAssignedSet: Set<number> = new Set();

    if (groupId && subjectId) {
      if (competencyId) {
        // Evidencias asociadas a la MISMA competencia que se está editando
        const ownRes = await pool.query(
          `SELECT DISTINCT ea.id_evidencia_dba
           FROM evidencia_aprendizaje ea
           JOIN competencias c ON c.id_competencia = ea.id_competencia
           WHERE c.id_colegio = $1
             AND (c.id_competencia = $2 OR (c.sync_uuid IS NOT NULL AND c.sync_uuid = (SELECT sync_uuid FROM competencias WHERE id_competencia = $2)))
             AND ea.id_evidencia_dba IS NOT NULL`,
          [schoolId, competencyId]
        );
        for (const row of ownRes.rows) {
          ownAssignedSet.add(Number(row.id_evidencia_dba));
        }

        // Evidencias asociadas a OTRAS competencias
        const otherRes = await pool.query(
          `SELECT DISTINCT ea.id_evidencia_dba, c.descripcion AS competencia_descripcion, p.nombre AS periodo_nombre
           FROM evidencia_aprendizaje ea
           JOIN competencias c ON c.id_competencia = ea.id_competencia
           JOIN periodo_academico p ON p.id_periodo = c.id_periodo
           WHERE c.id_colegio = $1
             AND c.id_materia = $2
             AND c.id_grupo IN (
               SELECT g2.id_grupo
               FROM grupos g1
               JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
               WHERE g1.id_grupo = $3 AND g1.id_colegio = $1
             )
             AND c.id_anio = (SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 ORDER BY id_anio DESC LIMIT 1)
             AND (c.sync_uuid != (SELECT sync_uuid FROM competencias WHERE id_competencia = $4) OR c.sync_uuid IS NULL)
             AND (c.id_competencia != $4)
             AND ea.id_evidencia_dba IS NOT NULL`,
          [schoolId, subjectId, groupId, competencyId]
        );
        for (const row of otherRes.rows) {
          assignedMap.set(Number(row.id_evidencia_dba), {
            competencia_descripcion: row.competencia_descripcion,
            periodo_nombre: row.periodo_nombre,
          });
        }
      } else {
        // Al crear: obtener TODAS las evidencias vinculadas
        const assignedRes = await pool.query(
          `SELECT DISTINCT ea.id_evidencia_dba, c.descripcion AS competencia_descripcion, p.nombre AS periodo_nombre
           FROM evidencia_aprendizaje ea
           JOIN competencias c ON c.id_competencia = ea.id_competencia
           JOIN periodo_academico p ON p.id_periodo = c.id_periodo
           WHERE c.id_colegio = $1
             AND c.id_materia = $2
             AND c.id_grupo IN (
               SELECT g2.id_grupo
               FROM grupos g1
               JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
               WHERE g1.id_grupo = $3 AND g1.id_colegio = $1
             )
             AND c.id_anio = (SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 ORDER BY id_anio DESC LIMIT 1)
             AND ea.id_evidencia_dba IS NOT NULL`,
          [schoolId, subjectId, groupId]
        );
        for (const row of assignedRes.rows) {
          assignedMap.set(Number(row.id_evidencia_dba), {
            competencia_descripcion: row.competencia_descripcion,
            periodo_nombre: row.periodo_nombre,
          });
        }
      }
    }

    // 4. Anotar cada evidencia con su estado de asignación
    const annotatedDba = dbaRes.rows.map(dba => {
      if (Array.isArray(dba.evidencias)) {
        dba.evidencias = dba.evidencias.map((ev: any) => {
          const evId = Number(ev.id_evidencia_dba);
          const isOwn = ownAssignedSet.has(evId);
          const assignment = assignedMap.get(evId);
          return {
            ...ev,
            asignada_a_esta_competencia: isOwn,
            asignada: isOwn || !!assignment,
            asignada_a: assignment || null,
          };
        });
      }
      return dba;
    });

    res.json({ dba: annotatedDba, versionCurricular });
  } catch (error: any) {
    console.error("Error al obtener DBA disponibles para planeación:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const vincularEvidenciasDbaACompetencia = async (req: Request, res: Response): Promise<void> => {
  const competencyId = Number(req.params.competenciaId);
  const schoolId = parseSchoolId(req.body.schoolId);
  const idEvidenciasDba: number[] = req.body.id_evidencias_dba; // Arreglo de IDs de evidencias_dba

  if (!competencyId || !schoolId || !Array.isArray(idEvidenciasDba)) {
    res.status(400).json({ error: "ID de competencia, ID de colegio y el listado de evidencias_dba son requeridos" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Obtener la competencia para verificar pertenencia y obtener el contexto (año, materia, periodo, grupo, sync_uuid)
    const compRes = await client.query(
      `SELECT id_competencia, id_anio, id_grupo, id_materia, id_periodo, id_colegio, sync_uuid 
       FROM competencias 
       WHERE id_competencia = $1 AND id_colegio = $2`,
      [competencyId, schoolId]
    );

    if (compRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    const comp = compRes.rows[0];

    // Asegurar que exista un sync_uuid
    let syncUuid = comp.sync_uuid;
    if (!syncUuid) {
      syncUuid = randomUUID();
      await client.query(
        `UPDATE public.competencias SET sync_uuid = $1 WHERE id_competencia = $2`,
        [syncUuid, competencyId]
      );
      comp.sync_uuid = syncUuid;
    }

    // Verificar el estado del periodo
    const periodRes = await client.query(
      `SELECT estado FROM periodo_academico WHERE id_periodo = $1`,
      [comp.id_periodo]
    );
    if (periodRes.rows.length > 0 && periodRes.rows[0].estado === "CERRADO") {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "No se pueden vincular evidencias a competencias en periodos cerrados." });
      return;
    }

    // 2. Obtener todos los grupos pares de la misma categoría de grado (sincronización a nivel de grado)
    const peerGroupsRes = await client.query(
      `SELECT g2.id_grupo
       FROM grupos g1
       JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
       WHERE g1.id_grupo = $1 AND g1.id_colegio = $2`,
      [comp.id_grupo, schoolId]
    );
    const peerGroupIds = peerGroupsRes.rows.map(r => r.id_grupo);

    // Si se seleccionaron evidencias DBA, verificar que ninguna esté ya vinculada a otra competencia (con sync_uuid diferente o nulo)
    if (idEvidenciasDba.length > 0) {
      const alreadyAssignedRes = await client.query(
        `SELECT ea.id_evidencia_dba, c.id_periodo, p.nombre AS periodo_nombre
         FROM evidencia_aprendizaje ea
         JOIN competencias c ON c.id_competencia = ea.id_competencia
         JOIN periodo_academico p ON p.id_periodo = c.id_periodo
         WHERE c.id_colegio = $1
           AND c.id_anio = $2
           AND c.id_materia = $3
           AND c.id_grupo = ANY($4::int[])
           AND (c.sync_uuid != $5 OR c.sync_uuid IS NULL)
           AND ea.id_evidencia_dba = ANY($6::int[])`,
        [schoolId, comp.id_anio, comp.id_materia, peerGroupIds, comp.sync_uuid, idEvidenciasDba]
      );

      if (alreadyAssignedRes.rows.length > 0) {
        await client.query("ROLLBACK");
        const names = alreadyAssignedRes.rows.map(r => `Evidencia ID ${r.id_evidencia_dba} en periodo ${r.periodo_nombre}`).join(", ");
        res.status(400).json({ error: `Una o más evidencias ya están asignadas a otra competencia: ${names}` });
        return;
      }
    }

    // Obtener todas las competencias hermanas que comparten el mismo sync_uuid
    const compsRes = await client.query(
      `SELECT id_competencia, id_grupo 
       FROM competencias 
       WHERE id_colegio = $1 AND sync_uuid = $2`,
      [schoolId, comp.sync_uuid]
    );
    const sisterCompIds = compsRes.rows.map(r => r.id_competencia);

    // 3. Si no hay evidencias DBA seleccionadas, eliminamos todas las evidencias de aprendizaje que estén enlazadas a DBA para estas competencias
    if (idEvidenciasDba.length === 0) {
      await client.query(
        `DELETE FROM evidencia_aprendizaje 
         WHERE id_competencia = ANY($1::int[]) AND id_evidencia_dba IS NOT NULL`,
        [sisterCompIds]
      );
      await client.query("COMMIT");
      res.json({ message: "Evidencias DBA desvinculadas correctamente de la competencia." });
      return;
    }

    // 4. Consultar las evidencias oficiales del DBA para obtener sus descripciones y orden
    const officialEvsRes = await client.query(
      `SELECT id_evidencia_dba, descripcion, orden 
       FROM evidencias_dba 
       WHERE id_evidencia_dba = ANY($1::int[]) AND estado = 'ACTIVO'`,
      [idEvidenciasDba]
    );

    if (officialEvsRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Ninguna de las evidencias DBA especificadas es válida o está activa" });
      return;
    }

    // Eliminar evidencias por defecto generadas automáticamente (sin DBA) al vincular evidencias de DBA
    await client.query(
      `DELETE FROM evidencia_aprendizaje 
       WHERE id_competencia = ANY($1::int[]) AND id_evidencia_dba IS NULL`,
      [sisterCompIds]
    );

    // Para cada competencia del grado (sincronización vertical):
    for (const targetCompId of sisterCompIds) {
      // Obtener qué evidencias_dba ya están vinculadas en evidencia_aprendizaje para esta competencia
      const existingRes = await client.query(
        `SELECT id_evidencia, id_evidencia_dba FROM evidencia_aprendizaje 
         WHERE id_competencia = $1 AND id_evidencia_dba IS NOT NULL`,
        [targetCompId]
      );

      const existingMap = new Map<number, number>(); // id_evidencia_dba -> id_evidencia
      existingRes.rows.forEach(r => existingMap.set(r.id_evidencia_dba, r.id_evidencia));

      const activeDbaIds = officialEvsRes.rows.map(r => r.id_evidencia_dba);

      // Eliminar las que ya no están seleccionadas
      const deleteIds: number[] = [];
      existingRes.rows.forEach(r => {
        if (!activeDbaIds.includes(r.id_evidencia_dba)) {
          deleteIds.push(r.id_evidencia);
        }
      });

      if (deleteIds.length > 0) {
        await client.query(
          `DELETE FROM evidencia_aprendizaje WHERE id_evidencia = ANY($1::int[])`,
          [deleteIds]
        );
      }

      // Insertar o actualizar las seleccionadas
      for (const offEv of officialEvsRes.rows) {
        if (existingMap.has(offEv.id_evidencia_dba)) {
          // Ya existe, actualizamos descripción y orden por si cambiaron en el catálogo global
          await client.query(
            `UPDATE evidencia_aprendizaje 
             SET descripcion = $1, orden = $2 
             WHERE id_evidencia = $3`,
            [offEv.descripcion, offEv.orden, existingMap.get(offEv.id_evidencia_dba)]
          );
        } else {
          // No existe, la insertamos
          await client.query(
            `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio, id_evidencia_dba)
             VALUES ($1, $2, $3, $4, $5)`,
            [targetCompId, offEv.descripcion, offEv.orden, schoolId, offEv.id_evidencia_dba]
          );
        }
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Evidencias del DBA vinculadas correctamente a la competencia del grado escolar." });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error al vincular evidencias de DBA a competencia:", error);
    res.status(500).json({ error: "Error interno en el servidor" });
  } finally {
    client.release();
  }
};

