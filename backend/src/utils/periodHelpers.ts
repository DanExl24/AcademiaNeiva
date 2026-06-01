import { Response } from "express";
import { pool } from "../config/db";

export const ensurePeriodOpen = async (periodId: number): Promise<boolean> => {
  const result = await pool.query(
    `SELECT 1
     FROM periodo_academico
     WHERE id_periodo = $1
       AND estado = 'ABIERTO'`,
    [periodId]
  );

  return result.rows.length > 0;
};

export const ensureSubjectOpen = async (detailGradeId: number, periodId: number): Promise<boolean> => {
  const result = await pool.query(
    `SELECT 1
     FROM cierre_materia
     WHERE id_detallegrado = $1
       AND id_periodo = $2
       AND estado = 'CERRADO'`,
    [detailGradeId, periodId]
  );

  return result.rows.length === 0;
};

export const getCurrentAllowedPeriodForSchool = async (schoolId: number) => {
  const currentYearRes = await pool.query<{ id_año: number }>(
    `SELECT "id_año"
     FROM "año_lectivo"
     WHERE id_colegio = $1
     ORDER BY "id_año" DESC
     LIMIT 1`,
    [schoolId]
  );

  if (currentYearRes.rows.length === 0) {
    return null;
  }

  const periodsRes = await pool.query<{
    id_periodo: number;
    nombre: string;
    estado: "ABIERTO" | "CERRADO";
    porcentaje: number;
    id_año: number;
    trimestre: number | null;
    dia_inicio: number | null;
    dia_fin: number | null;
    mes_inicio: number | null;
    mes_fin: number | null;
  }>(
    `SELECT id_periodo, nombre, estado, porcentaje, "id_año", dia_inicio, dia_fin, mes_inicio, mes_fin
     FROM periodo_academico
     WHERE id_colegio = $1
       AND "id_año" = $2
       AND estado = 'ABIERTO'
     ORDER BY id_periodo
     LIMIT 1`,
    [schoolId, Number(currentYearRes.rows[0].id_año)]
  );

  const period = periodsRes.rows[0];
  if (period) {
    if (period.id_año < 2000) {
       period.id_año = new Date().getFullYear();
    }
  }

  return period ?? null;
};

export const ensureCurrentPeriodForSchool = async (schoolId: number, periodId: number): Promise<boolean> => {
  const currentPeriod = await getCurrentAllowedPeriodForSchool(schoolId);
  return Boolean(currentPeriod && Number(currentPeriod.id_periodo) === periodId);
};

export const ensureCurrentPeriodOrRespond = async (
  res: Response,
  schoolId: number,
  periodId: number
): Promise<boolean> => {
  const currentPeriod = await getCurrentAllowedPeriodForSchool(schoolId);

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
