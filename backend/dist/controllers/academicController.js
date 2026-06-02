"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeacherDashboard = exports.getStudentsByGrade = exports.getTeacherCourses = void 0;
const db_1 = require("../config/db");
const getTeacherCourses = async (req, res) => {
    const { userId } = req.params; // id_usuario del docente
    try {
        // 1. Obtener el id_docente vinculado al usuario
        const docenteRes = await db_1.pool.query("SELECT id_docente FROM docente WHERE id_usuario = $1", [userId]);
        if (docenteRes.rows.length === 0) {
            res.status(404).json({ error: "Docente no encontrado" });
            return;
        }
        const idDocente = docenteRes.rows[0].id_docente;
        // 2. Obtener la jerarquía de Grados -> Materias
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
        res.json(result.rows);
    }
    catch (error) {
        console.error("Error fetching teacher courses:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getTeacherCourses = getTeacherCourses;
const getStudentsByGrade = async (req, res) => {
    const { gradeId } = req.params;
    try {
        const result = await db_1.pool.query(`SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.codigo 
       FROM estudiante e
       JOIN matricula m ON e.id_estudiante = m.id_estudiante
       WHERE m.id_grupo = $1 AND m.estado IN ('ACTIVA', 'TRASLADADA')
       ORDER BY e.apellido, e.nombre`, [gradeId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getStudentsByGrade = getStudentsByGrade;
const getTeacherDashboard = async (req, res) => {
    const { userId } = req.params;
    try {
        const docenteRes = await db_1.pool.query("SELECT id_docente FROM docente WHERE id_usuario = $1", [userId]);
        if (docenteRes.rows.length === 0) {
            res.status(404).json({ error: "Docente no encontrado" });
            return;
        }
        const idDocente = docenteRes.rows[0].id_docente;
        const periodRes = await db_1.pool.query("SELECT id_periodo FROM periodo_academico WHERE estado = 'ABIERTO' LIMIT 1");
        const activePeriodId = periodRes.rows.length > 0 ? periodRes.rows[0].id_periodo : null;
        if (!activePeriodId) {
            res.json({ coursesCount: 0, studentsCount: 0, noGradeActivities: 0, upToDateCourses: 0, courseAverages: [], alerts: [] });
            return;
        }
        // Cursos
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
        // Estudiantes Activos (Distintos)
        const studentsRes = await db_1.pool.query(`
      SELECT count(distinct m.id_estudiante) as total_students
      FROM detalle_grados dg
      JOIN matricula m ON dg.id_grupo = m.id_grupo
      WHERE dg.id_docente = $1 AND m.estado = 'ACTIVA'
    `, [idDocente]);
        const totalActiveStudents = Number(studentsRes.rows[0].total_students);
        let noGradeActivitiesCount = 0;
        let upToDateCoursesCount = 0;
        const courseAverages = [];
        const alerts = [];
        // Iterar por curso para sacar detalle exhaustivo (promedios y estados de entrega)
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
                // No cuenta como 'al dia' si no hay actividades
                courseAverages.push({ name: courseName, average: 0 });
                continue;
            }
            let courseTotalSum = 0;
            let missingAnyGradeForCourse = false;
            // Revisar actividad por actividad si está "Vacia" (0 notas)
            for (const act of activities) {
                const totalNotasRes = await db_1.pool.query(`
          SELECT count(*) as count FROM notas_actividad WHERE id_actividadmateria = $1
        `, [act.id_actividadmateria]);
                if (Number(totalNotasRes.rows[0].count) === 0) {
                    noGradeActivitiesCount++;
                }
            }
            // Evaluar a cada estudiante individualmente
            for (const stu of courseStudents) {
                const studentName = `${stu.nombre} ${stu.apellido}`;
                let studentMissingDeliveries = 0;
                let studentAverage = 0;
                for (const act of activities) {
                    const checkRes = await db_1.pool.query(`
            SELECT nota, estado FROM notas_actividad 
            WHERE id_actividadmateria = $1 AND id_estudiante = $2
          `, [act.id_actividadmateria, stu.id_estudiante]);
                    if (checkRes.rows.length === 0) {
                        missingAnyGradeForCourse = true;
                        studentMissingDeliveries++;
                    }
                    else {
                        studentAverage += Number(checkRes.rows[0].nota) * (Number(act.porcentaje) / 100);
                        if (checkRes.rows[0].estado === 'NO ENTREGADO' || Number(checkRes.rows[0].nota) === 0) {
                            studentMissingDeliveries++;
                        }
                    }
                }
                courseTotalSum += studentAverage;
                // Alerts for student
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
                // Faltas (asistencia)
                const inasistenciasRes = await db_1.pool.query(`
          SELECT count(*) as faltas
          FROM asistencia
          WHERE id_estudiante = $1 AND id_detallegrado = $2 AND estado IN ('FALTA', 'INJUSTIFICADA')
        `, [stu.id_estudiante, dgId]);
                const faltas = Number(inasistenciasRes.rows[0].faltas);
                if (faltas >= 3) {
                    alerts.push({
                        type: 'faltas',
                        message: `El estudiante ${studentName} tiene ${faltas} faltas acumuladas en ${course.materia_nombre}.`
                    });
                }
            } // end course students loop
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
            courseAverages, // Para la gráfica
            alerts // Lista automática
        });
    }
    catch (error) {
        console.error("Error fetching teacher dashboard:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getTeacherDashboard = getTeacherDashboard;
