import { Request, Response } from "express";
import { db } from "../../config/kysely";
import { sql } from "kysely";
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

  try {
    const result = await db.transaction().execute(async (trx) => {
      // Validacion 3: No deben existir dos años lectivos con el mismo nombre
      const duplicateRes = await trx
        .selectFrom("anio_lectivo")
        .select("id_anio")
        .where("calendario", "=", calendarioInput)
        .where("id_colegio", "=", schoolId)
        .execute();

      if (duplicateRes.length > 0) {
        throw new Error(`DUPLICATE: Ya existe un año lectivo configurado con el nombre '${calendarioInput}' para este colegio.`);
      }

      // Validacion 4: Evitar que dos años lectivos se solapen en fechas
      const overlapRes = await trx
        .selectFrom("anio_lectivo")
        .select(["id_anio", "calendario", "fecha_inicio", "fecha_fin"])
        .where("id_colegio", "=", schoolId)
        .where("fecha_inicio", "is not", null)
        .where("fecha_fin", "is not", null)
        .where("fecha_inicio", "<=", effectiveFechaFin as any)
        .where("fecha_fin", ">=", effectiveFechaInicio as any)
        .execute();

      if (overlapRes.length > 0) {
        const overYear = overlapRes[0];
        const formatStart = overYear.fecha_inicio instanceof Date ? overYear.fecha_inicio.toISOString().split('T')[0] : overYear.fecha_inicio;
        const formatEnd = overYear.fecha_fin instanceof Date ? overYear.fecha_fin.toISOString().split('T')[0] : overYear.fecha_fin;
        throw new Error(`OVERLAP: El rango de fechas (${effectiveFechaInicio} a ${effectiveFechaFin}) se solapa con el año lectivo '${overYear.calendario}' (${formatStart} a ${formatEnd}).`);
      }

      // Validacion 1: No puede haber dos años lectivos activos.
      await trx
        .updateTable("anio_lectivo")
        .set({ estado: "CERRADO" })
        .where("id_colegio", "=", schoolId)
        .where("estado", "=", "ABIERTO")
        .execute();

      const createdYear = await trx
        .insertInto("anio_lectivo")
        .values({
          calendario: calendarioInput,
          id_colegio: schoolId,
          tipo_calendario: tipo_calendario,
          estado: "ABIERTO",
          fecha_inicio: effectiveFechaInicio as any,
          fecha_fin: effectiveFechaFin as any
        })
        .returning(["id_anio", "calendario", "tipo_calendario", "estado", "fecha_inicio", "fecha_fin"])
        .executeTakeFirstOrThrow();

      const newYearId = Number(createdYear.id_anio);

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

        await trx
          .insertInto("periodo_academico")
          .values({
            nombre: periodNames[i],
            estado: estadoP as any,
            porcentaje: "25.00",
            mes_inicio,
            dia_inicio,
            mes_fin,
            dia_fin,
            id_anio: newYearId,
            id_colegio: schoolId,
            trimestre: i + 1
          })
          .execute();
      }

      // Clear group directors for the school (clean slate for the new year)
      await trx
        .updateTable("grupos")
        .set({ id_docente: null })
        .where("id_colegio", "=", schoolId)
        .execute();

      const updatedPeriods = await trx
        .selectFrom("periodo_academico")
        .select(["id_periodo", "nombre", "estado", "porcentaje", "mes_inicio", "dia_inicio", "mes_fin", "dia_fin", "trimestre"])
        .where("id_anio", "=", newYearId)
        .where("id_colegio", "=", schoolId)
        .orderBy("id_periodo", "asc")
        .execute();

      return {
        createdYear,
        periods: updatedPeriods
      };
    });

    res.status(201).json({
      ...result.createdYear,
      periods: result.periods,
      message: `Año lectivo ${calendarioInput} creado correctamente. Sus 4 periodos se han acomodado automáticamente a las fechas (${effectiveFechaInicio} al ${effectiveFechaFin}).`
    });
  } catch (error: any) {
    if (error.message?.startsWith("DUPLICATE: ")) {
      res.status(409).json({ error: error.message.replace("DUPLICATE: ", "") });
      return;
    }
    if (error.message?.startsWith("OVERLAP: ")) {
      res.status(400).json({ error: error.message.replace("OVERLAP: ", "") });
      return;
    }
    console.error("Error al crear año lectivo:", error);
    res.status(500).json({ error: error.message || "Error al crear el año lectivo." });
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

  try {
    await ensureAcademicPeriodTrimesterColumn();
    await ensureAcademicPeriodDayColumns();
    await ensureAcademicPeriodPendingStatus();
    const finalYearId = targetYearId || await ensureAcademicYearForSchool(schoolId);

    const newPeriod = await db.transaction().execute(async (trx) => {
      // Get school year info for calendar type and date boundaries
      const yearRow = await trx
        .selectFrom("anio_lectivo")
        .select(["id_anio", "calendario", "tipo_calendario", "fecha_inicio", "fecha_fin", "estado"])
        .where("id_anio", "=", finalYearId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (yearRow && yearRow.estado === "CERRADO") {
        throw new Error(`YEAR_CLOSED: El año lectivo ${yearRow.calendario || ""} se encuentra CERRADO. No es posible crear periodos en un ciclo escolar cerrado.`);
      }
      const calendarType = yearRow?.tipo_calendario || "A";

      if (yearRow && yearRow.fecha_inicio && yearRow.fecha_fin) {
        const yearStart = new Date(yearRow.fecha_inicio);
        const yearEnd = new Date(yearRow.fecha_fin);
        
        const startYearNum = yearStart.getUTCFullYear();
        const endYearNum = yearEnd.getUTCFullYear();

        let pStartYear = startYearNum;
        if (calendarType === "B" && mesInicio < (yearStart.getUTCMonth() + 1)) {
          pStartYear = endYearNum;
        }
        const pStartDate = new Date(Date.UTC(pStartYear, mesInicio - 1, diaInicio));

        let pEndYear = startYearNum;
        if (calendarType === "B" && mesFin < (yearStart.getUTCMonth() + 1)) {
          pEndYear = endYearNum;
        }
        const pEndDate = new Date(Date.UTC(pEndYear, mesFin - 1, diaFin));

        if (pStartDate < yearStart || pEndDate > yearEnd) {
          const formatYStart = yearStart.toISOString().split("T")[0];
          const formatYEnd = yearEnd.toISOString().split("T")[0];
          throw new Error(`OUT_OF_BOUNDS: Las fechas del periodo no pueden estar fuera del rango de fechas del año lectivo (${formatYStart} al ${formatYEnd}).`);
        }
      }

      // Validate ranges don't overlap with other periods
      const otherPeriods = await trx
        .selectFrom("periodo_academico")
        .select(["id_periodo", "nombre", "mes_inicio", "dia_inicio", "mes_fin", "dia_fin"])
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", finalYearId)
        .execute();

      const getNormalizedDateVal = (month: number, day: number, calType: string) => {
        if (calType === "B") {
          const normalizeMonth = (m: number) => m >= 8 ? m - 7 : m + 5;
          return normalizeMonth(month) * 100 + day;
        }
        return month * 100 + day;
      };

      const newStartVal = getNormalizedDateVal(mesInicio, diaInicio, calendarType);
      const newEndVal = getNormalizedDateVal(mesFin, diaFin, calendarType);

      if (newStartVal > newEndVal) {
        throw new Error("DATE_ORDER: La fecha de inicio no puede ser posterior a la fecha de fin");
      }

      for (const other of otherPeriods) {
        if (other.mes_inicio && other.dia_inicio && other.mes_fin && other.dia_fin) {
          const otherStartVal = getNormalizedDateVal(other.mes_inicio, other.dia_inicio, calendarType);
          const otherEndVal = getNormalizedDateVal(other.mes_fin, other.dia_fin, calendarType);

          const overlap = !(newEndVal < otherStartVal || otherEndVal < newStartVal);
          if (overlap) {
            throw new Error(`OVERLAP: El rango de fechas se superpone con el periodo '${other.nombre}' (${other.dia_inicio}/${other.mes_inicio} - ${other.dia_fin}/${other.mes_fin})`);
          }
        }
      }

      // If pending state: "Un periodo en estado pendiente no puede tener un rango de fechas anterior al periodo actual"
      if (estado === "PENDIENTE") {
        const active = await trx
          .selectFrom("periodo_academico")
          .select(["id_periodo", "nombre", "mes_inicio", "mes_fin", "dia_inicio", "dia_fin"])
          .where("id_colegio", "=", schoolId)
          .where("id_anio", "=", finalYearId)
          .where("estado", "=", "ABIERTO")
          .limit(1)
          .executeTakeFirst();

        if (active && active.mes_fin && active.dia_fin) {
          const activeEndVal = getNormalizedDateVal(active.mes_fin, active.dia_fin, calendarType);
          if (newStartVal < activeEndVal) {
            throw new Error(`PENDING_DATE: Un periodo en estado Pendiente no puede tener un rango de fechas anterior al periodo actual (${active.nombre})`);
          }
        }
      }

      const totalsRes = await trx
        .selectFrom("periodo_academico")
        .select(sql<string | number>`COALESCE(SUM(porcentaje), 0)`.as("total"))
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", finalYearId)
        .executeTakeFirst();

      const currentTotal = Number(totalsRes?.total || 0);
      if (currentTotal + porcentaje > 100) {
        throw new Error(`EXCEEDS_100: No es posible crear el periodo porque la suma de porcentajes excede 100%. Actual: ${currentTotal}%`);
      }

      const duplicateRes = await trx
        .selectFrom("periodo_academico")
        .select("id_periodo")
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", finalYearId)
        .where(sql`UPPER(TRIM(nombre))`, "=", nombre.trim().toUpperCase())
        .execute();

      if (duplicateRes.length > 0) {
        throw new Error("DUPLICATE_NAME: Ya existe un periodo académico con ese nombre en este año");
      }

      // Determine the next trimestre number
      const maxTrimestreRes = await trx
        .selectFrom("periodo_academico")
        .select(sql<number>`COALESCE(MAX(trimestre), 0)`.as("max_trim"))
        .where("id_colegio", "=", schoolId)
        .where("id_anio", "=", finalYearId)
        .executeTakeFirst();

      const nextTrimestre = Number(maxTrimestreRes?.max_trim || 0) + 1;

      const created = await trx
        .insertInto("periodo_academico")
        .values({
          nombre,
          estado: estado as any,
          porcentaje: String(porcentaje),
          mes_inicio: mesInicio,
          dia_inicio: diaInicio,
          mes_fin: mesFin,
          dia_fin: diaFin,
          id_anio: finalYearId,
          id_colegio: schoolId,
          trimestre: nextTrimestre
        })
        .returning(["id_periodo", "nombre", "estado", "porcentaje", "mes_inicio", "dia_inicio", "mes_fin", "dia_fin", "id_anio", "trimestre"])
        .executeTakeFirstOrThrow();

      // Audit check (if in supervision mode)
      const authReq = req as AuthRequest;
      const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
      let activeAuditoriaId: number | null = null;
      
      if (isSupervision) {
        const auditRes = await trx
          .selectFrom("auditoria_supervision")
          .select("id_auditoria")
          .where("id_colegio", "=", schoolId)
          .where("id_admin_general", "=", authReq.user!.id)
          .where("estado_supervision", "=", "ACTIVA")
          .executeTakeFirst();
        if (auditRes) {
          activeAuditoriaId = auditRes.id_auditoria;
        }
      }

      if (activeAuditoriaId) {
        await trx
          .insertInto("auditoria_acciones_realizadas")
          .values({
            id_auditoria: activeAuditoriaId,
            modulo: "CONFIGURACION",
            tipo_accion: "CREACION",
            accion: "Creación de periodo académico",
            recurso_afectado: `Periodo ID: ${created.id_periodo} (${nombre})`,
            valor_antiguo: null,
            valor_nuevo: JSON.stringify(created),
            motivo_cambio: motivo_cambio || "Creación inicial"
          })
          .execute();
      }

      return created;
    });

    res.status(201).json(newPeriod);
  } catch (error: any) {
    if (error.message?.startsWith("YEAR_CLOSED: ")) {
      res.status(400).json({ error: error.message.replace("YEAR_CLOSED: ", "") });
      return;
    }
    if (error.message?.startsWith("OUT_OF_BOUNDS: ")) {
      res.status(400).json({ error: error.message.replace("OUT_OF_BOUNDS: ", "") });
      return;
    }
    if (error.message?.startsWith("DATE_ORDER: ")) {
      res.status(400).json({ error: error.message.replace("DATE_ORDER: ", "") });
      return;
    }
    if (error.message?.startsWith("OVERLAP: ")) {
      res.status(409).json({ error: error.message.replace("OVERLAP: ", "") });
      return;
    }
    if (error.message?.startsWith("PENDING_DATE: ")) {
      res.status(400).json({ error: error.message.replace("PENDING_DATE: ", "") });
      return;
    }
    if (error.message?.startsWith("EXCEEDS_100: ")) {
      res.status(409).json({ error: error.message.replace("EXCEEDS_100: ", "") });
      return;
    }
    if (error.message?.startsWith("DUPLICATE_NAME: ")) {
      res.status(409).json({ error: error.message.replace("DUPLICATE_NAME: ", "") });
      return;
    }
    console.error("Error creating academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
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

  try {
    await db.transaction().execute(async (trx) => {
      // 1. Get current period
      const period = await trx
        .selectFrom("periodo_academico")
        .select(["id_periodo", "nombre", "estado", "id_anio", "trimestre"])
        .where("id_periodo", "=", periodId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!period) {
        throw new Error("NOT_FOUND: Periodo académico no encontrado");
      }

      if (period.id_anio) {
        const yearCheck = await trx
          .selectFrom("anio_lectivo")
          .select(["estado", "calendario"])
          .where("id_anio", "=", period.id_anio)
          .where("id_colegio", "=", schoolId)
          .executeTakeFirst();

        if (yearCheck?.estado === "CERRADO") {
          throw new Error(`YEAR_CLOSED: El año lectivo ${yearCheck?.calendario || ""} se encuentra CERRADO. No es posible aprobar periodos en un ciclo escolar cerrado.`);
        }
      }

      if (period.estado !== "PENDIENTE") {
        throw new Error("NOT_PENDING: Solo se pueden activar periodos en estado Pendiente.");
      }

      // 2. Validate previous period is Closed
      if (period.trimestre && period.id_anio) {
        const prev = await trx
          .selectFrom("periodo_academico")
          .select(["id_periodo", "nombre", "estado"])
          .where("id_colegio", "=", schoolId)
          .where("id_anio", "=", period.id_anio)
          .where("trimestre", "<", period.trimestre)
          .orderBy("trimestre", "desc")
          .limit(1)
          .executeTakeFirst();

        if (prev && prev.estado !== "CERRADO") {
          throw new Error(`PREV_NOT_CLOSED: El periodo anterior (${prev.nombre}) debe estar Cerrado para activar este periodo.`);
        }
      }

      // 3. Audit check (if in supervision mode)
      const authReq = req as AuthRequest;
      const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
      let activeAuditoriaId: number | null = null;
      
      if (isSupervision) {
        if (!motivo_cambio) {
          throw new Error("MOTIVO_REQUIRED: Se requiere justificar el cambio para registrar en la auditoría.");
        }
        const auditRes = await trx
          .selectFrom("auditoria_supervision")
          .select("id_auditoria")
          .where("id_colegio", "=", schoolId)
          .where("id_admin_general", "=", authReq.user!.id)
          .where("estado_supervision", "=", "ACTIVA")
          .executeTakeFirst();
        if (auditRes) {
          activeAuditoriaId = auditRes.id_auditoria;
        }
      }

      // 5. Activate this period
      await trx
        .updateTable("periodo_academico")
        .set({ estado: "ABIERTO" })
        .where("id_periodo", "=", periodId)
        .where("id_colegio", "=", schoolId)
        .execute();

      // 6. Record in audit
      if (activeAuditoriaId) {
        const valorAntiguo = { estado: period.estado };
        const valorNuevo = { estado: "ABIERTO" };
        await trx
          .insertInto("auditoria_acciones_realizadas")
          .values({
            id_auditoria: activeAuditoriaId,
            modulo: "CONFIGURACION",
            tipo_accion: "MODIFICACION",
            accion: "Aprobación y activación de periodo académico",
            recurso_afectado: `Periodo ID: ${periodId} (${period.nombre})`,
            valor_antiguo: JSON.stringify(valorAntiguo),
            valor_nuevo: JSON.stringify(valorNuevo),
            motivo_cambio: motivo_cambio
          })
          .execute();
      }
    });

    res.json({ message: "Periodo académico aprobado y activado con éxito", id_periodo: periodId, estado: "ABIERTO" });
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND: ")) {
      res.status(404).json({ error: error.message.replace("NOT_FOUND: ", "") });
      return;
    }
    if (error.message?.startsWith("YEAR_CLOSED: ")) {
      res.status(400).json({ error: error.message.replace("YEAR_CLOSED: ", "") });
      return;
    }
    if (error.message?.startsWith("NOT_PENDING: ")) {
      res.status(409).json({ error: error.message.replace("NOT_PENDING: ", "") });
      return;
    }
    if (error.message?.startsWith("PREV_NOT_CLOSED: ")) {
      res.status(409).json({ error: error.message.replace("PREV_NOT_CLOSED: ", "") });
      return;
    }
    if (error.message?.startsWith("MOTIVO_REQUIRED: ")) {
      res.status(400).json({ error: error.message.replace("MOTIVO_REQUIRED: ", "") });
      return;
    }
    console.error("Error approving academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
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

  try {
    const result = await db.transaction().execute(async (trx) => {
      const period = await trx
        .selectFrom("periodo_academico")
        .select(["id_periodo", "nombre", "estado", "id_anio"])
        .where("id_periodo", "=", periodId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!period) {
        throw new Error("NOT_FOUND: Periodo académico no encontrado");
      }

      if (period.id_anio) {
        const yearCheck = await trx
          .selectFrom("anio_lectivo")
          .select(["estado", "calendario"])
          .where("id_anio", "=", period.id_anio)
          .where("id_colegio", "=", schoolId)
          .executeTakeFirst();

        if (yearCheck?.estado === "CERRADO") {
          throw new Error(`YEAR_CLOSED: El año lectivo ${yearCheck?.calendario || ""} ya se encuentra CERRADO.`);
        }
      }

      if (period.estado === "PENDIENTE") {
        throw new Error("PENDING: Un periodo en estado Pendiente no se puede cerrar directamente. Debe ser aprobado primero.");
      }

      const assignments = await trx
        .selectFrom("detalle_grados as dg")
        .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
        .innerJoin("grupos as g", "g.id_grupo", "dg.id_grupo")
        .innerJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
        .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
        .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
        .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
        .select([
          "dg.id_detallegrado",
          "m.nombre as materia_nombre",
          "ne.nombre as nivel_nombre",
          "tg.nombre as tipo_grado_nombre",
          "s.nombre as seccion_nombre",
          "j.nombre as jornada_nombre"
        ])
        .where("dg.id_colegio", "=", schoolId)
        .where("dg.id_grupo", "is not", null)
        .execute();

      const closedRes = await trx
        .selectFrom("cierre_materia")
        .select("id_detallegrado")
        .where("id_periodo", "=", periodId)
        .where("estado", "=", "CERRADO")
        .execute();

      const closedIds = new Set(closedRes.map((row) => Number(row.id_detallegrado)));
      const pending = assignments.filter((row) => !closedIds.has(Number(row.id_detallegrado)));

      if (pending.length > 0 && !force) {
        const err: any = new Error("PENDING_ASSIGNMENTS");
        err.pending = pending;
        throw err;
      }

      if (force && pending.length > 0) {
        for (const row of pending) {
          const existing = await trx
            .selectFrom("cierre_materia")
            .select("id_cierremateria")
            .where("id_detallegrado", "=", row.id_detallegrado)
            .where("id_periodo", "=", periodId)
            .executeTakeFirst();

          if (!existing) {
            await trx
              .insertInto("cierre_materia")
              .values({
                id_detallegrado: row.id_detallegrado,
                id_periodo: periodId,
                estado: "CERRADO",
                fecha_cierre: new Date()
              })
              .execute();
          }
        }
      }

      await trx
        .updateTable("periodo_academico")
        .set({ estado: "CERRADO" })
        .where("id_periodo", "=", periodId)
        .where("id_colegio", "=", schoolId)
        .execute();

      return { pendingCount: pending.length };
    });

    res.json({
      message: force ? "Periodo cerrado con cierre forzado" : "Periodo cerrado correctamente",
      pendingResolved: result.pendingCount
    });
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND: ")) {
      res.status(404).json({ error: error.message.replace("NOT_FOUND: ", "") });
      return;
    }
    if (error.message?.startsWith("YEAR_CLOSED: ")) {
      res.status(400).json({ error: error.message.replace("YEAR_CLOSED: ", "") });
      return;
    }
    if (error.message?.startsWith("PENDING: ")) {
      res.status(409).json({ error: error.message.replace("PENDING: ", "") });
      return;
    }
    if (error.message === "PENDING_ASSIGNMENTS") {
      res.status(409).json({
        error: "No se puede cerrar el periodo porque hay asignaciones pendientes",
        pending: error.pending
      });
      return;
    }
    console.error("Error closing academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
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

  try {
    await db.transaction().execute(async (trx) => {
      // 1. Get current period
      const period = await trx
        .selectFrom("periodo_academico")
        .select(["id_periodo", "nombre", "estado", "id_anio"])
        .where("id_periodo", "=", periodId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!period) {
        throw new Error("NOT_FOUND: Periodo no encontrado");
      }

      if (period.id_anio) {
        const yearCheck = await trx
          .selectFrom("anio_lectivo")
          .select(["estado", "calendario"])
          .where("id_anio", "=", period.id_anio)
          .where("id_colegio", "=", schoolId)
          .executeTakeFirst();

        if (yearCheck?.estado === "CERRADO") {
          throw new Error(`YEAR_CLOSED: El año lectivo ${yearCheck?.calendario || ""} se encuentra CERRADO. Debe reabrir el año lectivo antes de reabrir sus periodos individuales.`);
        }
      }

      if (period.estado !== "CERRADO") {
        throw new Error("NOT_CLOSED: Solo se pueden reabrir periodos en estado Cerrado.");
      }

      // 2. Audit check
      const authReq = req as AuthRequest;
      const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
      let activeAuditoriaId: number | null = null;
      
      if (isSupervision) {
        const auditRes = await trx
          .selectFrom("auditoria_supervision")
          .select("id_auditoria")
          .where("id_colegio", "=", schoolId)
          .where("id_admin_general", "=", authReq.user!.id)
          .where("estado_supervision", "=", "ACTIVA")
          .executeTakeFirst();
        if (auditRes) {
          activeAuditoriaId = auditRes.id_auditoria;
        }
      }

      // 3. Update period state to ABIERTO
      await trx
        .updateTable("periodo_academico")
        .set({ estado: "ABIERTO" })
        .where("id_periodo", "=", periodId)
        .where("id_colegio", "=", schoolId)
        .execute();

      // 4. Log in audit
      if (activeAuditoriaId) {
        const valorAntiguo = { estado: period.estado };
        const valorNuevo = { estado: "ABIERTO" };
        await trx
          .insertInto("auditoria_acciones_realizadas")
          .values({
            id_auditoria: activeAuditoriaId,
            modulo: "CONFIGURACION",
            tipo_accion: "MODIFICACION",
            accion: "Reapertura de periodo académico",
            recurso_afectado: `Periodo ID: ${periodId} (${period.nombre})`,
            valor_antiguo: JSON.stringify(valorAntiguo),
            valor_nuevo: JSON.stringify(valorNuevo),
            motivo_cambio: motivo
          })
          .execute();
      }
    });

    res.json({ message: "Periodo reabierto con éxito" });
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND: ")) {
      res.status(404).json({ error: error.message.replace("NOT_FOUND: ", "") });
      return;
    }
    if (error.message?.startsWith("YEAR_CLOSED: ")) {
      res.status(400).json({ error: error.message.replace("YEAR_CLOSED: ", "") });
      return;
    }
    if (error.message?.startsWith("NOT_CLOSED: ")) {
      res.status(409).json({ error: error.message.replace("NOT_CLOSED: ", "") });
      return;
    }
    console.error("Error reopening academic period:", error);
    res.status(500).json({ error: "Error en el servidor" });
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

  try {
    const updated = await db.transaction().execute(async (trx) => {
      // Get current period data
      const period = await trx
        .selectFrom("periodo_academico")
        .select(["id_periodo", "nombre", "estado", "porcentaje", "mes_inicio", "dia_inicio", "mes_fin", "dia_fin", "id_anio"])
        .where("id_periodo", "=", periodId)
        .where("id_colegio", "=", schoolId)
        .executeTakeFirst();

      if (!period) {
        throw new Error("NOT_FOUND: Periodo académico no encontrado");
      }

      // Check if period is closed
      if (period.estado === "CERRADO") {
        throw new Error(`PERIOD_CLOSED: El periodo académico "${period.nombre}" se encuentra CERRADO institucionalmente. No es posible modificar su porcentaje ni fechas de vigencia sin antes reabrirlo formalmente.`);
      }

      if (period.id_anio) {
        // Get school year info for calendar type and status
        const yearRow = await trx
          .selectFrom("anio_lectivo")
          .select(["tipo_calendario", "estado"])
          .where("id_anio", "=", period.id_anio)
          .where("id_colegio", "=", schoolId)
          .executeTakeFirst();

        if (yearRow?.estado === "CERRADO") {
          throw new Error("YEAR_CLOSED: El año lectivo se encuentra CERRADO. No es posible modificar la configuración de periodos en un ciclo escolar cerrado.");
        }

        const calendarType = yearRow?.tipo_calendario || "A";

        // Validate ranges don't overlap with other periods
        const otherPeriods = await trx
          .selectFrom("periodo_academico")
          .select(["id_periodo", "nombre", "mes_inicio", "dia_inicio", "mes_fin", "dia_fin", "estado"])
          .where("id_colegio", "=", schoolId)
          .where("id_anio", "=", period.id_anio)
          .where("id_periodo", "!=", periodId)
          .execute();

        const getNormalizedDateVal = (month: number, day: number, calType: string) => {
          if (calType === "B") {
            const normalizeMonth = (m: number) => m >= 8 ? m - 7 : m + 5;
            return normalizeMonth(month) * 100 + day;
          }
          return month * 100 + day;
        };

        const newStartVal = getNormalizedDateVal(mesInicio, diaInicio, calendarType);
        const newEndVal = getNormalizedDateVal(mesFin, diaFin, calendarType);

        if (newStartVal > newEndVal) {
          throw new Error("DATE_ORDER: La fecha de inicio no puede ser posterior a la fecha de fin");
        }

        for (const other of otherPeriods) {
          if (other.mes_inicio && other.dia_inicio && other.mes_fin && other.dia_fin) {
            const otherStartVal = getNormalizedDateVal(other.mes_inicio, other.dia_inicio, calendarType);
            const otherEndVal = getNormalizedDateVal(other.mes_fin, other.dia_fin, calendarType);

            const overlap = !(newEndVal < otherStartVal || otherEndVal < newStartVal);
            if (overlap) {
              throw new Error(`OVERLAP: El rango de fechas se superpone con el periodo '${other.nombre}' (${other.dia_inicio}/${other.mes_inicio} - ${other.dia_fin}/${other.mes_fin})`);
            }
          }
        }

        // If pending state: "Un periodo en estado pendiente no puede tener un rango de fechas anterior al periodo actual"
        if (period.estado === "PENDIENTE") {
          const active = await trx
            .selectFrom("periodo_academico")
            .select(["id_periodo", "nombre", "mes_inicio", "mes_fin", "dia_inicio", "dia_fin"])
            .where("id_colegio", "=", schoolId)
            .where("id_anio", "=", period.id_anio)
            .where("estado", "=", "ABIERTO")
            .where("id_periodo", "!=", periodId)
            .limit(1)
            .executeTakeFirst();

          if (active && active.mes_fin && active.dia_fin) {
            const activeEndVal = getNormalizedDateVal(active.mes_fin, active.dia_fin, calendarType);
            if (newStartVal < activeEndVal) {
              throw new Error(`PENDING_DATE: Un periodo en estado Pendiente no puede tener un rango de fechas anterior al periodo actual (${active.nombre})`);
            }
          }
        }

        // Validate percentage sum <= 100
        const totalsRes = await trx
          .selectFrom("periodo_academico")
          .select(sql<string | number>`COALESCE(SUM(porcentaje), 0)`.as("total"))
          .where("id_colegio", "=", schoolId)
          .where("id_anio", "=", period.id_anio)
          .where("id_periodo", "!=", periodId)
          .executeTakeFirst();

        const otherTotal = Number(totalsRes?.total || 0);
        if (otherTotal + porcentaje > 100) {
          throw new Error(`EXCEEDS_100: No es posible actualizar el porcentaje porque la suma de porcentajes excede 100%. Actual del resto de periodos: ${otherTotal}%`);
        }
      }

      // Audit check (if in supervision mode)
      const authReq = req as AuthRequest;
      const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
      let activeAuditoriaId: number | null = null;
      
      if (isSupervision) {
        if (!motivo_cambio) {
          throw new Error("MOTIVO_REQUIRED: Se requiere justificar el cambio para registrar en la auditoría.");
        }
        const auditRes = await trx
          .selectFrom("auditoria_supervision")
          .select("id_auditoria")
          .where("id_colegio", "=", schoolId)
          .where("id_admin_general", "=", authReq.user!.id)
          .where("estado_supervision", "=", "ACTIVA")
          .executeTakeFirst();
        if (auditRes) {
          activeAuditoriaId = auditRes.id_auditoria;
        }
      }

      // Perform UPDATE
      const updatedPeriod = await trx
        .updateTable("periodo_academico")
        .set({
          porcentaje: String(porcentaje),
          mes_inicio: mesInicio,
          dia_inicio: diaInicio,
          mes_fin: mesFin,
          dia_fin: diaFin
        })
        .where("id_periodo", "=", periodId)
        .where("id_colegio", "=", schoolId)
        .returning(["id_periodo", "nombre", "estado", "porcentaje", "mes_inicio", "dia_inicio", "mes_fin", "dia_fin", "id_anio"])
        .executeTakeFirstOrThrow();

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
        
        await trx
          .insertInto("auditoria_acciones_realizadas")
          .values({
            id_auditoria: activeAuditoriaId,
            modulo: "CONFIGURACION",
            tipo_accion: "MODIFICACION",
            accion: "Modificación de fechas y porcentaje de periodo académico",
            recurso_afectado: `Periodo ID: ${periodId} (${period.nombre})`,
            valor_antiguo: JSON.stringify(valorAntiguo),
            valor_nuevo: JSON.stringify(valorNuevo),
            motivo_cambio: motivo_cambio
          })
          .execute();
      }

      return updatedPeriod;
    });

    res.json(updated);
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND: ")) {
      res.status(404).json({ error: error.message.replace("NOT_FOUND: ", "") });
      return;
    }
    if (error.message?.startsWith("PERIOD_CLOSED: ")) {
      res.status(400).json({ error: error.message.replace("PERIOD_CLOSED: ", "") });
      return;
    }
    if (error.message?.startsWith("YEAR_CLOSED: ")) {
      res.status(400).json({ error: error.message.replace("YEAR_CLOSED: ", "") });
      return;
    }
    if (error.message?.startsWith("DATE_ORDER: ")) {
      res.status(400).json({ error: error.message.replace("DATE_ORDER: ", "") });
      return;
    }
    if (error.message?.startsWith("OVERLAP: ")) {
      res.status(409).json({ error: error.message.replace("OVERLAP: ", "") });
      return;
    }
    if (error.message?.startsWith("PENDING_DATE: ")) {
      res.status(400).json({ error: error.message.replace("PENDING_DATE: ", "") });
      return;
    }
    if (error.message?.startsWith("EXCEEDS_100: ")) {
      res.status(409).json({ error: error.message.replace("EXCEEDS_100: ", "") });
      return;
    }
    if (error.message?.startsWith("MOTIVO_REQUIRED: ")) {
      res.status(400).json({ error: error.message.replace("MOTIVO_REQUIRED: ", "") });
      return;
    }
    console.error("Error updating academic period percentage:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

export const getPeriodClosureDetails = async (req: Request, res: Response): Promise<void> => {
  const periodId = Number(req.params.periodId);
  const schoolId = parseSchoolId(req.params.schoolId);

  if (!periodId || !schoolId) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  try {
    const period = await db
      .selectFrom("periodo_academico")
      .select(["nombre", "estado"])
      .where("id_periodo", "=", periodId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!period) {
      res.status(404).json({ error: "Periodo académico no encontrado" });
      return;
    }

    const details = await db
      .selectFrom("docente as d")
      .innerJoin("usuario as u", "u.id_usuario", "d.id_usuario")
      .innerJoin("detalle_grados as dg", "dg.id_docente", "d.id_docente")
      .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
      .innerJoin("grupos as g", "g.id_grupo", "dg.id_grupo")
      .innerJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .innerJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .innerJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .leftJoin("cierre_materia as cm", (join) =>
        join
          .onRef("cm.id_detallegrado", "=", "dg.id_detallegrado")
          .on("cm.id_periodo", "=", periodId)
      )
      .select([
        "d.id_docente",
        "u.nombre as docente_nombre",
        "u.email as docente_email",
        "dg.id_detallegrado",
        "m.nombre as materia_nombre",
        "tg.nombre as grado_nombre",
        "s.nombre as seccion_nombre",
        "j.nombre as jornada_nombre",
        sql<string>`COALESCE(cm.estado::VARCHAR, 'PENDIENTE')`.as("estado_cierre")
      ])
      .where("dg.id_colegio", "=", schoolId)
      .orderBy("u.nombre", "asc")
      .orderBy("m.nombre", "asc")
      .orderBy("tg.nombre", "asc")
      .execute();

    const teachersMap = new Map();
    details.forEach((row: any) => {
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
      if (row.estado_cierre === "CERRADO") {
        teacher.cerradas++;
      }
    });

    const teachers = Array.from(teachersMap.values());

    res.json({
      periodo: period,
      teachers
    });
  } catch (error: any) {
    console.error("Error fetching closure details:", error);
    res.status(500).json({ error: "Error en el servidor" });
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
    // 1. Verify period is from the same school and academic year is open
    const periodCheck = await db
      .selectFrom("periodo_academico as p")
      .innerJoin("anio_lectivo as a", "a.id_anio", "p.id_anio")
      .select(["p.id_periodo", "p.id_anio", "a.estado as anio_estado", "a.calendario"])
      .where("p.id_periodo", "=", periodId)
      .where("p.id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!periodCheck) {
      res.status(404).json({ error: "Periodo no encontrado o no es de tu colegio" });
      return;
    }

    if (periodCheck.anio_estado === "CERRADO") {
      res.status(400).json({ error: `El año lectivo ${periodCheck.calendario || ""} se encuentra CERRADO. No es posible modificar ni reabrir materias en un ciclo escolar cerrado.` });
      return;
    }

    // 2. Erase teacher closure history for this period & detail
    const deleted = await db
      .deleteFrom("cierre_materia")
      .where("id_detallegrado", "=", detailGradeId)
      .where("id_periodo", "=", periodId)
      .executeTakeFirst();

    if (Number(deleted.numDeletedRows || 0) === 0) {
      res.status(404).json({ error: "La materia no estaba cerrada para este periodo" });
      return;
    }

    res.json({ message: "Desbloqueado con éxito de cierre" });
  } catch (error: any) {
    console.error("Error reopening subject closure:", error);
    res.status(500).json({ error: "Error en el servidor al deshacer cierre de materia" });
  }
};

