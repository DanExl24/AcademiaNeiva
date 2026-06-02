"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureCurrentPeriodOrRespond = exports.ensureCurrentPeriodForSchool = exports.getCurrentAllowedPeriodForSchool = exports.ensureSubjectOpen = exports.ensurePeriodOpen = void 0;
const db_1 = require("../config/db");
const ensurePeriodOpen = async (periodId) => {
    const result = await db_1.pool.query(`SELECT 1
     FROM periodo_academico
     WHERE id_periodo = $1
       AND estado = 'ABIERTO'`, [periodId]);
    return result.rows.length > 0;
};
exports.ensurePeriodOpen = ensurePeriodOpen;
const ensureSubjectOpen = async (detailGradeId, periodId) => {
    const result = await db_1.pool.query(`SELECT 1
     FROM cierre_materia
     WHERE id_detallegrado = $1
       AND id_periodo = $2
       AND estado = 'CERRADO'`, [detailGradeId, periodId]);
    return result.rows.length === 0;
};
exports.ensureSubjectOpen = ensureSubjectOpen;
const getCurrentAllowedPeriodForSchool = async (schoolId) => {
    const currentYearRes = await db_1.pool.query(`SELECT "id_año"
     FROM "año_lectivo"
     WHERE id_colegio = $1
     ORDER BY "id_año" DESC
     LIMIT 1`, [schoolId]);
    if (currentYearRes.rows.length === 0) {
        return null;
    }
    const periodsRes = await db_1.pool.query(`SELECT id_periodo, nombre, estado, porcentaje, "id_año", dia_inicio, dia_fin, mes_inicio, mes_fin
     FROM periodo_academico
     WHERE id_colegio = $1
       AND "id_año" = $2
       AND estado = 'ABIERTO'
     ORDER BY id_periodo
     LIMIT 1`, [schoolId, Number(currentYearRes.rows[0].id_año)]);
    const period = periodsRes.rows[0];
    if (period) {
        if (period.id_año < 2000) {
            period.id_año = new Date().getFullYear();
        }
    }
    return period ?? null;
};
exports.getCurrentAllowedPeriodForSchool = getCurrentAllowedPeriodForSchool;
const ensureCurrentPeriodForSchool = async (schoolId, periodId) => {
    const currentPeriod = await (0, exports.getCurrentAllowedPeriodForSchool)(schoolId);
    return Boolean(currentPeriod && Number(currentPeriod.id_periodo) === periodId);
};
exports.ensureCurrentPeriodForSchool = ensureCurrentPeriodForSchool;
const ensureCurrentPeriodOrRespond = async (res, schoolId, periodId) => {
    const currentPeriod = await (0, exports.getCurrentAllowedPeriodForSchool)(schoolId);
    if (!currentPeriod) {
        res.status(409).json({ error: "No hay un periodo académico actual configurado para este colegio" });
        return false;
    }
    if (Number(currentPeriod.id_periodo) !== periodId) {
        res.status(409).json({
            error: `Solo está habilitado el periodo actual: ${currentPeriod.nombre}`,
            currentPeriod,
        });
        return false;
    }
    return true;
};
exports.ensureCurrentPeriodOrRespond = ensureCurrentPeriodOrRespond;
