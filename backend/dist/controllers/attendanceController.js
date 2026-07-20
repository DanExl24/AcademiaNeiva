"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttendanceHistory = exports.saveAttendance = exports.getAttendanceByDate = void 0;
const db_1 = require("../config/db");
// Helper to check if period/class is editable
const checkEditability = async (detailGradeId, schoolId) => {
    // 1. Get open period
    const periodRes = await db_1.pool.query(`SELECT id_periodo, nombre 
     FROM periodo_academico 
     WHERE id_colegio = $1 AND estado = 'ABIERTO' 
     LIMIT 1`, [schoolId]);
    if (periodRes.rows.length === 0) {
        return { editable: false, error: "No hay un periodo académico abierto para esta institución." };
    }
    const periodId = periodRes.rows[0].id_periodo;
    // 2. Check if teaching assignment is closed
    const closureRes = await db_1.pool.query(`SELECT estado 
     FROM cierre_materia 
     WHERE id_detallegrado = $1 AND id_periodo = $2`, [detailGradeId, periodId]);
    if (closureRes.rows.length > 0 && closureRes.rows[0].estado === "CERRADO") {
        return {
            editable: false,
            error: "El docente ya marcó como completado el registro académico para esta materia en este periodo.",
            periodId
        };
    }
    return { editable: true, periodId };
};
// GET /api/teacher/attendance/:detailGradeId/:date
const getAttendanceByDate = async (req, res) => {
    const detailGradeId = Number(req.params.detailGradeId);
    const dateStr = req.params.date;
    console.log(`[DEV] getAttendanceByDate called - detailGradeId=${detailGradeId}, date=${dateStr}`);
    try {
        // Get school id from teaching assignment
        const dgRes = await db_1.pool.query(`SELECT id_colegio, id_grupo FROM detalle_grados WHERE id_detallegrado = $1`, [detailGradeId]);
        if (dgRes.rows.length === 0) {
            res.status(404).json({ error: "Asignación académica no encontrada" });
            return;
        }
        const { id_colegio, id_grupo } = dgRes.rows[0];
        // Check if editable
        const editCheck = await checkEditability(detailGradeId, id_colegio);
        // Past days restriction
        const todayStr = new Date().toLocaleDateString('en-CA');
        const isToday = dateStr === todayStr;
        const editable = editCheck.editable && isToday;
        const errorReason = !isToday
            ? "No está permitido registrar o editar asistencias de fechas anteriores. Solo lectura habilitada."
            : editCheck.error;
        // Get all students enrolled in this group/grade
        const studentsRes = await db_1.pool.query(`SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.codigo 
       FROM estudiante e
       JOIN matricula m ON e.id_estudiante = m.id_estudiante
       WHERE m.id_grupo = $1 AND m.estado IN ('ACTIVA', 'TRASLADADA')
       ORDER BY e.apellido, e.nombre`, [id_grupo]);
        // Get attendance records for this date (including justificacion and hora_llegada)
        const attendanceRes = await db_1.pool.query(`SELECT id_estudiante, estado, justificacion, TO_CHAR(hora_llegada, 'HH24:MI') as hora_llegada 
       FROM registro_asistencia 
       WHERE id_detallegrado = $1 AND fecha::date = $2::date`, [detailGradeId, dateStr]);
        const attendanceMap = new Map();
        attendanceRes.rows.forEach(r => {
            attendanceMap.set(Number(r.id_estudiante), {
                estado: r.estado,
                justificacion: r.justificacion || null,
                hora_llegada: r.hora_llegada || null
            });
        });
        const studentsWithAttendance = studentsRes.rows.map(s => {
            const att = attendanceMap.get(Number(s.id_estudiante));
            return {
                id_estudiante: s.id_estudiante,
                nombre: `${s.nombre} ${s.apellido}`,
                documento: s.documento,
                codigo: s.codigo,
                estado: att ? att.estado : null,
                justificacion: att ? att.justificacion : null,
                hora_llegada: att ? att.hora_llegada : null
            };
        });
        console.log(`[DEV] getAttendanceByDate - id_grupo=${id_grupo}, editable=${editable}, students=${studentsRes.rows.length}`);
        res.json({
            editable,
            error: errorReason,
            periodId: editCheck.periodId,
            students: studentsWithAttendance
        });
    }
    catch (error) {
        console.error(`[DEV] getAttendanceByDate ERROR - detailGradeId=${detailGradeId}, date=${dateStr}:`, error.message, error.detail || '');
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getAttendanceByDate = getAttendanceByDate;
// POST /api/teacher/attendance
const saveAttendance = async (req, res) => {
    const { detailGradeId, date, records } = req.body;
    console.log(`[DEV] saveAttendance called - detailGradeId=${detailGradeId}, date=${date}, records=${Array.isArray(records) ? records.length : 'invalid'}`);
    if (!detailGradeId || !date || !Array.isArray(records)) {
        res.status(400).json({ error: "Parámetros inválidos" });
        return;
    }
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (date !== todayStr) {
        res.status(409).json({ error: "No está permitido registrar o modificar la asistencia de días pasados." });
        return;
    }
    const client = await db_1.pool.connect();
    try {
        const dgRes = await client.query(`SELECT id_colegio FROM detalle_grados WHERE id_detallegrado = $1`, [detailGradeId]);
        if (dgRes.rows.length === 0) {
            res.status(404).json({ error: "Asignación académica no encontrada" });
            return;
        }
        const schoolId = dgRes.rows[0].id_colegio;
        // Validate editability
        const editCheck = await checkEditability(detailGradeId, schoolId);
        if (!editCheck.editable) {
            res.status(409).json({ error: editCheck.error });
            return;
        }
        await client.query("BEGIN");
        // 3. Enforce 7-block daily limit per student
        const studentsWithStatus = records.filter(r => r.estado).map(r => Number(r.id_estudiante));
        if (studentsWithStatus.length > 0) {
            const limitCheckRes = await client.query(`SELECT ra.id_estudiante, e.nombre, e.apellido, COUNT(*) as count 
         FROM registro_asistencia ra
         JOIN estudiante e ON e.id_estudiante = ra.id_estudiante
         WHERE ra.id_estudiante = ANY($1) 
           AND ra.fecha::date = $2::date 
           AND ra.id_detallegrado != $3
         GROUP BY ra.id_estudiante, e.nombre, e.apellido
         HAVING COUNT(*) >= 7`, [studentsWithStatus, date, detailGradeId]);
            if (limitCheckRes.rows.length > 0) {
                const firstExceeded = limitCheckRes.rows[0];
                const name = `${firstExceeded.nombre} ${firstExceeded.apellido}`;
                await client.query("ROLLBACK");
                res.status(409).json({
                    error: `El estudiante ${name} ya alcanzó el límite máximo de 7 bloques académicos para el día ${date}. No es posible registrar más asistencias.`
                });
                client.release();
                return;
            }
        }
        // Encontrar la hora de llegada normal de referencia (PRESENTE)
        let refPresentTime = null;
        for (const r of records) {
            if (r.estado === "PRESENTE" && r.hora_llegada) {
                if (!refPresentTime || r.hora_llegada < refPresentTime) {
                    refPresentTime = r.hora_llegada;
                }
            }
        }
        if (!refPresentTime) {
            const dbPresentRes = await client.query(`SELECT MIN(TO_CHAR(hora_llegada, 'HH24:MI')) as min_hora 
         FROM registro_asistencia 
         WHERE id_detallegrado = $1 AND fecha::date = $2::date AND estado = 'PRESENTE'`, [detailGradeId, date]);
            if (dbPresentRes.rows.length && dbPresentRes.rows[0].min_hora) {
                refPresentTime = dbPresentRes.rows[0].min_hora;
            }
        }
        for (const record of records) {
            const studentId = Number(record.id_estudiante);
            const estado = record.estado;
            const justificacion = record.justificacion || null;
            const hora_llegada = record.hora_llegada || null;
            if (!estado) {
                // If estado is null/empty, delete any existing record
                await client.query(`DELETE FROM registro_asistencia 
           WHERE id_detallegrado = $1 AND id_estudiante = $2 AND fecha::date = $3::date`, [detailGradeId, studentId, date]);
            }
            else {
                // Validar tardanza
                if (estado === "TARDE") {
                    if (!hora_llegada) {
                        await client.query("ROLLBACK");
                        res.status(400).json({ error: "La hora de llegada es obligatoria para estudiantes con retraso (Tarde)." });
                        client.release();
                        return;
                    }
                    if (refPresentTime && hora_llegada <= refPresentTime) {
                        await client.query("ROLLBACK");
                        res.status(400).json({
                            error: `La hora de llegada del estudiante con retraso (${hora_llegada}) debe ser posterior a la hora de ingreso normal (${refPresentTime}).`
                        });
                        client.release();
                        return;
                    }
                }
                // Delete first to avoid duplicates
                await client.query(`DELETE FROM registro_asistencia 
           WHERE id_detallegrado = $1 AND id_estudiante = $2 AND fecha::date = $3::date`, [detailGradeId, studentId, date]);
                const dbHoraLlegada = (estado === 'PRESENTE' || estado === 'TARDE') ? (hora_llegada || null) : null;
                await client.query(`INSERT INTO registro_asistencia (id_estudiante, id_detallegrado, fecha, estado, id_colegio, justificacion, hora_llegada)
           VALUES ($1, $2, $3::timestamp with time zone, $4, $5, $6, $7)`, [studentId, detailGradeId, `${date}T12:00:00Z`, estado, schoolId, justificacion, dbHoraLlegada]);
            }
        }
        await client.query("COMMIT");
        res.json({ message: "Asistencia guardada exitosamente" });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error saving attendance:", error);
        res.status(500).json({ error: "Error al guardar la asistencia" });
    }
    finally {
        client.release();
    }
};
exports.saveAttendance = saveAttendance;
// GET /api/teacher/attendance-history/:detailGradeId
const getAttendanceHistory = async (req, res) => {
    const detailGradeId = Number(req.params.detailGradeId);
    console.log(`[DEV] getAttendanceHistory called - detailGradeId=${detailGradeId}`);
    try {
        const dgRes = await db_1.pool.query(`SELECT id_grupo FROM detalle_grados WHERE id_detallegrado = $1`, [detailGradeId]);
        if (dgRes.rows.length === 0) {
            res.status(404).json({ error: "Asignación académica no encontrada" });
            return;
        }
        const { id_grupo } = dgRes.rows[0];
        // Get all students
        const studentsRes = await db_1.pool.query(`SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.codigo 
       FROM estudiante e
       JOIN matricula m ON e.id_estudiante = m.id_estudiante
       WHERE m.id_grupo = $1 AND m.estado IN ('ACTIVA', 'TRASLADADA')
       ORDER BY e.apellido, e.nombre`, [id_grupo]);
        // Get history counts
        const historyRes = await db_1.pool.query(`SELECT 
         id_estudiante,
         COUNT(*) FILTER (WHERE estado = 'PRESENTE') as presentes,
         COUNT(*) FILTER (WHERE estado = 'AUSENTE') as ausentes,
         COUNT(*) FILTER (WHERE estado = 'TARDE') as tardes,
         COUNT(*) FILTER (WHERE estado = 'JUSTIFICADA') as justificadas
       FROM registro_asistencia
       WHERE id_detallegrado = $1
       GROUP BY id_estudiante`, [detailGradeId]);
        // Get distinct dates with attendance recorded
        const datesRes = await db_1.pool.query(`SELECT DISTINCT TO_CHAR(fecha, 'YYYY-MM-DD') as date_recorded
       FROM registro_asistencia
       WHERE id_detallegrado = $1
       ORDER BY date_recorded DESC`, [detailGradeId]);
        const countsMap = new Map();
        historyRes.rows.forEach(r => {
            countsMap.set(Number(r.id_estudiante), {
                presentes: Number(r.presentes),
                ausentes: Number(r.ausentes),
                tardes: Number(r.tardes),
                justificadas: Number(r.justificadas)
            });
        });
        const studentsHistory = studentsRes.rows.map(s => {
            const counts = countsMap.get(Number(s.id_estudiante)) || { presentes: 0, ausentes: 0, tardes: 0, justificadas: 0 };
            return {
                id_estudiante: s.id_estudiante,
                nombre: `${s.nombre} ${s.apellido}`,
                documento: s.documento,
                codigo: s.codigo,
                ...counts
            };
        });
        const datesList = datesRes.rows.map(r => r.date_recorded);
        res.json({
            studentsHistory,
            recordedDates: datesList
        });
    }
    catch (error) {
        console.error("Error fetching attendance history:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getAttendanceHistory = getAttendanceHistory;
