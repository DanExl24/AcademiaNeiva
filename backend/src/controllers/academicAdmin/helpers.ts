import { Request, Response } from "express";
import { PoolClient } from "pg";
import { pool } from "../../config/db";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { NotificationService } from "../../services/notificationService";
import { validateDocumentUniqueness, normalizeDocument, validateDocumentFormatByTipo } from "../../utils/documentValidation";
import { formatFriendlyErrorMessage } from "../../utils/errorHelper";
import { normalizeGradeName, isDuplicateOrSimilarGrade } from "../../utils/gradeNormalization";
import { getDefaultMonthsLabelForPeriodOrder, getAcademicYearLabel } from "../../config/academicCalendarDefaults";
import {
  DEFAULT_COMPETENCY_TEXT,
  ensureCompetencySchema,
  harmonizeCompetenciesForSchoolYear,
  syncCompetencyAcrossGrade,
  TeachingContext,
} from "../../config/competencyMigration";

export const parseSchoolId = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!parsed || Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
};

export const ensureTeacherStatusColumn = async () => {};

export const autoSwitchPeriodsForYear = async (client: any, schoolId: number, yearId: number): Promise<void> => {
  const yearRes = await client.query(
    `SELECT id_anio, calendario, tipo_calendario, estado
     FROM anio_lectivo
     WHERE id_anio = $1 AND id_colegio = $2`,
    [yearId, schoolId]
  );
  if (!yearRes.rows.length || yearRes.rows[0].estado === 'CERRADO') return;
  const yearRow = yearRes.rows[0];
  const calendarType = yearRow.tipo_calendario || 'A';

  const periodsRes = await client.query(
    `SELECT id_periodo, nombre, estado, porcentaje, trimestre, mes_inicio, dia_inicio, mes_fin, dia_fin
     FROM periodo_academico
     WHERE id_colegio = $1 AND id_anio = $2
     ORDER BY trimestre ASC, id_periodo ASC`,
    [schoolId, yearId]
  );
  const periods = periodsRes.rows;

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = now.getDate();
  let periodIdToOpen: number | null = null;

  for (const p of periods) {
    if (p.mes_inicio && p.dia_inicio && p.mes_fin && p.dia_fin) {
      const mesInicio = Number(p.mes_inicio);
      const diaInicio = Number(p.dia_inicio);
      const mesFin = Number(p.mes_fin);
      const diaFin = Number(p.dia_fin);

      if (calendarType === 'A') {
        const nowVal = currentMonth * 100 + currentDay;
        const startVal = mesInicio * 100 + diaInicio;
        const endVal = mesFin * 100 + diaFin;
        if (nowVal >= startVal && nowVal <= endVal) {
          periodIdToOpen = p.id_periodo;
          break;
        }
      } else {
        const normalizeMonth = (m: number) => m >= 8 ? m - 7 : m + 5;
        const nowNorm = normalizeMonth(currentMonth) * 100 + currentDay;
        const startNorm = normalizeMonth(mesInicio) * 100 + diaInicio;
        const endNorm = normalizeMonth(mesFin) * 100 + diaFin;
        if (nowNorm >= startNorm && nowNorm <= endNorm) {
          periodIdToOpen = p.id_periodo;
          break;
        }
      }
    }
  }

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    let nextState = p.estado;

    if (p.id_periodo === periodIdToOpen) {
      if (p.estado === 'PENDIENTE') {
        const previousPeriod = i > 0 ? periods[i - 1] : null;
        if (!previousPeriod || previousPeriod.estado === 'CERRADO') {
          nextState = 'ABIERTO';
        }
      } else if (p.estado === 'CERRADO') {
        nextState = 'CERRADO';
      } else {
        nextState = 'ABIERTO';
      }
    } else {
      if (p.estado === 'ABIERTO') {
        nextState = 'CERRADO';
      }
    }

    if (nextState !== p.estado) {
      await client.query(
        `UPDATE periodo_academico SET estado = $1 WHERE id_periodo = $2`,
        [nextState, p.id_periodo]
      );
    }
  }
};
