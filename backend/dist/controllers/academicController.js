"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeacherDashboard = exports.getStudentsByGrade = exports.getTeacherCourses = void 0;
const db_1 = require("../config/db");
const kysely_1 = require("../config/kysely");
const kysely_2 = require("kysely");
const getTeacherCourses = async (req, res) => {
    const { userId } = req.params;
    const authUser = req.user;
    const isMonitoring = req.headers['x-monitoring-mode'] === 'true' || req.headers['x-monitoring-mode'] === '1';
    if (authUser && !authUser.roles.includes("admin_general") && !isMonitoring && Number(authUser.id) !== Number(userId)) {
        res.status(403).json({ error: "No tiene permiso para consultar los cursos de otro docente." });
        return;
    }
    const schoolId = req.headers['x-school-id'] ? Number(req.headers['x-school-id']) : (req.query.schoolId ? Number(req.query.schoolId) : (authUser?.schoolId ? Number(authUser.schoolId) : null));
    try {
        let docenteQuery = kysely_1.db
            .selectFrom("docente")
            .select(["id_docente", "id_colegio"])
            .where("id_usuario", "=", Number(userId));
        if (schoolId) {
            docenteQuery = docenteQuery.where("id_colegio", "=", schoolId);
        }
        const docente = await docenteQuery.executeTakeFirst();
        if (!docente) {
            console.warn(`[DEV] getTeacherCourses - No docente found for id_usuario=${userId} in schoolId=${schoolId}`);
            res.json([]);
            return;
        }
        const idDocente = docente.id_docente;
        const yearId = req.query.yearId ? Number(req.query.yearId) : null;
        let baseQuery = kysely_1.db
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
        ])
            .where("dg.id_docente", "=", idDocente);
        if (schoolId) {
            baseQuery = baseQuery.where("dg.id_colegio", "=", schoolId);
        }
        if (yearId) {
            baseQuery = baseQuery.where("dg.id_anio", "=", yearId);
        }
        const result = await baseQuery.execute();
        res.json(result);
    }
    catch (error) {
        console.error(`[DEV] getTeacherCourses ERROR - userId=${userId}:`, error.message, error.detail || '');
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getTeacherCourses = getTeacherCourses;
const getStudentsByGrade = async (req, res) => {
    const { gradeId } = req.params;
    try {
        const students = await kysely_1.db
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
            .where("m.estado", "in", ["ACTIVA", "TRASLADADA"])
            .orderBy("e.apellido", "asc")
            .orderBy("e.nombre", "asc")
            .execute();
        res.json(students);
    }
    catch (error) {
        console.error(`[DEV] getStudentsByGrade ERROR - gradeId=${gradeId}:`, error.message, error.detail || '');
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getStudentsByGrade = getStudentsByGrade;
const getTeacherDashboard = async (req, res) => {
    const { userId } = req.params;
    const authUser = req.user;
    const schoolId = req.headers['x-school-id'] ? Number(req.headers['x-school-id']) : (req.query.schoolId ? Number(req.query.schoolId) : (authUser?.schoolId ? Number(authUser.schoolId) : null));
    try {
        let docenteQuery = kysely_1.db
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
                alerts: []
            });
            return;
        }
        const idDocente = docente.id_docente;
        let coursesQuery = kysely_1.db
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
        if (schoolId) {
            coursesQuery = coursesQuery.where("dg.id_colegio", "=", schoolId);
        }
        const courses = await coursesQuery.execute();
        let studentCountQuery = kysely_1.db
            .selectFrom("detalle_grados as dg")
            .innerJoin("matricula as m", "m.id_grupo", "dg.id_grupo")
            .select((0, kysely_2.sql) `COUNT(DISTINCT m.id_estudiante)::int`.as("total_students"))
            .where("dg.id_docente", "=", idDocente)
            .where("m.estado", "=", "ACTIVA");
        if (schoolId) {
            studentCountQuery = studentCountQuery.where("dg.id_colegio", "=", schoolId);
        }
        const studentCount = await studentCountQuery.executeTakeFirst();
        const totalActiveStudents = studentCount ? studentCount.total_students : 0;
        let periodRes;
        if (schoolId) {
            periodRes = await db_1.pool.query(`SELECT pa.id_periodo, pa.nombre, pa.estado, pa.mes_inicio, pa.dia_inicio, pa.mes_fin, pa.dia_fin, pa.id_anio, al.calendario, al.estado as anio_estado
         FROM periodo_academico pa
         JOIN anio_lectivo al ON pa.id_anio = al.id_anio
         WHERE pa.id_colegio = $1 AND pa.estado = 'ABIERTO'
         ORDER BY pa.id_periodo DESC LIMIT 1`, [schoolId]);
        }
        else {
            periodRes = await db_1.pool.query(`SELECT pa.id_periodo, pa.nombre, pa.estado, pa.mes_inicio, pa.dia_inicio, pa.mes_fin, pa.dia_fin, pa.id_anio, al.calendario, al.estado as anio_estado
         FROM periodo_academico pa
         JOIN anio_lectivo al ON pa.id_anio = al.id_anio
         WHERE pa.estado = 'ABIERTO'
         ORDER BY pa.id_periodo DESC LIMIT 1`);
        }
        const activePeriodInfo = periodRes.rows.length > 0 ? periodRes.rows[0] : null;
        const activePeriodId = activePeriodInfo ? activePeriodInfo.id_periodo : null;
        if (!activePeriodId) {
            res.json({
                coursesCount: courses.length,
                studentsCount: totalActiveStudents,
                noGradeActivities: 0,
                upToDateCourses: courses.length,
                courseAverages: [],
                alerts: [],
                activePeriodInfo: null
            });
            return;
        }
        let noGradeActivitiesCount = 0;
        let upToDateCoursesCount = 0;
        const courseAverages = [];
        const alerts = [];
        for (const course of courses) {
            const dgId = course.id_detallegrado;
            const courseName = `${course.grado_nombre} ${course.seccion} - ${course.materia_nombre} (${course.jornada})`;
            // 1. Actividades del curso
            const activitiesRes = await db_1.pool.query(`
        SELECT am.id_actividadmateria, am.porcentaje, am.nombre
        FROM actividad_materia am
        JOIN competencias c ON am.id_competencia = c.id_competencia
        WHERE am.id_detallegrado = $1 AND c.id_periodo = $2
      `, [dgId, activePeriodId]);
            const activities = activitiesRes.rows;
            const activityCount = activities.length;
            // 2. Estudiantes del curso
            const courseStudentsRes = await db_1.pool.query(`
        SELECT e.id_estudiante, e.nombre, e.apellido
        FROM estudiante e
        JOIN matricula m ON e.id_estudiante = m.id_estudiante
        JOIN detalle_grados dg ON m.id_grupo = dg.id_grupo
        WHERE dg.id_detallegrado = $1 AND m.estado = 'ACTIVA'
      `, [dgId]);
            const courseStudents = courseStudentsRes.rows;
            if (courseStudents.length === 0 || activityCount === 0) {
                courseAverages.push({ name: courseName, shortName: `${course.grado_nombre} ${course.seccion} - ${course.materia_nombre}`, average: 0 });
                continue;
            }
            let courseTotalSum = 0;
            let missingAnyGradeForCourse = false;
            for (const act of activities) {
                const totalNotasRes = await db_1.pool.query(`
          SELECT count(*) as count FROM notas_actividad WHERE id_actividadmateria = $1
        `, [act.id_actividadmateria]);
                if (Number(totalNotasRes.rows[0].count) === 0) {
                    noGradeActivitiesCount++;
                }
            }
            for (const stu of courseStudents) {
                const studentName = `${stu.nombre} ${stu.apellido}`;
                let studentMissingDeliveries = 0;
                let studentAverage = 0;
                for (const act of activities) {
                    const checkRes = await db_1.pool.query(`
            SELECT nota FROM notas_actividad 
            WHERE id_actividadmateria = $1 AND id_estudiante = $2
          `, [act.id_actividadmateria, stu.id_estudiante]);
                    if (checkRes.rows.length === 0) {
                        missingAnyGradeForCourse = true;
                        studentMissingDeliveries++;
                    }
                    else {
                        studentAverage += Number(checkRes.rows[0].nota) * (Number(act.porcentaje) / 100);
                        if (Number(checkRes.rows[0].nota) === 0) {
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
                const inasistenciasRes = await db_1.pool.query(`
          SELECT count(*)::int as faltas
          FROM registro_asistencia
          WHERE id_estudiante = $1 AND id_detallegrado = $2 AND estado = 'AUSENTE'
        `, [stu.id_estudiante, dgId]);
                const faltas = Number(inasistenciasRes.rows[0].faltas);
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
            activePeriodInfo
        });
    }
    catch (error) {
        console.error(`[DEV] getTeacherDashboard ERROR - userId=${userId}:`, error.message, error.detail || '', error.hint || '');
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getTeacherDashboard = getTeacherDashboard;
