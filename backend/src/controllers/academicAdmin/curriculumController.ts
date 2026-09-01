import { Request, Response } from "express";
import { PoolClient } from "pg";
import { pool } from "../../config/db";
import { db } from "../../config/kysely";
import { sql } from "kysely";
import { randomUUID } from "crypto";
import { formatFriendlyErrorMessage } from "../../utils/errorHelper";
import {
  syncCompetencyAcrossGrade,
  TeachingContext,
} from "../../config/competencyMigration";
import {
  AuthRequest,
  parseSchoolId,
  ensureSchoolSettingsTable,
  ensureSchoolDefaultSettings,
  roundToOne,
  syncSchoolScalesAndGrades,
} from "./helpers";

export const createSubject = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const nombre = String(req.body.nombre || "").trim();

  if (!schoolId || !nombre) {
    res.status(400).json({ error: "El nombre de la materia es obligatorio" });
    return;
  }

  try {
    const trashId = req.body.trashId ? Number(req.body.trashId) : null;

    const result = await db.transaction().execute(async (trx) => {
      // 1. Verificar duplicado dentro de la transacción
      const duplicate = await trx
        .selectFrom("materias")
        .select("id_materia")
        .where("id_colegio", "=", schoolId)
        .where(sql`UPPER(TRIM(nombre))`, "=", nombre.toUpperCase())
        .executeTakeFirst();

      if (duplicate) {
        throw new Error("DUPLICATE_SUBJECT");
      }

      // 2. Crear materia
      const created = await trx
        .insertInto("materias")
        .values({
          nombre,
          id_colegio: schoolId,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const newSubjectId = created.id_materia;

      if (trashId) {
        // RESTAURACIÓN PROFUNDA
        const trash = await trx
          .selectFrom("papelera_materias")
          .select("data_respaldo")
          .where("id_papelera", "=", trashId)
          .where("id_colegio", "=", schoolId)
          .executeTakeFirst();

        if (trash && trash.data_respaldo) {
          const backup =
            typeof trash.data_respaldo === "string"
              ? JSON.parse(trash.data_respaldo)
              : (trash.data_respaldo as any);

          const activeYear = await trx
            .selectFrom("anio_lectivo")
            .select("id_anio")
            .where("id_colegio", "=", schoolId)
            .where("estado", "=", "ABIERTO")
            .orderBy("id_anio", "desc")
            .executeTakeFirst();

          const fallbackYear = activeYear || (await trx
            .selectFrom("anio_lectivo")
            .select("id_anio")
            .where("id_colegio", "=", schoolId)
            .orderBy("id_anio", "desc")
            .executeTakeFirst());

          const defaultYearId = fallbackYear?.id_anio || 0;

          // 1. Restaurar Asignaciones
          if (backup.assignments && Array.isArray(backup.assignments)) {
            for (const asig of backup.assignments) {
              await trx
                .insertInto("detalle_grados")
                .values({
                  id_materia: newSubjectId,
                  id_docente: asig.id_docente,
                  id_grupo: asig.id_grupo,
                  id_colegio: schoolId,
                  id_anio: asig.id_anio || defaultYearId,
                })
                .execute();
            }
          }

          // 2. Restaurar Competencias
          if (backup.competencies && Array.isArray(backup.competencies)) {
            for (const comp of backup.competencies) {
              await trx
                .insertInto("competencias")
                .values({
                  descripcion: comp.descripcion,
                  id_materia: newSubjectId,
                  id_periodo: comp.id_periodo,
                  id_anio: comp.id_anio,
                  id_grupo: comp.id_grupo,
                  id_colegio: schoolId,
                })
                .execute();
            }
          }

          // 3. Limpiar papelera
          await trx
            .deleteFrom("papelera_materias")
            .where("id_papelera", "=", trashId)
            .execute();
        }
      }

      return created;
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error.message === "DUPLICATE_SUBJECT") {
      res.status(409).json({ error: "Se encontró una materia con el mismo nombre" });
      return;
    }
    console.error("Error creating subject:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const updateSubject = async (req: Request, res: Response): Promise<void> => {
  const subjectId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const nombre = String(req.body.nombre || "").trim();

  if (!subjectId || !schoolId || !nombre) {
    res.status(400).json({ error: "ID de materia, colegio y nuevo nombre son obligatorios." });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = Boolean(authReq.user && authReq.user.roles.includes("admin_general"));
  if (!isSupervision && authReq.user && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para editar materias en este colegio." });
    return;
  }

  try {
    // 1. Verificar que la materia exista en este colegio
    const currentSubject = await db
      .selectFrom("materias")
      .select(["id_materia", "nombre"])
      .where("id_materia", "=", subjectId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!currentSubject) {
      res.status(404).json({ error: "Materia no encontrada en esta institución." });
      return;
    }

    // 2. Verificar que no exista OTRA materia con el mismo nombre en el colegio (case-insensitive)
    const duplicateSubject = await db
      .selectFrom("materias")
      .select(["id_materia", "nombre"])
      .where("id_colegio", "=", schoolId)
      .where("id_materia", "!=", subjectId)
      .where(sql`UPPER(TRIM(nombre))`, "=", nombre.toUpperCase())
      .executeTakeFirst();

    if (duplicateSubject) {
      res.status(409).json({
        error: `Ya existe otra materia registrada con el nombre '${duplicateSubject.nombre}' en la institución.`,
      });
      return;
    }

    // 3. Actualizar nombre de la materia
    const updated = await db
      .updateTable("materias")
      .set({ nombre })
      .where("id_materia", "=", subjectId)
      .where("id_colegio", "=", schoolId)
      .returning(["id_materia", "nombre", "id_colegio"])
      .executeTakeFirst();

    res.json({
      message: "Nombre de la materia actualizado exitosamente.",
      subject: updated,
    });
  } catch (error: any) {
    console.error("Error updating subject:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
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

  try {
    // 1. Obtener información básica de la materia
    const subject = await db
      .selectFrom("materias")
      .select(["nombre", "id_materia"])
      .where("id_materia", "=", subjectId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!subject) {
      res.status(404).json({ error: "Materia no encontrada" });
      return;
    }

    const subjectName = subject.nombre;

    // 2. Analizar impacto
    const impact = await db
      .selectFrom("materias")
      .select([
        (eb) =>
          eb
            .selectFrom("detalle_grados")
            .select(sql<number>`COALESCE(COUNT(DISTINCT id_detallegrado), 0)::int`.as("count"))
            .where("id_materia", "=", subjectId)
            .as("asignaciones_count"),
        (eb) =>
          eb
            .selectFrom("competencias")
            .select(sql<number>`COALESCE(COUNT(DISTINCT id_competencia), 0)::int`.as("count"))
            .where("id_materia", "=", subjectId)
            .as("competencias_count"),
        (eb) =>
          eb
            .selectFrom("actividad_materia as aa")
            .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "aa.id_detallegrado")
            .select(sql<number>`COALESCE(COUNT(DISTINCT aa.id_actividadmateria), 0)::int`.as("count"))
            .where("dg.id_materia", "=", subjectId)
            .as("actividades_count"),
        (eb) =>
          eb
            .selectFrom("notas_actividad as na")
            .innerJoin("actividad_materia as aa", "aa.id_actividadmateria", "na.id_actividadmateria")
            .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "aa.id_detallegrado")
            .select(sql<number>`COALESCE(COUNT(DISTINCT na.id_notaactividad), 0)::int`.as("count"))
            .where("dg.id_materia", "=", subjectId)
            .as("notas_count"),
      ])
      .where("id_materia", "=", subjectId)
      .executeTakeFirst();

    const asigCount = impact?.asignaciones_count || 0;
    const compCount = impact?.competencias_count || 0;
    const hasRelations = asigCount > 0 || compCount > 0;

    if (hasRelations && !force) {
      res.status(409).json({
        error: "No se puede eliminar la materia porque tiene relaciones académicas activas",
        impact,
      });
      return;
    }

    if (force) {
      await db.transaction().execute(async (trx) => {
        // Bypass administrativo de triggers para cascada limpia y respaldo
        await sql`SET LOCAL my.app.bypass_triggers = 'true'`.execute(trx);

        // Respaldo de asignaciones
        const assignmentsBackup = await trx
          .selectFrom("detalle_grados as dg")
          .innerJoin("grupos as gr", "gr.id_grupo", "dg.id_grupo")
          .innerJoin("nivel_escolar as n", "n.id_nivel", "gr.id_nivel")
          .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "gr.id_tipo_grado")
          .innerJoin("secciones as s", "s.id_seccion", "gr.id_seccion")
          .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
          .select([
            "dg.id_docente",
            "dg.id_grupo",
            "dg.id_anio",
            "n.nombre as nivel_nombre",
            "tg.nombre as grado_nombre",
            "s.nombre as seccion_nombre",
            sql<string>`d.nombre || ' ' || d.apellido`.as("docente_nombre"),
          ])
          .distinct()
          .where("dg.id_materia", "=", subjectId)
          .execute();

        // Respaldo de competencias
        const competenciesBackup = await trx
          .selectFrom("competencias")
          .select(["descripcion", "id_periodo", "id_anio", "id_grupo"])
          .distinct()
          .where("id_materia", "=", subjectId)
          .execute();

        const detailedBackup = {
          impact,
          assignments: assignmentsBackup,
          competencies: competenciesBackup,
        };

        // 1. nota_criterio
        await trx
          .deleteFrom("nota_criterio")
          .where("id_criterio", "in", (eb) =>
            eb
              .selectFrom("criterio_evaluacion as c")
              .innerJoin("actividad_materia as aa", "aa.id_actividadmateria", "c.id_actividadmateria")
              .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "aa.id_detallegrado")
              .select("c.id_criterio")
              .where("dg.id_materia", "=", subjectId)
          )
          .execute();

        // 2. notas_actividad
        await trx
          .deleteFrom("notas_actividad")
          .where("id_actividadmateria", "in", (eb) =>
            eb
              .selectFrom("actividad_materia as aa")
              .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "aa.id_detallegrado")
              .select("aa.id_actividadmateria")
              .where("dg.id_materia", "=", subjectId)
          )
          .execute();

        // 3. desempeno
        await trx
          .deleteFrom("desempeno")
          .where("id_actividadmateria", "in", (eb) =>
            eb
              .selectFrom("actividad_materia as aa")
              .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "aa.id_detallegrado")
              .select("aa.id_actividadmateria")
              .where("dg.id_materia", "=", subjectId)
          )
          .execute();

        // 4. criterio_evaluacion
        await trx
          .deleteFrom("criterio_evaluacion")
          .where("id_actividadmateria", "in", (eb) =>
            eb
              .selectFrom("actividad_materia as aa")
              .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "aa.id_detallegrado")
              .select("aa.id_actividadmateria")
              .where("dg.id_materia", "=", subjectId)
          )
          .execute();

        // 5. actividad_materia
        await trx
          .deleteFrom("actividad_materia")
          .where("id_detallegrado", "in", (eb) =>
            eb
              .selectFrom("detalle_grados")
              .select("id_detallegrado")
              .where("id_materia", "=", subjectId)
          )
          .execute();

        // 6. evidencia_aprendizaje
        await trx
          .deleteFrom("evidencia_aprendizaje")
          .where("id_competencia", "in", (eb) =>
            eb
              .selectFrom("competencias")
              .select("id_competencia")
              .where("id_materia", "=", subjectId)
          )
          .execute();

        // 7. competencias
        await trx
          .deleteFrom("competencias")
          .where("id_materia", "=", subjectId)
          .execute();

        // 8. observacion_estudiante
        await trx
          .deleteFrom("observacion_estudiante")
          .where("id_detallegrado", "in", (eb) =>
            eb
              .selectFrom("detalle_grados")
              .select("id_detallegrado")
              .where("id_materia", "=", subjectId)
          )
          .execute();

        // 9. resultado_academico
        await trx
          .deleteFrom("resultado_academico")
          .where("id_detallegrado", "in", (eb) =>
            eb
              .selectFrom("detalle_grados")
              .select("id_detallegrado")
              .where("id_materia", "=", subjectId)
          )
          .execute();

        // 10. registro_asistencia
        await trx
          .deleteFrom("registro_asistencia")
          .where("id_detallegrado", "in", (eb) =>
            eb
              .selectFrom("detalle_grados")
              .select("id_detallegrado")
              .where("id_materia", "=", subjectId)
          )
          .execute();

        // 11. cierre_materia
        await trx
          .deleteFrom("cierre_materia")
          .where("id_detallegrado", "in", (eb) =>
            eb
              .selectFrom("detalle_grados")
              .select("id_detallegrado")
              .where("id_materia", "=", subjectId)
          )
          .execute();

        // 12. detalle_grados
        await trx
          .deleteFrom("detalle_grados")
          .where("id_materia", "=", subjectId)
          .execute();

        // 13. materias
        await trx
          .deleteFrom("materias")
          .where("id_materia", "=", subjectId)
          .execute();

        // 14. Crear respaldo en papelera
        await trx
          .insertInto("papelera_materias")
          .values({
            id_colegio: schoolId,
            nombre_materia: subjectName,
            data_respaldo: JSON.stringify(detailedBackup) as any,
          })
          .execute();
      });

      res.json({
        message: "Materia y todas sus relaciones eliminadas correctamente",
        report: {
          subjectName,
          timestamp: new Date().toISOString(),
          details: impact,
        },
      });
    } else {
      await db
        .deleteFrom("materias")
        .where("id_materia", "=", subjectId)
        .where("id_colegio", "=", schoolId)
        .execute();
      res.json({ message: "Materia eliminada correctamente" });
    }
  } catch (error: any) {
    console.error("Error deleting subject:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
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
    const result = await db
      .selectFrom("papelera_materias")
      .select(["id_papelera", "nombre_materia", "data_respaldo", "fecha_borrado"])
      .where("id_colegio", "=", schoolId)
      .orderBy("fecha_borrado", "desc")
      .execute();
    res.json(result);
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
    const subject = await db
      .selectFrom("materias")
      .selectAll()
      .where("id_materia", "=", subjectId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!subject) {
      res.status(404).json({ error: "Materia no encontrada" });
      return;
    }

    // 2. Target academic year (specified by yearId, or default to open year, or fallback to latest year)
    let activeYear: any = null;
    if (yearId) {
      activeYear = await db
        .selectFrom("anio_lectivo")
        .select(["id_anio", "calendario", "estado"])
        .where("id_anio", "=", yearId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();
    }

    if (!activeYear) {
      activeYear = await db
        .selectFrom("anio_lectivo")
        .select(["id_anio", "calendario", "estado"])
        .where("id_colegio", "=", schoolId)
        .where("estado", "=", "ABIERTO")
        .orderBy("id_anio", "desc")
        .executeTakeFirst();

      if (!activeYear) {
        activeYear = await db
          .selectFrom("anio_lectivo")
          .select(["id_anio", "calendario", "estado"])
          .where("id_colegio", "=", schoolId)
          .orderBy("id_anio", "desc")
          .executeTakeFirst();
      }
    }

    if (!activeYear) {
      res.status(400).json({ error: "No hay un año lectivo disponible para este colegio" });
      return;
    }

    // 3. Periods for the target year
    const periods = await db
      .selectFrom("periodo_academico")
      .select(["id_periodo", "nombre", "estado", "porcentaje"])
      .where("id_anio", "=", activeYear.id_anio)
      .orderBy("id_periodo", "asc")
      .execute();

    // 4. Assignments for this subject in the target year
    const assignments = await db
      .selectFrom("detalle_grados as dg")
      .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
      .innerJoin("grupos as g", "g.id_grupo", "dg.id_grupo")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("secciones as sec", "sec.id_seccion", "g.id_seccion")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .select([
        "dg.id_detallegrado",
        "dg.id_docente",
        "dg.id_grupo",
        sql<string>`d.nombre || ' ' || d.apellido`.as("docente_nombre"),
        "tg.nombre as grado_nombre",
        "ne.nombre as nivel_nombre",
        "tg.nombre as tipo_grado_nombre",
        "tg.id_tipo_grado",
        "sec.nombre as seccion_nombre",
        "j.nombre as jornada_nombre",
      ])
      .where("dg.id_materia", "=", subjectId)
      .where("dg.id_colegio", "=", schoolId)
      .where("dg.id_anio", "=", activeYear.id_anio)
      .orderBy("tg.nombre", "asc")
      .orderBy("ne.nombre", "asc")
      .orderBy("sec.nombre", "asc")
      .orderBy("d.nombre", "asc")
      .execute();

    // 5. Competencies and learning evidences for this subject in the target year
    const comps = await db
      .selectFrom("competencias as c")
      .innerJoin("grupos as g", "g.id_grupo", "c.id_grupo")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("secciones as sec", "sec.id_seccion", "g.id_seccion")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
      .select([
        "c.id_competencia",
        "c.id_grupo",
        "c.id_periodo",
        "c.descripcion",
        "c.nombre as competencia_nombre",
        "tg.nombre as grado_nombre",
        "ne.nombre as nivel_nombre",
        "tg.id_tipo_grado",
        "tg.nombre as tipo_grado_nombre",
        "sec.nombre as seccion_nombre",
        "p.nombre as periodo_nombre",
        "g.id_jornada",
        "j.nombre as jornada_nombre",
      ])
      .where("c.id_materia", "=", subjectId)
      .where("c.id_anio", "=", activeYear.id_anio)
      .where("c.id_colegio", "=", schoolId)
      .orderBy("p.id_periodo", "asc")
      .orderBy("tg.nombre", "asc")
      .orderBy("ne.nombre", "asc")
      .orderBy("sec.nombre", "asc")
      .execute();

    const compIds = comps.map((c) => c.id_competencia);
    let evidences: any[] = [];
    if (compIds.length > 0) {
      evidences = await db
        .selectFrom("evidencia_aprendizaje as ea")
        .leftJoin("evidencias_dba as ed", "ed.id_evidencia_dba", "ea.id_evidencia_dba")
        .leftJoin("dba as d", "d.id_dba", "ed.id_dba")
        .select([
          "ea.id_evidencia",
          "ea.id_competencia",
          "ea.descripcion",
          "ea.orden",
          "ea.id_evidencia_dba",
          sql<string>`('DBA ' || d.numero_dba)`.as("dba_codigo"),
          "ed.descripcion as dba_descripcion",
        ])
        .where("ea.id_competencia", "in", compIds)
        .where("ea.id_colegio", "=", schoolId)
        .orderBy("ea.id_competencia", "asc")
        .orderBy("ea.orden", "asc")
        .execute();
    }

    // Deduplicate competencies with identical id_grupo, id_periodo, and descripcion, preferring the row with evidences
    const uniqueCompsMap = new Map<string, any>();
    comps.forEach((comp) => {
      const compEvs = evidences.filter((e) => e.id_competencia === comp.id_competencia);
      const key = `${comp.id_grupo}_${comp.id_periodo}_${(comp.descripcion || "").trim()}`;

      if (!uniqueCompsMap.has(key)) {
        uniqueCompsMap.set(key, {
          ...comp,
          evidencias: compEvs,
        });
      } else {
        const existing = uniqueCompsMap.get(key);
        if ((!existing.evidencias || existing.evidencias.length === 0) && compEvs.length > 0) {
          uniqueCompsMap.set(key, {
            ...comp,
            evidencias: compEvs,
          });
        }
      }
    });

    const competencies = Array.from(uniqueCompsMap.values());

    // 6. School groups
    const groups = await db
      .selectFrom("grupos as g")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("secciones as sec", "sec.id_seccion", "g.id_seccion")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .select([
        "g.id_grupo",
        "tg.nombre as grado_nombre",
        "ne.nombre as nivel_nombre",
        "tg.id_tipo_grado",
        "tg.nombre as tipo_grado_nombre",
        "sec.nombre as seccion_nombre",
        "j.nombre as jornada_nombre",
      ])
      .where("g.id_colegio", "=", schoolId)
      .orderBy("tg.nombre", "asc")
      .orderBy("ne.nombre", "asc")
      .orderBy("sec.nombre", "asc")
      .execute();

    res.json({
      subject,
      activeYear,
      periods,
      assignments,
      competencies,
      groups,
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

  const yearId = req.body.yearId ? Number(req.body.yearId) : null;
  if (yearId && schoolId) {
    const yearCheck = await db
      .selectFrom("anio_lectivo")
      .select(["estado", "calendario"])
      .where("id_anio", "=", yearId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (yearCheck?.estado === "CERRADO") {
      res.status(400).json({
        error: `El año lectivo ${yearCheck.calendario || ""} se encuentra CERRADO. No es posible modificar las escalas en un ciclo escolar cerrado.`,
      });
      return;
    }
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
    const period = await db
      .selectFrom("periodo_academico")
      .select(["id_anio", "estado"])
      .where("id_periodo", "=", periodId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!period) {
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    if (period.estado === "CERRADO") {
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
        idAnio: Number(period.id_anio),
      };

      await client.query("BEGIN");
      const created = await syncCompetencyAcrossGrade(client, context, periodId, descripcion, undefined, idDimension);

      // Si se proporcionó id_evidencias_dba, vincularlas a las competencias de todo el grado
      if (idEvidenciasDba !== undefined && Array.isArray(idEvidenciasDba)) {
        const sisterCompsRes = await client.query<{ id_competencia: number }>(
          `SELECT id_competencia 
           FROM competencias 
           WHERE id_colegio = $1 
             AND (id_competencia = $2 OR (sync_uuid IS NOT NULL AND sync_uuid = $3))`,
          [schoolId, created.id_competencia, created.sync_uuid]
        );
        const sisterCompIds = sisterCompsRes.rows.map((r) => r.id_competencia);

        if (idEvidenciasDba.length === 0) {
          await client.query(
            `DELETE FROM evidencia_aprendizaje 
             WHERE id_competencia = ANY($1::int[]) AND id_evidencia_dba IS NOT NULL`,
            [sisterCompIds]
          );
        } else {
          // Validar que ninguna de las evidencias oficiales seleccionadas esté vinculada a otra competencia del mismo año, asignatura y grupo (o paralelos)
          const alreadyAssignedRes = await client.query<{
            id_evidencia_dba: number;
            id_periodo: number;
            periodo_nombre: string;
            competencia_descripcion: string;
          }>(
            `SELECT ea.id_evidencia_dba, c.id_periodo, p.nombre AS periodo_nombre, c.descripcion AS competencia_descripcion
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
               AND (c.sync_uuid != $5 OR c.sync_uuid IS NULL)
               AND c.id_competencia != $6
               AND ea.id_evidencia_dba = ANY($7::int[])`,
            [schoolId, created.id_anio, created.id_materia, created.id_grupo, created.sync_uuid, created.id_competencia, idEvidenciasDba]
          );

          if (alreadyAssignedRes.rows.length > 0) {
            await client.query("ROLLBACK");
            const names = alreadyAssignedRes.rows
              .map((r) => `Evidencia ID ${r.id_evidencia_dba} (${r.periodo_nombre} - ${r.competencia_descripcion})`)
              .join(", ");
            res.status(400).json({ error: `Una o más evidencias ya están asignadas a otra competencia: ${names}` });
            return;
          }

          const officialEvsRes = await client.query<{
            id_evidencia_dba: number;
            descripcion: string;
            orden: number;
          }>(
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
              const existingRes = await client.query<{
                id_evidencia: number;
                id_evidencia_dba: number;
              }>(
                `SELECT id_evidencia, id_evidencia_dba FROM evidencia_aprendizaje 
                 WHERE id_competencia = $1 AND id_evidencia_dba IS NOT NULL`,
                [targetCompId]
              );

              const existingMap = new Map<number, number>();
              existingRes.rows.forEach((r) => existingMap.set(r.id_evidencia_dba, r.id_evidencia));

              const activeDbaIds = officialEvsRes.rows.map((r) => r.id_evidencia_dba);

              const deleteIds: number[] = [];
              existingRes.rows.forEach((r) => {
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

  try {
    await db.transaction().execute(async (trx) => {
      const check = await trx
        .selectFrom("competencias as c")
        .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
        .select(["c.id_competencia", "c.sync_uuid", "p.estado as period_estado"])
        .where("c.id_competencia", "=", competencyId)
        .where("c.id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!check) {
        throw new Error("NOT_FOUND");
      }

      if (check.period_estado === "CERRADO") {
        throw new Error("PERIOD_CLOSED");
      }

      const sync_uuid = check.sync_uuid;

      let sisterQuery = trx
        .selectFrom("competencias")
        .select("id_competencia")
        .where("id_colegio", "=", schoolId);

      if (sync_uuid) {
        sisterQuery = sisterQuery.where((eb) =>
          eb.or([
            eb("id_competencia", "=", competencyId),
            eb("sync_uuid", "=", sync_uuid),
          ])
        );
      } else {
        sisterQuery = sisterQuery.where("id_competencia", "=", competencyId);
      }

      const targetCompIdsRes = await sisterQuery.execute();
      const compIds = targetCompIdsRes.map((r) => r.id_competencia);

      if (compIds.length > 0) {
        // RN-COM-005: Verificar uso evaluativo antes de eliminar
        const usageRes = await trx
          .selectFrom("actividad_materia")
          .select(sql<number>`COUNT(*)::int`.as("count"))
          .where("id_competencia", "in", compIds)
          .executeTakeFirst();

        const activitiesCount = usageRes?.count || 0;
        if (activitiesCount > 0) {
          const err = new Error("COMPETENCY_IN_USE");
          (err as any).activitiesCount = activitiesCount;
          throw err;
        }

        // 1. Delete associated evidencia_aprendizaje
        await trx
          .deleteFrom("evidencia_aprendizaje")
          .where("id_competencia", "in", compIds)
          .execute();

        // 2. Unlink activities in actividad_materia (set id_competencia = NULL)
        await trx
          .updateTable("actividad_materia")
          .set({ id_competencia: null })
          .where("id_competencia", "in", compIds)
          .execute();

        // 3. Delete competencies
        await trx
          .deleteFrom("competencias")
          .where("id_competencia", "in", compIds)
          .where("id_colegio", "=", schoolId)
          .execute();
      }
    });

    res.json({ success: true, message: "Competencia y relaciones eliminadas exitosamente" });
  } catch (error: any) {
    if (error.message === "NOT_FOUND") {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }
    if (error.message === "PERIOD_CLOSED") {
      res.status(409).json({ error: "No se puede eliminar una competencia en un periodo cerrado" });
      return;
    }
    if (error.message === "COMPETENCY_IN_USE") {
      res.status(409).json({
        error: `No se puede eliminar la competencia porque tiene ${error.activitiesCount} actividad(es) evaluativa(s) asignada(s) por docentes en el aula.`,
      });
      return;
    }
    console.error("Error deleting competency:", error);
    res.status(500).json({ error: "Error en el servidor al eliminar competencia" });
  }
};

export const checkCompetenciaUsage = async (req: Request, res: Response): Promise<void> => {
  const competencyId = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId as string);

  if (!competencyId || !schoolId) {
    res.status(400).json({ error: "ID de competencia y colegio son obligatorios" });
    return;
  }

  try {
    const comp = await db
      .selectFrom("competencias as c")
      .select(["c.id_competencia", "c.sync_uuid", "c.descripcion"])
      .where("c.id_competencia", "=", competencyId)
      .where("c.id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!comp) {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    const { sync_uuid, descripcion } = comp;

    let query = db
      .selectFrom("competencias as c")
      .innerJoin("actividad_materia as am", "am.id_competencia", "c.id_competencia")
      .leftJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
      .leftJoin("materias as m", "m.id_materia", "c.id_materia")
      .leftJoin("grupos as g", "g.id_grupo", "c.id_grupo")
      .leftJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .leftJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .leftJoin("docente as d", "d.id_docente", "dg.id_docente")
      .leftJoin("usuario as u", "u.id_usuario", "d.id_usuario")
      .leftJoin("criterio_evaluacion as ce", "ce.id_actividadmateria", "am.id_actividadmateria")
      .leftJoin("nota_criterio as nc", "nc.id_criterio", "ce.id_criterio")
      .select([
        sql<string>`COALESCE(u.nombre || ' ' || COALESCE(u.apellido, ''), 'Docente Asignado')`.as("docente_nombre"),
        "m.nombre as materia_nombre",
        sql<string>`ne.nombre || ' - ' || tg.nombre || ' (' || s.nombre || ')'`.as("grupo_nombre"),
        sql<number>`COUNT(DISTINCT am.id_actividadmateria)::int`.as("total_actividades"),
        sql<number>`COUNT(DISTINCT nc.id_criterio)::int`.as("total_notas"),
      ])
      .where("c.id_colegio", "=", schoolId)
      .groupBy([
        "u.nombre",
        "u.apellido",
        "m.nombre",
        "ne.nombre",
        "tg.nombre",
        "s.nombre",
      ]);

    if (sync_uuid) {
      query = query.where((eb) =>
        eb.or([
          eb("c.id_competencia", "=", competencyId),
          eb("c.sync_uuid", "=", sync_uuid),
        ])
      );
    } else {
      query = query.where("c.id_competencia", "=", competencyId);
    }

    const teachersUsage = await query.execute();

    res.json({
      isUsed: teachersUsage.length > 0,
      descripcion,
      teachersUsage,
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
    const check = await db
      .selectFrom("competencias as c")
      .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
      .select(["c.id_competencia", "p.estado as period_estado"])
      .where("c.id_competencia", "=", competenciaId)
      .where("c.id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!check) {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }

    if (check.period_estado === "CERRADO") {
      res.status(409).json({ error: "No se pueden agregar evidencias a una competencia en un periodo cerrado" });
      return;
    }

    const ordenRes = await db
      .selectFrom("evidencia_aprendizaje")
      .select(sql<number>`COALESCE(MAX(orden), -1) + 1`.as("next_orden"))
      .where("id_competencia", "=", competenciaId)
      .executeTakeFirst();

    const orden = Number(ordenRes?.next_orden || 0);

    const result = await db
      .insertInto("evidencia_aprendizaje")
      .values({
        id_competencia: competenciaId,
        descripcion,
        orden,
        id_colegio: schoolId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    res.status(201).json(result);
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
    const check = await db
      .selectFrom("evidencia_aprendizaje as ea")
      .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
      .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
      .select(["ea.id_evidencia", "p.estado as period_estado"])
      .where("ea.id_evidencia", "=", evidenciaId)
      .where("ea.id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!check) {
      res.status(404).json({ error: "Evidencia no encontrada" });
      return;
    }

    if (check.period_estado === "CERRADO") {
      res.status(409).json({ error: "No se puede modificar evidencias de una competencia en un periodo cerrado" });
      return;
    }

    const updated = await db
      .updateTable("evidencia_aprendizaje")
      .set({ descripcion })
      .where("id_evidencia", "=", evidenciaId)
      .where("id_colegio", "=", schoolId)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      res.status(404).json({ error: "Evidencia no encontrada" });
      return;
    }

    res.json(updated);
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
    const check = await db
      .selectFrom("evidencia_aprendizaje as ea")
      .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
      .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
      .select(["ea.id_evidencia", "p.estado as period_estado"])
      .where("ea.id_evidencia", "=", evidenciaId)
      .where("ea.id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!check) {
      res.status(404).json({ error: "Evidencia no encontrada" });
      return;
    }

    if (check.period_estado === "CERRADO") {
      res.status(409).json({ error: "No se puede eliminar evidencias de una competencia en un periodo cerrado" });
      return;
    }

    const deleted = await db
      .deleteFrom("evidencia_aprendizaje")
      .where("id_evidencia", "=", evidenciaId)
      .where("id_colegio", "=", schoolId)
      .returning("id_evidencia")
      .executeTakeFirst();

    if (!deleted) {
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
    // 1. Obtener el grado del grupo
    const gradeRes = await db
      .selectFrom("grupos as g")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .select("tg.nombre")
      .where("g.id_grupo", "=", groupId)
      .executeTakeFirst();

    if (!gradeRes) {
      res.status(404).json({ error: "Grupo no encontrado" });
      return;
    }

    const gradeName = gradeRes.nombre;

    if (gradeName === "PREJARDIN" || gradeName === "JARDIN") {
      res.json({ dba: [], versionCurricular: null });
      return;
    }

    // 2. Obtener la versión curricular asignada
    const subjectRow = await db
      .selectFrom("materias")
      .select("nombre")
      .where("id_materia", "=", subjectId)
      .executeTakeFirst();

    const subjectName = subjectRow?.nombre || "";

    const cvcRes = await db
      .selectFrom("colegio_version_curricular as cvc")
      .select("cvc.version_curricular")
      .where("cvc.id_colegio", "=", schoolId)
      .where((eb) => {
        const conds = [eb("cvc.area", "=", subjectName)];
        if (gradeName === "TRANSICION" && subjectName === "Desarrollo Integral") {
          conds.push(eb("cvc.area", "in", ["Desarrollo Integral", "Transición", "Desarrollo Integral (Transición)"]));
        }
        return eb.or(conds);
      })
      .where("cvc.grado", "=", gradeName)
      .executeTakeFirst();

    if (!cvcRes) {
      res.json({ dba: [], versionCurricular: null });
      return;
    }

    const versionCurricular = cvcRes.version_curricular;

    // 3. Obtener DBAs y sus evidencias oficiales activas
    const dbaRows = await db
      .selectFrom("dba as d")
      .select([
        "d.id_dba",
        "d.numero_dba",
        "d.enunciado",
        "d.area",
        "d.grado",
        "d.version_curricular",
        (eb) =>
          eb
            .selectFrom("evidencias_dba as e")
            .select(
              sql<any>`COALESCE(json_agg(
                json_build_object(
                  'id_evidencia_dba', e.id_evidencia_dba,
                  'descripcion', e.descripcion,
                  'orden', e.orden
                ) ORDER BY e.orden, e.id_evidencia_dba
              ), '[]'::json)`.as("evidencias")
            )
            .whereRef("e.id_dba", "=", "d.id_dba")
            .where("e.estado", "=", "ACTIVO")
            .as("evidencias"),
      ])
      .where((eb) => {
        const conds = [eb("d.area", "=", subjectName)];
        if (gradeName === "TRANSICION" && subjectName === "Desarrollo Integral") {
          conds.push(eb("d.area", "in", ["Desarrollo Integral", "Transición", "Desarrollo Integral (Transición)"]));
        }
        return eb.or(conds);
      })
      .where("d.grado", "=", gradeName)
      .where("d.version_curricular", "=", versionCurricular)
      .where("d.estado", "=", "ACTIVO")
      .orderBy("d.numero_dba", "asc")
      .execute();

    // 4. Resolver el año lectivo objetivo de la consulta
    let targetYearId: number | null = req.query.id_anio ? Number(req.query.id_anio) : null;
    if (!targetYearId && req.query.id_periodo) {
      const pYearRes = await db
        .selectFrom("periodo_academico")
        .select("id_anio")
        .where("id_periodo", "=", Number(req.query.id_periodo))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();
      if (pYearRes) {
        targetYearId = pYearRes.id_anio;
      }
    }
    if (!targetYearId && competencyId) {
      const cYearRes = await db
        .selectFrom("competencias")
        .select("id_anio")
        .where("id_competencia", "=", competencyId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();
      if (cYearRes) {
        targetYearId = cYearRes.id_anio;
      }
    }
    if (!targetYearId) {
      const activeYearRes = await db
        .selectFrom("anio_lectivo")
        .select("id_anio")
        .where("id_colegio", "=", schoolId)
        .where("estado", "=", "ABIERTO")
        .orderBy("id_anio", "desc")
        .executeTakeFirst();
      if (activeYearRes) {
        targetYearId = activeYearRes.id_anio;
      } else {
        const fallbackYearRes = await db
          .selectFrom("anio_lectivo")
          .select("id_anio")
          .where("id_colegio", "=", schoolId)
          .orderBy("id_anio", "desc")
          .executeTakeFirst();
        if (fallbackYearRes) {
          targetYearId = fallbackYearRes.id_anio;
        }
      }
    }

    // 5. Evidencias asignadas
    const assignedMap: Map<number, { competencia_descripcion: string; periodo_nombre: string }> = new Map();
    const ownAssignedSet: Set<number> = new Set();

    if (groupId && subjectId) {
      if (competencyId) {
        // Evidencias de la MISMA competencia
        const targetComp = await db
          .selectFrom("competencias")
          .select(["id_competencia", "sync_uuid"])
          .where("id_competencia", "=", competencyId)
          .executeTakeFirst();

        let ownQuery = db
          .selectFrom("evidencia_aprendizaje as ea")
          .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
          .select("ea.id_evidencia_dba")
          .distinct()
          .where("c.id_colegio", "=", schoolId)
          .where("ea.id_evidencia_dba", "is not", null);

        if (targetComp?.sync_uuid) {
          ownQuery = ownQuery.where((eb) =>
            eb.or([
              eb("c.id_competencia", "=", competencyId),
              eb("c.sync_uuid", "=", targetComp.sync_uuid),
            ])
          );
        } else {
          ownQuery = ownQuery.where("c.id_competencia", "=", competencyId);
        }

        const ownRes = await ownQuery.execute();
        for (const row of ownRes) {
          if (row.id_evidencia_dba) ownAssignedSet.add(Number(row.id_evidencia_dba));
        }

        // Evidencias de OTRAS competencias
        let otherQuery = db
          .selectFrom("evidencia_aprendizaje as ea")
          .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
          .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
          .select([
            "ea.id_evidencia_dba",
            "c.descripcion as competencia_descripcion",
            "p.nombre as periodo_nombre",
          ])
          .distinct()
          .where("c.id_colegio", "=", schoolId)
          .where("c.id_materia", "=", subjectId)
          .where("c.id_grupo", "in", (eb) =>
            eb
              .selectFrom("grupos as g1")
              .innerJoin("grupos as g2", (join) =>
                join
                  .onRef("g2.id_nivel", "=", "g1.id_nivel")
                  .onRef("g2.id_tipo_grado", "=", "g1.id_tipo_grado")
              )
              .select("g2.id_grupo")
              .where("g1.id_grupo", "=", groupId)
              .where("g1.id_colegio", "=", schoolId)
          )
          .where("c.id_competencia", "!=", competencyId)
          .where("ea.id_evidencia_dba", "is not", null);

        if (targetYearId) {
          otherQuery = otherQuery.where("c.id_anio", "=", targetYearId);
        }

        if (targetComp?.sync_uuid) {
          otherQuery = otherQuery.where((eb) =>
            eb.or([
              eb("c.sync_uuid", "!=", targetComp.sync_uuid),
              eb("c.sync_uuid", "is", null),
            ])
          );
        }

        const otherRes = await otherQuery.execute();
        for (const row of otherRes) {
          if (row.id_evidencia_dba) {
            assignedMap.set(Number(row.id_evidencia_dba), {
              competencia_descripcion: row.competencia_descripcion,
              periodo_nombre: row.periodo_nombre,
            });
          }
        }
      } else {
        // Al crear: obtener TODAS las evidencias vinculadas en este grado/materia/año
        let assignedQuery = db
          .selectFrom("evidencia_aprendizaje as ea")
          .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
          .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
          .select([
            "ea.id_evidencia_dba",
            "c.descripcion as competencia_descripcion",
            "p.nombre as periodo_nombre",
          ])
          .distinct()
          .where("c.id_colegio", "=", schoolId)
          .where("c.id_materia", "=", subjectId)
          .where("c.id_grupo", "in", (eb) =>
            eb
              .selectFrom("grupos as g1")
              .innerJoin("grupos as g2", (join) =>
                join
                  .onRef("g2.id_nivel", "=", "g1.id_nivel")
                  .onRef("g2.id_tipo_grado", "=", "g1.id_tipo_grado")
              )
              .select("g2.id_grupo")
              .where("g1.id_grupo", "=", groupId)
              .where("g1.id_colegio", "=", schoolId)
          )
          .where("ea.id_evidencia_dba", "is not", null);

        if (targetYearId) {
          assignedQuery = assignedQuery.where("c.id_anio", "=", targetYearId);
        }

        const assignedRes = await assignedQuery.execute();
        for (const row of assignedRes) {
          if (row.id_evidencia_dba) {
            assignedMap.set(Number(row.id_evidencia_dba), {
              competencia_descripcion: row.competencia_descripcion,
              periodo_nombre: row.periodo_nombre,
            });
          }
        }
      }
    }

    // 6. Anotar cada evidencia con su estado de asignación
    const annotatedDba = dbaRows.map((dba) => {
      let evList = dba.evidencias;
      if (typeof evList === "string") {
        try {
          evList = JSON.parse(evList);
        } catch {
          evList = [];
        }
      }
      if (Array.isArray(evList)) {
        evList = evList.map((ev: any) => {
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
      return {
        ...dba,
        evidencias: evList,
      };
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
  const idEvidenciasDba: number[] = req.body.id_evidencias_dba;

  if (!competencyId || !schoolId || !Array.isArray(idEvidenciasDba)) {
    res.status(400).json({ error: "ID de competencia, ID de colegio y el listado de evidencias_dba son requeridos" });
    return;
  }

  try {
    await db.transaction().execute(async (trx) => {
      // 1. Obtener la competencia
      const comp = await trx
        .selectFrom("competencias")
        .select(["id_competencia", "id_anio", "id_grupo", "id_materia", "id_periodo", "id_colegio", "sync_uuid"])
        .where("id_competencia", "=", competencyId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!comp) {
        throw new Error("COMPETENCY_NOT_FOUND");
      }

      let syncUuid = comp.sync_uuid;
      if (!syncUuid) {
        syncUuid = randomUUID();
        await trx
          .updateTable("competencias")
          .set({ sync_uuid: syncUuid })
          .where("id_competencia", "=", competencyId)
          .execute();
      }

      // 2. Verificar estado del periodo
      const period = await trx
        .selectFrom("periodo_academico")
        .select("estado")
        .where("id_periodo", "=", comp.id_periodo)
        .executeTakeFirst();

      if (period?.estado === "CERRADO") {
        throw new Error("PERIOD_CLOSED");
      }

      // 3. Grupos pares
      const peerGroups = await trx
        .selectFrom("grupos as g1")
        .innerJoin("grupos as g2", (join) =>
          join
            .onRef("g2.id_nivel", "=", "g1.id_nivel")
            .onRef("g2.id_tipo_grado", "=", "g1.id_tipo_grado")
        )
        .select("g2.id_grupo")
        .where("g1.id_grupo", "=", comp.id_grupo)
        .where("g1.id_colegio", "=", schoolId)
        .execute();

      const peerGroupIds = peerGroups.map((r) => r.id_grupo);

      // Si se seleccionaron evidencias DBA, verificar colisión
      if (idEvidenciasDba.length > 0) {
        let collisionQuery = trx
          .selectFrom("evidencia_aprendizaje as ea")
          .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
          .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
          .select([
            "ea.id_evidencia_dba",
            "c.id_periodo",
            "p.nombre as periodo_nombre",
            "c.descripcion as competencia_descripcion",
          ])
          .where("c.id_colegio", "=", schoolId)
          .where("c.id_anio", "=", comp.id_anio)
          .where("c.id_materia", "=", comp.id_materia)
          .where("c.id_grupo", "in", peerGroupIds)
          .where("c.id_competencia", "!=", competencyId)
          .where("ea.id_evidencia_dba", "in", idEvidenciasDba);

        if (syncUuid) {
          collisionQuery = collisionQuery.where((eb) =>
            eb.or([
              eb("c.sync_uuid", "!=", syncUuid),
              eb("c.sync_uuid", "is", null),
            ])
          );
        }

        const alreadyAssigned = await collisionQuery.execute();

        if (alreadyAssigned.length > 0) {
          const names = alreadyAssigned
            .map((r) => `Evidencia ID ${r.id_evidencia_dba} (${r.periodo_nombre} - ${r.competencia_descripcion})`)
            .join(", ");
          const err = new Error("EVIDENCES_ALREADY_ASSIGNED");
          (err as any).assignedNames = names;
          throw err;
        }
      }

      // Obtener todas las competencias hermanas que comparten el mismo sync_uuid
      const sisterComps = await trx
        .selectFrom("competencias")
        .select(["id_competencia", "id_grupo"])
        .where("id_colegio", "=", schoolId)
        .where("sync_uuid", "=", syncUuid)
        .execute();

      const sisterCompIds = sisterComps.map((r) => r.id_competencia);

      if (idEvidenciasDba.length === 0) {
        await trx
          .deleteFrom("evidencia_aprendizaje")
          .where("id_competencia", "in", sisterCompIds)
          .where("id_evidencia_dba", "is not", null)
          .execute();
        return;
      }

      const officialEvs = await trx
        .selectFrom("evidencias_dba")
        .select(["id_evidencia_dba", "descripcion", "orden"])
        .where("id_evidencia_dba", "in", idEvidenciasDba)
        .where("estado", "=", "ACTIVO")
        .execute();

      if (officialEvs.length === 0) {
        throw new Error("NO_VALID_DBA_EVIDENCES");
      }

      // Eliminar evidencias por defecto sin DBA
      await trx
        .deleteFrom("evidencia_aprendizaje")
        .where("id_competencia", "in", sisterCompIds)
        .where("id_evidencia_dba", "is", null)
        .execute();

      for (const targetCompId of sisterCompIds) {
        const existingEvs = await trx
          .selectFrom("evidencia_aprendizaje")
          .select(["id_evidencia", "id_evidencia_dba"])
          .where("id_competencia", "=", targetCompId)
          .where("id_evidencia_dba", "is not", null)
          .execute();

        const existingMap = new Map<number, number>();
        existingEvs.forEach((r) => {
          if (r.id_evidencia_dba) existingMap.set(r.id_evidencia_dba, r.id_evidencia);
        });

        const activeDbaIds = officialEvs.map((r) => r.id_evidencia_dba);

        const deleteIds: number[] = [];
        existingEvs.forEach((r) => {
          if (r.id_evidencia_dba && !activeDbaIds.includes(r.id_evidencia_dba)) {
            deleteIds.push(r.id_evidencia);
          }
        });

        if (deleteIds.length > 0) {
          await trx
            .deleteFrom("evidencia_aprendizaje")
            .where("id_evidencia", "in", deleteIds)
            .execute();
        }

        for (const offEv of officialEvs) {
          if (existingMap.has(offEv.id_evidencia_dba)) {
            await trx
              .updateTable("evidencia_aprendizaje")
              .set({
                descripcion: offEv.descripcion,
                orden: offEv.orden,
              })
              .where("id_evidencia", "=", existingMap.get(offEv.id_evidencia_dba)!)
              .execute();
          } else {
            await trx
              .insertInto("evidencia_aprendizaje")
              .values({
                id_competencia: targetCompId,
                descripcion: offEv.descripcion,
                orden: offEv.orden,
                id_colegio: schoolId,
                id_evidencia_dba: offEv.id_evidencia_dba,
              })
              .execute();
          }
        }
      }
    });

    res.json({ message: "Evidencias del DBA vinculadas correctamente a la competencia del grado escolar." });
  } catch (error: any) {
    if (error.message === "COMPETENCY_NOT_FOUND") {
      res.status(404).json({ error: "Competencia no encontrada" });
      return;
    }
    if (error.message === "PERIOD_CLOSED") {
      res.status(409).json({ error: "No se pueden vincular evidencias a competencias en periodos cerrados." });
      return;
    }
    if (error.message === "EVIDENCES_ALREADY_ASSIGNED") {
      res.status(400).json({ error: `Una o más evidencias ya están asignadas a otra competencia: ${error.assignedNames}` });
      return;
    }
    if (error.message === "NO_VALID_DBA_EVIDENCES") {
      res.status(400).json({ error: "Ninguna de las evidencias DBA especificadas es válida o está activa" });
      return;
    }
    console.error("Error al vincular evidencias de DBA a competencia:", error);
    res.status(500).json({ error: "Error interno en el servidor" });
  }
};
