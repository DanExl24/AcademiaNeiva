import { Request, Response } from "express";
import { pool } from "../config/db";
import { db } from "../config/kysely";
import { sql } from "kysely";

export const getTeacherCourses = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  const authUser = (req as any).user;
  const isDirectivoOrAdmin = authUser && (authUser.roles.includes("admin_general") || authUser.roles.includes("directivo"));
  const isMonitoring = req.headers['x-monitoring-mode'] === 'true' || req.headers['x-monitoring-mode'] === '1';
  if (authUser && !isDirectivoOrAdmin && !isMonitoring && Number(authUser.id) !== Number(userId)) {
    res.status(403).json({ error: "No tiene permiso para consultar los cursos de otro docente." });
    return;
  }

  const schoolId = req.headers['x-school-id'] ? Number(req.headers['x-school-id']) : (req.query.schoolId ? Number(req.query.schoolId) : (authUser?.schoolId ? Number(authUser.schoolId) : null));

  try {
    let docenteQuery = db
      .selectFrom("docente")
      .select(["id_docente", "id_colegio"])
      .where("id_usuario", "=", Number(userId));

    if (schoolId) {
      docenteQuery = docenteQuery.where("id_colegio", "=", schoolId);
    }

    const docente = await docenteQuery.executeTakeFirst();

    const yearId = req.query.yearId
      ? Number(req.query.yearId)
      : (req.headers['x-academic-year-id'] ? Number(req.headers['x-academic-year-id']) : (req as any).academicYearId || null);

    let baseQuery = db
      .selectFrom("detalle_grados as dg")
      .innerJoin("grupos as g", "g.id_grupo", "dg.id_grupo")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
      .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
      .select([
        "dg.id_detallegrado",
        "g.id_grupo as id_grado",
        "tg.nombre as grado_nombre",
        "ne.nombre as nivel",
        "s.nombre as seccion",
        "j.nombre as jornada_nombre",
        "m.id_materia",
        "m.nombre as materia_nombre"
      ]);

    if (docente) {
      baseQuery = baseQuery.where("dg.id_docente", "=", docente.id_docente);
    } else if (!isDirectivoOrAdmin) {
      console.warn(`[DEV] getTeacherCourses - No docente found for id_usuario=${userId} in schoolId=${schoolId}`);
      res.json([]);
      return;
    }

    if (schoolId) {
      baseQuery = baseQuery.where("dg.id_colegio", "=", schoolId);
    }

    if (yearId) {
      baseQuery = baseQuery.where("dg.id_anio", "=", yearId);
    }

    const result = await baseQuery.execute();
    res.json(result);
  } catch (error: any) {
    console.error(`[DEV] getTeacherCourses ERROR - userId=${userId}:`, error.message, error.detail || '');
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getStudentsByGrade = async (req: Request, res: Response): Promise<void> => {
  const { gradeId } = req.params;
  const yearId = req.query.yearId
    ? Number(req.query.yearId)
    : (req.headers['x-academic-year-id'] ? Number(req.headers['x-academic-year-id']) : (req as any).academicYearId || null);

  try {
    let query = db
      .selectFrom("estudiante as e")
      .leftJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .innerJoin("matricula as m", "m.id_estudiante", "e.id_estudiante")
      .select([
        "e.id_estudiante",
        "e.nombre",
        "e.apellido",
        "u.documento",
        "e.codigo"
      ])
      .where("m.id_grupo", "=", Number(gradeId))
      .where("m.estado", "in", ["ACTIVA", "APROBADA"]);

    if (yearId) {
      query = query.where("m.id_anio", "=", yearId);
    }

    const students = await query
      .orderBy("e.apellido", "asc")
      .orderBy("e.nombre", "asc")
      .execute();

    res.json(students);
  } catch (error: any) {
    console.error(`[DEV] getStudentsByGrade ERROR - gradeId=${gradeId}:`, error.message, error.detail || '');
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getTeacherDashboard = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  const authUser = (req as any).user;
  const schoolId = req.headers['x-school-id'] ? Number(req.headers['x-school-id']) : (req.query.schoolId ? Number(req.query.schoolId) : (authUser?.schoolId ? Number(authUser.schoolId) : null));
  const yearIdParam = req.query.yearId ? Number(req.query.yearId) : null;
  const periodIdRaw = req.query.periodId ? String(req.query.periodId) : null;
  const isAllPeriods = periodIdRaw === 'all' || periodIdRaw === '0';
  const periodIdParam = (periodIdRaw && !isAllPeriods) ? Number(periodIdRaw) : null;

  try {
    let docenteQuery = db
      .selectFrom("docente")
      .select(["id_docente", "id_colegio"])
      .where("id_usuario", "=", Number(userId));

    if (schoolId) {
      docenteQuery = docenteQuery.where("id_colegio", "=", schoolId);
    }

    const docente = await docenteQuery.executeTakeFirst();

    if (!docente) {
      res.json({
        coursesCount: 0,
        studentsCount: 0,
        noGradeActivities: 0,
        upToDateCourses: 0,
        courseAverages: [],
        alerts: [],
        availablePeriods: [],
        activePeriodInfo: null
      });
      return;
    }
    const idDocente = docente.id_docente;
    const effectiveSchoolId = schoolId || docente.id_colegio;

    let coursesQuery = db
      .selectFrom("detalle_grados as dg")
      .innerJoin("grupos as g", "g.id_grupo", "dg.id_grupo")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
      .select([
        "dg.id_detallegrado",
        "m.nombre as materia_nombre",
        "tg.nombre as grado_nombre",
        "s.nombre as seccion",
        "j.nombre as jornada"
      ])
      .where("dg.id_docente", "=", idDocente);

    if (effectiveSchoolId) {
      coursesQuery = coursesQuery.where("dg.id_colegio", "=", effectiveSchoolId);
    }

    const courses = await coursesQuery.execute();

    let studentCountQuery = db
      .selectFrom("detalle_grados as dg")
      .innerJoin("matricula as m", "m.id_grupo", "dg.id_grupo")
      .select(sql<number>`COUNT(DISTINCT m.id_estudiante)::int`.as("total_students"))
      .where("dg.id_docente", "=", idDocente)
      .where("m.estado", "=", "ACTIVA");

    if (effectiveSchoolId) {
      studentCountQuery = studentCountQuery.where("dg.id_colegio", "=", effectiveSchoolId);
    }

    const studentCount = await studentCountQuery.executeTakeFirst();
    const totalActiveStudents = studentCount ? studentCount.total_students : 0;

    // Get available periods for yearIdParam (or effectiveSchoolId)
    let periodsQuery = db
      .selectFrom("periodo_academico as pa")
      .innerJoin("anio_lectivo as al", "al.id_anio", "pa.id_anio")
      .select([
        "pa.id_periodo",
        "pa.nombre",
        "pa.estado",
        "pa.mes_inicio",
        "pa.dia_inicio",
        "pa.mes_fin",
        "pa.dia_fin",
        "pa.id_anio",
        "al.calendario",
        "al.estado as anio_estado"
      ]);

    if (effectiveSchoolId) {
      periodsQuery = periodsQuery.where("pa.id_colegio", "=", effectiveSchoolId);
    }
    if (yearIdParam) {
      periodsQuery = periodsQuery.where("pa.id_anio", "=", yearIdParam);
    }

    const availablePeriods = await periodsQuery.orderBy("pa.id_periodo", "asc").execute();

    let activePeriodInfo: any = null;
    if (isAllPeriods) {
      activePeriodInfo = { id_periodo: 'all', nombre: 'Todos los Periodos (Acumulado)' };
    } else if (periodIdParam) {
      activePeriodInfo = availablePeriods.find(p => p.id_periodo === periodIdParam) || null;
    }
    if (!activePeriodInfo && availablePeriods.length > 0) {
      activePeriodInfo = availablePeriods.find(p => p.estado === 'ABIERTO') || availablePeriods[availablePeriods.length - 1];
    }

    const activePeriodId = activePeriodInfo ? activePeriodInfo.id_periodo : null;

    if (!activePeriodId && !isAllPeriods) {
      res.json({
        coursesCount: courses.length,
        studentsCount: totalActiveStudents,
        noGradeActivities: 0,
        upToDateCourses: courses.length,
        courseAverages: [],
        alerts: [],
        availablePeriods,
        activePeriodInfo: null
      });
      return;
    }

    let noGradeActivitiesCount = 0;
    let upToDateCoursesCount = 0;
    const courseAverages: any[] = [];
    const alerts: any[] = [];

    for (const course of courses) {
      const dgId = course.id_detallegrado;
      const courseName = `${course.grado_nombre} ${course.seccion} - ${course.materia_nombre} (${course.jornada})`;

      // 1. Actividades del curso
      let activitiesQuery = db
        .selectFrom("actividad_materia as am")
        .innerJoin("competencias as c", "c.id_competencia", "am.id_competencia")
        .innerJoin("periodo_academico as pa", "pa.id_periodo", "c.id_periodo")
        .select(["am.id_actividadmateria", "am.porcentaje", "am.nombre", "c.id_periodo"])
        .where("am.id_detallegrado", "=", dgId);

      if (!isAllPeriods && activePeriodId) {
        activitiesQuery = activitiesQuery.where("c.id_periodo", "=", Number(activePeriodId));
      } else if (yearIdParam) {
        activitiesQuery = activitiesQuery.where("pa.id_anio", "=", yearIdParam);
      }

      const activities = await activitiesQuery.execute();

      const activityCount = activities.length;

      // 2. Estudiantes del curso
      const courseStudents = await db
        .selectFrom("estudiante as e")
        .innerJoin("matricula as m", "m.id_estudiante", "e.id_estudiante")
        .innerJoin("detalle_grados as dg", "dg.id_grupo", "m.id_grupo")
        .select(["e.id_estudiante", "e.nombre", "e.apellido"])
        .where("dg.id_detallegrado", "=", dgId)
        .where("m.estado", "=", "ACTIVA")
        .execute();

      if (courseStudents.length === 0 || activityCount === 0) {
        let fallbackAvg = 0;
        if (activePeriodId && activePeriodId !== 'all') {
          const raRes = await db
            .selectFrom("resultado_academico")
            .select(sql<number>`AVG(promedio)::numeric`.as("avg_promedio"))
            .where("id_detallegrado", "=", dgId)
            .where("id_periodo", "=", Number(activePeriodId))
            .executeTakeFirst();
          if (raRes && raRes.avg_promedio !== null) {
            fallbackAvg = Number(Number(raRes.avg_promedio).toFixed(1));
          }
        }
        courseAverages.push({
          name: courseName,
          shortName: `${course.grado_nombre} ${course.seccion} - ${course.materia_nombre}`,
          average: fallbackAvg
        });
        continue;
      }

      let courseTotalSum = 0;
      let missingAnyGradeForCourse = false;

      for (const act of activities) {
        const totalNotasRes = await db
          .selectFrom("notas_actividad")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("id_actividadmateria", "=", act.id_actividadmateria)
          .executeTakeFirst();

        if (totalNotasRes && Number(totalNotasRes.count) === 0) {
          noGradeActivitiesCount++;
        }
      }

      for (const stu of courseStudents) {
        const studentName = `${stu.nombre} ${stu.apellido}`;
        let studentMissingDeliveries = 0;
        let studentAverage = 0;

        for (const act of activities) {
          const checkRes = await db
            .selectFrom("notas_actividad")
            .select("nota")
            .where("id_actividadmateria", "=", act.id_actividadmateria)
            .where("id_estudiante", "=", stu.id_estudiante)
            .executeTakeFirst();

          if (!checkRes) {
            missingAnyGradeForCourse = true;
            studentMissingDeliveries++;
          } else {
            studentAverage += Number(checkRes.nota) * (Number(act.porcentaje) / 100);
            if (Number(checkRes.nota) === 0) {
              studentMissingDeliveries++;
            }
          }
        }
        courseTotalSum += studentAverage;

        if (studentAverage > 0 && studentAverage < 3.0) {
          alerts.push({
            type: 'riesgo',
            message: `El estudiante ${studentName} tiene un promedio bajo de ${studentAverage.toFixed(1)} en ${course.materia_nombre}.`
          });
        }
        if (studentMissingDeliveries >= 2) {
          alerts.push({
            type: 'entregas',
            message: `El estudiante ${studentName} no ha entregado ${studentMissingDeliveries} actividades en ${course.materia_nombre}.`
          });
        }

        const inasistenciasRes = await db
          .selectFrom("registro_asistencia")
          .select(sql<number>`count(*)::int`.as("faltas"))
          .where("id_estudiante", "=", stu.id_estudiante)
          .where("id_detallegrado", "=", dgId)
          .where("estado", "=", "AUSENTE")
          .executeTakeFirst();

        const faltas = inasistenciasRes ? Number(inasistenciasRes.faltas) : 0;

        if (faltas >= 3) {
          alerts.push({
            type: 'faltas',
            message: `El estudiante ${studentName} tiene ${faltas} faltas acumuladas en ${course.materia_nombre}.`
          });
        }
      }

      if (!missingAnyGradeForCourse) {
        upToDateCoursesCount++;
      }

      const cAverage = courseTotalSum / courseStudents.length;
      courseAverages.push({
        name: courseName,
        shortName: `${course.grado_nombre} ${course.seccion} - ${course.materia_nombre}`,
        average: Number(cAverage.toFixed(1))
      });

      if (cAverage > 0 && cAverage < 3.0) {
        alerts.push({
          type: 'promedio_grupal',
          message: `${courseName} tiene un promedio grupal bajo de ${cAverage.toFixed(1)}`
        });
      }
    }

    res.json({
      coursesCount: courses.length,
      studentsCount: totalActiveStudents,
      noGradeActivities: noGradeActivitiesCount,
      upToDateCourses: upToDateCoursesCount,
      courseAverages,
      alerts,
      availablePeriods,
      activePeriodInfo
    });
  } catch (error: any) {
    console.error(`[DEV] getTeacherDashboard ERROR - userId=${userId}:`, error.message, error.detail || '', error.hint || '');
    res.status(500).json({ error: "Error en el servidor" });
  }
};
