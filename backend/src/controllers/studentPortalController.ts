import { Request, Response } from 'express';
import { db } from '../config/kysely';
import { sql } from 'kysely';
import { ensureSchoolDefaultSettings } from './academicAdmin/helpers';

/**
 * Gets closed academic years for a specific student's school
 */
export const getStudentAcademicYears = async (req: Request, res: Response) => {
  const { id_estudiante } = req.params;
  try {
    let rows = await db
      .selectFrom("matricula as m")
      .innerJoin("anio_lectivo as al", "al.id_anio", "m.id_anio")
      .select(["al.id_anio", "al.calendario"])
      .distinct()
      .where("m.id_estudiante", "=", Number(id_estudiante))
      .orderBy("al.calendario", "desc")
      .execute();

    if (rows.length === 0) {
      rows = await db
        .selectFrom("anio_lectivo as al")
        .innerJoin("estudiante as e", "e.id_colegio", "al.id_colegio")
        .select(["al.id_anio", "al.calendario"])
        .distinct()
        .where("e.id_estudiante", "=", Number(id_estudiante))
        .orderBy("al.calendario", "desc")
        .execute();
    }

    res.json(rows);
  } catch (error) {
    console.error('Error fetching academic years:', error);
    res.status(500).json({ error: 'Error al obtener años lectivos' });
  }
};

/**
 * Gets closed periods for a specific student and academic year
 */
export const getStudentClosedPeriods = async (req: Request, res: Response) => {
  const { id_estudiante, id_anio } = req.params;
  try {
    const rows = await db
      .selectFrom("periodo_academico as p")
      .select(["p.id_periodo", "p.nombre", "p.trimestre", "p.porcentaje"])
      .where("p.id_anio", "=", Number(id_anio))
      .where("p.estado", "=", "CERRADO")
      .orderBy("p.trimestre", "asc")
      .execute();

    res.json(rows);
  } catch (error) {
    console.error('Error fetching closed periods:', error);
    res.status(500).json({ error: 'Error al obtener periodos cerrados' });
  }
};

/**
 * Gets all periods (open and closed) for a specific student and academic year
 */
export const getStudentAllPeriods = async (req: Request, res: Response) => {
  const { id_estudiante, id_anio } = req.params;
  try {
    const rows = await db
      .selectFrom("periodo_academico as p")
      .select(["p.id_periodo", "p.nombre", "p.trimestre", "p.porcentaje", "p.estado"])
      .where("p.id_anio", "=", Number(id_anio))
      .where("p.estado", "!=", "PENDIENTE")
      .orderBy("p.trimestre", "asc")
      .execute();

    res.json(rows);
  } catch (error) {
    console.error('Error fetching all periods:', error);
    res.status(500).json({ error: 'Error al obtener todos los periodos' });
  }
};

/**
 * Gets grades for a specific student and closed period
 */
export const getStudentGrades = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo } = req.params;
  try {
    // 1. Verify period exists and is not pending
    const period = await db
      .selectFrom("periodo_academico")
      .select(["estado", "id_colegio", "id_anio"])
      .where("id_periodo", "=", Number(id_periodo))
      .executeTakeFirst();

    if (!period || period.estado === 'PENDIENTE') {
      return res.status(400).json({ error: 'El periodo seleccionado no está disponible' });
    }
    const id_colegio = period.id_colegio;

    // 2. Fetch grades using logic similar to boletin controller
    const raSubquery = db
      .selectFrom("resultado_academico as ra_inner")
      .innerJoin("detalle_grados as dg_ra", "dg_ra.id_detallegrado", "ra_inner.id_detallegrado")
      .select(["dg_ra.id_materia", "ra_inner.promedio"])
      .where("ra_inner.id_estudiante", "=", Number(id_estudiante))
      .where("ra_inner.id_periodo", "=", Number(id_periodo))
      .orderBy("ra_inner.id_resultado", "desc")
      .as("ra");

    const calcSubquery = db
      .selectFrom("notas_actividad as na")
      .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
      .innerJoin("detalle_grados as dg_am", "dg_am.id_detallegrado", "am.id_detallegrado")
      .select([
        "dg_am.id_materia",
        sql<number>`ROUND(SUM(na.nota * (am.porcentaje / 100.0))::numeric, 2)`.as("promedio_calculado")
      ])
      .where("am.id_periodo", "=", Number(id_periodo))
      .where("na.id_estudiante", "=", Number(id_estudiante))
      .groupBy("dg_am.id_materia")
      .as("calc");

    const gradeRows = await db
      .selectFrom("detalle_grados as dg")
      .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
      .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
      .innerJoin("matricula as mat", "mat.id_grupo", "dg.id_grupo")
      .leftJoin(raSubquery, "ra.id_materia", "m.id_materia")
      .leftJoin(calcSubquery, "calc.id_materia", "m.id_materia")
      .leftJoin("escala_valoracion as ev", (join) =>
        join
          .on("ev.id_colegio", "=", id_colegio)
          .on(sql`COALESCE(ra.promedio, calc.promedio_calculado)`, ">=", sql`ev.valor_minimo`)
          .on(sql`COALESCE(ra.promedio, calc.promedio_calculado)`, "<=", sql`ev.valor_maximo`)
      )
      .distinctOn("m.id_materia")
      .select([
        "m.id_materia",
        "m.nombre as materia",
        sql<string>`d.nombre || ' ' || d.apellido`.as("docente"),
        sql<number | null>`COALESCE(ra.promedio, calc.promedio_calculado)`.as("calificacion"),
        "ev.nivel as desempeno"
      ])
      .where("mat.id_estudiante", "=", Number(id_estudiante))
      .where("mat.id_anio", "=", period.id_anio)
      .where("mat.estado", "in", ["ACTIVA", "APROBADA", "CULMINADA", "TRASLADADA"])
      .orderBy("m.id_materia")
      .orderBy("dg.id_detallegrado", "desc")
      .execute();

    // Ordenar alfabéticamente por materia tras tomar la asignación docente más reciente
    const sortedRows = gradeRows.sort((a, b) => a.materia.localeCompare(b.materia));

    // Calculate general average ONLY for subjects with registered grades
    const grades = sortedRows.map(row => {
      const hasGrade = row.calificacion !== null && row.calificacion !== undefined;
      return {
        ...row,
        calificacion: hasGrade ? parseFloat(String(row.calificacion)) : null,
        desempeno: hasGrade ? (row.desempeno || 'SIN DEFINIR') : 'N/A'
      };
    });
    
    const gradedList = grades.filter(g => g.calificacion !== null);
    let promedio_general: number | null = null;
    if (gradedList.length > 0) {
      const sum = gradedList.reduce((acc, curr) => acc + curr.calificacion!, 0);
      promedio_general = parseFloat((sum / gradedList.length).toFixed(2));
    }

    let nivel_desempeno = 'N/A';
    if (promedio_general !== null) {
      const perf = await db
        .selectFrom("escala_valoracion")
        .select("nivel")
        .where("id_colegio", "=", id_colegio)
        .where(sql`${promedio_general}`, ">=", sql`valor_minimo`)
        .where(sql`${promedio_general}`, "<=", sql`valor_maximo`)
        .executeTakeFirst();

      nivel_desempeno = perf?.nivel || 'N/A';
    }

    res.json({
      grades,
      promedio_general,
      nivel_desempeno
    });
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ error: 'Error al obtener calificaciones' });
  }
};

/**
 * Gets detailed activity grades for a subject and period
 */
export const getGradeDetails = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo, id_materia } = req.params;
  
  if (id_estudiante === 'undefined' || id_periodo === 'undefined' || id_materia === 'undefined') {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  try {
    const studentIdInt = parseInt(id_estudiante as any);
    const periodIdInt = parseInt(id_periodo as any);
    const materiaIdInt = parseInt(id_materia as any);

    if (isNaN(studentIdInt) || isNaN(periodIdInt) || isNaN(materiaIdInt)) {
      return res.status(400).json({ error: 'Parámetros numéricos inválidos' });
    }

    // 1. Obtener grupo del estudiante
    const mat = await db
      .selectFrom("matricula")
      .select("id_grupo")
      .where("id_estudiante", "=", studentIdInt)
      .where("estado", "=", "ACTIVA")
      .limit(1)
      .executeTakeFirst();

    if (!mat || !mat.id_grupo) {
      return res.json([]);
    }

    const id_grupo = mat.id_grupo;

    // 2. Obtener el docente ACTUAL asignado (para el header de la materia)
    const doc = await db
      .selectFrom("detalle_grados as dg")
      .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
      .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
      .select([
        sql<string>`d.nombre || ' ' || d.apellido`.as("docente"),
        "m.nombre as materia"
      ])
      .where("dg.id_grupo", "=", id_grupo)
      .where("dg.id_materia", "=", materiaIdInt)
      .orderBy("dg.id_detallegrado", "desc")
      .limit(1)
      .executeTakeFirst();

    const currentTeacher = doc?.docente || 'Sin docente asignado';
    const materiaNombre = doc?.materia || '';

    // 3. Obtener actividades con el nombre del docente CREADOR de cada una
    const activityRows = await db
      .selectFrom("actividad_materia as am")
      .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
      .leftJoin("notas_actividad as na", (join) =>
        join
          .onRef("na.id_actividadmateria", "=", "am.id_actividadmateria")
          .on("na.id_estudiante", "=", studentIdInt)
      )
      .distinctOn("am.id_actividadmateria")
      .select([
        "am.id_actividadmateria",
        "am.nombre as actividad",
        "am.porcentaje",
        "na.nota",
        sql<string>`${materiaNombre}`.as("materia"),
        sql<string>`${currentTeacher}`.as("docente"),
        sql<string>`CASE
          WHEN am.id_docente_creador IS NOT NULL THEN
            (SELECT d2.nombre || ' ' || d2.apellido FROM docente d2 WHERE d2.id_docente = am.id_docente_creador)
          ELSE ${currentTeacher}
        END`.as("docente_creador")
      ])
      .where("dg.id_grupo", "=", id_grupo)
      .where("dg.id_materia", "=", materiaIdInt)
      .where("am.id_periodo", "=", periodIdInt)
      .orderBy("am.id_actividadmateria", "asc")
      .execute();

    const activityIds = activityRows.map(r => r.id_actividadmateria);

    // 4. Obtener criterios con su nota individual por estudiante
    let criteriosByActivity: Record<number, any[]> = {};
    if (activityIds.length > 0) {
      const critRows = await db
        .selectFrom("criterio_evaluacion as ce")
        .leftJoin("nota_criterio as nc", (join) =>
          join
            .onRef("nc.id_criterio", "=", "ce.id_criterio")
            .on("nc.id_estudiante", "=", studentIdInt)
        )
        .select([
          "ce.id_criterio",
          "ce.id_actividadmateria",
          "ce.descripcion",
          "ce.porcentaje",
          "nc.nota as nota_criterio"
        ])
        .where("ce.id_actividadmateria", "in", activityIds)
        .orderBy("ce.id_criterio", "asc")
        .execute();

      for (const row of critRows) {
        if (!criteriosByActivity[row.id_actividadmateria]) {
          criteriosByActivity[row.id_actividadmateria] = [];
        }
        criteriosByActivity[row.id_actividadmateria].push(row);
      }
    }

    // 5. Combinar actividades con sus criterios y calcular nota final ponderada si aplica
    const activities = activityRows.map((act: any) => {
      const criterios = criteriosByActivity[act.id_actividadmateria] || [];
      
      // Si tiene criterios, la nota es el promedio ponderado de las notas de criterio
      let notaFinal = act.nota !== null && act.nota !== undefined ? parseFloat(String(act.nota)) : null;
      if (criterios.length > 0) {
        const allGraded = criterios.every((c: any) => c.nota_criterio !== null && c.nota_criterio !== undefined);
        if (allGraded) {
          const totalPeso = criterios.reduce((sum: number, c: any) => sum + parseFloat(String(c.porcentaje)), 0);
          const ponderado = criterios.reduce((sum: number, c: any) => {
            return sum + (parseFloat(String(c.nota_criterio)) * parseFloat(String(c.porcentaje)));
          }, 0);
          notaFinal = totalPeso > 0 ? parseFloat((ponderado / totalPeso).toFixed(2)) : null;
        } else {
          notaFinal = null; // Aún no todos los criterios calificados
        }
      }

      return {
        ...act,
        nota: notaFinal,
        criterios,
        // Mantener criterio como string para compatibilidad con componentes que lo usen
        criterio: criterios.length > 0
          ? criterios.map((c: any) => c.descripcion).join(' / ')
          : null
      };
    });

    res.json(activities);
  } catch (error) {
    console.error('Error fetching grade details:', error);
    res.status(500).json({ error: 'Error al obtener detalle de calificaciones' });
  }
};

/**
 * Gets basic student info
 */
export const getStudentInfo = async (req: Request, res: Response) => {
  const { id_estudiante } = req.params;
  try {
    // Auto-expire sanctions
    await db
      .updateTable("sancion")
      .set({ estado: 'VENCIDA' })
      .where("estado", "=", 'ACTIVA')
      .where("fecha_fin", "<", sql<Date>`CURRENT_DATE`)
      .execute();

    await db
      .updateTable("estudiante")
      .set({ estado: 'ACTIVO' })
      .where("estado", "=", 'SANCIONADO')
      .where((eb) => eb("id_estudiante", "not in", eb.selectFrom("sancion").select("id_estudiante").where("estado", "=", 'ACTIVA')))
      .execute();

    const activeMatriculaSubquery = db
      .selectFrom("matricula")
      .select(["id_estudiante", "id_grupo", "id_anio", "id_colegio", "estado"])
      .distinctOn("id_estudiante")
      .where("estado", "in", ["ACTIVA", "APROBADA", "PENDIENTE", "PENDIENTE_RENOVACION", "CORREGIDA", "CULMINADA", "TRASLADADA"])
      .orderBy("id_estudiante")
      .orderBy(sql`CASE 
        WHEN estado IN ('ACTIVA', 'APROBADA') THEN 1
        WHEN estado IN ('PENDIENTE', 'PENDIENTE_RENOVACION', 'CORREGIDA') THEN 2
        WHEN estado = 'CULMINADA' THEN 3
        WHEN estado = 'TRASLADADA' THEN 4
        ELSE 5
      END`, "asc")
      .orderBy("id_anio", "desc")
      .orderBy("id_matricula", "desc")
      .as("m");

    const sancionSubquery = db
      .selectFrom("sancion as sa")
      .innerJoin("tipo_sancion as ts", "ts.id_tipo_sancion", "sa.id_tipo_sancion")
      .select([
        "sa.fecha_fin as sancion_hasta",
        "sa.motivo as sancion_motivo",
        "ts.nombre as sancion_tipo",
        "sa.id_estudiante"
      ])
      .where("sa.id_estudiante", "=", Number(id_estudiante))
      .where("sa.estado", "=", "ACTIVA")
      .where(sql`CURRENT_DATE`, ">=", sql`sa.fecha_inicio`)
      .where(sql`CURRENT_DATE`, "<=", sql`sa.fecha_fin`)
      .orderBy("sa.fecha_fin", "desc")
      .limit(1)
      .as("sanc");

    const row = await db
      .selectFrom("estudiante as e")
      .leftJoin(activeMatriculaSubquery, "m.id_estudiante", "e.id_estudiante")
      .leftJoin("grupos as gr", "gr.id_grupo", "m.id_grupo")
      .leftJoin("secciones as s", "s.id_seccion", "gr.id_seccion")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "gr.id_tipo_grado")
      .leftJoin("jornada as j", "j.id_jornada", "gr.id_jornada")
      .leftJoin("nivel_escolar as n", "n.id_nivel", "gr.id_nivel")
      .leftJoin(sancionSubquery, "sanc.id_estudiante", "e.id_estudiante")
      .select([
        "e.id_estudiante",
        "e.nombre",
        "e.apellido",
        "e.codigo",
        "e.estado",
        "tg.nombre as grado",
        "s.nombre as seccion",
        sql<string>`CASE 
          WHEN tg.nombre IS NOT NULL AND s.nombre IS NOT NULL THEN tg.nombre || '-' || s.nombre
          WHEN tg.nombre IS NOT NULL THEN tg.nombre
          WHEN s.nombre IS NOT NULL THEN s.nombre
          ELSE 'Sin Grupo'
        END`.as("grupo"),
        "j.nombre as jornada",
        "n.nombre as nivel",
        "sanc.sancion_hasta",
        "sanc.sancion_motivo",
        "sanc.sancion_tipo"
      ])
      .where("e.id_estudiante", "=", Number(id_estudiante))
      .executeTakeFirst();

    if (!row) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.json(row);
  } catch (error) {
    console.error('Error fetching student info:', error);
    res.status(500).json({ error: 'Error al obtener información del estudiante' });
  }
};

/**
 * Gets children for a specific parent user
 */
export const getParentChildren = async (req: Request, res: Response) => {
  const { id_usuario } = req.params;
  try {
    const activeMatriculaSubquery = db
      .selectFrom("matricula")
      .select(["id_estudiante", "id_grupo", "id_anio", "id_colegio", "estado"])
      .distinctOn("id_estudiante")
      .where("estado", "in", ["ACTIVA", "APROBADA", "PENDIENTE", "PENDIENTE_RENOVACION", "CORREGIDA", "CULMINADA", "TRASLADADA"])
      .orderBy("id_estudiante")
      .orderBy(sql`CASE 
        WHEN estado IN ('ACTIVA', 'APROBADA') THEN 1
        WHEN estado IN ('PENDIENTE', 'PENDIENTE_RENOVACION', 'CORREGIDA') THEN 2
        WHEN estado = 'CULMINADA' THEN 3
        WHEN estado = 'TRASLADADA' THEN 4
        ELSE 5
      END`, "asc")
      .orderBy("id_anio", "desc")
      .orderBy("id_matricula", "desc")
      .as("m");

    const authReq = req as any;
    let query = db
      .selectFrom("padre_familia as pf")
      .innerJoin("detalle_padrefamilia as dpf", "dpf.id_padrefamilia", "pf.id_padrefamilia")
      .innerJoin("estudiante as e", "e.id_estudiante", "dpf.id_estudiante")
      .leftJoin(activeMatriculaSubquery, "m.id_estudiante", "e.id_estudiante")
      .leftJoin("colegio as col", (join) =>
        join.on("col.id_colegio", "=", sql`COALESCE(m.id_colegio, e.id_colegio, dpf.id_colegio)`)
      )
      .leftJoin("grupos as gr", "gr.id_grupo", "m.id_grupo")
      .leftJoin("secciones as s", "s.id_seccion", "gr.id_seccion")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "gr.id_tipo_grado")
      .leftJoin("jornada as j", "j.id_jornada", "gr.id_jornada")
      .leftJoin("nivel_escolar as n", "n.id_nivel", "gr.id_nivel")
      .leftJoin("usuario as u_e", "u_e.id_usuario", "e.id_usuario")
      .select([
        "e.id_estudiante",
        "e.nombre",
        "e.apellido",
        "e.codigo",
        "e.estado",
        "u_e.documento",
        "tg.nombre as grado",
        "s.nombre as seccion",
        sql<string>`CASE 
          WHEN tg.nombre IS NOT NULL AND s.nombre IS NOT NULL THEN tg.nombre || '-' || s.nombre
          WHEN tg.nombre IS NOT NULL THEN tg.nombre
          WHEN s.nombre IS NOT NULL THEN s.nombre
          ELSE 'Sin Grupo'
        END`.as("grupo"),
        "j.nombre as jornada",
        "n.nombre as nivel",
        sql<number>`COALESCE(m.id_colegio, e.id_colegio, dpf.id_colegio)`.as("id_colegio"),
        "col.nombre as colegio_nombre",
        "col.escudo_url as colegio_escudo",
        "m.estado as estado_matricula"
      ])
      .where("pf.id_usuario", "=", Number(id_usuario));

    if (authReq.user?.schoolId && authReq.user?.roles?.some((r: string) => ['admin', 'directivo'].includes(r)) && authReq.isMonitoring) {
      query = query.where((eb) =>
        eb.or([
          eb("dpf.id_colegio", "=", authReq.user.schoolId),
          eb("e.id_colegio", "=", authReq.user.schoolId)
        ])
      );
    }

    const rows = await query.execute();

    res.json(rows);
  } catch (error) {
    console.error('Error fetching parent children:', error);
    res.status(500).json({ error: 'Error al obtener hijos' });
  }
};

/**
 * Gets attendance records for a specific student and period
 */
export const getStudentAttendance = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo } = req.params;
  const { id_materia, estado, fecha } = req.query; // Optional filters

  try {
    const studentIdInt = Number(id_estudiante);
    const periodIdInt = Number(id_periodo);

    let queryRecords = db
      .selectFrom("registro_asistencia as ra")
      .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "ra.id_detallegrado")
      .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
      .innerJoin("docente as doc", "doc.id_docente", "dg.id_docente")
      .where("ra.id_estudiante", "=", studentIdInt);

    let queryStats = db
      .selectFrom("registro_asistencia as ra")
      .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "ra.id_detallegrado")
      .where("ra.id_estudiante", "=", studentIdInt);

    if (fecha) {
      queryRecords = queryRecords.where("ra.fecha", "=", fecha as any);
      queryStats = queryStats.where("ra.fecha", "=", fecha as any);
    } else {
      const dateStartSubquery = db
        .selectFrom("periodo_academico as pa")
        .innerJoin("anio_lectivo as al", "al.id_anio", "pa.id_anio")
        .select([
          sql<Date>`(al.calendario || '-' || LPAD(pa.mes_inicio::text, 2, '0') || '-' || LPAD(pa.dia_inicio::text, 2, '0'))::date`.as("fecha_inicio")
        ])
        .where("pa.id_periodo", "=", periodIdInt);

      const dateEndSubquery = db
        .selectFrom("periodo_academico as pa")
        .innerJoin("anio_lectivo as al", "al.id_anio", "pa.id_anio")
        .select([
          sql<Date>`(al.calendario || '-' || LPAD(pa.mes_fin::text, 2, '0') || '-' || LPAD(pa.dia_fin::text, 2, '0'))::date`.as("fecha_fin")
        ])
        .where("pa.id_periodo", "=", periodIdInt);

      queryRecords = queryRecords
        .where("ra.fecha", ">=", dateStartSubquery)
        .where("ra.fecha", "<=", dateEndSubquery);

      queryStats = queryStats
        .where("ra.fecha", ">=", dateStartSubquery)
        .where("ra.fecha", "<=", dateEndSubquery);
    }

    if (id_materia && id_materia !== 'all') {
      queryRecords = queryRecords.where("dg.id_materia", "=", Number(id_materia));
      queryStats = queryStats.where("dg.id_materia", "=", Number(id_materia));
    }

    if (estado && estado !== 'all') {
      queryRecords = queryRecords.where("ra.estado", "=", estado as any);
      queryStats = queryStats.where("ra.estado", "=", estado as any);
    }

    const records = await queryRecords
      .select([
        "ra.fecha",
        "ra.estado",
        "ra.justificacion",
        sql<string>`TO_CHAR(ra.hora_llegada, 'HH24:MI')`.as("hora_llegada"),
        "m.nombre as materia",
        sql<string>`doc.nombre || ' ' || doc.apellido`.as("docente")
      ])
      .orderBy("ra.fecha", "desc")
      .execute();

    const statsRows = await queryStats
      .select([
        "ra.estado",
        sql<number>`COUNT(*)::int`.as("count")
      ])
      .groupBy("ra.estado")
      .execute();

    const stats: any = {
      PRESENTE: 0,
      AUSENTE: 0,
      TARDE: 0,
      JUSTIFICADA: 0
    };

    statsRows.forEach(row => {
      if (stats.hasOwnProperty(row.estado)) {
        stats[row.estado] = Number(row.count);
      }
    });

    res.json({
      records,
      stats
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({ error: 'Error al obtener registros de asistencia' });
  }
};

/**
 * Gets academic observations for a specific student and period
 */
export const getStudentObservations = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo } = req.params;
  const { tipo } = req.query;

  try {
    let query = db
      .selectFrom("observacion_estudiante as oe")
      .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "oe.id_detallegrado")
      .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
      .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
      .where("oe.id_estudiante", "=", Number(id_estudiante))
      .where("oe.id_periodo", "=", Number(id_periodo));

    if (tipo && tipo !== 'all') {
      let targetTipo = tipo;
      if (tipo === 'CONVIVENCIAL') {
        targetTipo = 'CONVIVENCIA';
      }
      query = query.where("oe.tipo", "=", targetTipo as any);
    }

    const rows = await query
      .select([
        "oe.id_observacion",
        "oe.fortalezas",
        "oe.debilidades",
        "oe.recomendaciones",
        "oe.fecha",
        "oe.tipo",
        "m.nombre as materia",
        sql<string>`d.nombre || ' ' || d.apellido`.as("docente")
      ])
      .orderBy("m.nombre", "asc")
      .execute();

    const mappedRows = rows.map(row => ({
      ...row,
      tipo: row.tipo === 'CONVIVENCIA' ? 'CONVIVENCIAL' : row.tipo
    }));
    res.json(mappedRows);
  } catch (error) {
    console.error('Error fetching student observations:', error);
    res.status(500).json({ error: 'Error al obtener las observaciones académicas' });
  }
};

/**
 * Gets a comprehensive summary for the parent dashboard including analytics
 */
export const getParentDashboardData = async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id_usuario as string);
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'ID de usuario inválido' });
  }

  try {
    const targetYearId = req.query.yearId ? Number(req.query.yearId) : null;

    // 1. Get children basic info and enrollment for selected year
    let activeMatriculaQuery = db
      .selectFrom("matricula")
      .select(["id_estudiante", "id_grupo", "id_anio", "id_colegio", "estado"])
      .distinctOn("id_estudiante")
      .where("estado", "in", ["ACTIVA", "APROBADA", "PENDIENTE", "PENDIENTE_RENOVACION", "CORREGIDA", "CULMINADA", "TRASLADADA"]);

    if (targetYearId) {
      activeMatriculaQuery = activeMatriculaQuery.where("id_anio", "=", Number(targetYearId));
    }

    const activeMatriculaSubquery = activeMatriculaQuery
      .orderBy("id_estudiante")
      .orderBy(sql`CASE 
        WHEN estado IN ('ACTIVA', 'APROBADA') THEN 1
        WHEN estado IN ('PENDIENTE', 'PENDIENTE_RENOVACION', 'CORREGIDA') THEN 2
        WHEN estado = 'CULMINADA' THEN 3
        WHEN estado = 'TRASLADADA' THEN 4
        ELSE 5
      END`, "asc")
      .orderBy("id_anio", "desc")
      .orderBy("id_matricula", "desc")
      .as("m");

    const authReq = req as any;
    const schoolId = authReq.user?.schoolId || (req.query.id_colegio ? parseInt(req.query.id_colegio as string) : null);

    let childrenQuery = db
      .selectFrom("padre_familia as pf")
      .innerJoin("detalle_padrefamilia as dpf", "dpf.id_padrefamilia", "pf.id_padrefamilia")
      .innerJoin("estudiante as e", "e.id_estudiante", "dpf.id_estudiante")
      .leftJoin(activeMatriculaSubquery, "m.id_estudiante", "e.id_estudiante")
      .leftJoin("colegio as col", (join) =>
        join.on("col.id_colegio", "=", sql`COALESCE(m.id_colegio, e.id_colegio, dpf.id_colegio)`)
      )
      .leftJoin("grupos as gr", "gr.id_grupo", "m.id_grupo")
      .leftJoin("secciones as s", "s.id_seccion", "gr.id_seccion")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "gr.id_tipo_grado")
      .leftJoin("jornada as j", "j.id_jornada", "gr.id_jornada")
      .leftJoin("nivel_escolar as n", "n.id_nivel", "gr.id_nivel")
      .select([
        "e.id_estudiante",
        "e.nombre",
        "e.apellido",
        "e.codigo",
        "e.estado as estado_estudiante",
        "tg.nombre as grado",
        "s.nombre as seccion",
        sql<string>`CASE 
          WHEN tg.nombre IS NOT NULL AND s.nombre IS NOT NULL THEN tg.nombre || '-' || s.nombre
          WHEN tg.nombre IS NOT NULL THEN tg.nombre
          WHEN s.nombre IS NOT NULL THEN s.nombre
          ELSE 'Sin Grupo'
        END`.as("grupo"),
        "j.nombre as jornada",
        "n.nombre as nivel",
        sql<number>`COALESCE(m.id_colegio, e.id_colegio, dpf.id_colegio)`.as("id_colegio"),
        "col.nombre as colegio_nombre",
        "col.escudo_url as colegio_escudo",
        "m.id_grupo",
        "m.id_anio",
        "m.estado as estado_matricula"
      ])
      .where("pf.id_usuario", "=", userId);

    if (schoolId && authReq.user?.roles?.some((r: string) => ['admin', 'directivo'].includes(r)) && authReq.isMonitoring) {
      childrenQuery = childrenQuery.where((eb) =>
        eb.or([
          eb("dpf.id_colegio", "=", schoolId),
          eb("e.id_colegio", "=", schoolId)
        ])
      );
    }

    const children = await childrenQuery.execute();

    if (children.length === 0) {
      return res.json({ 
        children: [], 
        studentStats: [], 
        recentActivity: [], 
        activePeriod: null,
        periods: [] 
      });
    }

    const activeSchoolId = schoolId || children[0].id_colegio;
    const filteredChildren = children;
    const schoolSettings = await ensureSchoolDefaultSettings(activeSchoolId);
    const notaAprobacion = Number(schoolSettings?.nota_aprobacion ?? 3.0);

    // 2. Get available periods for the selected year and school
    let periodsQuery = db
      .selectFrom("periodo_academico as pa")
      .innerJoin("anio_lectivo as al", "al.id_anio", "pa.id_anio")
      .select([
        "pa.id_periodo",
        "pa.nombre",
        "pa.trimestre",
        "pa.estado",
        sql<Date>`(al.calendario || '-' || lpad(pa.mes_inicio::text, 2, '0') || '-' || lpad(pa.dia_inicio::text, 2, '0'))::date`.as("fecha_inicio"),
        sql<Date>`(al.calendario || '-' || lpad(pa.mes_fin::text, 2, '0') || '-' || lpad(pa.dia_fin::text, 2, '0'))::date`.as("fecha_fin")
      ])
      .where("pa.id_colegio", "=", activeSchoolId)
      .where("pa.estado", "!=", "PENDIENTE");

    if (targetYearId) {
      periodsQuery = periodsQuery.where("pa.id_anio", "=", Number(targetYearId));
    }

    const periods = await periodsQuery.orderBy("pa.trimestre", "asc").execute();

    // 3. Determine active period (either from query or auto-detected)
    let id_periodo: number | null = null;
    let activePeriod = null;
    const periodQuery = req.query.id_periodo as string;

    if (periodQuery === 'all') {
      id_periodo = null;
      activePeriod = null;
    } else {
      id_periodo = periodQuery ? parseInt(periodQuery) : null;
      if (id_periodo) {
        activePeriod = periods.find(p => p.id_periodo === id_periodo);
      }

      if (!activePeriod) {
        // Periodo ABIERTO
        activePeriod = periods.find(p => p.estado === 'ABIERTO');
        
        // Fallback a último CERRADO si no hay abierto
        if (!activePeriod && periods.length > 0) {
          activePeriod = periods[periods.length - 1];
        }
        
        id_periodo = activePeriod?.id_periodo || null;
      }
    }

    // 4. Aggregate stats per child (only for the selected school)
    const statsPromises = filteredChildren.map(async (child: any) => {
      // Average and At Risk
      let grades: any[] = [];
      if (id_periodo && child.id_grupo) {
        const calcSubquery = db
          .selectFrom("notas_actividad as na")
          .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
          .select([
            "am.id_detallegrado",
            "na.id_estudiante",
            sql<number>`ROUND(SUM(na.nota * (am.porcentaje / 100.0))::numeric, 2)`.as("promedio_calculado")
          ])
          .where("am.id_periodo", "=", id_periodo)
          .where("na.id_estudiante", "=", child.id_estudiante)
          .groupBy(["am.id_detallegrado", "na.id_estudiante"])
          .as("calc");

        const rows = await db
          .selectFrom("detalle_grados as dg")
          .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
          .leftJoin("resultado_academico as ra", (join) =>
            join
              .onRef("ra.id_detallegrado", "=", "dg.id_detallegrado")
              .on("ra.id_periodo", "=", id_periodo)
              .on("ra.id_estudiante", "=", child.id_estudiante)
          )
          .leftJoin(calcSubquery, "calc.id_detallegrado", "dg.id_detallegrado")
          .select([
            "m.nombre as materia",
            sql<number | null>`MAX(COALESCE(ra.promedio, calc.promedio_calculado))`.as("calificacion")
          ])
          .where("dg.id_grupo", "=", child.id_grupo)
          .groupBy("m.nombre")
          .execute();

        grades = rows
          .filter(r => r.calificacion !== null && r.calificacion !== undefined && !isNaN(Number(r.calificacion)))
          .map(r => ({
            materia: r.materia,
            calificacion: parseFloat(String(r.calificacion))
          }));
      } else if (child.id_grupo && child.id_anio) {
        const calcSubquery = db
          .selectFrom("notas_actividad as na")
          .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
          .innerJoin("periodo_academico as pa", "pa.id_periodo", "am.id_periodo")
          .select([
            "am.id_detallegrado",
            "na.id_estudiante",
            sql<number>`ROUND(SUM(na.nota * (am.porcentaje / 100.0))::numeric, 2)`.as("promedio_calculado")
          ])
          .where("pa.id_anio", "=", Number(child.id_anio))
          .where("na.id_estudiante", "=", child.id_estudiante)
          .where("pa.estado", "!=", "PENDIENTE")
          .groupBy(["am.id_detallegrado", "na.id_estudiante"])
          .as("calc");

        const rows = await db
          .selectFrom("detalle_grados as dg")
          .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
          .leftJoin(calcSubquery, "calc.id_detallegrado", "dg.id_detallegrado")
          .select([
            "m.nombre as materia",
            sql<number | null>`MAX(calc.promedio_calculado)`.as("calificacion")
          ])
          .where("dg.id_grupo", "=", child.id_grupo)
          .groupBy("m.nombre")
          .execute();

        grades = rows
          .filter(r => r.calificacion !== null && r.calificacion !== undefined && !isNaN(Number(r.calificacion)))
          .map(r => ({
            materia: r.materia,
            calificacion: parseFloat(String(r.calificacion))
          }));
      }

      const gradedList = grades.filter(g => g.calificacion !== null);
      const avg = gradedList.length > 0 ? (gradedList.reduce((a, b) => a + b.calificacion!, 0) / gradedList.length) : null;
      const atRisk = gradedList.filter(g => g.calificacion! < notaAprobacion);

      // Attendance Filtered by Period Dates or overall academic year
      let attStatsRow: any;
      if (id_periodo && activePeriod) {
        attStatsRow = await db
          .selectFrom("registro_asistencia")
          .select([
            sql<number>`COUNT(*) filter (where estado = 'PRESENTE')::int`.as("presentes"),
            sql<number>`COUNT(*) filter (where estado = 'AUSENTE')::int`.as("ausentes"),
            sql<number>`COUNT(*) filter (where estado = 'TARDE')::int`.as("tardes"),
            sql<number>`COUNT(*)::int`.as("total")
          ])
          .where("id_estudiante", "=", child.id_estudiante)
          .where("id_colegio", "=", child.id_colegio)
          .where("fecha", ">=", activePeriod.fecha_inicio as any)
          .where("fecha", "<=", activePeriod.fecha_fin as any)
          .executeTakeFirst();
      } else {
        attStatsRow = await db
          .selectFrom("registro_asistencia")
          .select([
            sql<number>`COUNT(*) filter (where estado = 'PRESENTE')::int`.as("presentes"),
            sql<number>`COUNT(*) filter (where estado = 'AUSENTE')::int`.as("ausentes"),
            sql<number>`COUNT(*) filter (where estado = 'TARDE')::int`.as("tardes"),
            sql<number>`COUNT(*)::int`.as("total")
          ])
          .where("id_estudiante", "=", child.id_estudiante)
          .where("id_colegio", "=", child.id_colegio)
          .executeTakeFirst();
      }
      
      const attStats = attStatsRow || { presentes: 0, ausentes: 0, tardes: 0, total: 0 };
      const attRate = attStats.total > 0 ? (Number(attStats.presentes) / Number(attStats.total)) * 100 : 100;

      // Pending Activities
      let pendingCount = 0;
      if (id_periodo && child.id_grupo) {
        const row = await db
          .selectFrom("actividad_materia as am")
          .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
          .leftJoin("notas_actividad as na", (join) =>
            join
              .onRef("na.id_actividadmateria", "=", "am.id_actividadmateria")
              .on("na.id_estudiante", "=", child.id_estudiante)
          )
          .select(sql<number>`COUNT(*)::int`.as("count"))
          .where("dg.id_grupo", "=", child.id_grupo)
          .where("am.id_periodo", "=", id_periodo)
          .where("na.nota", "is", null)
          .executeTakeFirst();

        pendingCount = row?.count || 0;
      } else if (child.id_grupo && child.id_anio) {
        const row = await db
          .selectFrom("actividad_materia as am")
          .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
          .innerJoin("periodo_academico as pa", "pa.id_periodo", "am.id_periodo")
          .leftJoin("notas_actividad as na", (join) =>
            join
              .onRef("na.id_actividadmateria", "=", "am.id_actividadmateria")
              .on("na.id_estudiante", "=", child.id_estudiante)
          )
          .select(sql<number>`COUNT(*)::int`.as("count"))
          .where("dg.id_grupo", "=", child.id_grupo)
          .where("pa.id_anio", "=", Number(child.id_anio))
          .where("pa.estado", "!=", "PENDIENTE")
          .where("na.nota", "is", null)
          .executeTakeFirst();

        pendingCount = row?.count || 0;
      }

      // Evolution (by period)
      let evolution: any[] = [];
      if (child.id_anio) {
        evolution = await db
          .selectFrom("resultado_academico as ra")
          .innerJoin("periodo_academico as pa", "pa.id_periodo", "ra.id_periodo")
          .select([
            "pa.nombre as periodo",
            sql<number>`ROUND(AVG(ra.promedio)::numeric, 2)`.as("promedio")
          ])
          .where("ra.id_estudiante", "=", child.id_estudiante)
          .where("pa.id_anio", "=", Number(child.id_anio))
          .groupBy(["pa.id_periodo", "pa.nombre", "pa.trimestre"])
          .orderBy("pa.trimestre", "asc")
          .execute();
      }

      // Sort to get top best and worst subjects
      const sortedGrades = [...gradedList].sort((a, b) => b.calificacion! - a.calificacion!);
      const top_materias_mejores = sortedGrades.slice(0, 5);
      const top_materias_peores = [...sortedGrades].reverse().slice(0, 5);

      return {
        id_estudiante: child.id_estudiante,
        average: avg !== null ? parseFloat(avg.toFixed(2)) : 0,
        atRisk: atRisk.length,
        atRiskSubjects: atRisk.map(s => s.materia),
        attendanceRate: Math.round(attRate),
        pendingActivities: Number(pendingCount),
        evolution,
        grades: gradedList,
        top_materias_mejores,
        top_materias_peores,
        attendanceDetails: {
          presentes: Number(attStats.presentes || 0),
          ausentes: Number(attStats.ausentes || 0),
          tardes: Number(attStats.tardes || 0),
          total: Number(attStats.total || 0)
        }
      };
    });

    const studentStats = await Promise.all(statsPromises);

    // 5. Recent Activity (use filtered studentIds)
    const studentIds = filteredChildren.map((c: any) => c.id_estudiante);
    let recentActivity: any[] = [];
    if (studentIds.length > 0) {
      if (id_periodo) {
        const califs = db
          .selectFrom("notas_actividad as na")
          .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
          .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
          .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
          .innerJoin("estudiante as e", "e.id_estudiante", "na.id_estudiante")
          .select([
            sql<string>`'CALIFICACION'`.as("tipo_actividad"),
            "m.nombre as materia",
            "am.nombre as detalle",
            sql<string>`na.nota::text`.as("valor"),
            sql<Date | null>`NULL::date`.as("fecha"),
            sql<string>`e.nombre || ' ' || e.apellido`.as("estudiante")
          ])
          .where("na.id_estudiante", "in", studentIds)
          .where("am.id_periodo", "=", id_periodo);

        const obs = db
          .selectFrom("observacion_estudiante as oe")
          .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "oe.id_detallegrado")
          .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
          .innerJoin("estudiante as e", "e.id_estudiante", "oe.id_estudiante")
          .select([
            sql<string>`'OBSERVACION'`.as("tipo_actividad"),
            "m.nombre as materia",
            sql<string>`oe.tipo::text`.as("detalle"),
            sql<string>`oe.id_observacion::text`.as("valor"),
            "oe.fecha as fecha",
            sql<string>`e.nombre || ' ' || e.apellido`.as("estudiante")
          ])
          .where("oe.id_estudiante", "in", studentIds)
          .where("oe.id_periodo", "=", id_periodo);

        recentActivity = await califs.unionAll(obs).orderBy("fecha", "desc").limit(10).execute();
      } else {
        const califs = db
          .selectFrom("notas_actividad as na")
          .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
          .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
          .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
          .innerJoin("estudiante as e", "e.id_estudiante", "na.id_estudiante")
          .select([
            sql<string>`'CALIFICACION'`.as("tipo_actividad"),
            "m.nombre as materia",
            "am.nombre as detalle",
            sql<string>`na.nota::text`.as("valor"),
            sql<Date | null>`NULL::date`.as("fecha"),
            sql<string>`e.nombre || ' ' || e.apellido`.as("estudiante")
          ])
          .where("na.id_estudiante", "in", studentIds);

        const obs = db
          .selectFrom("observacion_estudiante as oe")
          .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "oe.id_detallegrado")
          .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
          .innerJoin("estudiante as e", "e.id_estudiante", "oe.id_estudiante")
          .select([
            sql<string>`'OBSERVACION'`.as("tipo_actividad"),
            "m.nombre as materia",
            sql<string>`oe.tipo::text`.as("detalle"),
            sql<string>`oe.id_observacion::text`.as("valor"),
            "oe.fecha as fecha",
            sql<string>`e.nombre || ' ' || e.apellido`.as("estudiante")
          ])
          .where("oe.id_estudiante", "in", studentIds);

        recentActivity = await califs.unionAll(obs).orderBy("fecha", "desc").limit(10).execute();
      }
    }

    res.json({
      children: filteredChildren,
      studentStats,
      recentActivity,
      activePeriod,
      periods,
      defaultSettings: schoolSettings
    });
  } catch (error) {
    console.error('Error fetching parent dashboard data:', error);
    res.status(500).json({ 
      error: 'Error al obtener datos del dashboard',
      children: [],
      studentStats: [],
      recentActivity: [],
      activePeriod: null,
      periods: []
    });
  }
};

/**
 * Gets student ID from user ID (for logged in students)
 */
export const getStudentIdByUserId = async (req: Request, res: Response) => {
  const { id_usuario } = req.params;
  try {
    const row = await db
      .selectFrom("estudiante")
      .select("id_estudiante")
      .where("id_usuario", "=", Number(id_usuario))
      .executeTakeFirst();

    if (!row) {
      return res.status(404).json({ error: 'Estudiante no vinculado a este usuario' });
    }
    res.json(row);
  } catch (error) {
    console.error('Error fetching student ID:', error);
    res.status(500).json({ error: 'Error al obtener vinculación de estudiante' });
  }
};

/**
 * Gets aggregated dashboard statistics for a specific student and period
 */
export const getStudentDashboardStats = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo } = req.params;

  try {
    const studentIdInt = parseInt(id_estudiante as string);
    const periodIdInt = parseInt(id_periodo as string);

    if (isNaN(studentIdInt) || isNaN(periodIdInt)) {
      return res.status(400).json({ error: 'Parámetros numéricos inválidos' });
    }

    // 1. Get student basic info and group
    const studentCheck = await db
      .selectFrom("estudiante as e")
      .leftJoin("matricula as m", (join) =>
        join
          .onRef("m.id_estudiante", "=", "e.id_estudiante")
          .on("m.estado", "=", "ACTIVA")
      )
      .select(["e.id_estudiante", "e.id_colegio", "m.id_grupo"])
      .where("e.id_estudiante", "=", studentIdInt)
      .limit(1)
      .executeTakeFirst();

    if (!studentCheck) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const { id_colegio, id_grupo } = studentCheck;

    // Get school grading approval limit
    const configRes = await db
      .selectFrom("configuracion_colegio")
      .select("nota_aprobacion")
      .where("id_colegio", "=", id_colegio)
      .executeTakeFirst();

    const nota_aprobacion = configRes ? parseFloat(String(configRes.nota_aprobacion)) : 3.0;

    // 2. Fetch all student subjects and their grades for this period
    let grades: any[] = [];
    if (id_grupo) {
      const calcSubquery = db
        .selectFrom("notas_actividad as na")
        .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
        .select([
          "am.id_detallegrado",
          "na.id_estudiante",
          sql<number>`ROUND(SUM(na.nota * (am.porcentaje / 100.0))::numeric, 2)`.as("promedio_calculado")
        ])
        .where("am.id_periodo", "=", periodIdInt)
        .where("na.id_estudiante", "=", studentIdInt)
        .groupBy(["am.id_detallegrado", "na.id_estudiante"])
        .as("calc");

      const gradesRows = await db
        .selectFrom("detalle_grados as dg")
        .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
        .leftJoin("resultado_academico as ra", (join) =>
          join
            .onRef("ra.id_detallegrado", "=", "dg.id_detallegrado")
            .on("ra.id_periodo", "=", periodIdInt)
            .on("ra.id_estudiante", "=", studentIdInt)
        )
        .leftJoin(calcSubquery, "calc.id_detallegrado", "dg.id_detallegrado")
        .select([
          "m.id_materia",
          "m.nombre as materia",
          sql<number | null>`COALESCE(ra.promedio, calc.promedio_calculado)`.as("calificacion")
        ])
        .where("dg.id_grupo", "=", id_grupo)
        .orderBy("m.nombre", "asc")
        .execute();

      grades = gradesRows.map(row => ({
        id_materia: row.id_materia,
        materia: row.materia,
        calificacion: row.calificacion !== null && row.calificacion !== undefined ? parseFloat(String(row.calificacion)) : null
      }));
    }

    const gradedList = grades.filter(g => g.calificacion !== null);

    // Check if any actual grades or results exist in the database for this period and student
    const notesCountRow = await db
      .selectFrom("notas_actividad as na")
      .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
      .select(sql<number>`COUNT(*)::int`.as("count"))
      .where("am.id_periodo", "=", periodIdInt)
      .where("na.id_estudiante", "=", studentIdInt)
      .executeTakeFirst();

    const resultsCountRow = await db
      .selectFrom("resultado_academico")
      .select(sql<number>`COUNT(*)::int`.as("count"))
      .where("id_periodo", "=", periodIdInt)
      .where("id_estudiante", "=", studentIdInt)
      .executeTakeFirst();

    const has_calificaciones = (notesCountRow?.count || 0) > 0 || (resultsCountRow?.count || 0) > 0;

    // Calculate grades aggregates
    let promedio_general = null;
    let materias_aprobadas: number | null = null;
    let materias_reprobadas: number | null = null;

    if (has_calificaciones && gradedList.length > 0) {
      const sum = gradedList.reduce((acc, curr) => acc + curr.calificacion!, 0);
      promedio_general = sum / gradedList.length;
      
      let aprobadas = 0;
      let reprobadas = 0;
      gradedList.forEach(g => {
        if (g.calificacion! >= nota_aprobacion) {
          aprobadas++;
        } else {
          reprobadas++;
        }
      });
      materias_aprobadas = aprobadas;
      materias_reprobadas = reprobadas;
    }

    // Sort to get top best and worst subjects (only among subjects with grades)
    const sortedGrades = [...gradedList].sort((a, b) => b.calificacion! - a.calificacion!);
    const top_materias_mejores = sortedGrades.slice(0, 5);
    const top_materias_peores = [...sortedGrades].reverse().slice(0, 5);

    // 3. Attendance statistics
    const dateStartSubquery = db
      .selectFrom("periodo_academico as pa")
      .innerJoin("anio_lectivo as al", "al.id_anio", "pa.id_anio")
      .select([
        sql<Date>`(al.calendario || '-' || LPAD(pa.mes_inicio::text, 2, '0') || '-' || LPAD(pa.dia_inicio::text, 2, '0'))::date`.as("fecha_inicio")
      ])
      .where("pa.id_periodo", "=", periodIdInt);

    const dateEndSubquery = db
      .selectFrom("periodo_academico as pa")
      .innerJoin("anio_lectivo as al", "al.id_anio", "pa.id_anio")
      .select([
        sql<Date>`(al.calendario || '-' || LPAD(pa.mes_fin::text, 2, '0') || '-' || LPAD(pa.dia_fin::text, 2, '0'))::date`.as("fecha_fin")
      ])
      .where("pa.id_periodo", "=", periodIdInt);

    const attendanceRows = await db
      .selectFrom("registro_asistencia as ra")
      .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "ra.id_detallegrado")
      .select([
        "ra.estado",
        sql<number>`COUNT(*)::int`.as("count")
      ])
      .where("ra.id_estudiante", "=", studentIdInt)
      .where("ra.fecha", ">=", dateStartSubquery)
      .where("ra.fecha", "<=", dateEndSubquery)
      .groupBy("ra.estado")
      .execute();

    const attCounts: any = { PRESENTE: 0, AUSENTE: 0, TARDE: 0, JUSTIFICADA: 0 };
    let attendance_total = 0;

    attendanceRows.forEach(row => {
      if (attCounts.hasOwnProperty(row.estado)) {
        const count = Number(row.count);
        attCounts[row.estado] = count;
        attendance_total += count;
      }
    });

    const inasistencias_total = attCounts.AUSENTE;
    const has_asistencia = attendance_total > 0;
    const asistencia_porcentaje = has_asistencia
      ? Math.round(((attendance_total - inasistencias_total) / attendance_total) * 100)
      : null;

    // 4. Observations count by type
    const obsRows = await db
      .selectFrom("observacion_estudiante")
      .select([
        "tipo",
        sql<number>`COUNT(*)::int`.as("count")
      ])
      .where("id_estudiante", "=", studentIdInt)
      .where("id_periodo", "=", periodIdInt)
      .groupBy("tipo")
      .execute();

    const reportes_conteo = {
      ACADEMICA: 0,
      DISCIPLINARIA: 0,
      CONVIVENCIAL: 0
    };

    obsRows.forEach(row => {
      if (row.tipo === 'ACADEMICA') {
        reportes_conteo.ACADEMICA = Number(row.count);
      } else if (row.tipo === 'CONVIVENCIA') {
        reportes_conteo.CONVIVENCIAL = Number(row.count);
      } else if (row.tipo === 'DISCIPLINARIA') {
        reportes_conteo.DISCIPLINARIA = Number(row.count);
      }
    });

    // 5. Recent activities
    let actividades_recientes: any[] = [];
    if (id_grupo) {
      const actRows = await db
        .selectFrom("actividad_materia as am")
        .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "am.id_detallegrado")
        .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
        .leftJoin("notas_actividad as na", (join) =>
          join
            .onRef("na.id_actividadmateria", "=", "am.id_actividadmateria")
            .on("na.id_estudiante", "=", studentIdInt)
        )
        .select([
          "am.nombre as actividad",
          "am.porcentaje",
          "m.nombre as materia",
          sql<boolean>`CASE WHEN na.nota IS NOT NULL THEN true ELSE false END`.as("calificada"),
          "na.nota"
        ])
        .where("dg.id_grupo", "=", id_grupo)
        .where("am.id_periodo", "=", periodIdInt)
        .orderBy("am.id_actividadmateria", "desc")
        .limit(5)
        .execute();

      actividades_recientes = actRows.map(row => ({
        actividad: row.actividad,
        porcentaje: parseFloat(String(row.porcentaje)),
        materia: row.materia,
        calificada: row.calificada,
        nota: row.nota ? parseFloat(String(row.nota)) : null
      }));
    }

    // 6. Student ranking / academic position in group
    let puesto = null;
    let total_estudiantes = 0;

    if (id_grupo) {
      const calcSubqueryRanking = db
        .selectFrom("notas_actividad as na")
        .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
        .select([
          "am.id_detallegrado",
          "na.id_estudiante",
          sql<number>`SUM(na.nota * (am.porcentaje / 100.0))`.as("promedio_calculado")
        ])
        .where("am.id_periodo", "=", periodIdInt)
        .groupBy(["am.id_detallegrado", "na.id_estudiante"])
        .as("calc");

      const promediosEstudiantesCte = db
        .selectFrom("matricula as mat")
        .innerJoin("detalle_grados as dg", "dg.id_grupo", "mat.id_grupo")
        .leftJoin("resultado_academico as ra", (join) =>
          join
            .onRef("ra.id_detallegrado", "=", "dg.id_detallegrado")
            .on("ra.id_periodo", "=", periodIdInt)
            .onRef("ra.id_estudiante", "=", "mat.id_estudiante")
        )
        .leftJoin(calcSubqueryRanking, (join) =>
          join
            .onRef("calc.id_detallegrado", "=", "dg.id_detallegrado")
            .onRef("calc.id_estudiante", "=", "mat.id_estudiante")
        )
        .select([
          "mat.id_estudiante",
          sql<number>`ROUND(AVG(COALESCE(ra.promedio, calc.promedio_calculado, 0))::numeric, 2)`.as("promedio_general")
        ])
        .where("mat.id_grupo", "=", id_grupo)
        .where("mat.estado", "=", "ACTIVA")
        .groupBy("mat.id_estudiante");

      const rankingEstudiantesCte = db
        .with("promedios_estudiantes", () => promediosEstudiantesCte)
        .selectFrom("promedios_estudiantes")
        .select([
          "id_estudiante",
          "promedio_general",
          sql<number>`RANK() OVER (ORDER BY promedio_general DESC)`.as("puesto"),
          sql<number>`COUNT(*) OVER ()`.as("total_estudiantes")
        ]);

      const rankingRow = await db
        .with("promedios_estudiantes", () => promediosEstudiantesCte)
        .with("ranking_estudiantes", () => rankingEstudiantesCte)
        .selectFrom("ranking_estudiantes")
        .select(["puesto", "total_estudiantes"])
        .where("id_estudiante", "=", studentIdInt)
        .executeTakeFirst();

      if (rankingRow) {
        puesto = Number(rankingRow.puesto);
        total_estudiantes = Number(rankingRow.total_estudiantes);
      }
    }

    res.json({
      promedio_general: (has_calificaciones && promedio_general !== null) ? parseFloat(promedio_general.toFixed(2)) : null,
      materias_aprobadas,
      materias_reprobadas,
      asistencia_porcentaje,
      inasistencias_total: has_asistencia ? inasistencias_total : null,
      reportes_conteo,
      top_materias_mejores: has_calificaciones ? top_materias_mejores : [],
      top_materias_peores: has_calificaciones ? top_materias_peores : [],
      actividades_recientes,
      puesto_academico: (has_calificaciones && puesto) ? { puesto, total_estudiantes } : null,
      has_calificaciones,
      has_asistencia
    });

  } catch (error) {
    console.error('Error fetching student dashboard stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas del estudiante' });
  }
};
