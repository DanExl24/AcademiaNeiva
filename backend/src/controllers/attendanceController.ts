import { Request, Response } from "express";
import { db } from "../config/kysely";
import { sql } from "kysely";

// Helper to check if period/class is editable
const checkEditability = async (
  detailGradeId: number,
  schoolId: number
): Promise<{ editable: boolean; error?: string; periodId?: number }> => {
  // 1. Get open period in open academic year
  const periodRow = await db
    .selectFrom("periodo_academico as pa")
    .innerJoin("anio_lectivo as al", "al.id_anio", "pa.id_anio")
    .select(["pa.id_periodo", "pa.nombre"])
    .where("pa.id_colegio", "=", schoolId)
    .where("pa.estado", "=", "ABIERTO")
    .where("al.estado", "=", "ABIERTO")
    .limit(1)
    .executeTakeFirst();

  if (!periodRow) {
    return { editable: false, error: "No hay un periodo académico y año lectivo abierto para esta institución." };
  }

  const periodId = periodRow.id_periodo;

  // 2. Check if teaching assignment is closed
  const closureRow = await db
    .selectFrom("cierre_materia")
    .select("estado")
    .where("id_detallegrado", "=", detailGradeId)
    .where("id_periodo", "=", periodId)
    .executeTakeFirst();

  if (closureRow && closureRow.estado === "CERRADO") {
    return {
      editable: false,
      error: "El docente ya marcó como completado el registro académico para esta materia en este periodo.",
      periodId,
    };
  }

  return { editable: true, periodId };
};

// GET /api/teacher/attendance/:detailGradeId/:date
export const getAttendanceByDate = async (req: Request, res: Response): Promise<void> => {
  const detailGradeId = Number(req.params.detailGradeId);
  const dateStr = req.params.date;
  console.log(`[DEV] getAttendanceByDate called - detailGradeId=${detailGradeId}, date=${dateStr}`);

  try {
    // Get school id from teaching assignment
    const dgRow = await db
      .selectFrom("detalle_grados")
      .select(["id_colegio", "id_grupo"])
      .where("id_detallegrado", "=", detailGradeId)
      .executeTakeFirst();

    if (!dgRow) {
      res.status(404).json({ error: "Asignación académica no encontrada" });
      return;
    }

    const { id_colegio, id_grupo } = dgRow;

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== id_colegio) {
      res.status(403).json({ error: "No tiene permiso para ver las asistencias de este colegio." });
      return;
    }

    // Check if editable
    const editCheck = await checkEditability(detailGradeId, id_colegio);

    // Past days restriction
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const isToday = dateStr === todayStr;
    const editable = editCheck.editable && isToday;
    const errorReason = !isToday
      ? "No está permitido registrar o editar asistencias de fechas anteriores. Solo lectura habilitada."
      : editCheck.error;

    // Get all students enrolled in this group/grade
    const studentsRows = await db
      .selectFrom("estudiante as e")
      .leftJoin("usuario as u", "e.id_usuario", "u.id_usuario")
      .innerJoin("matricula as m", "e.id_estudiante", "m.id_estudiante")
      .select(["e.id_estudiante", "e.nombre", "e.apellido", "u.documento", "e.codigo"])
      .where("m.id_grupo", "=", id_grupo)
      .where("m.estado", "in", ["ACTIVA", "APROBADA"])
      .orderBy("e.apellido", "asc")
      .orderBy("e.nombre", "asc")
      .execute();

    // Get attendance records for this date (including justificacion and hora_llegada)
    const attendanceRows = await db
      .selectFrom("registro_asistencia")
      .select([
        "id_estudiante",
        "estado",
        "justificacion",
        sql<string>`TO_CHAR(hora_llegada, 'HH24:MI')`.as("hora_llegada"),
      ])
      .where("id_detallegrado", "=", detailGradeId)
      .where(sql<boolean>`fecha::date = ${dateStr}::date`)
      .execute();

    const attendanceMap = new Map<
      number,
      { estado: string; justificacion: string | null; hora_llegada: string | null }
    >();
    attendanceRows.forEach((r) => {
      attendanceMap.set(Number(r.id_estudiante), {
        estado: r.estado,
        justificacion: r.justificacion || null,
        hora_llegada: r.hora_llegada || null,
      });
    });

    const studentsWithAttendance = studentsRows.map((s) => {
      const att = attendanceMap.get(Number(s.id_estudiante));
      return {
        id_estudiante: s.id_estudiante,
        nombre: `${s.nombre} ${s.apellido}`,
        documento: s.documento,
        codigo: s.codigo,
        estado: att ? att.estado : null,
        justificacion: att ? att.justificacion : null,
        hora_llegada: att ? att.hora_llegada : null,
      };
    });

    console.log(
      `[DEV] getAttendanceByDate - id_grupo=${id_grupo}, editable=${editable}, students=${studentsRows.length}`
    );
    res.json({
      editable,
      error: errorReason,
      periodId: editCheck.periodId,
      students: studentsWithAttendance,
    });
  } catch (error: any) {
    console.error(
      `[DEV] getAttendanceByDate ERROR - detailGradeId=${detailGradeId}, date=${dateStr}:`,
      error.message,
      error.detail || ""
    );
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// POST /api/teacher/attendance
export const saveAttendance = async (req: Request, res: Response): Promise<void> => {
  const { detailGradeId, date, records } = req.body;
  console.log(
    `[DEV] saveAttendance called - detailGradeId=${detailGradeId}, date=${date}, records=${Array.isArray(records) ? records.length : "invalid"}`
  );

  if (!detailGradeId || !date || !Array.isArray(records)) {
    res.status(400).json({ error: "Parámetros inválidos" });
    return;
  }

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  if (date !== todayStr) {
    res.status(409).json({ error: "No está permitido registrar o modificar la asistencia de días pasados." });
    return;
  }

  try {
    const dgRow = await db
      .selectFrom("detalle_grados")
      .select("id_colegio")
      .where("id_detallegrado", "=", detailGradeId)
      .executeTakeFirst();

    if (!dgRow) {
      res.status(404).json({ error: "Asignación académica no encontrada" });
      return;
    }

    const schoolId = dgRow.id_colegio;

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
      res.status(403).json({ error: "No tiene permiso para registrar asistencias en este colegio." });
      return;
    }

    // Validate editability
    const editCheck = await checkEditability(detailGradeId, schoolId);
    if (!editCheck.editable) {
      res.status(409).json({ error: editCheck.error });
      return;
    }

    await db.transaction().execute(async (trx) => {
      // 2.5. Validar que todos los estudiantes a registrar tengan matrícula ACTIVA en el colegio
      const studentIds = records
        .map((r: any) => Number(r.id_estudiante))
        .filter((id: number) => !isNaN(id) && id > 0);

      if (studentIds.length > 0) {
        const activeEnrollments = await trx
          .selectFrom("matricula")
          .select("id_estudiante")
          .where("id_estudiante", "in", studentIds)
          .where("id_colegio", "=", schoolId)
          .where("estado", "in", ["ACTIVA", "APROBADA"])
          .execute();

        const activeSet = new Set(activeEnrollments.map((r) => Number(r.id_estudiante)));
        const invalidStudents = studentIds.filter((id: number) => !activeSet.has(id));

        if (invalidStudents.length > 0) {
          const namesRes = await trx
            .selectFrom("estudiante")
            .select(["nombre", "apellido"])
            .where("id_estudiante", "in", invalidStudents)
            .execute();
          const namesStr = namesRes.map((r) => `${r.nombre} ${r.apellido}`).join(", ");
          throw {
            statusCode: 409,
            message: `No es posible registrar asistencias. Los siguientes estudiantes no cuentan con matrícula activa en esta institución (trasladados o inactivos): ${namesStr}`,
          };
        }
      }

      // 3. Enforce 7-block daily limit per student
      const studentsWithStatus = records.filter((r: any) => r.estado).map((r: any) => Number(r.id_estudiante));
      if (studentsWithStatus.length > 0) {
        const limitCheckRes = await trx
          .selectFrom("registro_asistencia as ra")
          .innerJoin("estudiante as e", "e.id_estudiante", "ra.id_estudiante")
          .select([
            "ra.id_estudiante",
            "e.nombre",
            "e.apellido",
            sql<number>`COUNT(*)::int`.as("count"),
          ])
          .where("ra.id_estudiante", "in", studentsWithStatus)
          .where(sql<boolean>`ra.fecha::date = ${date}::date`)
          .where("ra.id_detallegrado", "!=", detailGradeId)
          .groupBy(["ra.id_estudiante", "e.nombre", "e.apellido"])
          .having(sql<number>`COUNT(*)`, ">=", 7)
          .execute();

        if (limitCheckRes.length > 0) {
          const firstExceeded = limitCheckRes[0];
          const name = `${firstExceeded.nombre} ${firstExceeded.apellido}`;
          throw {
            statusCode: 409,
            message: `El estudiante ${name} ya alcanzó el límite máximo de 7 bloques académicos para el día ${date}. No es posible registrar más asistencias.`,
          };
        }
      }

      // Encontrar la hora de llegada normal de referencia (PRESENTE)
      let refPresentTime: string | null = null;
      for (const r of records) {
        if (r.estado === "PRESENTE" && r.hora_llegada) {
          if (!refPresentTime || r.hora_llegada < refPresentTime) {
            refPresentTime = r.hora_llegada;
          }
        }
      }

      if (!refPresentTime) {
        const dbPresentRes = await trx
          .selectFrom("registro_asistencia")
          .select(sql<string>`MIN(TO_CHAR(hora_llegada, 'HH24:MI'))`.as("min_hora"))
          .where("id_detallegrado", "=", detailGradeId)
          .where(sql<boolean>`fecha::date = ${date}::date`)
          .where("estado", "=", "PRESENTE")
          .executeTakeFirst();
        if (dbPresentRes?.min_hora) {
          refPresentTime = dbPresentRes.min_hora;
        }
      }

      for (const record of records) {
        const studentId = Number(record.id_estudiante);
        const estado = record.estado;
        const justificacion = record.justificacion || null;
        const hora_llegada = record.hora_llegada || null;

        if (!estado) {
          // If estado is null/empty, delete any existing record
          await trx
            .deleteFrom("registro_asistencia")
            .where("id_detallegrado", "=", detailGradeId)
            .where("id_estudiante", "=", studentId)
            .where(sql<boolean>`fecha::date = ${date}::date`)
            .execute();
        } else {
          // Validar tardanza
          if (estado === "TARDE") {
            if (!hora_llegada) {
              throw {
                statusCode: 400,
                message: "La hora de llegada es obligatoria para estudiantes con retraso (Tarde).",
              };
            }
            if (refPresentTime && hora_llegada <= refPresentTime) {
              throw {
                statusCode: 400,
                message: `La hora de llegada del estudiante con retraso (${hora_llegada}) debe ser posterior a la hora de ingreso normal (${refPresentTime}).`,
              };
            }
          }

          // Delete first to avoid duplicates
          await trx
            .deleteFrom("registro_asistencia")
            .where("id_detallegrado", "=", detailGradeId)
            .where("id_estudiante", "=", studentId)
            .where(sql<boolean>`fecha::date = ${date}::date`)
            .execute();

          const dbHoraLlegada =
            estado === "PRESENTE" || estado === "TARDE" ? hora_llegada || null : null;

          await trx
            .insertInto("registro_asistencia")
            .values({
              id_estudiante: studentId,
              id_detallegrado: detailGradeId,
              fecha: sql`${`${date}T12:00:00Z`}::timestamp with time zone` as any,
              estado: estado as any,
              id_colegio: schoolId,
              justificacion: justificacion || null,
              hora_llegada: dbHoraLlegada ? (sql`${dbHoraLlegada}::time` as any) : null,
            })
            .execute();
        }
      }
    });

    res.json({ message: "Asistencia guardada exitosamente" });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error("Error saving attendance:", error);
    res.status(500).json({ error: "Error al guardar la asistencia" });
  }
};

// GET /api/teacher/attendance-history/:detailGradeId
export const getAttendanceHistory = async (req: Request, res: Response): Promise<void> => {
  const detailGradeId = Number(req.params.detailGradeId);
  console.log(`[DEV] getAttendanceHistory called - detailGradeId=${detailGradeId}`);

  try {
    const dgRow = await db
      .selectFrom("detalle_grados")
      .select("id_grupo")
      .where("id_detallegrado", "=", detailGradeId)
      .executeTakeFirst();

    if (!dgRow) {
      res.status(404).json({ error: "Asignación académica no encontrada" });
      return;
    }

    const { id_grupo } = dgRow;

    // Get all students
    const studentsRows = await db
      .selectFrom("estudiante as e")
      .leftJoin("usuario as u", "e.id_usuario", "u.id_usuario")
      .innerJoin("matricula as m", "e.id_estudiante", "m.id_estudiante")
      .select(["e.id_estudiante", "e.nombre", "e.apellido", "u.documento", "e.codigo"])
      .where("m.id_grupo", "=", id_grupo)
      .where("m.estado", "in", ["ACTIVA", "APROBADA"])
      .orderBy("e.apellido", "asc")
      .orderBy("e.nombre", "asc")
      .execute();

    // Get history counts
    const historyRows = await db
      .selectFrom("registro_asistencia")
      .select([
        "id_estudiante",
        sql<number>`COUNT(*) FILTER (WHERE estado = 'PRESENTE')`.as("presentes"),
        sql<number>`COUNT(*) FILTER (WHERE estado = 'AUSENTE')`.as("ausentes"),
        sql<number>`COUNT(*) FILTER (WHERE estado = 'TARDE')`.as("tardes"),
        sql<number>`COUNT(*) FILTER (WHERE estado = 'JUSTIFICADA')`.as("justificadas"),
      ])
      .where("id_detallegrado", "=", detailGradeId)
      .groupBy("id_estudiante")
      .execute();

    // Get distinct dates with attendance recorded
    const datesRows = await db
      .selectFrom("registro_asistencia")
      .select(sql<string>`DISTINCT TO_CHAR(fecha, 'YYYY-MM-DD')`.as("date_recorded"))
      .where("id_detallegrado", "=", detailGradeId)
      .orderBy("date_recorded", "desc")
      .execute();

    const countsMap = new Map<number, any>();
    historyRows.forEach((r) => {
      countsMap.set(Number(r.id_estudiante), {
        presentes: Number(r.presentes),
        ausentes: Number(r.ausentes),
        tardes: Number(r.tardes),
        justificadas: Number(r.justificadas),
      });
    });

    const studentsHistory = studentsRows.map((s) => {
      const counts = countsMap.get(Number(s.id_estudiante)) || {
        presentes: 0,
        ausentes: 0,
        tardes: 0,
        justificadas: 0,
      };
      return {
        id_estudiante: s.id_estudiante,
        nombre: `${s.nombre} ${s.apellido}`,
        documento: s.documento,
        codigo: s.codigo,
        ...counts,
      };
    });

    const datesList = datesRows.map((r) => r.date_recorded);

    res.json({
      studentsHistory,
      recordedDates: datesList,
    });
  } catch (error: any) {
    console.error("Error fetching attendance history:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};
