"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPeriodsForSchool = exports.ensureCurrentPeriodOrRespond = exports.ensureCurrentPeriodForSchool = exports.getCurrentAllowedPeriodForSchool = exports.ensureSubjectOpen = exports.ensurePeriodOpen = void 0;
const kysely_1 = require("../config/kysely");
const ensurePeriodOpen = async (periodId) => {
    const row = await kysely_1.db
        .selectFrom("periodo_academico")
        .select("id_periodo")
        .where("id_periodo", "=", periodId)
        .where("estado", "=", "ABIERTO")
        .executeTakeFirst();
    return !!row;
};
exports.ensurePeriodOpen = ensurePeriodOpen;
const ensureSubjectOpen = async (detailGradeId, periodId) => {
    const row = await kysely_1.db
        .selectFrom("cierre_materia")
        .select("id_cierremateria")
        .where("id_detallegrado", "=", detailGradeId)
        .where("id_periodo", "=", periodId)
        .where("estado", "=", "CERRADO")
        .executeTakeFirst();
    return !row;
};
exports.ensureSubjectOpen = ensureSubjectOpen;
const getCurrentAllowedPeriodForSchool = async (schoolId) => {
    const currentYear = await kysely_1.db
        .selectFrom("anio_lectivo")
        .select("id_anio")
        .where("id_colegio", "=", schoolId)
        .orderBy("id_anio", "desc")
        .executeTakeFirst();
    if (!currentYear) {
        return null;
    }
    const period = await kysely_1.db
        .selectFrom("periodo_academico")
        .select([
        "id_periodo",
        "nombre",
        "estado",
        "porcentaje",
        "id_anio",
        "dia_inicio",
        "dia_fin",
        "mes_inicio",
        "mes_fin"
    ])
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", currentYear.id_anio)
        .where("estado", "=", "ABIERTO")
        .orderBy("id_periodo", "asc")
        .executeTakeFirst();
    if (period && period.id_anio !== null) {
        if (period.id_anio < 2000) {
            period.id_anio = new Date().getFullYear();
        }
    }
    return period ?? null;
};
exports.getCurrentAllowedPeriodForSchool = getCurrentAllowedPeriodForSchool;
const ensureCurrentPeriodForSchool = async (schoolId, periodId) => {
    const row = await kysely_1.db
        .selectFrom("periodo_academico")
        .select("estado")
        .where("id_periodo", "=", periodId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();
    if (!row) {
        return false;
    }
    return row.estado !== "CERRADO";
};
exports.ensureCurrentPeriodForSchool = ensureCurrentPeriodForSchool;
const ensureCurrentPeriodOrRespond = async (res, schoolId, periodId) => {
    const period = await kysely_1.db
        .selectFrom("periodo_academico")
        .select(["estado", "nombre"])
        .where("id_periodo", "=", periodId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();
    if (!period) {
        res.status(404).json({ error: "Periodo académico no encontrado" });
        return false;
    }
    if (period.estado === "CERRADO") {
        res.status(409).json({
            error: `El periodo académico "${period.nombre}" está cerrado institucionalmente y no admite modificaciones.`,
        });
        return false;
    }
    return true;
};
exports.ensureCurrentPeriodOrRespond = ensureCurrentPeriodOrRespond;
const getAllPeriodsForSchool = async (schoolId, targetYearId) => {
    let yearIdToUse = targetYearId;
    if (!yearIdToUse) {
        const currentYear = await kysely_1.db
            .selectFrom("anio_lectivo")
            .select("id_anio")
            .where("id_colegio", "=", schoolId)
            .orderBy("id_anio", "desc")
            .executeTakeFirst();
        if (!currentYear) {
            return [];
        }
        yearIdToUse = currentYear.id_anio;
    }
    const periods = await kysely_1.db
        .selectFrom("periodo_academico")
        .select([
        "id_periodo",
        "nombre",
        "estado",
        "porcentaje",
        "id_anio",
        "dia_inicio",
        "dia_fin",
        "mes_inicio",
        "mes_fin",
        "trimestre"
    ])
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", yearIdToUse)
        .where("estado", "!=", "PENDIENTE")
        .orderBy("id_periodo", "asc")
        .execute();
    return periods;
};
exports.getAllPeriodsForSchool = getAllPeriodsForSchool;
