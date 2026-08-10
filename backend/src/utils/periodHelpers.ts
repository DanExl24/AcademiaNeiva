import { Response } from "express";
import { db } from "../config/kysely";

export const ensurePeriodOpen = async (periodId: number): Promise<boolean> => {
  const row = await db
    .selectFrom("periodo_academico")
    .select("id_periodo")
    .where("id_periodo", "=", periodId)
    .where("estado", "=", "ABIERTO")
    .executeTakeFirst();

  return !!row;
};

export const ensureSubjectOpen = async (detailGradeId: number, periodId: number): Promise<boolean> => {
  const row = await db
    .selectFrom("cierre_materia")
    .select("id_cierremateria")
    .where("id_detallegrado", "=", detailGradeId)
    .where("id_periodo", "=", periodId)
    .where("estado", "=", "CERRADO")
    .executeTakeFirst();

  return !row;
};

export const getCurrentAllowedPeriodForSchool = async (schoolId: number) => {
  const currentYear = await db
    .selectFrom("anio_lectivo")
    .select("id_anio")
    .where("id_colegio", "=", schoolId)
    .orderBy("id_anio", "desc")
    .executeTakeFirst();

  if (!currentYear) {
    return null;
  }

  const period = await db
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

  if (period) {
    if (period.id_anio < 2000) {
      period.id_anio = new Date().getFullYear();
    }
  }

  return period ?? null;
};

export const ensureCurrentPeriodForSchool = async (schoolId: number, periodId: number): Promise<boolean> => {
  const row = await db
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

export const ensureCurrentPeriodOrRespond = async (
  res: Response,
  schoolId: number,
  periodId: number
): Promise<boolean> => {
  const period = await db
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

export const getAllPeriodsForSchool = async (schoolId: number, targetYearId?: number) => {
  let yearIdToUse = targetYearId;
  if (!yearIdToUse) {
    const currentYear = await db
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

  const periods = await db
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
