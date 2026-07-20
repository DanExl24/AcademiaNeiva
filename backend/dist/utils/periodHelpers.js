"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPeriodsForSchool = exports.ensureCurrentPeriodOrRespond = exports.ensureCurrentPeriodForSchool = exports.getCurrentAllowedPeriodForSchool = exports.ensureSubjectOpen = exports.ensurePeriodOpen = void 0;
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
    const currentYearRes = await db_1.pool.query(`SELECT id_anio
     FROM anio_lectivo
     WHERE id_colegio = $1
     ORDER BY id_anio DESC
     LIMIT 1`, [schoolId]);
    if (currentYearRes.rows.length === 0) {
        return null;
    }
    const periodsRes = await db_1.pool.query(`SELECT id_periodo, nombre, estado, porcentaje, id_anio, dia_inicio, dia_fin, mes_inicio, mes_fin
     FROM periodo_academico
     WHERE id_colegio = $1
       AND id_anio = $2
       AND estado = 'ABIERTO'
     ORDER BY id_periodo
     LIMIT 1`, [schoolId, Number(currentYearRes.rows[0].id_anio)]);
    const period = periodsRes.rows[0];
    if (period) {
        if (period.id_anio < 2000) {
            period.id_anio = new Date().getFullYear();
        }
    }
    return period ?? null;
};
exports.getCurrentAllowedPeriodForSchool = getCurrentAllowedPeriodForSchool;
const ensureCurrentPeriodForSchool = async (schoolId, periodId) => {
    const result = await db_1.pool.query(`SELECT estado FROM periodo_academico WHERE id_periodo = $1 AND id_colegio = $2`, [periodId, schoolId]);
    if (result.rows.length === 0) {
        return false;
    }
    return result.rows[0].estado !== "CERRADO";
};
exports.ensureCurrentPeriodForSchool = ensureCurrentPeriodForSchool;
const ensureCurrentPeriodOrRespond = async (res, schoolId, periodId) => {
    const periodRes = await db_1.pool.query(`SELECT estado, nombre FROM periodo_academico WHERE id_periodo = $1 AND id_colegio = $2`, [periodId, schoolId]);
    if (periodRes.rows.length === 0) {
        res.status(404).json({ error: "Periodo académico no encontrado" });
        return false;
    }
    if (periodRes.rows[0].estado === "CERRADO") {
        res.status(409).json({
            error: `El periodo académico "${periodRes.rows[0].nombre}" está cerrado institucionalmente y no admite modificaciones.`,
        });
        return false;
    }
    return true;
};
exports.ensureCurrentPeriodOrRespond = ensureCurrentPeriodOrRespond;
const getAllPeriodsForSchool = async (schoolId) => {
    const currentYearRes = await db_1.pool.query(`SELECT id_anio
     FROM anio_lectivo
     WHERE id_colegio = $1
     ORDER BY id_anio DESC
     LIMIT 1`, [schoolId]);
    if (currentYearRes.rows.length === 0) {
        return [];
    }
    const periodsRes = await db_1.pool.query(`SELECT id_periodo, nombre, estado, porcentaje, id_anio, dia_inicio, dia_fin, mes_inicio, mes_fin, trimestre
     FROM periodo_academico
     WHERE id_colegio = $1
       AND id_anio = $2
       AND estado IN ('ABIERTO', 'CERRADO')
     ORDER BY id_periodo`, [schoolId, Number(currentYearRes.rows[0].id_anio)]);
    return periodsRes.rows;
};
exports.getAllPeriodsForSchool = getAllPeriodsForSchool;
