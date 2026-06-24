"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeacherDashboard = exports.getStudentsByGrade = exports.getTeacherCourses = void 0;
const db_1 = require("../config/db");
const getTeacherCourses = async (req, res) => {
    const { userId } = req.params;
    console.log(`[DEV] getTeacherCourses called - userId: ${userId}`);
    try {
        const docenteRes = await db_1.pool.query("SELECT id_docente FROM docente WHERE id_usuario = $1", [userId]);
        if (docenteRes.rows.length === 0) {
            console.warn(`[DEV] getTeacherCourses - No docente found for id_usuario=${userId}`);
            res.status(404).json({ error: "Docente no encontrado" });
            return;
        }
        const idDocente = docenteRes.rows[0].id_docente;
        console.log(`[DEV] getTeacherCourses - id_docente=${idDocente}`);
        const result = await db_1.pool.query(`SELECT 
        dg.id_detallegrado,
        g.id_grupo as id_grado, 
        tg.nombre as grado_nombre, 
        ne.nombre as nivel, 
        s.nombre as seccion,
        j.nombre as jornada_nombre,
        m.id_materia, 
        m.nombre as materia_nombre
       FROM detalle_grados dg
       JOIN grupos g ON dg.id_grupo = g.id_grupo
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       JOIN secciones s ON g.id_seccion = s.id_seccion
       JOIN jornada j ON g.id_jornada = j.id_jornada
       JOIN materias m ON dg.id_materia = m.id_materia
       WHERE dg.id_docente = $1`, [idDocente]);
        console.log(`[DEV] getTeacherCourses - returning ${result.rows.length} course(s) for id_docente=${idDocente}`);
        res.json(result.rows);
    }
    catch (error) {
        console.error(`[DEV] getTeacherCourses ERROR - userId=${userId}:`, error.message, error.detail || '');
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getTeacherCourses = getTeacherCourses;
const getStudentsByGrade = async (req, res) => {
    const { gradeId } = req.params;
    console.log(`[DEV] getStudentsByGrade called - gradeId (id_grupo): ${gradeId}`);
    try {
        const result = await db_1.pool.query(`SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.codigo 
       FROM estudiante e
       JOIN matricula m ON e.id_estudiante = m.id_estudiante
       WHERE m.id_grupo = $1 AND m.estado IN ('ACTIVA', 'TRASLADADA')
       ORDER BY e.apellido, e.nombre`, [gradeId]);
        console.log(`[DEV] getStudentsByGrade - gradeId=${gradeId} -> ${result.rows.length} student(s)`);
        res.json(result.rows);
    }
    catch (error) {
        console.error(`[DEV] getStudentsByGrade ERROR - gradeId=${gradeId}:`, error.message, error.detail || '');
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getStudentsByGrade = getStudentsByGrade;
const getTeacherDashboard = async (req, res) => {
    const { userId } = req.params;
    console.log(`[DEV] getTeacherDashboard called - userId: ${userId}`);
    try {
        const docenteRes = await db_1.pool.query("SELECT id_docente FROM docente WHERE id_usuario = $1", [userId]);
        if (docenteRes.rows.length === 0) {
            console.warn(`[DEV] getTeacherDashboard - No docente found for id_usuario=${userId}`);
            res.status(404).json({ error: "Docente no encontrado" });
            return;
        }
        const idDocente = docenteRes.rows[0].id_docente;
        console.log(`[DEV] getTeacherDashboard - id_docente=${idDocente}`);
        const coursesRes = await db_1.pool.query(`
      SELECT dg.id_detallegrado, m.nombre as materia_nombre, 
             tg.nombre as grado_nombre, s.nombre as seccion, j.nombre as jornada
      FROM detalle_grados dg
      JOIN grupos g ON dg.id_grupo = g.id_grupo
      JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
      JOIN secciones s ON g.id_seccion = s.id_seccion
      JOIN jornada j ON g.id_jornada = j.id_jornada
      JOIN materias m ON dg.id_materia = m.id_materia
      WHERE dg.id_docente = $1
    `, [idDocente]);
        const courses = coursesRes.rows;
        console.log(`[DEV] getTeacherDashboard - courses found: ${courses.length}`);
        const studentsRes = await db_1.pool.query(`
      SELECT count(distinct m.id_estudiante) as total_students
      FROM detalle_grados dg
      JOIN matricula m ON dg.id_grupo = m.id_grupo
      WHERE dg.id_docente = $1 AND m.estado = 'ACTIVA'
    `, [idDocente]);
        const totalActiveStudents = Number(studentsRes.rows[0].total_students);
        console.log(`[DEV] getTeacherDashboard - total active students: ${totalActiveStudents}`);
        const periodRes = await db_1.pool.query("SELECT id_periodo FROM periodo_academico WHERE estado = 'ABIERTO' LIMIT 1");
        const activePeriodId = periodRes.rows.length > 0 ? periodRes.rows[0].id_periodo : null;
        console.log(`[DEV] getTeacherDashboard - active periodId: ${activePeriodId}`);
        if (!activePeriodId) {
            console.log(`[DEV] getTeacherDashboard - No active period, returning basic stats`);
            res.json({
                coursesCount: courses.length,
                studentsCount: totalActiveStudents,
                noGradeActivities: 0,
                upToDateCourses: courses.length,
                courseAverages: [],
                alerts: []
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
            console.log(`[DEV] getTeacherDashboard - processing course dgId=${dgId}: ${courseName}`);
            // 1. Actividades del curso
            const activitiesRes = await db_1.pool.query(`
        SELECT am.id_actividadmateria, am.porcentaje, am.nombre
        FROM actividad_materia am
        JOIN competencias c ON am.id_competencia = c.id_competencia
        WHERE am.id_detallegrado = $1 AND c.id_periodo = $2
      `, [dgId, activePeriodId]);
            const activities = activitiesRes.rows;
            const activityCount = activities.length;
            console.log(`[DEV]   -> activities: ${activityCount}`);
            // 2. Estudiantes del curso
            const courseStudentsRes = await db_1.pool.query(`
        SELECT e.id_estudiante, e.nombre, e.apellido
        FROM estudiante e
        JOIN matricula m ON e.id_estudiante = m.id_estudiante
        JOIN detalle_grados dg ON m.id_grupo = dg.id_grupo
        WHERE dg.id_detallegrado = $1 AND m.estado = 'ACTIVA'
      `, [dgId]);
            const courseStudents = courseStudentsRes.rows;
            console.log(`[DEV]   -> courseStudents: ${courseStudents.length}`);
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
        console.log(`[DEV] getTeacherDashboard - done. courses=${courses.length}, students=${totalActiveStudents}, noGradeActs=${noGradeActivitiesCount}, alerts=${alerts.length}`);
        res.json({
            coursesCount: courses.length,
            studentsCount: totalActiveStudents,
            noGradeActivities: noGradeActivitiesCount,
            upToDateCourses: upToDateCoursesCount,
            courseAverages,
            alerts
        });
    }
    catch (error) {
        console.error(`[DEV] getTeacherDashboard ERROR - userId=${userId}:`, error.message, error.detail || '', error.hint || '');
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getTeacherDashboard = getTeacherDashboard;
