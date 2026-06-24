"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteObservation = exports.updateObservation = exports.createObservation = exports.getObservations = void 0;
const db_1 = require("../config/db");
// Helper to check if period/class is editable (same logic as attendanceController)
const checkEditability = async (detailGradeId, schoolId, periodId) => {
    // 1. Check period is open
    const periodRes = await db_1.pool.query(`SELECT estado FROM periodo_academico WHERE id_periodo = $1 AND id_colegio = $2`, [periodId, schoolId]);
    if (periodRes.rows.length === 0) {
        return { editable: false, error: "Periodo académico no encontrado." };
    }
    if (periodRes.rows[0].estado !== "ABIERTO") {
        const isPending = periodRes.rows[0].estado === "PENDIENTE";
        return {
            editable: false,
            error: isPending
                ? "El periodo académico está pendiente de aprobación. No se pueden registrar observaciones."
                : "El periodo académico está cerrado. No se pueden modificar observaciones.",
        };
    }
    // 2. Check if subject is closed for this period
    const closureRes = await db_1.pool.query(`SELECT estado FROM cierre_materia WHERE id_detallegrado = $1 AND id_periodo = $2`, [detailGradeId, periodId]);
    if (closureRes.rows.length > 0 && closureRes.rows[0].estado === "CERRADO") {
        return {
            editable: false,
            error: "El docente ya marcó como completado el registro académico para esta materia en este periodo.",
        };
    }
    return { editable: true };
};
// Helper to check if a date falls within the period's trimester and dia_inicio/dia_fin range
const checkDateInPeriod = async (periodId, dateInput) => {
    const periodRes = await db_1.pool.query(`SELECT mes_inicio, dia_inicio, mes_fin, dia_fin, "id_año" 
     FROM periodo_academico 
     WHERE id_periodo = $1`, [periodId]);
    if (periodRes.rows.length === 0) {
        return { valid: false, error: "Periodo académico no encontrado." };
    }
    const { mes_inicio, dia_inicio, mes_fin, dia_fin, id_año } = periodRes.rows[0];
    let year = id_año ? Number(id_año) : new Date().getFullYear();
    if (year < 2000) {
        year = new Date().getFullYear();
    }
    if (!mes_inicio || !dia_inicio || !mes_fin || !dia_fin) {
        // Si no hay rango definido, permitimos cualquier fecha del año lectivo por defecto
        // o podriamos ser mas estrictos. Por ahora, asumimos que deben estar definidos.
        return { valid: true };
    }
    const startDate = new Date(year, mes_inicio - 1, dia_inicio, 0, 0, 0);
    let endDate = new Date(year, mes_fin - 1, dia_fin, 23, 59, 59);
    // Si el fin es menor que el inicio, cruza el año
    if (endDate < startDate) {
        endDate.setFullYear(endDate.getFullYear() + 1);
    }
    const checkDate = new Date(dateInput);
    if (checkDate < startDate || checkDate > endDate) {
        const formatDateString = (d) => {
            const dd = String(d.getDate()).padStart(2, "0");
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        };
        return {
            valid: false,
            error: `La fecha de la observación (${formatDateString(checkDate)}) está fuera del rango de fechas permitido para este periodo académico (del ${formatDateString(startDate)} al ${formatDateString(endDate)}).`,
        };
    }
    return { valid: true };
};
// GET /api/teacher/observations/:detailGradeId/:periodId
const getObservations = async (req, res) => {
    const detailGradeId = Number(req.params.detailGradeId);
    const periodId = Number(req.params.periodId);
    console.log(`[DEV] getObservations called - detailGradeId=${detailGradeId}, periodId=${periodId}`);
    try {
        // Get school id from teaching assignment
        const dgRes = await db_1.pool.query(`SELECT id_colegio, id_grupo FROM detalle_grados WHERE id_detallegrado = $1`, [detailGradeId]);
        if (dgRes.rows.length === 0) {
            res.status(404).json({ error: "Asignación académica no encontrada" });
            return;
        }
        const { id_colegio } = dgRes.rows[0];
        // Check editability
        const editCheck = await checkEditability(detailGradeId, id_colegio, periodId);
        // Get all observations for this detailGrade and period, joined with student info
        const observationsRes = await db_1.pool.query(`SELECT 
         o.id_observacion,
         o.id_estudiante,
         e.nombre,
         e.apellido,
         e.documento,
         e.codigo,
         o.fortalezas,
         o.debilidades,
         o.recomendaciones,
         o.fecha,
         o.tipo
       FROM observacion_estudiante o
       JOIN estudiante e ON e.id_estudiante = o.id_estudiante
       WHERE o.id_detallegrado = $1 AND o.id_periodo = $2
       ORDER BY o.fecha DESC`, [detailGradeId, periodId]);
        const observations = observationsRes.rows.map((r) => {
            let clientTipo = 'ACADEMICA';
            if (r.tipo === 'DISCIPLINARIA') {
                clientTipo = 'DISCIPLINARIO';
            }
            else if (r.tipo === 'CONVIVENCIA') {
                clientTipo = 'CONVIVENCIAL';
            }
            else if (r.tipo) {
                clientTipo = r.tipo;
            }
            return {
                id_observacion: r.id_observacion,
                id_estudiante: r.id_estudiante,
                nombre: `${r.nombre} ${r.apellido}`,
                documento: r.documento,
                codigo: r.codigo,
                fortalezas: r.fortalezas || null,
                debilidades: r.debilidades || null,
                recomendaciones: r.recomendaciones || null,
                fecha: r.fecha,
                tipo: clientTipo,
            };
        });
        console.log(`[DEV] getObservations - editable=${editCheck.editable}, observations=${observations.length}, error=${editCheck.error || 'none'}`);
        res.json({
            editable: editCheck.editable,
            error: editCheck.error,
            observations,
        });
    }
    catch (error) {
        console.error(`[DEV] getObservations ERROR - detailGradeId=${detailGradeId}, periodId=${periodId}:`, error.message, error.detail || '');
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getObservations = getObservations;
// POST /api/teacher/observations
const createObservation = async (req, res) => {
    const { detailGradeId, periodId, studentId, fortalezas, debilidades, recomendaciones, fecha, tipo } = req.body;
    console.log(`[DEV] createObservation called - detailGradeId=${detailGradeId}, periodId=${periodId}, studentId=${studentId}, tipo=${tipo}`);
    if (!detailGradeId || !periodId || !studentId) {
        res.status(400).json({ error: "Parámetros obligatorios faltantes (grado, periodo, estudiante)." });
        return;
    }
    // Validate at least one observation field
    const hasFortalezas = fortalezas && fortalezas.trim().length > 0;
    const hasDebilidades = debilidades && debilidades.trim().length > 0;
    const hasRecomendaciones = recomendaciones && recomendaciones.trim().length > 0;
    if (!hasFortalezas && !hasDebilidades && !hasRecomendaciones) {
        res
            .status(400)
            .json({ error: "Rellene por lo menos un tipo de observación (fortalezas, debilidades o recomendaciones)." });
        return;
    }
    try {
        // Get school id
        const dgRes = await db_1.pool.query(`SELECT id_colegio FROM detalle_grados WHERE id_detallegrado = $1`, [detailGradeId]);
        if (dgRes.rows.length === 0) {
            res.status(404).json({ error: "Asignación académica no encontrada" });
            return;
        }
        const schoolId = dgRes.rows[0].id_colegio;
        // Validate editability
        const editCheck = await checkEditability(detailGradeId, schoolId, periodId);
        if (!editCheck.editable) {
            res.status(409).json({ error: editCheck.error });
            return;
        }
        const dateValue = fecha || new Date().toISOString();
        // Validate date falls within period range
        const dateCheck = await checkDateInPeriod(periodId, dateValue);
        if (!dateCheck.valid) {
            res.status(400).json({ error: dateCheck.error });
            return;
        }
        let dbTipo = 'ACADEMICA';
        if (tipo === 'DISCIPLINARIO') {
            dbTipo = 'DISCIPLINARIA';
        }
        else if (tipo === 'CONVIVENCIAL' || tipo === 'CONVIVENCIA') {
            dbTipo = 'CONVIVENCIA';
        }
        else if (tipo === 'ACADEMICA') {
            dbTipo = 'ACADEMICA';
        }
        else if (tipo) {
            dbTipo = tipo;
        }
        const result = await db_1.pool.query(`INSERT INTO observacion_estudiante 
         (id_estudiante, id_detallegrado, id_periodo, fortalezas, debilidades, recomendaciones, fecha, id_colegio, tipo)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamp with time zone, $8, $9)
       RETURNING id_observacion`, [
            studentId,
            detailGradeId,
            periodId,
            hasFortalezas ? fortalezas.trim() : null,
            hasDebilidades ? debilidades.trim() : null,
            hasRecomendaciones ? recomendaciones.trim() : null,
            dateValue,
            schoolId,
            dbTipo,
        ]);
        res.json({
            message: "Observación registrada exitosamente",
            id_observacion: result.rows[0].id_observacion,
        });
    }
    catch (error) {
        console.error("Error creating observation:", error);
        res.status(500).json({ error: "Error al registrar la observación" });
    }
};
exports.createObservation = createObservation;
// PUT /api/teacher/observations/:id
const updateObservation = async (req, res) => {
    const observationId = Number(req.params.id);
    const { fortalezas, debilidades, recomendaciones, tipo } = req.body;
    // Validate at least one observation field
    const hasFortalezas = fortalezas && fortalezas.trim().length > 0;
    const hasDebilidades = debilidades && debilidades.trim().length > 0;
    const hasRecomendaciones = recomendaciones && recomendaciones.trim().length > 0;
    if (!hasFortalezas && !hasDebilidades && !hasRecomendaciones) {
        res
            .status(400)
            .json({ error: "Rellene por lo menos un tipo de observación (fortalezas, debilidades o recomendaciones)." });
        return;
    }
    try {
        // Get current observation to check ownership
        const obsRes = await db_1.pool.query(`SELECT id_detallegrado, id_periodo, id_colegio FROM observacion_estudiante WHERE id_observacion = $1`, [observationId]);
        if (obsRes.rows.length === 0) {
            res.status(404).json({ error: "Observación no encontrada" });
            return;
        }
        const { id_detallegrado, id_periodo, id_colegio } = obsRes.rows[0];
        // Validate editability
        const editCheck = await checkEditability(id_detallegrado, id_colegio, id_periodo);
        if (!editCheck.editable) {
            res.status(409).json({ error: editCheck.error });
            return;
        }
        let dbTipo = 'ACADEMICA';
        if (tipo === 'DISCIPLINARIO') {
            dbTipo = 'DISCIPLINARIA';
        }
        else if (tipo === 'CONVIVENCIAL' || tipo === 'CONVIVENCIA') {
            dbTipo = 'CONVIVENCIA';
        }
        else if (tipo === 'ACADEMICA') {
            dbTipo = 'ACADEMICA';
        }
        else if (tipo) {
            dbTipo = tipo;
        }
        await db_1.pool.query(`UPDATE observacion_estudiante 
       SET fortalezas = $1, debilidades = $2, recomendaciones = $3, tipo = $4
       WHERE id_observacion = $5`, [
            hasFortalezas ? fortalezas.trim() : null,
            hasDebilidades ? debilidades.trim() : null,
            hasRecomendaciones ? recomendaciones.trim() : null,
            dbTipo,
            observationId,
        ]);
        res.json({ message: "Observación actualizada exitosamente" });
    }
    catch (error) {
        console.error("Error updating observation:", error);
        res.status(500).json({ error: "Error al actualizar la observación" });
    }
};
exports.updateObservation = updateObservation;
// DELETE /api/teacher/observations/:id
const deleteObservation = async (req, res) => {
    const observationId = Number(req.params.id);
    try {
        // Get current observation
        const obsRes = await db_1.pool.query(`SELECT id_detallegrado, id_periodo, id_colegio FROM observacion_estudiante WHERE id_observacion = $1`, [observationId]);
        if (obsRes.rows.length === 0) {
            res.status(404).json({ error: "Observación no encontrada" });
            return;
        }
        const { id_detallegrado, id_periodo, id_colegio } = obsRes.rows[0];
        // Validate editability
        const editCheck = await checkEditability(id_detallegrado, id_colegio, id_periodo);
        if (!editCheck.editable) {
            res.status(409).json({ error: editCheck.error });
            return;
        }
        await db_1.pool.query(`DELETE FROM observacion_estudiante WHERE id_observacion = $1`, [observationId]);
        res.json({ message: "Observación eliminada exitosamente" });
    }
    catch (error) {
        console.error("Error deleting observation:", error);
        res.status(500).json({ error: "Error al eliminar la observación" });
    }
};
exports.deleteObservation = deleteObservation;
