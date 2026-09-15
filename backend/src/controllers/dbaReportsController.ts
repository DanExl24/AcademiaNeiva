import { Request, Response } from "express";
import { db } from "../config/kysely";
import { sql } from "kysely";

// Helper to parse schoolId
const parseSchoolId = (val: any): number => {
  const id = Number(val);
  return Number.isNaN(id) ? 0 : id;
};

// ============================================================================
// 1. REPORTE DE COHERENCIA CURRICULAR (PLANEADO VS REAL)
// ============================================================================
export const obtenerReporteCoherenciaCurricular = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  const { id_anio, yearId, id_periodo, id_grupo, grado, id_materia, id_docente, solo_con_estudiantes } = req.query;
  const targetYear = id_anio || yearId;
  const targetGrade = (grado || id_grupo) as string;

  if (!schoolId) {
    res.status(400).json({ error: "El ID de colegio es obligatorio" });
    return;
  }

  try {
    let query = db
      .selectFrom("actividad_evidencia_dba as aedba")
      .innerJoin("evidencias_dba as edba", "edba.id_evidencia_dba", "aedba.id_evidencia_dba")
      .innerJoin("dba", "dba.id_dba", "edba.id_dba")
      .innerJoin("actividad_materia as am", "am.id_actividadmateria", "aedba.id_actividadmateria")
      .innerJoin("competencias as c", "c.id_competencia", "am.id_competencia")
      .innerJoin("periodo_academico as p", "p.id_periodo", "c.id_periodo")
      .innerJoin("grupos as g", "g.id_grupo", "c.id_grupo")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "tg.id_nivel")
      .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .innerJoin("materias as m", "m.id_materia", "c.id_materia")
      .leftJoin(
        (eb) =>
          eb
            .selectFrom("detalle_grados as dg_cur")
            .select(["dg_cur.id_docente", "dg_cur.id_grupo", "dg_cur.id_materia"])
            .distinctOn(["dg_cur.id_grupo", "dg_cur.id_materia"])
            .orderBy("dg_cur.id_grupo")
            .orderBy("dg_cur.id_materia")
            .orderBy("dg_cur.id_detallegrado", "desc")
            .as("dg"),
        (join) =>
          join
            .onRef("dg.id_grupo", "=", "g.id_grupo")
            .onRef("dg.id_materia", "=", "m.id_materia")
      )
      .leftJoin("docente as d", "d.id_docente", "dg.id_docente")
      .leftJoin("usuario as u", "u.id_usuario", "d.id_usuario")
      .leftJoin("docente as d_creador", "d_creador.id_docente", "am.id_docente_creador")
      .leftJoin("usuario as u_creador", "u_creador.id_usuario", "d_creador.id_usuario")
      .where("c.id_colegio", "=", schoolId)
      .select([
        "am.id_actividadmateria",
        "am.nombre as actividad_nombre",
        "am.porcentaje as actividad_porcentaje",
        "am.fecha_creacion as actividad_fecha",
        "am.motivo_extra",
        "am.justificacion_extra",
        "c.id_competencia",
        "c.descripcion as competencia_descripcion",
        "c.nombre as competencia_nombre",
        "p.id_periodo",
        "p.nombre as periodo_nombre",
        "g.id_grupo",
        "j.nombre as jornada_nombre",
        sql<string>`ne.nombre || ' - ' || tg.nombre || ' (' || s.nombre || ') [' || j.nombre || ']'`.as("grupo_nombre"),
        "m.id_materia",
        "m.nombre as materia_nombre",
        "d.id_docente",
        sql<string>`u.nombre || ' ' || u.apellido`.as("docente_nombre"),
        sql<string>`COALESCE(u_creador.nombre || ' ' || u_creador.apellido, u.nombre || ' ' || u.apellido)`.as("docente_creador_nombre"),
        "edba.id_evidencia_dba",
        "edba.descripcion as evidencia_descripcion",
        "edba.orden as evidencia_orden",
        "dba.id_dba",
        "dba.numero_dba",
        "dba.enunciado as dba_enunciado",
        sql<string>`
          CASE 
            WHEN EXISTS (
              SELECT 1 
              FROM evidencia_aprendizaje ea
              WHERE ea.id_competencia = am.id_competencia 
                AND ea.id_evidencia_dba = aedba.id_evidencia_dba
            ) THEN 'PLANEADA'
            ELSE 'EXTRA'
          END
        `.as("estado_coherencia"),
        sql<number>`COALESCE((
          SELECT COUNT(*)::int
          FROM matricula m_sub
          WHERE m_sub.id_grupo = g.id_grupo
            AND m_sub.id_anio = c.id_anio
            AND m_sub.estado = 'ACTIVA'
        ), 0)`.as("total_estudiantes"),
        sql<number>`COALESCE((
          SELECT COUNT(DISTINCT na_sub.id_estudiante)::int
          FROM notas_actividad na_sub
          WHERE na_sub.id_actividadmateria = am.id_actividadmateria
            AND na_sub.nota IS NOT NULL
        ), 0)`.as("estudiantes_calificados"),
        sql<number>`GREATEST(0, COALESCE((
          SELECT COUNT(*)::int
          FROM matricula m_sub
          WHERE m_sub.id_grupo = g.id_grupo
            AND m_sub.id_anio = c.id_anio
            AND m_sub.estado = 'ACTIVA'
        ), 0) - COALESCE((
          SELECT COUNT(DISTINCT na_sub.id_estudiante)::int
          FROM notas_actividad na_sub
          WHERE na_sub.id_actividadmateria = am.id_actividadmateria
            AND na_sub.nota IS NOT NULL
        ), 0))`.as("estudiantes_pendientes"),
        sql<string>`
          CASE
            WHEN (
              SELECT COUNT(DISTINCT na_sub.id_estudiante)::int
              FROM notas_actividad na_sub
              WHERE na_sub.id_actividadmateria = am.id_actividadmateria
                AND na_sub.nota IS NOT NULL
            ) >= (
              SELECT COUNT(*)::int
              FROM matricula m_sub
              WHERE m_sub.id_grupo = g.id_grupo
                AND m_sub.id_anio = c.id_anio
                AND m_sub.estado = 'ACTIVA'
            ) AND (
              SELECT COUNT(*)::int
              FROM matricula m_sub
              WHERE m_sub.id_grupo = g.id_grupo
                AND m_sub.id_anio = c.id_anio
                AND m_sub.estado = 'ACTIVA'
            ) > 0 THEN 'COMPLETO'
            WHEN (
              SELECT COUNT(DISTINCT na_sub.id_estudiante)::int
              FROM notas_actividad na_sub
              WHERE na_sub.id_actividadmateria = am.id_actividadmateria
                AND na_sub.nota IS NOT NULL
            ) > 0 THEN 'PARCIAL'
            ELSE 'SIN_CALIFICAR'
          END
        `.as("estado_calificacion")
      ]);

    if (targetYear && targetYear !== "TODOS") {
      query = query.where("c.id_anio", "=", Number(targetYear));
    }

    if (id_periodo && id_periodo !== "TODOS") {
      query = query.where("c.id_periodo", "=", Number(id_periodo));
    }

    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        query = query.where("g.id_grupo", "=", Number(targetGrade));
      } else {
        query = query.where(sql`LOWER(TRIM(tg.nombre))`, "=", targetGrade.trim().toLowerCase());
      }
    }

    if (id_materia && id_materia !== "TODOS") {
      query = query.where("c.id_materia", "=", Number(id_materia));
    }

    if (id_docente && id_docente !== "TODOS") {
      query = query.where("d.id_docente", "=", Number(id_docente));
    }

    if (solo_con_estudiantes === "true" || solo_con_estudiantes === "1") {
      query = query.where(sql`(
        SELECT COUNT(*)::int
        FROM matricula m_sub
        WHERE m_sub.id_grupo = g.id_grupo
          AND m_sub.id_anio = c.id_anio
          AND m_sub.estado = 'ACTIVA'
      )`, ">", 0);
    }

    query = query
      .orderBy("p.id_periodo", "asc")
      .orderBy(sql`ne.nombre || ' - ' || tg.nombre || ' (' || s.nombre || ') [' || j.nombre || ']'`, "asc")
      .orderBy("m.nombre", "asc")
      .orderBy("am.id_actividadmateria", "asc")
      .orderBy("edba.orden", "asc");

    const result = await query.execute();
    res.json(result);
  } catch (error: any) {
    console.error("Error al obtener reporte de coherencia curricular:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// ============================================================================
// 2. REPORTE DE COBERTURA DE DBA (KPI'S Y LISTADO OPTIMIZADO)
// ============================================================================
export const obtenerReporteCoberturaDba = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  const { id_anio, yearId, id_periodo, id_materia, id_grupo, grado } = req.query;
  const targetYear = (id_anio || yearId) as string;
  const targetGrade = (grado || id_grupo) as string;

  if (!schoolId) {
    res.status(400).json({ error: "El ID de colegio es obligatorio" });
    return;
  }

  const authReq = req as any;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para ver los reportes DBA de este colegio." });
    return;
  }

  try {
    const periodParam = (id_periodo && id_periodo !== "TODOS") ? Number(id_periodo) : null;
    const yearParam = (targetYear && targetYear !== "TODOS") ? Number(targetYear) : null;

    // Subquery vectorizada de evidencias planeadas
    let planSub = db
      .selectFrom("evidencia_aprendizaje as ea")
      .innerJoin("competencias as c", "c.id_competencia", "ea.id_competencia")
      .innerJoin("grupos as g", "g.id_grupo", "c.id_grupo")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .where("c.id_colegio", "=", schoolId)
      .select("ea.id_evidencia_dba")
      .distinct();

    if (periodParam !== null) {
      planSub = planSub.where("c.id_periodo", "=", periodParam);
    }
    if (yearParam !== null) {
      planSub = planSub.where("c.id_anio", "=", yearParam);
    }
    if (id_materia && id_materia !== "TODOS") {
      planSub = planSub.where("c.id_materia", "=", Number(id_materia));
    }
    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        planSub = planSub.where("g.id_grupo", "=", Number(targetGrade));
      } else {
        planSub = planSub.where(sql`LOWER(TRIM(tg.nombre))`, "=", targetGrade.trim().toLowerCase());
      }
    }

    // Subquery vectorizada de IDs de evidencias evaluadas
    let evalDistinctSub = db
      .selectFrom("actividad_evidencia_dba as aedba")
      .innerJoin("actividad_materia as am", "am.id_actividadmateria", "aedba.id_actividadmateria")
      .innerJoin("competencias as c", "c.id_competencia", "am.id_competencia")
      .innerJoin("grupos as g", "g.id_grupo", "c.id_grupo")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .where("am.id_colegio", "=", schoolId)
      .select("aedba.id_evidencia_dba")
      .distinct();

    if (periodParam !== null) {
      evalDistinctSub = evalDistinctSub.where("am.id_periodo", "=", periodParam);
    }
    if (yearParam !== null) {
      evalDistinctSub = evalDistinctSub.where("c.id_anio", "=", yearParam);
    }
    if (id_materia && id_materia !== "TODOS") {
      evalDistinctSub = evalDistinctSub.where("c.id_materia", "=", Number(id_materia));
    }
    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        evalDistinctSub = evalDistinctSub.where("g.id_grupo", "=", Number(targetGrade));
      } else {
        evalDistinctSub = evalDistinctSub.where(sql`LOWER(TRIM(tg.nombre))`, "=", targetGrade.trim().toLowerCase());
      }
    }

    // 1. Resumen agrupado por área y grado (KPIs)
    let summaryQuery = db
      .selectFrom("colegio_version_curricular as cvc")
      .innerJoin("dba as d", (join) =>
        join
          .onRef("d.area", "=", "cvc.area")
          .onRef("d.grado", "=", "cvc.grado")
          .onRef("d.version_curricular", "=", "cvc.version_curricular")
          .on("d.estado", "=", "ACTIVO")
      )
      .innerJoin("evidencias_dba as edba", (join) =>
        join
          .onRef("edba.id_dba", "=", "d.id_dba")
          .on("edba.estado", "=", "ACTIVO")
      )
      .leftJoin(planSub.as("ea_plan"), "ea_plan.id_evidencia_dba", "edba.id_evidencia_dba")
      .leftJoin(evalDistinctSub.as("aedba"), "aedba.id_evidencia_dba", "edba.id_evidencia_dba")
      .where("cvc.id_colegio", "=", schoolId);

    if (id_materia && id_materia !== "TODOS") {
      summaryQuery = summaryQuery.where(
        sql`LOWER(TRIM(cvc.area))`,
        "=",
        db.selectFrom("materias").select(sql`LOWER(TRIM(nombre))`.as("n")).where("id_materia", "=", Number(id_materia)).limit(1)
      );
    }

    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        summaryQuery = summaryQuery.where(
          sql`LOWER(TRIM(cvc.grado))`,
          "=",
          db
            .selectFrom("grupos as g")
            .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
            .select(sql`LOWER(TRIM(tg.nombre))`.as("n"))
            .where("g.id_grupo", "=", Number(targetGrade))
            .limit(1)
        );
      } else {
        summaryQuery = summaryQuery.where(sql`LOWER(TRIM(cvc.grado))`, "=", targetGrade.trim().toLowerCase());
      }
    }

    summaryQuery = summaryQuery
      .groupBy(["cvc.area", "cvc.grado", "cvc.version_curricular"])
      .select([
        "cvc.area",
        "cvc.grado",
        "cvc.version_curricular",
        sql<number>`
          COUNT(DISTINCT CASE 
            WHEN ${periodParam}::int IS NULL AND ${yearParam}::int IS NULL THEN edba.id_evidencia_dba
            WHEN ea_plan.id_evidencia_dba IS NOT NULL OR aedba.id_evidencia_dba IS NOT NULL THEN edba.id_evidencia_dba
          END)::int
        `.as("total_evidencias"),
        sql<number>`
          COUNT(DISTINCT CASE WHEN aedba.id_evidencia_dba IS NOT NULL THEN edba.id_evidencia_dba END)::int
        `.as("evidencias_evaluadas")
      ])
      .having(
        sql`
          COUNT(DISTINCT CASE 
            WHEN ${periodParam}::int IS NULL AND ${yearParam}::int IS NULL THEN edba.id_evidencia_dba
            WHEN ea_plan.id_evidencia_dba IS NOT NULL OR aedba.id_evidencia_dba IS NOT NULL THEN edba.id_evidencia_dba
          END)
        `,
        ">",
        0
      )
      .orderBy("cvc.area", "asc")
      .orderBy(
        sql`
          CASE cvc.grado
            WHEN 'PRIMERO' THEN 1
            WHEN 'SEGUNDO' THEN 2
            WHEN 'TERCERO' THEN 3
            WHEN 'CUARTO' THEN 4
            WHEN 'QUINTO' THEN 5
            WHEN 'SEXTO' THEN 6
            WHEN 'SEPTIMO' THEN 7
            WHEN 'OCTAVO' THEN 8
            WHEN 'NOVENO' THEN 9
            WHEN 'DECIMO' THEN 10
            WHEN 'ONCE' THEN 11
            ELSE 12
          END
        `,
        "asc"
      );

    const summaryRes = await summaryQuery.execute();

    // 2. Pre-agregación vectorizada de detalles de evaluación (JSON)
    let evalRows = db
      .selectFrom("actividad_evidencia_dba as aedba")
      .innerJoin("actividad_materia as am", "am.id_actividadmateria", "aedba.id_actividadmateria")
      .innerJoin("competencias as c", "c.id_competencia", "am.id_competencia")
      .leftJoin("periodo_academico as p", "p.id_periodo", "am.id_periodo")
      .leftJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
      .leftJoin("grupos as g", "g.id_grupo", "dg.id_grupo")
      .leftJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .leftJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .leftJoin("nivel_escolar as ne", "ne.id_nivel", "tg.id_nivel")
      .leftJoin("docente as doc", "doc.id_docente", "dg.id_docente")
      .leftJoin("usuario as u", "u.id_usuario", "doc.id_usuario")
      .where("am.id_colegio", "=", schoolId);

    if (periodParam !== null) {
      evalRows = evalRows.where("am.id_periodo", "=", periodParam);
    }
    if (yearParam !== null) {
      evalRows = evalRows.where("c.id_anio", "=", yearParam);
    }
    if (id_materia && id_materia !== "TODOS") {
      evalRows = evalRows.where("c.id_materia", "=", Number(id_materia));
    }
    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        evalRows = evalRows.where("g.id_grupo", "=", Number(targetGrade));
      } else {
        evalRows = evalRows.where(sql`LOWER(TRIM(tg.nombre))`, "=", targetGrade.trim().toLowerCase());
      }
    }

    const evalDistinct = evalRows
      .select([
        "aedba.id_evidencia_dba",
        "am.id_actividadmateria",
        "am.nombre as actividad_nombre",
        "am.porcentaje as actividad_porcentaje",
        sql<string>`ne.nombre || ' - ' || tg.nombre || COALESCE(' (' || s.nombre || ')', '') || COALESCE(' [' || j.nombre || ']', '')`.as("grupo_nombre"),
        sql<string>`u.nombre || ' ' || u.apellido`.as("docente_nombre"),
        "p.nombre as periodo_nombre",
        sql<number>`COALESCE((
          SELECT COUNT(*)::int
          FROM matricula m_sub
          WHERE m_sub.id_grupo = g.id_grupo
            AND m_sub.id_anio = c.id_anio
            AND m_sub.estado = 'ACTIVA'
        ), 0)`.as("total_estudiantes"),
        sql<number>`COALESCE((
          SELECT COUNT(DISTINCT na_sub.id_estudiante)::int
          FROM notas_actividad na_sub
          WHERE na_sub.id_actividadmateria = am.id_actividadmateria
            AND na_sub.nota IS NOT NULL
        ), 0)`.as("estudiantes_calificados"),
        sql<string>`
          CASE
            WHEN (
              SELECT COUNT(DISTINCT na_sub.id_estudiante)::int
              FROM notas_actividad na_sub
              WHERE na_sub.id_actividadmateria = am.id_actividadmateria
                AND na_sub.nota IS NOT NULL
            ) >= (
              SELECT COUNT(*)::int
              FROM matricula m_sub
              WHERE m_sub.id_grupo = g.id_grupo
                AND m_sub.id_anio = c.id_anio
                AND m_sub.estado = 'ACTIVA'
            ) AND (
              SELECT COUNT(*)::int
              FROM matricula m_sub
              WHERE m_sub.id_grupo = g.id_grupo
                AND m_sub.id_anio = c.id_anio
                AND m_sub.estado = 'ACTIVA'
            ) > 0 THEN 'COMPLETO'
            WHEN (
              SELECT COUNT(DISTINCT na_sub.id_estudiante)::int
              FROM notas_actividad na_sub
              WHERE na_sub.id_actividadmateria = am.id_actividadmateria
                AND na_sub.nota IS NOT NULL
            ) > 0 THEN 'PARCIAL'
            ELSE 'SIN_CALIFICAR'
          END
        `.as("estado_calificacion")
      ])
      .distinct();

    const evalGrouped = db
      .selectFrom(evalDistinct.as("sub"))
      .groupBy("sub.id_evidencia_dba")
      .select([
        "sub.id_evidencia_dba",
        sql<any[]>`
          json_agg(
            json_build_object(
              'actividad_nombre', sub.actividad_nombre,
              'actividad_porcentaje', sub.actividad_porcentaje,
              'grupo_nombre', sub.grupo_nombre,
              'docente_nombre', sub.docente_nombre,
              'periodo_nombre', sub.periodo_nombre,
              'total_estudiantes', sub.total_estudiantes,
              'estudiantes_calificados', sub.estudiantes_calificados,
              'estado_calificacion', sub.estado_calificacion
            )
          )
        `.as("evaluaciones")
      ]);

    // 3. Consulta principal de detalles de evidencias (sin subconsultas correlacionadas)
    let detailsQuery = db
      .selectFrom("colegio_version_curricular as cvc")
      .innerJoin("dba as d", (join) =>
        join
          .onRef("d.area", "=", "cvc.area")
          .onRef("d.grado", "=", "cvc.grado")
          .onRef("d.version_curricular", "=", "cvc.version_curricular")
          .on("d.estado", "=", "ACTIVO")
      )
      .innerJoin("evidencias_dba as edba", (join) =>
        join
          .onRef("edba.id_dba", "=", "d.id_dba")
          .on("edba.estado", "=", "ACTIVO")
      )
      .leftJoin(planSub.as("plan_sub"), "plan_sub.id_evidencia_dba", "edba.id_evidencia_dba")
      .leftJoin(evalGrouped.as("eval_sub"), "eval_sub.id_evidencia_dba", "edba.id_evidencia_dba")
      .where("cvc.id_colegio", "=", schoolId);

    if (periodParam !== null) {
      detailsQuery = detailsQuery.where((eb) =>
        eb.or([
          eb("plan_sub.id_evidencia_dba", "is not", null),
          eb("eval_sub.id_evidencia_dba", "is not", null)
        ])
      );
    }

    if (id_materia && id_materia !== "TODOS") {
      detailsQuery = detailsQuery.where(
        sql`LOWER(TRIM(cvc.area))`,
        "=",
        db.selectFrom("materias").select(sql`LOWER(TRIM(nombre))`.as("n")).where("id_materia", "=", Number(id_materia)).limit(1)
      );
    }

    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        detailsQuery = detailsQuery.where(
          sql`LOWER(TRIM(cvc.grado))`,
          "=",
          db
            .selectFrom("grupos as g")
            .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
            .select(sql`LOWER(TRIM(tg.nombre))`.as("n"))
            .where("g.id_grupo", "=", Number(targetGrade))
            .limit(1)
        );
      } else {
        detailsQuery = detailsQuery.where(sql`LOWER(TRIM(cvc.grado))`, "=", targetGrade.trim().toLowerCase());
      }
    }

    detailsQuery = detailsQuery
      .select([
        "d.id_dba",
        "d.numero_dba",
        "d.enunciado as dba_enunciado",
        "d.area",
        "d.grado",
        "edba.id_evidencia_dba",
        "edba.descripcion as evidencia_descripcion",
        "edba.orden as evidencia_orden",
        sql<boolean>`(plan_sub.id_evidencia_dba IS NOT NULL)`.as("es_planeada"),
        sql<any[]>`COALESCE(eval_sub.evaluaciones, '[]'::json)`.as("evaluaciones")
      ])
      .orderBy("cvc.area", "asc")
      .orderBy(
        sql`
          CASE cvc.grado
            WHEN 'PRIMERO' THEN 1
            WHEN 'SEGUNDO' THEN 2
            WHEN 'TERCERO' THEN 3
            WHEN 'CUARTO' THEN 4
            WHEN 'QUINTO' THEN 5
            WHEN 'SEXTO' THEN 6
            WHEN 'SEPTIMO' THEN 7
            WHEN 'OCTAVO' THEN 8
            WHEN 'NOVENO' THEN 9
            WHEN 'DECIMO' THEN 10
            WHEN 'ONCE' THEN 11
            ELSE 12
          END
        `,
        "asc"
      )
      .orderBy("d.numero_dba", "asc")
      .orderBy("edba.orden", "asc");

    const detailsRes = await detailsQuery.execute();

    res.json({
      resumen: summaryRes,
      detalles: detailsRes
    });
  } catch (error: any) {
    console.error("Error al obtener reporte de cobertura DBA:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// ============================================================================
// 3. CATÁLOGO OFICIAL DE DBA Y EVIDENCIAS CON ESTADO DE PLANEACIÓN
// ============================================================================
export const obtenerCatalogoDbaDirectivo = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  const { id_anio, yearId } = req.query;
  const targetYear = (id_anio || yearId) as string;
  const yearParam = (targetYear && targetYear !== "TODOS") ? Number(targetYear) : null;

  if (!schoolId) {
    res.status(400).json({ error: "El ID de colegio es obligatorio" });
    return;
  }

  const authReq = req as any;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para ver los reportes DBA de este colegio." });
    return;
  }

  try {
    const query = db
      .selectFrom("colegio_version_curricular as cvc")
      .innerJoin("dba as d", (join) =>
        join
          .onRef("d.area", "=", "cvc.area")
          .onRef("d.grado", "=", "cvc.grado")
          .onRef("d.version_curricular", "=", "cvc.version_curricular")
          .on("d.estado", "=", "ACTIVO")
      )
      .where("cvc.id_colegio", "=", schoolId)
      .select([
        "d.id_dba",
        "d.numero_dba",
        "d.enunciado as dba_enunciado",
        "d.area",
        "d.grado",
        "d.version_curricular",
        sql<any[]>`
          COALESCE(
            (SELECT json_agg(
               json_build_object(
                 'id_evidencia_dba', edba.id_evidencia_dba,
                 'descripcion', edba.descripcion,
                 'orden', edba.orden,
                 'planeaciones', COALESCE(
                   (SELECT json_agg(
                      json_build_object(
                        'id_competencia', c.id_competencia,
                        'competencia_descripcion', c.descripcion,
                        'competencia_nombre', c.nombre,
                        'id_periodo', p.id_periodo,
                        'periodo_nombre', p.nombre,
                        'id_materia', m.id_materia,
                        'materia_nombre', m.nombre,
                        'id_grupo', g.id_grupo,
                        'grupo_nombre', ne.nombre || ' - ' || tg.nombre || ' (' || s.nombre || ') [' || j.nombre || ']'
                      )
                    )
                    FROM evidencia_aprendizaje ea
                    JOIN competencias c ON c.id_competencia = ea.id_competencia
                    JOIN periodo_academico p ON p.id_periodo = c.id_periodo
                    JOIN materias m ON m.id_materia = c.id_materia
                    JOIN grupos g ON g.id_grupo = c.id_grupo
                    JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
                    JOIN nivel_escolar ne ON ne.id_nivel = tg.id_nivel
                    JOIN secciones s ON s.id_seccion = g.id_seccion
                    JOIN jornada j ON j.id_jornada = g.id_jornada
                    WHERE ea.id_evidencia_dba = edba.id_evidencia_dba
                      AND c.id_colegio = ${schoolId}
                      AND (${yearParam}::int IS NULL OR c.id_anio = ${yearParam}::int)
                   ), '[]'::json
                 )
               ) ORDER BY edba.orden ASC, edba.id_evidencia_dba ASC
             )
             FROM evidencias_dba edba
             WHERE edba.id_dba = d.id_dba AND edba.estado = 'ACTIVO'
            ), '[]'::json
          )
        `.as("evidencias")
      ])
      .orderBy("cvc.area", "asc")
      .orderBy(
        sql`
          CASE cvc.grado
            WHEN 'PRIMERO' THEN 1
            WHEN 'SEGUNDO' THEN 2
            WHEN 'TERCERO' THEN 3
            WHEN 'CUARTO' THEN 4
            WHEN 'QUINTO' THEN 5
            WHEN 'SEXTO' THEN 6
            WHEN 'SEPTIMO' THEN 7
            WHEN 'OCTAVO' THEN 8
            WHEN 'NOVENO' THEN 9
            WHEN 'DECIMO' THEN 10
            WHEN 'ONCE' THEN 11
            ELSE 12
          END
        `,
        "asc"
      )
      .orderBy("d.numero_dba", "asc");

    const result = await query.execute();
    res.json(result);
  } catch (error: any) {
    console.error("Error al obtener catálogo de DBA para directivo:", error);
    res.status(500).json({ error: "Error en el servidor al consultar catálogo DBA" });
  }
};
