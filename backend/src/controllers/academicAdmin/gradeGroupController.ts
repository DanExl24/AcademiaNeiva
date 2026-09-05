import { Request, Response } from "express";
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
    const level = await db
      .selectFrom("nivel_escolar")
      .select("id_nivel")
      .where("id_nivel", "=", levelId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!level) {
      res.status(404).json({ error: "Nivel académico no encontrado para este colegio" });
      return;
    }

    // Obtener todos los grados existentes en la institución para validación estricta de duplicados y variaciones
    const existingGrades = await db
      .selectFrom("tipo_grado as tg")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "tg.id_nivel")
      .select(["tg.id_tipo_grado", "tg.nombre", "tg.id_nivel"])
      .where("ne.id_colegio", "=", schoolId)
      .execute();

    const duplicate = existingGrades.find((g: { id_tipo_grado: number; nombre: string; id_nivel: number }) => {
      return isDuplicateOrSimilarGrade(g.nombre, rawNombre);
    });

    if (duplicate) {
      res.status(409).json({ 
        error: `El nombre de grado '${rawNombre}' es equivalente o similar al grado existente '${duplicate.nombre}' en la institución. No se permiten grados duplicados o con variaciones ortográficas.` 
      });
      return;
    }

    const created = await db
      .insertInto("tipo_grado")
      .values({
        nombre: rawNombre.toUpperCase(),
        id_nivel: levelId,
      })
      .returning(["id_tipo_grado", "nombre", "id_nivel"])
      .executeTakeFirstOrThrow();

    res.status(201).json(created);
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
    const impact = await db
      .selectFrom("tipo_grado as tg")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "tg.id_nivel")
      .leftJoin("grupos as g", (join) =>
        join.onRef("g.id_tipo_grado", "=", "tg.id_tipo_grado").onRef("g.id_colegio", "=", "ne.id_colegio")
      )
      .leftJoin("matricula as m", "m.id_grupo", "g.id_grupo")
      .leftJoin("detalle_grados as dg", "dg.id_grupo", "g.id_grupo")
      .select([
        "tg.id_tipo_grado",
        sql<number>`COUNT(DISTINCT g.id_grupo)::int`.as("cursos_count"),
        sql<number>`COUNT(DISTINCT m.id_matricula)::int`.as("matriculas_count"),
        sql<number>`COUNT(DISTINCT dg.id_detallegrado)::int`.as("asignaciones_count"),
      ])
      .where("tg.id_tipo_grado", "=", gradeTypeId)
      .where("ne.id_colegio", "=", schoolId)
      .groupBy("tg.id_tipo_grado")
      .executeTakeFirst();

    if (!impact) {
      res.status(404).json({ error: "Grado no encontrado" });
      return;
    }

    if (impact.cursos_count > 0 || impact.matriculas_count > 0 || impact.asignaciones_count > 0) {
      res.status(409).json({
        error: "No se puede eliminar el grado porque tiene relaciones académicas activas",
        impact,
      });
      return;
    }

    await db.deleteFrom("tipo_grado").where("id_tipo_grado", "=", gradeTypeId).execute();
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

  try {
    const created = await db.transaction().execute(async (trx) => {
      // If seccionNombre is provided, find or create section
      if (seccionNombre) {
        if (seccionNombre.length > 10) {
          throw new Error("VALIDATION:El nombre de la sección no puede superar los 10 caracteres");
        }

        const secRes = await trx
          .selectFrom("secciones")
          .select("id_seccion")
          .where(sql`UPPER(nombre)`, "=", seccionNombre)
          .executeTakeFirst();

        if (secRes) {
          idSeccion = secRes.id_seccion;
        } else {
          const insertRes = await trx
            .insertInto("secciones")
            .values({ nombre: seccionNombre })
            .returning("id_seccion")
            .executeTakeFirstOrThrow();
          idSeccion = insertRes.id_seccion;
        }
      }

      if (!idSeccion) {
        throw new Error("VALIDATION:La sección es obligatoria");
      }

      const nivelOk = await trx
        .selectFrom("nivel_escolar")
        .select("id_nivel")
        .where("id_nivel", "=", idNivel)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      const jornadaOk = await trx
        .selectFrom("jornada")
        .select("id_jornada")
        .where("id_jornada", "=", idJornada)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      const seccionOk = await trx
        .selectFrom("secciones")
        .select("id_seccion")
        .where("id_seccion", "=", idSeccion)
        .executeTakeFirst();

      const tipoOk = await trx
        .selectFrom("tipo_grado as tg")
        .innerJoin("nivel_escolar as ne", "ne.id_nivel", "tg.id_nivel")
        .select("tg.id_tipo_grado")
        .where("tg.id_tipo_grado", "=", idTipoGrado)
        .where("ne.id_colegio", "=", schoolId)
        .where("tg.id_nivel", "=", idNivel)
        .executeTakeFirst();

      if (!nivelOk || !jornadaOk || !seccionOk || !tipoOk) {
        throw new Error("VALIDATION:La combinación de nivel, jornada, sección y grado no es válida");
      }

      const duplicate = await trx
        .selectFrom("grupos")
        .select("id_grupo")
        .where("id_colegio", "=", schoolId)
        .where("id_nivel", "=", idNivel)
        .where("id_jornada", "=", idJornada)
        .where("id_seccion", "=", idSeccion)
        .where("id_tipo_grado", "=", idTipoGrado)
        .executeTakeFirst();

      if (duplicate) {
        throw new Error("CONFLICT:Ya existe un curso con esta combinación de jornada, grado y sección");
      }

      return await trx
        .insertInto("grupos")
        .values({
          id_nivel: idNivel,
          id_jornada: idJornada,
          id_colegio: schoolId,
          id_seccion: idSeccion,
          cupos_totales: cuposTotales,
          id_tipo_grado: idTipoGrado,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });

    res.status(201).json(created);
  } catch (error: any) {
    if (error.message?.startsWith("VALIDATION:")) {
      res.status(400).json({ error: error.message.replace("VALIDATION:", "") });
      return;
    }
    if (error.message?.startsWith("CONFLICT:")) {
      res.status(409).json({ error: error.message.replace("CONFLICT:", "") });
      return;
    }
    console.error("Error creating group:", error);
    res.status(500).json({ error: "Error en el servidor" });
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
    const impact = await db
      .selectFrom("grupos as g")
      .leftJoin("matricula as m", "m.id_grupo", "g.id_grupo")
      .leftJoin("detalle_grados as dg", "dg.id_grupo", "g.id_grupo")
      .leftJoin("competencias as c", "c.id_grupo", "g.id_grupo")
      .select([
        "g.id_grupo",
        sql<number>`COUNT(DISTINCT m.id_matricula)::int`.as("matriculas_count"),
        sql<number>`COUNT(DISTINCT dg.id_detallegrado)::int`.as("asignaciones_count"),
        sql<number>`COUNT(DISTINCT c.id_competencia)::int`.as("competencias_count"),
      ])
      .where("g.id_grupo", "=", groupId)
      .where("g.id_colegio", "=", schoolId)
      .groupBy("g.id_grupo")
      .executeTakeFirst();

    if (!impact) {
      res.status(404).json({ error: "Curso no encontrado" });
      return;
    }

    if (impact.matriculas_count > 0 || impact.asignaciones_count > 0 || impact.competencias_count > 0) {
      res.status(409).json({
        error: "No se puede eliminar el curso porque tiene relaciones académicas activas",
        impact,
      });
      return;
    }

    await db.deleteFrom("grupos").where("id_grupo", "=", groupId).execute();
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
    const group = await db
      .selectFrom("grupos")
      .select("id_grupo")
      .where("id_grupo", "=", groupId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!group) {
      res.status(404).json({ error: "Curso no encontrado o no pertenece a su institución" });
      return;
    }

    // 2. Contar matrículas actuales
    const matriculasRes = await db
      .selectFrom("matricula")
      .select(sql<number>`COUNT(*)::int`.as("count"))
      .where("id_grupo", "=", groupId)
      .executeTakeFirst();

    const matriculadosActuales = matriculasRes?.count || 0;

    if (newCupos < matriculadosActuales) {
      res.status(400).json({ 
        error: `No se puede reducir el cupo a ${newCupos} porque ya existen ${matriculadosActuales} estudiantes matriculados en este curso.` 
      });
      return;
    }

    // 3. Actualizar
    await db
      .updateTable("grupos")
      .set({ cupos_totales: newCupos })
      .where("id_grupo", "=", groupId)
      .execute();

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
    const parsedYearId = yearId ? Number(yearId) : null;

    const jornadasPromise = db
      .selectFrom("jornada")
      .select(["id_jornada", "nombre"])
      .where("id_colegio", "=", schoolId)
      .orderBy("nombre", "asc")
      .execute();

    const levelsPromise = db
      .selectFrom("nivel_escolar")
      .select(["id_nivel", "nombre"])
      .where("id_colegio", "=", schoolId)
      .orderBy("nombre", "asc")
      .execute();

    const gradeTypesPromise = db
      .selectFrom("tipo_grado as tg")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "tg.id_nivel")
      .leftJoin("grupos as g", (join) =>
        join.onRef("g.id_tipo_grado", "=", "tg.id_tipo_grado").onRef("g.id_colegio", "=", "ne.id_colegio")
      )
      .select([
        "tg.id_tipo_grado",
        "tg.nombre",
        "tg.id_nivel",
        "ne.nombre as nivel_nombre",
        sql<number>`COUNT(DISTINCT g.id_grupo)::int`.as("cursos_count"),
      ])
      .where("ne.id_colegio", "=", schoolId)
      .groupBy(["tg.id_tipo_grado", "tg.nombre", "tg.id_nivel", "ne.nombre"])
      .orderBy("ne.nombre", "asc")
      .orderBy("tg.nombre", "asc")
      .execute();

    const groupsQuery = db
      .selectFrom("grupos as g")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .leftJoin("matricula as m", (join) => {
        let j = join.onRef("m.id_grupo", "=", "g.id_grupo").on("m.estado", "not in", ["CANCELADA", "RECHAZADA"]);
        if (parsedYearId) {
          j = j.on("m.id_anio", "=", parsedYearId);
        }
        return j;
      })
      .leftJoin("detalle_grados as dg", (join) => {
        let j = join.onRef("dg.id_grupo", "=", "g.id_grupo");
        if (parsedYearId) {
          j = j.on("dg.id_anio", "=", parsedYearId);
        }
        return j;
      })
      .leftJoin("competencias as c", (join) => {
        let j = join.onRef("c.id_grupo", "=", "g.id_grupo");
        if (parsedYearId) {
          j = j.on("c.id_anio", "=", parsedYearId);
        }
        return j;
      });

    const groupsPromise = groupsQuery
      .select([
        "g.id_grupo",
        "g.id_nivel",
        "g.id_jornada",
        "g.id_seccion",
        "g.id_tipo_grado",
        "g.cupos_totales",
        "ne.nombre as nivel_nombre",
        "tg.nombre as tipo_grado_nombre",
        "j.nombre as jornada_nombre",
        "s.nombre as seccion_nombre",
        sql<number>`COUNT(DISTINCT m.id_matricula)::int`.as("matriculas_count"),
        sql<number>`COUNT(DISTINCT dg.id_detallegrado)::int`.as("asignaciones_count"),
        sql<number>`COUNT(DISTINCT c.id_competencia)::int`.as("competencias_count"),
      ])
      .where("g.id_colegio", "=", schoolId)
      .groupBy([
        "g.id_grupo",
        "g.id_nivel",
        "g.id_jornada",
        "g.id_seccion",
        "g.id_tipo_grado",
        "g.cupos_totales",
        "ne.nombre",
        "tg.nombre",
        "j.nombre",
        "s.nombre",
      ])
      .orderBy("ne.nombre", "asc")
      .orderBy("tg.nombre", "asc")
      .orderBy(sql`LENGTH(s.nombre)`, "asc")
      .orderBy("s.nombre", "asc")
      .orderBy("j.nombre", "asc")
      .execute();

    const [jornadas, niveles, tiposGrado, grupos] = await Promise.all([
      jornadasPromise,
      levelsPromise,
      gradeTypesPromise,
      groupsPromise,
    ]);

    res.json({
      jornadas,
      niveles,
      tiposGrado,
      grupos,
      groups: grupos,
      grados: grupos,
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
    const group = await db
      .selectFrom("grupos as g")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .select([
        "g.id_grupo",
        "g.cupos_totales",
        "ne.nombre as nivel_nombre",
        "tg.nombre as tipo_grado_nombre",
        "j.nombre as jornada_nombre",
        "s.nombre as seccion_nombre",
      ])
      .where("g.id_grupo", "=", groupId)
      .where("g.id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!group) {
      res.status(404).json({ error: "Curso no encontrado" });
      return;
    }

    let studentsQuery = db
      .selectFrom("matricula as m")
      .innerJoin("estudiante as e", "e.id_estudiante", "m.id_estudiante")
      .leftJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .leftJoin("tipo_documento as td", "td.id_tipodocumento", "u.id_tipodocumento")
      .select([
        "e.id_estudiante",
        "e.nombre",
        "e.apellido",
        "e.codigo as codigo_estudiantil",
        "u.documento",
        "td.tipo as tipo_documento",
        "m.id_matricula",
        "m.estado as estado_matricula",
        "m.tipo as tipo_matricula",
        "u.email",
      ])
      .where("m.id_grupo", "=", groupId)
      .where("m.estado", "not in", ["CANCELADA", "RECHAZADA"]);

    if (yearId) {
      studentsQuery = studentsQuery.where("m.id_anio", "=", yearId);
    }

    const students = await studentsQuery
      .orderBy("e.apellido", "asc")
      .orderBy("e.nombre", "asc")
      .execute();

    let teachersQuery = db
      .selectFrom("detalle_grados as dg")
      .innerJoin("materias as mat", "mat.id_materia", "dg.id_materia")
      .innerJoin("docente as doc", "doc.id_docente", "dg.id_docente")
      .leftJoin("usuario as u", "u.id_usuario", "doc.id_usuario")
      .select([
        "dg.id_detallegrado",
        "mat.id_materia",
        "mat.nombre as materia_nombre",
        "doc.id_docente",
        "doc.nombre as docente_nombre",
        "doc.apellido as docente_apellido",
        "u.documento as docente_documento",
        "u.email as docente_email",
      ])
      .where("dg.id_grupo", "=", groupId);

    if (yearId) {
      teachersQuery = teachersQuery.where("dg.id_anio", "=", yearId);
    }

    const teachers = await teachersQuery
      .orderBy("mat.nombre", "asc")
      .execute();

    res.json({
      group,
      students,
      teachers,
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

  try {
    await db.transaction().execute(async (trx) => {
      // Security: verify group belongs to school
      const group = await trx
        .selectFrom("grupos")
        .select(["id_grupo", "id_seccion"])
        .where("id_grupo", "=", idGrupo)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!group) {
        throw new Error("NOT_FOUND: Curso no encontrado");
      }

      const id_seccion = group.id_seccion;

      // 1. Buscar si ya existe una sección con este nombre en el catálogo general 'secciones'
      const existingSec = await trx
        .selectFrom("secciones")
        .select("id_seccion")
        .where(sql`UPPER(nombre)`, "=", nombre.toUpperCase())
        .executeTakeFirst();

      if (existingSec) {
        const targetSeccionId = existingSec.id_seccion;
        if (targetSeccionId !== id_seccion) {
          await trx
            .updateTable("grupos")
            .set({ id_seccion: targetSeccionId })
            .where("id_grupo", "=", idGrupo)
            .execute();
        }
      } else {
        const shareRes = await trx
          .selectFrom("grupos")
          .select(sql<number>`COUNT(*)::int`.as("total"))
          .where("id_seccion", "=", id_seccion)
          .where("id_colegio", "=", schoolId)
          .executeTakeFirst();

        const shared = Number(shareRes?.total || 0);

        if (shared <= 1 && id_seccion) {
          await trx
            .updateTable("secciones")
            .set({ nombre })
            .where("id_seccion", "=", id_seccion)
            .execute();
        } else {
          const newSec = await trx
            .insertInto("secciones")
            .values({ nombre })
            .returning("id_seccion")
            .executeTakeFirstOrThrow();

          await trx
            .updateTable("grupos")
            .set({ id_seccion: newSec.id_seccion })
            .where("id_grupo", "=", idGrupo)
            .execute();
        }
      }
    });

    res.json({ message: `Curso renombrado a "${nombre}" exitosamente.` });
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND: ")) {
      res.status(404).json({ error: error.message.replace("NOT_FOUND: ", "") });
      return;
    }
    console.error("Error in renameSingleCourse:", error);
    res.status(500).json({ error: "Error en el servidor al renombrar el curso." });
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

  try {
    const renamedCount = await db.transaction().execute(async (trx) => {
      // Verify grade type belongs to school
      const gt = await trx
        .selectFrom("tipo_grado as tg")
        .innerJoin("nivel_escolar as ne", "tg.id_nivel", "ne.id_nivel")
        .select("tg.id_tipo_grado")
        .where("tg.id_tipo_grado", "=", idTipoGrado)
        .where("ne.id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!gt) {
        throw new Error("NOT_FOUND: Grado no encontrado");
      }

      // Get all groups for this grade ordered consistently
      const groups = await trx
        .selectFrom("grupos")
        .select(["id_grupo", "id_seccion"])
        .where("id_tipo_grado", "=", idTipoGrado)
        .where("id_colegio", "=", schoolId)
        .orderBy("id_grupo", "asc")
        .execute();

      if (!groups.length) {
        throw new Error("NO_COURSES: Este grado no tiene cursos");
      }

      // Validate generated name length
      const lastOrdinal = isLetter ? indexToLetter(groups.length - 1) : String(groups.length);
      const maxGeneratedName = `${base}${sep}${lastOrdinal}`;
      if (maxGeneratedName.length > 10) {
        throw new Error(`LENGTH: La estructura del nombre superaría los 10 caracteres (ej: ${maxGeneratedName})`);
      }

      for (let i = 0; i < groups.length; i++) {
        const { id_grupo, id_seccion } = groups[i];
        const ordinal = isLetter ? indexToLetter(i) : String(i + 1);
        const nuevoNombre = `${base}${sep}${ordinal}`;

        const shareRes = await trx
          .selectFrom("grupos")
          .select(sql<number>`COUNT(*)::int`.as("total"))
          .where("id_seccion", "=", id_seccion)
          .where("id_colegio", "=", schoolId)
          .executeTakeFirst();

        const shared = Number(shareRes?.total || 0);

        if (shared <= 1 && id_seccion) {
          await trx
            .updateTable("secciones")
            .set({ nombre: nuevoNombre })
            .where("id_seccion", "=", id_seccion)
            .execute();
        } else {
          const newSec = await trx
            .insertInto("secciones")
            .values({ nombre: nuevoNombre })
            .returning("id_seccion")
            .executeTakeFirstOrThrow();

          await trx
            .updateTable("grupos")
            .set({ id_seccion: newSec.id_seccion })
            .where("id_grupo", "=", id_grupo)
            .execute();
        }
      }

      return groups.length;
    });

    res.json({ message: `${renamedCount} cursos renombrados exitosamente.`, renamed: renamedCount });
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND: ")) {
      res.status(404).json({ error: error.message.replace("NOT_FOUND: ", "") });
      return;
    }
    if (error.message?.startsWith("NO_COURSES: ")) {
      res.status(400).json({ error: error.message.replace("NO_COURSES: ", "") });
      return;
    }
    if (error.message?.startsWith("LENGTH: ")) {
      res.status(400).json({ error: error.message.replace("LENGTH: ", "") });
      return;
    }
    console.error("Error in bulkRenameCourses:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// ============================================================================
// ─── Planeación y Gestión de DBA en Colegios (Fase 2) ────────────────────────
// ============================================================================

export const getAcademicCatalogs = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [sections, levels] = await Promise.all([
      db.selectFrom("secciones").select(["id_seccion", "nombre"]).orderBy("nombre", "asc").execute(),
      db.selectFrom("nivel_escolar").select(["id_nivel", "nombre", "id_colegio"]).orderBy("nombre", "asc").execute(),
    ]);

    res.json({
      secciones: sections,
      niveles: levels,
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
    const includeDefaults = !requestedKeys || requestedKeys.includes('defaults') || requestedKeys.includes('defaultSettings');

    // Auto-switch periods based on current date if periods are requested
    const runPeriodSchedules = !requestedKeys || requestedKeys.includes('periods');
    if (runPeriodSchedules) {
      await autoSwitchPeriodsForYear(schoolId, currentYearId);
    }

    // Only run heavy competency harmonization if explicitly requested via query param (e.g. harmonize=true)
    // to prevent blocking read requests with hundreds of sequential writes and row locks.
    const runCompetencyHarmonization = req.query.harmonize === 'true';
    if (runCompetencyHarmonization) {
      await db.transaction().execute(async (trx) => {
        await harmonizeCompetenciesForSchoolYear(trx, schoolId, currentYearId);
      });
    }

    const queries: Promise<any>[] = [
      // 0: yearRes
      includeYears
        ? db
            .selectFrom("anio_lectivo")
            .select(["id_anio", "calendario", "tipo_calendario", "estado"])
            .where("id_anio", "=", currentYearId)
            .where("id_colegio", "=", schoolId)
            .execute()
        : Promise.resolve([]),

      // 1: academicYearsRes
      includeYears
        ? db
            .selectFrom("anio_lectivo")
            .select(["id_anio", "calendario", "tipo_calendario", "estado"])
            .where("id_colegio", "=", schoolId)
            .orderBy("id_anio", "desc")
            .execute()
        : Promise.resolve([]),

      // 2: defaultSettingsRes
      includeDefaults
        ? ensureSchoolDefaultSettings(schoolId)
        : Promise.resolve(null),

      // 3: periodsRes
      includePeriods
        ? db
            .selectFrom("periodo_academico")
            .select(["id_periodo", "nombre", "estado", "porcentaje", "trimestre", "dia_inicio", "dia_fin", "mes_inicio", "mes_fin", "id_anio"])
            .where("id_colegio", "=", schoolId)
            .where("id_anio", "=", currentYearId)
            .orderBy("id_periodo", "asc")
            .execute()
        : Promise.resolve([]),

      // 4: scalesRes
      includeScales
        ? db
            .selectFrom("escala_valoracion as ev")
            .leftJoin("notas_actividad as n", "n.id_escalavaloracion", "ev.id_escalavaloracion")
            .select([
              "ev.id_escalavaloracion",
              "ev.nivel",
              "ev.valor_minimo",
              "ev.valor_maximo",
              sql<number>`COUNT(DISTINCT n.id_notaactividad)::int`.as("notas_count")
            ])
            .where("ev.id_colegio", "=", schoolId)
            .groupBy("ev.id_escalavaloracion")
            .orderBy("ev.valor_minimo", "desc")
            .orderBy("ev.valor_maximo", "desc")
            .execute()
        : Promise.resolve([]),

      // 5: assignmentsRes
      includeAssignments
        ? db
            .selectFrom("detalle_grados as dg")
            .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
            .innerJoin("grupos as g", "g.id_grupo", "dg.id_grupo")
            .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
            .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
            .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
            .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
            .select([
              "dg.id_detallegrado",
              "dg.id_grupo",
              "dg.id_materia",
              "m.nombre as materia_nombre",
              "ne.nombre as nivel_nombre",
              "tg.nombre as tipo_grado_nombre",
              "s.nombre as seccion_nombre",
              "j.nombre as jornada_nombre"
            ])
            .where("dg.id_colegio", "=", schoolId)
            .where("dg.id_grupo", "is not", null)
            .where("dg.id_anio", "=", currentYearId)
            .orderBy("ne.nombre", "asc")
            .orderBy("tg.nombre", "asc")
            .orderBy(sql`LENGTH(s.nombre)`, "asc")
            .orderBy("s.nombre", "asc")
            .orderBy("j.nombre", "asc")
            .orderBy("m.nombre", "asc")
            .execute()
        : Promise.resolve([]),

      // 6: competenciesRes
      includeCompetencies
        ? sql<any[]>`SELECT
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
                   AND UPPER(TRIM(TRAILING '.' FROM c2.descripcion)) <> UPPER(TRIM(TRAILING '.' FROM ${DEFAULT_COMPETENCY_TEXT}))
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
           WHERE c.id_colegio = ${schoolId}
             AND c.id_anio = ${currentYearId}
           ORDER BY p.id_periodo, ne.nombre, tg.nombre, m.nombre`.execute(db).then((r) => r.rows)
        : Promise.resolve([]),

      // 7: closureSummaryRes
      includeClosures
        ? sql<any[]>`SELECT
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
           WHERE p.id_colegio = ${schoolId} AND p.id_anio = ${currentYearId}
           GROUP BY p.id_periodo
           ORDER BY p.id_periodo`.execute(db).then((r) => r.rows)
        : Promise.resolve([]),

      // 8: dimensionsRes
      includeDimensions
        ? db
            .selectFrom("dimensiones_preescolar")
            .select(["id_dimension", "nombre"])
            .orderBy("id_dimension", "asc")
            .execute()
        : Promise.resolve([]),
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

    const periodsWithDefaults = periodsRes.map((period: any, index: number) => ({
      ...period,
      meses_referencia: getDefaultMonthsLabelForPeriodOrder(index + 1),
    }));

    const authReq = req as AuthRequest;
    let availableYears = academicYearsRes;

    if (authReq.user && includeYears && academicYearsRes.length > 0) {
      const userRoles = authReq.user.roles || [];
      const eligibleYearIds = await getUserEligibleAcademicYears(
        authReq.user.id,
        authReq.user.email || '',
        userRoles,
        schoolId
      );
      availableYears = academicYearsRes.filter((y: any) => eligibleYearIds.includes(Number(y.id_anio)));
    }

    res.json({
      currentYear: yearRes[0] || null,
      activeYear: yearRes[0] || null,
      academicYears: availableYears,
      defaultSettings: defaultSettingsRes,
      periods: periodsWithDefaults,
      scales: scalesRes || [],
      assignments: assignmentsRes || [],
      competencies: competenciesRes || [],
      closureSummary: closureSummaryRes || [],
      dimensions: dimensionsRes || [],
    });
  } catch (error: any) {
    console.error("Error fetching academic settings:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const createJornada = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const rawNombre = String(req.body.nombre || "").trim().toUpperCase();

  if (!schoolId || !rawNombre) {
    res.status(400).json({ error: "Colegio y nombre de la jornada son requeridos." });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para registrar jornadas en este colegio." });
    return;
  }

  const validJornadas = ["MAÑANA", "TARDE", "UNICA", "NOCTURNA"];
  if (!validJornadas.includes(rawNombre)) {
    res.status(400).json({ error: `Nombre de jornada inválido. Debe ser una de: ${validJornadas.join(", ")}` });
    return;
  }

  try {
    const existing = await db
      .selectFrom("jornada")
      .select(["id_jornada", "nombre"])
      .where("id_colegio", "=", schoolId)
      .where("nombre", "=", rawNombre as any)
      .executeTakeFirst();

    if (existing) {
      res.status(409).json({ error: `La jornada '${rawNombre}' ya se encuentra registrada en esta institución.` });
      return;
    }

    const created = await db
      .insertInto("jornada")
      .values({
        id_colegio: schoolId,
        nombre: rawNombre as any
      })
      .returning(["id_jornada", "nombre", "id_colegio"])
      .executeTakeFirstOrThrow();

    res.status(201).json(created);
  } catch (error: any) {
    console.error("Error creating jornada:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

export const deleteJornada = async (req: Request, res: Response): Promise<void> => {
  const idJornada = Number(req.params.id);
  const schoolId = parseSchoolId(req.query.schoolId || req.body.schoolId);

  if (!idJornada || !schoolId) {
    res.status(400).json({ error: "Jornada y colegio son requeridos." });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para eliminar jornadas en este colegio." });
    return;
  }

  try {
    const jornada = await db
      .selectFrom("jornada")
      .selectAll()
      .where("id_jornada", "=", idJornada)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!jornada) {
      res.status(404).json({ error: "Jornada no encontrada para este colegio." });
      return;
    }

    // Verificar si existen grupos vinculados a esta jornada
    const groupsCountRes = await db
      .selectFrom("grupos")
      .select(db.fn.count("id_grupo").as("count"))
      .where("id_jornada", "=", idJornada)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    const linkedGroups = Number(groupsCountRes?.count || 0);
    if (linkedGroups > 0) {
      res.status(409).json({ 
        error: `No es posible eliminar la jornada '${jornada.nombre}' porque tiene ${linkedGroups} curso(s) asociado(s). Reasigna o elimina los cursos antes de retirar la jornada.` 
      });
      return;
    }

    await db
      .deleteFrom("jornada")
      .where("id_jornada", "=", idJornada)
      .where("id_colegio", "=", schoolId)
      .execute();

    res.json({ message: `Jornada '${jornada.nombre}' eliminada exitosamente.` });
  } catch (error: any) {
    console.error("Error deleting jornada:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

const IS_JORNADA_REASSIGNMENT_ENABLED = false;

export const reassignGroupJornada = async (req: Request, res: Response): Promise<void> => {
  // FEATURE GUARD: Reasignación temporalmente restringida para proteger las jornadas seleccionadas en matrícula
  if (!IS_JORNADA_REASSIGNMENT_ENABLED) {
    res.status(403).json({ 
      error: "La reasignación masiva de jornada para cursos se encuentra temporalmente restringida por política institucional de matrículas." 
    });
    return;
  }

  const idGrupo = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const targetIdJornada = Number(req.body.id_jornada);

  if (!idGrupo || !schoolId || !targetIdJornada) {
    res.status(400).json({ error: "Grupo, colegio y nueva jornada son requeridos." });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = Boolean(authReq.user && authReq.user.roles.includes("admin_general"));
  if (!isSupervision && authReq.user && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para reasignar cursos en este colegio." });
    return;
  }

  try {
    const currentGroup = await db
      .selectFrom("grupos")
      .selectAll()
      .where("id_grupo", "=", idGrupo)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!currentGroup) {
      res.status(404).json({ error: "Curso no encontrado." });
      return;
    }

    if (currentGroup.id_jornada === targetIdJornada) {
      res.status(400).json({ error: "El curso ya pertenece a la jornada seleccionada." });
      return;
    }

    const targetJornada = await db
      .selectFrom("jornada")
      .selectAll()
      .where("id_jornada", "=", targetIdJornada)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!targetJornada) {
      res.status(404).json({ error: "La jornada de destino no existe en esta institución." });
      return;
    }

    // Validar si ya existe otro curso con la misma combinación (id_tipo_grado, id_seccion, targetIdJornada)
    const conflictGroup = await db
      .selectFrom("grupos")
      .selectAll()
      .where("id_colegio", "=", schoolId)
      .where("id_tipo_grado", "=", currentGroup.id_tipo_grado)
      .where("id_seccion", "=", currentGroup.id_seccion)
      .where("id_jornada", "=", targetIdJornada)
      .executeTakeFirst();

    if (conflictGroup) {
      res.status(409).json({ 
        error: `Ya existe un curso equivalente en la jornada ${targetJornada.nombre}. No se pueden duplicar cursos con el mismo grado y sección en la misma jornada.` 
      });
      return;
    }

    await db
      .updateTable("grupos")
      .set({ id_jornada: targetIdJornada })
      .where("id_grupo", "=", idGrupo)
      .where("id_colegio", "=", schoolId)
      .execute();

    res.json({ message: `Curso reasignado exitosamente a la jornada ${targetJornada.nombre}.` });
  } catch (error: any) {
    console.error("Error reassigning group jornada:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};


