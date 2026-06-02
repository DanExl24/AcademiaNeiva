"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGradeBoletines = exports.getStudentBoletin = exports.validatePeriodClosed = void 0;
const db_1 = require("../config/db");
/**
 * Validates if a period is closed for the entire school
 */
const validatePeriodClosed = async (req, res) => {
    const { id_periodo, id_colegio } = req.params;
    try {
        const periodRes = await db_1.pool.query(`SELECT estado FROM periodo_academico WHERE id_periodo = $1 AND id_colegio = $2`, [id_periodo, id_colegio]);
        if (periodRes.rows.length === 0) {
            return res.status(404).json({ error: 'Periodo no encontrado' });
        }
        if (periodRes.rows[0].estado !== 'CERRADO') {
            return res.status(400).json({ error: 'El periodo académico debe estar cerrado para generar boletines.' });
        }
        res.json({ message: 'El periodo está cerrado, se pueden generar boletines.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error validando estado del periodo' });
    }
};
exports.validatePeriodClosed = validatePeriodClosed;
/**
 * Get Report Card for a specific student
 * Returns student info, subjects with their grades, period average, and attendance summary.
 */
const getStudentBoletin = async (req, res) => {
    const { id_estudiante, id_periodo } = req.params;
    try {
        // 1. Check if period is closed
        const periodRes = await db_1.pool.query(`SELECT estado, nombre, porcentaje FROM periodo_academico WHERE id_periodo = $1`, [id_periodo]);
        if (!periodRes.rows.length || periodRes.rows[0].estado !== 'CERRADO') {
            return res.status(400).json({ error: 'No se puede generar el boletín en un periodo abierto' });
        }
        const periodoDetails = periodRes.rows[0];
        // 2. Fetch Student Info
        const studentRes = await db_1.pool.query(`
      SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.codigo, 
             c.nombre as colegio_nombre, c.sede,
             g.nivel, g.seccion, tg.nombre as grado_nombre
      FROM estudiante e
      JOIN colegio c ON c.id_colegio = e.id_colegio
      LEFT JOIN matricula m ON m.id_estudiante = e.id_estudiante
      LEFT JOIN grupos gr ON gr.id_grupo = m.id_grupo
      LEFT JOIN grados g ON g.id_jornada = gr.id_jornada AND g.id_colegio = gr.id_colegio AND g.seccion = gr.id_seccion::varchar
      LEFT JOIN tipo_grado tg ON tg.id_tipo_grado = gr.id_tipo_grado
      WHERE e.id_estudiante = $1
      LIMIT 1
    `, [id_estudiante]);
        if (!studentRes.rows.length) {
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }
        const studentInfo = studentRes.rows[0];
        // 3. Fetch Grades Summary
        const materiasRes = await db_1.pool.query(`
      SELECT 
        m.nombre as materia,
        ra.promedio as calificacion,
        ev.nivel as desempeno,
        oe.fortalezas,
        oe.debilidades,
        oe.recomendaciones,
        d.nombre as docente_nombre,
        d.apellido as docente_apellido
      FROM resultado_academico ra
      JOIN detalle_grados dg ON dg.id_detallegrado = ra.id_detallegrado
      JOIN materias m ON m.id_materia = dg.id_materia
      JOIN docente d ON d.id_docente = dg.id_docente
      LEFT JOIN escala_valoracion ev ON ev.id_colegio = ra.id_estudiante::int * 0 + dg.id_colegio 
           AND ra.promedio >= ev.valor_minimo AND ra.promedio <= ev.valor_maximo
      LEFT JOIN observacion_estudiante oe ON oe.id_estudiante = ra.id_estudiante 
           AND oe.id_detallegrado = dg.id_detallegrado 
           AND oe.id_periodo = ra.id_periodo
      WHERE ra.id_estudiante = $1 AND ra.id_periodo = $2
    `, [id_estudiante, id_periodo]);
        // 4. Fetch Attendance Summary
        const attendanceRes = await db_1.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE estado = 'AUSENTE') as faltas,
        COUNT(*) FILTER (WHERE estado = 'JUSTIFICADA') as justificadas,
        COUNT(*) FILTER (WHERE estado = 'TARDE') as retardos
      FROM registro_asistencia
      WHERE id_estudiante = $1 AND id_detallegrado IN (
        SELECT id_detallegrado FROM cierre_materia WHERE id_periodo = $2
      )
    `, [id_estudiante, id_periodo]);
        // Calculate General Average
        const materias = materiasRes.rows;
        let promedioGlobal = 0;
        if (materias.length > 0) {
            const sum = materias.reduce((acc, curr) => acc + parseFloat(curr.calificacion || '0'), 0);
            promedioGlobal = sum / materias.length;
        }
        res.json({
            periodo: periodoDetails.nombre,
            estudiante: studentInfo,
            materias: materias,
            promedioGeneral: promedioGlobal.toFixed(2),
            asistencia: {
                faltasInjustificadas: parseInt(attendanceRes.rows[0]?.faltas || '0'),
                faltasJustificadas: parseInt(attendanceRes.rows[0]?.justificadas || '0'),
                retardos: parseInt(attendanceRes.rows[0]?.retardos || '0'),
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando boletín' });
    }
};
exports.getStudentBoletin = getStudentBoletin;
/**
 * Get Report Cards for an entire grade (mass generation)
 */
const getGradeBoletines = async (req, res) => {
    const { id_grupo, id_periodo } = req.params;
    try {
        // Check period
        const periodRes = await db_1.pool.query(`SELECT estado FROM periodo_academico WHERE id_periodo = $1`, [id_periodo]);
        if (!periodRes.rows.length || periodRes.rows[0].estado !== 'CERRADO') {
            return res.status(400).json({ error: 'No se puede generar el boletín masivo en un periodo abierto' });
        }
        // Get all students in this group
        const studentsRes = await db_1.pool.query(`
       SELECT id_estudiante FROM matricula WHERE id_grupo = $1 AND estado = 'ACTIVA'
    `, [id_grupo]);
        const studentIds = studentsRes.rows.map(r => r.id_estudiante);
        // Real implementation would batch fetch or use the getStudentBoletin logic internally
        // For now we will return the list of student IDs to be processed by the frontend or mapped later
        res.json({ students: studentIds });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando boletines masivos' });
    }
};
exports.getGradeBoletines = getGradeBoletines;
