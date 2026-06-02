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
    const dateStr = req.params.date; // format YYYY-MM-DD
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
        // Get attendance records for this date (including justificacion)
        const attendanceRes = await db_1.pool.query(`SELECT id_estudiante, estado, justificacion 
       FROM registro_asistencia 
       WHERE id_detallegrado = $1 AND fecha::date = $2::date`, [detailGradeId, dateStr]);
        const attendanceMap = new Map();
        attendanceRes.rows.forEach(r => {
            attendanceMap.set(Number(r.id_estudiante), {
                estado: r.estado,
                justificacion: r.justificacion || null
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
                justificacion: att ? att.justificacion : null
            };
        });
        res.json({
            editable,
            error: errorReason,
            periodId: editCheck.periodId,
            students: studentsWithAttendance
        });
    }
    catch (error) {
        console.error("Error fetching attendance by date:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getAttendanceByDate = getAttendanceByDate;
// POST /api/teacher/attendance
const saveAttendance = async (req, res) => {
    const { detailGradeId, date, records } = req.body;
    // records: Array of { id_estudiante: number, estado: string | null, justificacion: string | null }
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
        for (const record of records) {
            const studentId = Number(record.id_estudiante);
            const estado = record.estado;
            const justificacion = record.justificacion || null;
            if (!estado) {
                // If estado is null/empty, delete any existing record
                await client.query(`DELETE FROM registro_asistencia 
           WHERE id_detallegrado = $1 AND id_estudiante = $2 AND fecha::date = $3::date`, [detailGradeId, studentId, date]);
            }
            else {
                // Delete first to avoid duplicates
                await client.query(`DELETE FROM registro_asistencia 
           WHERE id_detallegrado = $1 AND id_estudiante = $2 AND fecha::date = $3::date`, [detailGradeId, studentId, date]);
                await client.query(`INSERT INTO registro_asistencia (id_estudiante, id_detallegrado, fecha, estado, id_colegio, justificacion)
           VALUES ($1, $2, $3::timestamp with time zone, $4, $5, $6)`, [studentId, detailGradeId, `${date}T12:00:00Z`, estado, schoolId, justificacion]);
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
        const datesRes = await db_1.pool.query(`SELECT DISTINCT fecha::date as date_recorded
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
        const datesList = datesRes.rows.map(r => {
            // Format as YYYY-MM-DD
            const d = new Date(r.date_recorded);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        });
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
