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
  const currentYearRes = await pool.query<{ id_anio: number }>(
    `SELECT id_anio
     FROM anio_lectivo
     WHERE id_colegio = $1
     ORDER BY id_anio DESC
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
    id_anio: number;
    trimestre: number | null;
    dia_inicio: number | null;
    dia_fin: number | null;
    mes_inicio: number | null;
    mes_fin: number | null;
  }>(
    `SELECT id_periodo, nombre, estado, porcentaje, id_anio, dia_inicio, dia_fin, mes_inicio, mes_fin
     FROM periodo_academico
     WHERE id_colegio = $1
       AND id_anio = $2
       AND estado = 'ABIERTO'
     ORDER BY id_periodo
     LIMIT 1`,
    [schoolId, Number(currentYearRes.rows[0].id_anio)]
  );

  const period = periodsRes.rows[0];
  if (period) {
    if (period.id_anio < 2000) {
       period.id_anio = new Date().getFullYear();
    }
  }

  return period ?? null;
};

export const ensureCurrentPeriodForSchool = async (schoolId: number, periodId: number): Promise<boolean> => {
  const result = await pool.query(
    `SELECT estado FROM periodo_academico WHERE id_periodo = $1 AND id_colegio = $2`,
    [periodId, schoolId]
  );
  if (result.rows.length === 0) {
    return false;
  }
  return result.rows[0].estado !== "CERRADO";
};

export const ensureCurrentPeriodOrRespond = async (
  res: Response,
  schoolId: number,
  periodId: number
): Promise<boolean> => {
  const periodRes = await pool.query(
    `SELECT estado, nombre FROM periodo_academico WHERE id_periodo = $1 AND id_colegio = $2`,
    [periodId, schoolId]
  );

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
