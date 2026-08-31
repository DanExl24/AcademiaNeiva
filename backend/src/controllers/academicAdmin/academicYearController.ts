import { Request, Response } from "express";
import { PoolClient } from "pg";
import { pool } from "../../config/db";
import { db } from "../../config/kysely";
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
import {
  AuthRequest,
  path,
  parseSchoolId,
  ensureTeacherStatusColumn,
  autoSwitchPeriodsForYear,
  ensureAcademicYearForSchool,
  ensureSchoolSettingsTable,
  ensureAcademicPeriodTrimesterColumn,
  ensureAcademicPeriodDayColumns,
  ensureAcademicPeriodMonthColumns,
  ensureAcademicPeriodPendingStatus,
  ensureSchoolDefaultSettings,
  roundToOne,
  syncSchoolScalesAndGrades,
  getUserEligibleAcademicYears
} from "./helpers";

export const createAcademicYear = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const calendarioInput = String(req.body.calendario || "").trim();
  const tipo_calendario = String(req.body.tipo_calendario || "A").trim().toUpperCase();
  const fecha_inicio = req.body.fecha_inicio ? String(req.body.fecha_inicio).trim() : null;
  const fecha_fin = req.body.fecha_fin ? String(req.body.fecha_fin).trim() : null;

  if (!schoolId) {
    res.status(400).json({ error: "Identificador de colegio inválido" });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para registrar años lectivos en este colegio." });
    return;
  }

  if (!calendarioInput || !/^[0-9]{4}(-[0-9]{4})?$/.test(calendarioInput)) {
    res.status(400).json({ error: "El nombre del año lectivo debe ser un año (ej. 2026) o un rango de dos años (ej. 2026-2027)." });
    return;
  }

  if (tipo_calendario !== "A" && tipo_calendario !== "B") {
    res.status(400).json({ error: "El tipo de calendario debe ser A o B." });
    return;
  }

  const yearMatch = calendarioInput.match(/\d{4}/g);
  const endYearNum = yearMatch ? parseInt(yearMatch[yearMatch.length - 1]) : 2026;
  const startYearNum = yearMatch && yearMatch.length > 1 ? parseInt(yearMatch[0]) : (tipo_calendario === 'B' ? endYearNum - 1 : endYearNum);

  let effectiveFechaInicio = fecha_inicio;
  let effectiveFechaFin = fecha_fin;

  if (!effectiveFechaInicio) {
    effectiveFechaInicio = tipo_calendario === 'B' ? `${startYearNum}-09-01` : `${startYearNum}-01-15`;
  }
  if (!effectiveFechaFin) {
    effectiveFechaFin = tipo_calendario === 'B' ? `${endYearNum}-06-30` : `${endYearNum}-11-30`;
  }

  const startDate = new Date(effectiveFechaInicio);
  const endDate = new Date(effectiveFechaFin);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    res.status(400).json({ error: "Las fechas de inicio y fin deben tener un formato válido (AAAA-MM-DD)." });
    return;
  }

  // Validacion 2: La fecha de fin debe ser mayor que la de inicio
  if (endDate <= startDate) {
    res.status(400).json({ error: "La fecha de fin debe ser mayor que la fecha de inicio del año lectivo." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Validacion 3: No deben existir dos años lectivos con el mismo nombre
    const duplicateRes = await client.query(
      `SELECT id_anio FROM anio_lectivo WHERE calendario = $1 AND id_colegio = $2`,
      [calendarioInput, schoolId]
    );

    if (duplicateRes.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: `Ya existe un año lectivo configurado con el nombre '${calendarioInput}' para este colegio.` });
      return;
    }

    // Validacion 4: Evitar que dos años lectivos se solapen en fechas
    const overlapRes = await client.query(
      `SELECT id_anio, calendario, fecha_inicio, fecha_fin 
       FROM anio_lectivo 
       WHERE id_colegio = $1 
         AND fecha_inicio IS NOT NULL 
         AND fecha_fin IS NOT NULL
         AND (fecha_inicio <= $2 AND fecha_fin >= $3)`,
      [schoolId, effectiveFechaFin, effectiveFechaInicio]
    );

    if (overlapRes.rows.length > 0) {
      const overYear = overlapRes.rows[0];
      const formatStart = overYear.fecha_inicio instanceof Date ? overYear.fecha_inicio.toISOString().split('T')[0] : overYear.fecha_inicio;
      const formatEnd = overYear.fecha_fin instanceof Date ? overYear.fecha_fin.toISOString().split('T')[0] : overYear.fecha_fin;
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `El rango de fechas (${effectiveFechaInicio} a ${effectiveFechaFin}) se solapa con el año lectivo '${overYear.calendario}' (${formatStart} a ${formatEnd}).`
      });
      return;
    }

    // Validacion 1: No puede haber dos años lectivos activos.
    await client.query(
      `UPDATE anio_lectivo SET estado = 'CERRADO' WHERE id_colegio = $1 AND estado = 'ABIERTO'`,
      [schoolId]
    );

    const createdYear = await client.query(
      `INSERT INTO anio_lectivo (calendario, id_colegio, tipo_calendario, estado, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, 'ABIERTO', $4, $5)
       RETURNING id_anio, calendario, tipo_calendario, estado, fecha_inicio, fecha_fin`,
      [calendarioInput, schoolId, tipo_calendario, effectiveFechaInicio, effectiveFechaFin]
    );

    const newYearId = Number(createdYear.rows[0].id_anio);

    // Auto-distribuir los 4 periodos acomodados exactamente al rango fecha_inicio a fecha_fin
    const quarterMs = (endDate.getTime() - startDate.getTime()) / 4;
    const periodNames = ["Primer Periodo", "Segundo Periodo", "Tercer Periodo", "Cuarto Periodo"];

    for (let i = 0; i < 4; i++) {
      const qStart = new Date(startDate.getTime() + Math.round(i * quarterMs));
      const qEnd = i === 3 
        ? new Date(endDate.getTime()) 
        : new Date(startDate.getTime() + Math.round((i + 1) * quarterMs) - (24 * 60 * 60 * 1000));

      const mes_inicio = qStart.getUTCMonth() + 1;
      const dia_inicio = qStart.getUTCDate();
      const mes_fin = qEnd.getUTCMonth() + 1;
      const dia_fin = qEnd.getUTCDate();
      const estadoP = i === 0 ? 'ABIERTO' : 'PENDIENTE';

      await client.query(
        `INSERT INTO periodo_academico (nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, id_anio, id_colegio, trimestre)
         VALUES ($1, $2, 25.00, $3, $4, $5, $6, $7, $8, $9)`,
        [periodNames[i], estadoP, mes_inicio, dia_inicio, mes_fin, dia_fin, newYearId, schoolId, i + 1]
      );
    }

    // Clear group directors for the school (clean slate for the new year)
    await client.query("UPDATE grupos SET id_docente = NULL WHERE id_colegio = $1", [schoolId]);

    const updatedPeriodsRes = await client.query(
      `SELECT id_periodo, nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, trimestre
       FROM periodo_academico
       WHERE id_anio = $1 AND id_colegio = $2
       ORDER BY id_periodo`,
      [newYearId, schoolId]
    );

    await client.query("COMMIT");

    res.status(201).json({
      ...createdYear.rows[0],
      periods: updatedPeriodsRes.rows,
      message: `Año lectivo ${calendarioInput} creado correctamente. Sus 4 periodos se han acomodado automáticamente a las fechas (${effectiveFechaInicio} al ${effectiveFechaFin}).`
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error al crear año lectivo:", error);
    res.status(500).json({ error: error.message || "Error al crear el año lectivo." });
  } finally {
    client.release();
  }
};

export const deleteAcademicYear = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthRequest;
  const schoolId = parseSchoolId(req.body?.schoolId || req.query?.schoolId || authReq.user?.schoolId);
  const yearId = Number(req.params.id);

  if (!schoolId || Number.isNaN(yearId)) {
    res.status(400).json({ error: "Identificador de año lectivo o colegio inválido." });
    return;
  }

  const isSupervision = Boolean(authReq.user && authReq.user.roles.includes("admin_general"));
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para eliminar años lectivos en esta institución." });
    return;
  }

  try {
    const result = await db.transaction().execute(async (trx) => {
      // 1. Verificar existencia y estado del año lectivo
      const targetYear = await trx
        .selectFrom("anio_lectivo")
        .select(["id_anio", "estado", "calendario"])
        .where("id_anio", "=", yearId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!targetYear) {
        throw new Error("NOT_FOUND: Año lectivo no encontrado en esta institución.");
      }

      if (targetYear.estado === "CERRADO") {
        throw new Error("CLOSED_YEAR: El año lectivo se encuentra CERRADO y contiene historial académico archivado. No puede ser eliminado.");
      }

      // 2. Verificar que no sea el único año lectivo del colegio
      const totalYears = await trx
        .selectFrom("anio_lectivo")
        .select((eb) => eb.fn.count("id_anio").as("count"))
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (Number(totalYears?.count || 0) <= 1) {
        throw new Error("MIN_YEAR_LIMIT: No es posible eliminar este año lectivo porque la institución debe conservar al menos un año lectivo registrado.");
      }

      // 3. Validar matrículas registradas en este año
      const matriculaCheck = await trx
        .selectFrom("matricula")
        .select((eb) => eb.fn.count("id_matricula").as("count"))
        .where("id_anio", "=", yearId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (Number(matriculaCheck?.count || 0) > 0) {
        throw new Error(`ACADEMIC_RECORDS: No es posible eliminar el año lectivo porque ya cuenta con ${matriculaCheck?.count} matrícula(s) registrada(s).`);
      }

      // 4. Validar asignaciones de carga académica (cursos, docentes y materias)
      const detalleGradosCheck = await trx
        .selectFrom("detalle_grados")
        .select((eb) => eb.fn.count("id_detallegrado").as("count"))
        .where("id_anio", "=", yearId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (Number(detalleGradosCheck?.count || 0) > 0) {
        throw new Error(`ACADEMIC_RECORDS: No es posible eliminar el año lectivo porque ya cuenta con ${detalleGradosCheck?.count} asignación(es) de carga académica (materias y docentes) vinculadas.`);
      }

      // 5. Validar competencias curriculares registradas en este año
      const competenciasCheck = await trx
        .selectFrom("competencias")
        .select((eb) => eb.fn.count("id_competencia").as("count"))
        .where("id_anio", "=", yearId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (Number(competenciasCheck?.count || 0) > 0) {
        throw new Error(`ACADEMIC_RECORDS: No es posible eliminar el año lectivo porque ya cuenta con ${competenciasCheck?.count} competencia(s) pedagógica(s) configuradas.`);
      }

      // 6. Validar periodos académicos asociados y sus registros
      const periods = await trx
        .selectFrom("periodo_academico")
        .select(["id_periodo", "nombre", "estado"])
        .where("id_anio", "=", yearId)
        .where("id_colegio", "=", schoolId)
        .execute();

      const activeOrClosedPeriods = periods.filter((p) => p.estado !== "PENDIENTE");
      if (activeOrClosedPeriods.length > 0) {
        const periodNames = activeOrClosedPeriods.map((p) => `"${p.nombre}" (${p.estado})`).join(", ");
        throw new Error(`ACADEMIC_RECORDS: No es posible eliminar el año lectivo porque contiene periodos en curso o cerrados (${periodNames}).`);
      }

      const periodIds = periods.map((p) => p.id_periodo);
      if (periodIds.length > 0) {
        const [raCheck, actCheck, obsCheck, cierreCheck] = await Promise.all([
          trx.selectFrom("resultado_academico").select((eb) => eb.fn.count("id_resultado").as("count")).where("id_periodo", "in", periodIds).executeTakeFirst(),
          trx.selectFrom("actividad_materia").select((eb) => eb.fn.count("id_actividadmateria").as("count")).where("id_periodo", "in", periodIds).executeTakeFirst(),
          trx.selectFrom("observacion_estudiante").select((eb) => eb.fn.count("id_observacion").as("count")).where("id_periodo", "in", periodIds).executeTakeFirst(),
          trx.selectFrom("cierre_materia").select((eb) => eb.fn.count("id_cierremateria").as("count")).where("id_periodo", "in", periodIds).executeTakeFirst(),
        ]);

        const totalRecords = Number(raCheck?.count || 0) + Number(actCheck?.count || 0) + Number(obsCheck?.count || 0) + Number(cierreCheck?.count || 0);
        if (totalRecords > 0) {
          throw new Error(`ACADEMIC_RECORDS: No es posible eliminar el año lectivo porque sus periodos contienen ${totalRecords} calificaciones, actividades o registros pedagógicos asociados.`);
        }
      }

      // 7. Validar decisiones de promoción o registros de graduados
      const [promocionCheck, graduadosCheck] = await Promise.all([
        trx.selectFrom("decision_promocion_directivo").select((eb) => eb.fn.count("id_decision").as("count")).where("id_anio_anterior", "=", yearId).where("id_colegio", "=", schoolId).executeTakeFirst(),
        trx.selectFrom("registro_graduados").select((eb) => eb.fn.count("id_graduado").as("count")).where("id_anio", "=", yearId).executeTakeFirst(),
      ]);

      if (Number(promocionCheck?.count || 0) > 0 || Number(graduadosCheck?.count || 0) > 0) {
        throw new Error("ACADEMIC_RECORDS: No es posible eliminar el año lectivo porque cuenta con registros históricos de graduación o promoción asociados.");
      }

      // 8. Eliminar configuración de inscripción del año si existe
      await trx
        .deleteFrom("configuracion_inscripcion")
        .where("id_anio", "=", yearId)
        .where("id_colegio", "=", schoolId)
        .execute();

      // 9. Eliminar los periodos pendientes del año
      if (periodIds.length > 0) {
        await trx
          .deleteFrom("periodo_academico")
          .where("id_anio", "=", yearId)
          .where("id_colegio", "=", schoolId)
          .execute();
      }

      // 10. Eliminar el año lectivo
      await trx
        .deleteFrom("anio_lectivo")
        .where("id_anio", "=", yearId)
        .where("id_colegio", "=", schoolId)
        .execute();

      // 11. Verificar que quede al menos un año ABIERTO
      const openYearCheck = await trx
        .selectFrom("anio_lectivo")
        .select("id_anio")
        .where("id_colegio", "=", schoolId)
        .where("estado", "=", "ABIERTO")
        .limit(1)
        .executeTakeFirst();

      let reactivatedYearLabel = "";
      if (!openYearCheck) {
        const latestYear = await trx
          .selectFrom("anio_lectivo")
          .select(["id_anio", "calendario"])
          .where("id_colegio", "=", schoolId)
          .orderBy("id_anio", "desc")
          .limit(1)
          .executeTakeFirst();

        if (latestYear) {
          await trx
            .updateTable("anio_lectivo")
            .set({ estado: "ABIERTO" })
            .where("id_anio", "=", latestYear.id_anio)
            .execute();
          reactivatedYearLabel = latestYear.calendario || "";
        }
      }

      return { reactivatedYearLabel, targetYear };
    });

    res.json({
      message: result.reactivatedYearLabel
        ? `Año lectivo ${result.targetYear.calendario} eliminado exitosamente. El año lectivo ${result.reactivatedYearLabel} ha sido reactivado automáticamente como año abierto.`
        : `Año lectivo ${result.targetYear.calendario} y sus periodos eliminados exitosamente.`,
    });
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND:")) {
      res.status(404).json({ error: error.message.replace("NOT_FOUND: ", "") });
      return;
    }
    if (error.message?.startsWith("CLOSED_YEAR:")) {
      res.status(400).json({ error: error.message.replace("CLOSED_YEAR: ", "") });
      return;
    }
    if (error.message?.startsWith("MIN_YEAR_LIMIT:")) {
      res.status(400).json({ error: error.message.replace("MIN_YEAR_LIMIT: ", "") });
      return;
    }
    if (error.message?.startsWith("ACADEMIC_RECORDS:")) {
      res.status(409).json({ error: error.message.replace("ACADEMIC_RECORDS: ", "") });
      return;
    }
    console.error("Error deleting academic year:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

export const updateAcademicYearStatus = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const yearId = Number(req.params.id);
  const nuevoEstado = String(req.body.estado || "").trim().toUpperCase();

  if (!schoolId || Number.isNaN(yearId) || (nuevoEstado !== "ABIERTO" && nuevoEstado !== "CERRADO")) {
    res.status(400).json({ error: "Parámetros de cambio de estado inválidos" });
    return;
  }

  try {
    const updated = await db.transaction().execute(async (trx) => {
      if (nuevoEstado === "CERRADO") {
        // Verify if this is the only open year in the school
        const openYears = await trx
          .selectFrom("anio_lectivo")
          .select("id_anio")
          .where("id_colegio", "=", schoolId)
          .where("estado", "=", "ABIERTO")
          .execute();

        if (openYears.length <= 1 && openYears.some((y) => y.id_anio === yearId)) {
          throw new Error("ONLY_OPEN_YEAR: Debe existir al menos un año lectivo abierto en la institución. Para cerrar este año, activa o abre otro año lectivo primero.");
        }
      }

      if (nuevoEstado === "ABIERTO") {
        await trx
          .updateTable("anio_lectivo")
          .set({ estado: "CERRADO" })
          .where("id_colegio", "=", schoolId)
          .where("id_anio", "!=", yearId)
          .where("estado", "=", "ABIERTO")
          .execute();
      }

      const resUpdate = await trx
        .updateTable("anio_lectivo")
        .set({ estado: nuevoEstado })
        .where("id_anio", "=", yearId)
        .where("id_colegio", "=", schoolId)
        .returning(["id_anio", "calendario", "tipo_calendario", "estado", "fecha_inicio", "fecha_fin"])
        .executeTakeFirst();

      if (!resUpdate) {
        throw new Error("NOT_FOUND: Año lectivo no encontrado");
      }

      return resUpdate;
    });

    res.json(updated);
  } catch (error: any) {
    if (error.message?.startsWith("ONLY_OPEN_YEAR:")) {
      res.status(400).json({ error: error.message.replace("ONLY_OPEN_YEAR: ", "") });
      return;
    }
    if (error.message?.startsWith("NOT_FOUND:")) {
      res.status(404).json({ error: error.message.replace("NOT_FOUND: ", "") });
      return;
    }
    console.error("Error updating academic year status:", error);
    res.status(500).json({ error: error.message || "Error en el servidor" });
  }
};

export const updateAcademicYearCalendarType = async (_req: Request, res: Response): Promise<void> => {
  res.status(400).json({
    error: "El tipo de calendario de un año lectivo es inmutable tras su creación. Para utilizar un esquema de calendario diferente (Calendario A o Calendario B), debe registrar un nuevo año lectivo con el calendario deseado.",
  });
};

export const createAcademicPeriod = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.body.schoolId);
  const nombre = String(req.body.nombre || "").trim();
  const porcentaje = Number(req.body.porcentaje);
  const mesInicio = Number(req.body.mes_inicio);
  const diaInicio = Number(req.body.dia_inicio);
  const mesFin = Number(req.body.mes_fin);
  const diaFin = Number(req.body.dia_fin);
  const targetYearId = req.body.id_anio ? Number(req.body.id_anio) : null;
  const estadoInput = req.body.estado;
  const estado = (estadoInput === 'ABIERTO' || estadoInput === 'CERRADO' || estadoInput === 'PENDIENTE') ? estadoInput : 'PENDIENTE';
  const { motivo_cambio } = req.body;

  if (
    !schoolId ||
    !nombre ||
    Number.isNaN(porcentaje) ||
    porcentaje <= 0 ||
    !mesInicio || !diaInicio || !mesFin || !diaFin
  ) {
    res.status(400).json({ error: "Nombre, porcentaje y rango de fechas (mes/día) son obligatorios" });
    return;
  }

  if (diaInicio !== null && (!Number.isInteger(diaInicio) || diaInicio < 1 || diaInicio > 31)) {
    res.status(400).json({ error: "El día de inicio debe ser un número entre 1 y 31" });
    return;
  }

  if (diaFin !== null && (!Number.isInteger(diaFin) || diaFin < 1 || diaFin > 31)) {
    res.status(400).json({ error: "El día de fin debe ser un número entre 1 y 31" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await ensureAcademicPeriodTrimesterColumn();
    await ensureAcademicPeriodDayColumns();
    await ensureAcademicPeriodPendingStatus();
    const finalYearId = targetYearId || await ensureAcademicYearForSchool(schoolId);

    // Get school year info for calendar type and date boundaries
    const yearRes = await client.query(
      `SELECT id_anio, calendario, tipo_calendario, fecha_inicio, fecha_fin, estado FROM anio_lectivo WHERE id_anio = $1 AND id_colegio = $2`,
      [finalYearId, schoolId]
    );
    const yearRow = yearRes.rows[0];

    if (yearRow && yearRow.estado === 'CERRADO') {
      await client.query("ROLLBACK");
      res.status(400).json({ error: `El año lectivo ${yearRow.calendario || ''} se encuentra CERRADO. No es posible crear periodos en un ciclo escolar cerrado.` });
      return;
    }
    const calendarType = yearRow?.tipo_calendario || 'A';

    if (yearRow && yearRow.fecha_inicio && yearRow.fecha_fin) {
      const yearStart = new Date(yearRow.fecha_inicio);
      const yearEnd = new Date(yearRow.fecha_fin);
      
      const startYearNum = yearStart.getUTCFullYear();
      const endYearNum = yearEnd.getUTCFullYear();

      let pStartYear = startYearNum;
      if (calendarType === 'B' && mesInicio < (yearStart.getUTCMonth() + 1)) {
        pStartYear = endYearNum;
      }
      const pStartDate = new Date(Date.UTC(pStartYear, mesInicio - 1, diaInicio));

      let pEndYear = startYearNum;
      if (calendarType === 'B' && mesFin < (yearStart.getUTCMonth() + 1)) {
        pEndYear = endYearNum;
      }
      const pEndDate = new Date(Date.UTC(pEndYear, mesFin - 1, diaFin));

      if (pStartDate < yearStart || pEndDate > yearEnd) {
        await client.query("ROLLBACK");
        const formatYStart = yearStart.toISOString().split('T')[0];
        const formatYEnd = yearEnd.toISOString().split('T')[0];
        res.status(400).json({
          error: `Las fechas del periodo no pueden estar fuera del rango de fechas del año lectivo (${formatYStart} al ${formatYEnd}).`
        });
        return;
      }
    }

    // Validate ranges don't overlap with other periods
    const otherPeriodsRes = await client.query(
      `SELECT id_periodo, nombre, mes_inicio, dia_inicio, mes_fin, dia_fin
       FROM periodo_academico
       WHERE id_colegio = $1 AND id_anio = $2`,
      [schoolId, finalYearId]
    );

    const getNormalizedDateVal = (month: number, day: number, calType: string) => {
      if (calType === 'B') {
        const normalizeMonth = (m: number) => m >= 8 ? m - 7 : m + 5;
        return normalizeMonth(month) * 100 + day;
      }
      return month * 100 + day;
    };

    const newStartVal = getNormalizedDateVal(mesInicio, diaInicio, calendarType);
    const newEndVal = getNormalizedDateVal(mesFin, diaFin, calendarType);

    if (newStartVal > newEndVal) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "La fecha de inicio no puede ser posterior a la fecha de fin" });
      return;
    }

    for (const other of otherPeriodsRes.rows) {
      if (other.mes_inicio && other.dia_inicio && other.mes_fin && other.dia_fin) {
        const otherStartVal = getNormalizedDateVal(other.mes_inicio, other.dia_inicio, calendarType);
        const otherEndVal = getNormalizedDateVal(other.mes_fin, other.dia_fin, calendarType);

        const overlap = !(newEndVal < otherStartVal || otherEndVal < newStartVal);
        if (overlap) {
          await client.query("ROLLBACK");
          res.status(409).json({
            error: `El rango de fechas se superpone con el periodo '${other.nombre}' (${other.dia_inicio}/${other.mes_inicio} - ${other.dia_fin}/${other.mes_fin})`
          });
          return;
        }
      }
    }

    // If pending state: "Un periodo en estado pendiente no puede tener un rango de fechas anterior al periodo actual"
    if (estado === 'PENDIENTE') {
      const activePeriodRes = await client.query(
        `SELECT id_periodo, nombre, mes_inicio, mes_fin, dia_inicio, dia_fin
         FROM periodo_academico
         WHERE id_colegio = $1 AND id_anio = $2 AND estado = 'ABIERTO'
         LIMIT 1`,
        [schoolId, finalYearId]
      );

      if (activePeriodRes.rows.length > 0) {
        const active = activePeriodRes.rows[0];
        if (active.mes_fin && active.dia_fin) {
          const activeEndVal = getNormalizedDateVal(active.mes_fin, active.dia_fin, calendarType);
          if (newStartVal < activeEndVal) {
            await client.query("ROLLBACK");
            res.status(400).json({
              error: `Un periodo en estado Pendiente no puede tener un rango de fechas anterior al periodo actual (${active.nombre})`
            });
            return;
          }
        }
      }
    }

    const totalsRes = await client.query(
      `SELECT COALESCE(SUM(porcentaje), 0)::numeric AS total
       FROM periodo_academico
       WHERE id_colegio = $1 AND id_anio = $2`,
      [schoolId, finalYearId]
    );

    const currentTotal = Number(totalsRes.rows[0].total);
    if (currentTotal + porcentaje > 100) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: `No es posible crear el periodo porque la suma de porcentajes excede 100%. Actual: ${currentTotal}%`,
      });
      return;
    }

    const duplicateRes = await client.query(
      `SELECT id_periodo
       FROM periodo_academico
       WHERE id_colegio = $1
         AND id_anio = $2
         AND UPPER(TRIM(nombre)) = UPPER(TRIM($3))`,
      [schoolId, finalYearId, nombre]
    );

    if (duplicateRes.rows.length > 0) {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Ya existe un periodo académico con ese nombre en este año" });
      return;
    }

    // Determine the next trimestre number
    const maxTrimestreRes = await client.query(
      `SELECT COALESCE(MAX(trimestre), 0) as max_trim
       FROM periodo_academico
       WHERE id_colegio = $1 AND id_anio = $2`,
      [schoolId, finalYearId]
    );
    const nextTrimestre = Number(maxTrimestreRes.rows[0].max_trim) + 1;

    const created = await pool.query(
      `INSERT INTO periodo_academico (nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, id_anio, id_colegio, trimestre)
       VALUES ($1, $2::estado_periodo, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id_periodo, nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, id_anio, trimestre`,
      [nombre, estado, porcentaje, mesInicio, diaInicio, mesFin, diaFin, finalYearId, schoolId, nextTrimestre]
    );

    const newPeriod = created.rows[0];

    // Audit check (if in supervision mode)
    const authReq = req as AuthRequest;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    let activeAuditoriaId: number | null = null;
    
    if (isSupervision) {
      const auditRes = await client.query(
        `SELECT id_auditoria 
         FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA'`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    if (activeAuditoriaId) {
      await client.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'CONFIGURACION', 'CREACION', 'Creación de periodo académico', $2, NULL, $3, $4)`,
        [activeAuditoriaId, `Periodo ID: ${newPeriod.id_periodo} (${nombre})`, JSON.stringify(newPeriod), motivo_cambio || 'Creación inicial']
      );
    }

    await client.query("COMMIT");
    res.status(201).json(newPeriod);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error creating academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const approveAcademicPeriod = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const { motivo_cambio } = req.body;

  if (!periodId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Get current period
    const periodRes = await client.query(
      `SELECT id_periodo, nombre, estado, id_anio, trimestre
       FROM periodo_academico
       WHERE id_periodo = $1 AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const period = periodRes.rows[0];

    const yearCheck = await client.query(`SELECT estado, calendario FROM anio_lectivo WHERE id_anio = $1 AND id_colegio = $2`, [period.id_anio, schoolId]);
    if (yearCheck.rows[0]?.estado === 'CERRADO') {
      await client.query("ROLLBACK");
      res.status(400).json({ error: `El año lectivo ${yearCheck.rows[0]?.calendario || ''} se encuentra CERRADO. No es posible aprobar periodos en un ciclo escolar cerrado.` });
      return;
    }
    if (period.estado !== 'PENDIENTE') {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Solo se pueden activar periodos en estado Pendiente." });
      return;
    }

    // 2. Validate previous period is Closed
    const previousPeriodRes = await client.query(
      `SELECT id_periodo, nombre, estado
       FROM periodo_academico
       WHERE id_colegio = $1 AND id_anio = $2 AND trimestre < $3
       ORDER BY trimestre DESC
       LIMIT 1`,
      [schoolId, period.id_anio, period.trimestre]
    );

    if (previousPeriodRes.rows.length > 0) {
      const prev = previousPeriodRes.rows[0];
      if (prev.estado !== 'CERRADO') {
        await client.query("ROLLBACK");
        res.status(409).json({
          error: `El periodo anterior (${prev.nombre}) debe estar Cerrado para activar este periodo.`
        });
        return;
      }
    }

    // 3. Audit check (if in supervision mode)
    const authReq = req as AuthRequest;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    let activeAuditoriaId: number | null = null;
    
    if (isSupervision) {
      if (!motivo_cambio) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Se requiere justificar el cambio para registrar en la auditoría." });
        return;
      }
      const auditRes = await client.query(
        `SELECT id_auditoria 
         FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA'`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    // 5. Activate this period
    await client.query(
      `UPDATE periodo_academico
       SET estado = 'ABIERTO'
       WHERE id_periodo = $1 AND id_colegio = $2`,
      [periodId, schoolId]
    );

    // 6. Record in audit
    if (activeAuditoriaId) {
      const valorAntiguo = { estado: period.estado };
      const valorNuevo = { estado: 'ABIERTO' };
      await client.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'CONFIGURACION', 'MODIFICACION', 'Aprobación y activación de periodo académico', $2, $3, $4, $5)`,
        [activeAuditoriaId, `Periodo ID: ${periodId} (${period.nombre})`, JSON.stringify(valorAntiguo), JSON.stringify(valorNuevo), motivo_cambio]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Periodo académico aprobado y activado con éxito", id_periodo: periodId, estado: 'ABIERTO' });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error approving academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const deleteAcademicPeriod = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body?.schoolId || req.query?.schoolId);

  if (!periodId || !schoolId) {
    res.status(400).json({ error: "Identificador de periodo o colegio inválido." });
    return;
  }

  const authReq = req as AuthRequest;
  const isSupervision = Boolean(authReq.user && authReq.user.roles.includes("admin_general"));
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para eliminar periodos en este colegio." });
    return;
  }

  try {
    const period = await db
      .selectFrom("periodo_academico as pa")
      .innerJoin("anio_lectivo as al", "al.id_anio", "pa.id_anio")
      .select([
        "pa.id_periodo",
        "pa.nombre",
        "pa.estado",
        "pa.porcentaje",
        "pa.trimestre",
        "pa.mes_inicio",
        "pa.dia_inicio",
        "pa.mes_fin",
        "pa.dia_fin",
        "pa.id_anio",
        "pa.id_colegio",
        "al.calendario",
        "al.estado as anio_estado",
        "al.tipo_calendario"
      ])
      .where("pa.id_periodo", "=", periodId)
      .where("pa.id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!period) {
      res.status(404).json({ error: "Periodo académico no encontrado para este colegio." });
      return;
    }

    if (period.anio_estado === 'CERRADO') {
      res.status(400).json({ 
        error: `El año lectivo ${period.calendario || ''} se encuentra CERRADO. No es posible eliminar periodos en un ciclo escolar cerrado.` 
      });
      return;
    }

    if (period.estado === 'CERRADO') {
      res.status(400).json({ 
        error: `No es posible eliminar el periodo "${period.nombre}" porque ya ha sido CERRADO institucionalmente.` 
      });
      return;
    }

    if (period.estado === 'ABIERTO') {
      res.status(400).json({ 
        error: `No es posible eliminar el periodo "${period.nombre}" porque se encuentra actualmente ABIERTO en curso. Debe cerrarse o desestimarse formalmente.` 
      });
      return;
    }

    // Validación temporal: No se puede eliminar si la fecha actual ya alcanzó o sobrepasó el inicio o el fin del periodo
    let startYear = new Date().getFullYear();
    if (period.calendario) {
      const parsedYear = parseInt(period.calendario, 10);
      if (!isNaN(parsedYear) && parsedYear > 1900) {
        startYear = parsedYear;
      }
    }

    if (period.mes_inicio && period.dia_inicio) {
      const periodStartDate = new Date(startYear, Number(period.mes_inicio) - 1, Number(period.dia_inicio), 0, 0, 0);
      let endYear = startYear;
      if (period.tipo_calendario === 'B' || (period.mes_fin && period.mes_fin < period.mes_inicio)) {
        endYear = startYear + 1;
      }
      const periodEndDate = period.mes_fin && period.dia_fin 
        ? new Date(endYear, Number(period.mes_fin) - 1, Number(period.dia_fin), 23, 59, 59)
        : null;

      const now = new Date();
      if (now >= periodStartDate) {
        const formattedStart = `${String(period.dia_inicio).padStart(2, '0')}/${String(period.mes_inicio).padStart(2, '0')}/${startYear}`;
        const formattedEnd = periodEndDate && period.dia_fin && period.mes_fin
          ? ` al ${String(period.dia_fin).padStart(2, '0')}/${String(period.mes_fin).padStart(2, '0')}/${endYear}`
          : '';
        res.status(400).json({
          error: `No es posible eliminar el periodo académico "${period.nombre}" porque su vigencia programada (${formattedStart}${formattedEnd}) ya ha iniciado o ha sido alcanzada por la fecha actual del sistema.`
        });
        return;
      }
    }

    // Verificar dependencias académicas reales con Kysely
    const [raRes, naRes, obsRes, compRes, cierreRes] = await Promise.all([
      db.selectFrom("resultado_academico").select(db.fn.count("id_resultado").as("count")).where("id_periodo", "=", periodId).executeTakeFirst(),
      db.selectFrom("actividad_materia").select(db.fn.count("id_actividadmateria").as("count")).where("id_periodo", "=", periodId).where("id_colegio", "=", schoolId).executeTakeFirst(),
      db.selectFrom("observacion_estudiante").select(db.fn.count("id_observacion").as("count")).where("id_periodo", "=", periodId).where("id_colegio", "=", schoolId).executeTakeFirst(),
      db.selectFrom("competencias").select(db.fn.count("id_competencia").as("count")).where("id_periodo", "=", periodId).where("id_colegio", "=", schoolId).executeTakeFirst(),
      db.selectFrom("cierre_materia").select(db.fn.count("id_cierremateria").as("count")).where("id_periodo", "=", periodId).executeTakeFirst(),
    ]);

    const totalRecords = Number(raRes?.count || 0) + 
                         Number(naRes?.count || 0) + 
                         Number(obsRes?.count || 0) + 
                         Number(compRes?.count || 0) + 
                         Number(cierreRes?.count || 0);

    if (totalRecords > 0) {
      res.status(400).json({ 
        error: `No es posible eliminar el periodo "${period.nombre}" porque ya contiene actividades, notas, competencias o registros académicos asociados (${totalRecords} dependencias encontradas).` 
      });
      return;
    }

    // Registrar en auditoría si aplica modo supervisión
    let activeAuditoriaId: number | null = null;
    if (isSupervision && authReq.user) {
      const auditRes = await db
        .selectFrom("auditoria_supervision")
        .select("id_auditoria")
        .where("id_colegio", "=", schoolId)
        .where("id_admin_general", "=", authReq.user.id)
        .where("estado_supervision", "=", "ACTIVA")
        .executeTakeFirst();
      if (auditRes) {
        activeAuditoriaId = auditRes.id_auditoria;
      }
    }

    if (activeAuditoriaId) {
      await db
        .insertInto("auditoria_acciones_realizadas")
        .values({
          id_auditoria: activeAuditoriaId,
          modulo: "CONFIGURACION",
          tipo_accion: "ELIMINACION",
          accion: "Eliminación de periodo académico",
          recurso_afectado: `Periodo ID: ${periodId} (${period.nombre})`,
          valor_antiguo: JSON.stringify(period),
          valor_nuevo: null,
          motivo_cambio: (req.body?.motivo_cambio as string) || "Eliminación de periodo académico"
        })
        .execute();
    }

    await db
      .deleteFrom("periodo_academico")
      .where("id_periodo", "=", periodId)
      .where("id_colegio", "=", schoolId)
      .execute();

    res.json({ message: `Periodo académico "${period.nombre}" eliminado correctamente.` });
  } catch (error: any) {
    console.error("Error al eliminar periodo académico:", error);
    res.status(500).json({ error: formatFriendlyErrorMessage(error) });
  }
};

export const closeAcademicPeriod = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const force = Boolean(req.body.force);

  if (!periodId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const periodRes = await client.query(
      `SELECT id_periodo, nombre, estado, id_anio
       FROM periodo_academico
       WHERE id_periodo = $1
         AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const period = periodRes.rows[0];

    const yearCheck = await client.query(`SELECT estado, calendario FROM anio_lectivo WHERE id_anio = $1 AND id_colegio = $2`, [period.id_anio, schoolId]);
    if (yearCheck.rows[0]?.estado === 'CERRADO') {
      await client.query("ROLLBACK");
      res.status(400).json({ error: `El año lectivo ${yearCheck.rows[0]?.calendario || ''} ya se encuentra CERRADO.` });
      return;
    }
    if (period.estado === 'PENDIENTE') {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Un periodo en estado Pendiente no se puede cerrar directamente. Debe ser aprobado primero." });
      return;
    }

    const assignmentsRes = await client.query(
      `SELECT
         dg.id_detallegrado,
         m.nombre AS materia_nombre,
         ne.nombre AS nivel_nombre,
         tg.nombre AS tipo_grado_nombre,
         s.nombre AS seccion_nombre,
         j.nombre AS jornada_nombre
       FROM detalle_grados dg
       JOIN materias m ON m.id_materia = dg.id_materia
       JOIN grupos g ON g.id_grupo = dg.id_grupo
       JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
       JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
       JOIN secciones s ON s.id_seccion = g.id_seccion
       JOIN jornada j ON j.id_jornada = g.id_jornada
       WHERE dg.id_colegio = $1
         AND dg.id_grupo IS NOT NULL`,
      [schoolId]
    );

    const closedRes = await client.query(
      `SELECT id_detallegrado
       FROM cierre_materia
       WHERE id_periodo = $1
         AND estado = 'CERRADO'`,
      [periodId]
    );

    const closedIds = new Set(closedRes.rows.map((row) => Number(row.id_detallegrado)));
    const pending = assignmentsRes.rows.filter((row) => !closedIds.has(Number(row.id_detallegrado)));

    if (pending.length > 0 && !force) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: "No se puede cerrar el periodo porque hay asignaciones pendientes",
        pending,
      });
      return;
    }

    if (force && pending.length > 0) {
      for (const row of pending) {
        await client.query(
          `INSERT INTO cierre_materia (id_detallegrado, id_periodo, estado, fecha_cierre)
           SELECT $1, $2, 'CERRADO', NOW()
           WHERE NOT EXISTS (
             SELECT 1
             FROM cierre_materia
             WHERE id_detallegrado = $1
               AND id_periodo = $2
           )`,
          [row.id_detallegrado, periodId]
        );
      }
    }

    await client.query(
      `UPDATE periodo_academico
       SET estado = 'CERRADO'
       WHERE id_periodo = $1
         AND id_colegio = $2`,
      [periodId, schoolId]
    );

    await client.query("COMMIT");
    res.json({
      message: force ? "Periodo cerrado con cierre forzado" : "Periodo cerrado correctamente",
      pendingResolved: pending.length,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error closing academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const reopenAcademicPeriod = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const { motivo } = req.body;

  if (!periodId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  if (!motivo || !motivo.trim()) {
    res.status(400).json({ error: "Debe proporcionar un motivo para reabrir el periodo." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Get current period
    const periodRes = await client.query(
      `SELECT id_periodo, nombre, estado, id_anio
       FROM periodo_academico
       WHERE id_periodo = $1 AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Periodo no encontrado" });
      return;
    }

    const period = periodRes.rows[0];

    const yearCheck = await client.query(`SELECT estado, calendario FROM anio_lectivo WHERE id_anio = $1 AND id_colegio = $2`, [period.id_anio, schoolId]);
    if (yearCheck.rows[0]?.estado === 'CERRADO') {
      await client.query("ROLLBACK");
      res.status(400).json({ error: `El año lectivo ${yearCheck.rows[0]?.calendario || ''} se encuentra CERRADO. Debe reabrir el año lectivo antes de reabrir sus periodos individuales.` });
      return;
    }
    if (period.estado !== 'CERRADO') {
      await client.query("ROLLBACK");
      res.status(409).json({ error: "Solo se pueden reabrir periodos en estado Cerrado." });
      return;
    }

    // 2. Audit check
    const authReq = req as AuthRequest;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    let activeAuditoriaId: number | null = null;
    
    if (isSupervision) {
      const auditRes = await client.query(
        `SELECT id_auditoria 
         FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA'`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    // 3. Update period state to ABIERTO
    await client.query(
      `UPDATE periodo_academico
       SET estado = 'ABIERTO'
       WHERE id_periodo = $1 AND id_colegio = $2`,
      [periodId, schoolId]
    );

    // 4. Log in audit
    if (activeAuditoriaId) {
      const valorAntiguo = { estado: period.estado };
      const valorNuevo = { estado: 'ABIERTO' };
      await client.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'CONFIGURACION', 'MODIFICACION', 'Reapertura de periodo académico', $2, $3, $4, $5)`,
        [activeAuditoriaId, `Periodo ID: ${periodId} (${period.nombre})`, JSON.stringify(valorAntiguo), JSON.stringify(valorNuevo), motivo]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Periodo reabierto con éxito" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error reopening academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const updateAcademicPeriodPercentage = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.id);
  const schoolId = parseSchoolId(req.body.schoolId);
  const porcentaje = Number(req.body.porcentaje);
  const mesInicio = Number(req.body.mes_inicio);
  const diaInicio = Number(req.body.dia_inicio);
  const mesFin = Number(req.body.mes_fin);
  const diaFin = Number(req.body.dia_fin);
  const { motivo_cambio } = req.body;

  if (!periodId || !schoolId || Number.isNaN(porcentaje) || porcentaje <= 0 || !mesInicio || !diaInicio || !mesFin || !diaFin) {
    res.status(400).json({ error: "Todos los campos (porcentaje y rango de fechas) son obligatorios" });
    return;
  }

  if (diaInicio !== null && (!Number.isInteger(diaInicio) || diaInicio < 1 || diaInicio > 31)) {
    res.status(400).json({ error: "El día de inicio debe ser un número entre 1 y 31" });
    return;
  }

  if (diaFin !== null && (!Number.isInteger(diaFin) || diaFin < 1 || diaFin > 31)) {
    res.status(400).json({ error: "El día de fin debe ser un número entre 1 y 31" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get current period data
    const periodRes = await client.query(
      `SELECT id_periodo, nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, id_anio
       FROM periodo_academico
       WHERE id_periodo = $1 AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodRes.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const period = periodRes.rows[0];

    // Check if period is closed
    if (period.estado === 'CERRADO') {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `El periodo académico "${period.nombre}" se encuentra CERRADO institucionalmente. No es posible modificar su porcentaje ni fechas de vigencia sin antes reabrirlo formalmente.`
      });
      return;
    }

    // Get school year info for calendar type and status
    const yearRes = await client.query(
      `SELECT tipo_calendario, estado FROM anio_lectivo WHERE id_anio = $1 AND id_colegio = $2`,
      [period.id_anio, schoolId]
    );

    if (yearRes.rows[0]?.estado === 'CERRADO') {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: "El año lectivo se encuentra CERRADO. No es posible modificar la configuración de periodos en un ciclo escolar cerrado."
      });
      return;
    }

    const calendarType = yearRes.rows[0]?.tipo_calendario || 'A';

    // Validate ranges don't overlap with other periods
    const otherPeriodsRes = await client.query(
      `SELECT id_periodo, nombre, mes_inicio, dia_inicio, mes_fin, dia_fin, estado
       FROM periodo_academico
       WHERE id_colegio = $1 AND id_anio = $2 AND id_periodo != $3`,
      [schoolId, period.id_anio, periodId]
    );

    const getNormalizedDateVal = (month: number, day: number, calType: string) => {
      if (calType === 'B') {
        const normalizeMonth = (m: number) => m >= 8 ? m - 7 : m + 5;
        return normalizeMonth(month) * 100 + day;
      }
      return month * 100 + day;
    };

    const newStartVal = getNormalizedDateVal(mesInicio, diaInicio, calendarType);
    const newEndVal = getNormalizedDateVal(mesFin, diaFin, calendarType);

    if (newStartVal > newEndVal) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "La fecha de inicio no puede ser posterior a la fecha de fin" });
      return;
    }

    for (const other of otherPeriodsRes.rows) {
      if (other.mes_inicio && other.dia_inicio && other.mes_fin && other.dia_fin) {
        const otherStartVal = getNormalizedDateVal(other.mes_inicio, other.dia_inicio, calendarType);
        const otherEndVal = getNormalizedDateVal(other.mes_fin, other.dia_fin, calendarType);

        const overlap = !(newEndVal < otherStartVal || otherEndVal < newStartVal);
        if (overlap) {
          await client.query("ROLLBACK");
          res.status(409).json({
            error: `El rango de fechas se superpone con el periodo '${other.nombre}' (${other.dia_inicio}/${other.mes_inicio} - ${other.dia_fin}/${other.mes_fin})`
          });
          return;
        }
      }
    }

    // If pending state: "Un periodo en estado pendiente no puede tener un rango de fechas anterior al periodo actual"
    if (period.estado === 'PENDIENTE') {
      const activePeriodRes = await client.query(
        `SELECT id_periodo, nombre, mes_inicio, mes_fin, dia_inicio, dia_fin
         FROM periodo_academico
         WHERE id_colegio = $1 AND id_anio = $2 AND estado = 'ABIERTO' AND id_periodo != $3
         LIMIT 1`,
        [schoolId, period.id_anio, periodId]
      );

      if (activePeriodRes.rows.length > 0) {
        const active = activePeriodRes.rows[0];
        if (active.mes_fin && active.dia_fin) {
          const activeEndVal = getNormalizedDateVal(active.mes_fin, active.dia_fin, calendarType);
          if (newStartVal < activeEndVal) {
            await client.query("ROLLBACK");
            res.status(400).json({
              error: `Un periodo en estado Pendiente no puede tener un rango de fechas anterior al periodo actual (${active.nombre})`
            });
            return;
          }
        }
      }
    }

    // Validate percentage sum <= 100
    const totalsRes = await client.query(
      `SELECT COALESCE(SUM(porcentaje), 0)::numeric AS total
       FROM periodo_academico
       WHERE id_colegio = $1 AND id_anio = $2 AND id_periodo != $3`,
      [schoolId, period.id_anio, periodId]
    );
    const otherTotal = Number(totalsRes.rows[0].total);
    if (otherTotal + porcentaje > 100) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: `No es posible actualizar el porcentaje porque la suma de porcentajes excede 100%. Actual del resto de periodos: ${otherTotal}%`
      });
      return;
    }

    // Audit check (if in supervision mode)
    const authReq = req as AuthRequest;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    let activeAuditoriaId: number | null = null;
    
    if (isSupervision) {
      if (!motivo_cambio) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Se requiere justificar el cambio para registrar en la auditoría." });
        return;
      }
      const auditRes = await client.query(
        `SELECT id_auditoria 
         FROM auditoria_supervision 
         WHERE id_colegio = $1 AND id_admin_general = $2 AND estado_supervision = 'ACTIVA'`,
        [schoolId, authReq.user!.id]
      );
      if (auditRes.rows.length > 0) {
        activeAuditoriaId = auditRes.rows[0].id_auditoria;
      }
    }

    // Perform UPDATE
    const updated = await client.query(
      `UPDATE periodo_academico
       SET porcentaje = $1,
           mes_inicio = $2,
           dia_inicio = $3,
           mes_fin = $4,
           dia_fin = $5
       WHERE id_periodo = $6 AND id_colegio = $7
       RETURNING id_periodo, nombre, estado, porcentaje, mes_inicio, dia_inicio, mes_fin, dia_fin, id_anio`,
      [porcentaje, mesInicio, diaInicio, mesFin, diaFin, periodId, schoolId]
    );

    // Record in audit
    if (activeAuditoriaId) {
      const valorAntiguo = {
        porcentaje: period.porcentaje,
        mes_inicio: period.mes_inicio,
        dia_inicio: period.dia_inicio,
        mes_fin: period.mes_fin,
        dia_fin: period.dia_fin
      };
      const valorNuevo = {
        porcentaje: porcentaje,
        mes_inicio: mesInicio,
        dia_inicio: diaInicio,
        mes_fin: mesFin,
        dia_fin: diaFin
      };
      
      await client.query(
        `INSERT INTO auditoria_acciones_realizadas
         (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
         VALUES ($1, 'CONFIGURACION', 'MODIFICACION', 'Modificación de fechas y porcentaje de periodo académico', $2, $3, $4, $5)`,
        [activeAuditoriaId, `Periodo ID: ${periodId} (${period.nombre})`, JSON.stringify(valorAntiguo), JSON.stringify(valorNuevo), motivo_cambio]
      );
    }

    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error updating academic period percentage:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const getPeriodClosureDetails = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  const schoolId = parseSchoolId(req.params.schoolId);

  if (!periodId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const client = await pool.connect();
  try {
    const periodRes = await client.query(
      `SELECT nombre, estado FROM periodo_academico WHERE id_periodo = $1 AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodRes.rows.length === 0) {
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const query = `
      SELECT
        d.id_docente,
        u.nombre AS docente_nombre,
        u.email AS docente_email,
        dg.id_detallegrado,
        m.nombre AS materia_nombre,
        tg.nombre AS grado_nombre,
        s.nombre AS seccion_nombre,
        j.nombre AS jornada_nombre,
        COALESCE(cm.estado::VARCHAR, 'PENDIENTE') AS estado_cierre
      FROM docente d
      JOIN usuario u ON u.id_usuario = d.id_usuario
      JOIN detalle_grados dg ON dg.id_docente = d.id_docente
      JOIN materias m ON m.id_materia = dg.id_materia
      JOIN grupos g ON g.id_grupo = dg.id_grupo
      JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
      JOIN secciones s ON s.id_seccion = g.id_seccion
      JOIN jornada j ON j.id_jornada = g.id_jornada
      LEFT JOIN cierre_materia cm ON cm.id_detallegrado = dg.id_detallegrado AND cm.id_periodo = $1
      WHERE dg.id_colegio = $2
      ORDER BY u.nombre, m.nombre, tg.nombre
    `;
    const detailsRes = await client.query(query, [periodId, schoolId]);

    const teachersMap = new Map();
    detailsRes.rows.forEach(row => {
      if (!teachersMap.has(row.id_docente)) {
        teachersMap.set(row.id_docente, {
          id_docente: row.id_docente,
          docente_nombre: row.docente_nombre,
          docente_email: row.docente_email,
          asignaciones: [],
          total_asignaciones: 0,
          cerradas: 0,
        });
      }
      const teacher = teachersMap.get(row.id_docente);
      teacher.asignaciones.push({
        id_detallegrado: row.id_detallegrado,
        materia_nombre: row.materia_nombre,
        grado_nombre: row.grado_nombre,
        seccion_nombre: row.seccion_nombre,
        jornada_nombre: row.jornada_nombre,
        curso_nombre: `${row.grado_nombre} ${row.seccion_nombre}`,
        grado: `${row.grado_nombre} ${row.seccion_nombre} · ${row.jornada_nombre}`,
        estado: row.estado_cierre
      });
      teacher.total_asignaciones++;
      if (row.estado_cierre === 'CERRADO') {
        teacher.cerradas++;
      }
    });

    const teachers = Array.from(teachersMap.values());

    res.json({
      periodo: periodRes.rows[0],
      teachers
    });
  } catch (error: any) {
    console.error("Error fetching closure details:", error);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    client.release();
  }
};

export const reopenSubjectClosure = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  const detailGradeId = Number(req.params.detailGradeId);
  const schoolId = parseSchoolId(req.body.schoolId);

  if (!periodId || !detailGradeId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    // 1. Verify period is from the same school
    const periodCheck = await pool.query(
      `SELECT id_periodo
       FROM periodo_academico
       WHERE id_periodo = $1
         AND id_colegio = $2`,
      [periodId, schoolId]
    );

    if (periodCheck.rows.length === 0) {
      res.status(404).json({ error: "Periodo no encontrado o no es de tu colegio" });
      return;
    }

    // 2. Erase teacher closure history for this period & detail
    const deleted = await pool.query(
      `DELETE FROM cierre_materia
       WHERE id_detallegrado = $1
         AND id_periodo = $2`,
      [detailGradeId, periodId]
    );

    if (deleted.rowCount === 0) {
      res.status(404).json({ error: "La materia no estaba cerrada para este periodo" });
      return;
    }

    res.json({ message: "Desbloqueado con éxito de cierre" });
  } catch (error: any) {
    console.error("Error reopening subject closure:", error);
    res.status(500).json({ error: "Error en el servidor al deshacer cierre de materia" });
  }
};

