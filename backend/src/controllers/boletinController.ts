import { Request, Response } from 'express';
import { db } from '../config/kysely';
import { sql } from 'kysely';
import { cleanMojibake } from '../utils/errorHelper';

/**
 * Validates if a period is closed for the entire school
 */
export const validatePeriodClosed = async (req: Request, res: Response) => {
  const { id_periodo, id_colegio } = req.params;

  const authReq = req as any;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== Number(id_colegio)) {
    return res.status(403).json({ error: "No tiene permiso para acceder a los boletines de este colegio." });
  }

  try {
    const periodRes = await db
      .selectFrom("periodo_academico")
      .select("estado")
      .where("id_periodo", "=", Number(id_periodo))
      .where("id_colegio", "=", Number(id_colegio))
      .executeTakeFirst();

    if (!periodRes) {
      return res.status(404).json({ error: 'Periodo no encontrado' });
    }

    if (periodRes.estado !== 'CERRADO') {
      return res.status(200).json({ 
        canGenerate: false, 
        message: 'El periodo académico debe estar cerrado para generar boletines.',
        estado: periodRes.estado
      });
    }

    res.json({ 
      canGenerate: true, 
      message: 'El periodo está cerrado, se pueden generar boletines.',
      estado: periodRes.estado
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error validando estado del periodo' });
  }
};

/**
 * Get Report Card for a specific student
 * Returns student info, subjects with their grades, period average, and attendance summary.
 */
export const getStudentBoletin = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo } = req.params;
  const numEstudiante = Number(id_estudiante);
  const numPeriodo = Number(id_periodo);

  console.log('[getStudentBoletin] Received parameters:', { id_estudiante, id_periodo });
  try {
    // 1. Check if period is closed
    const periodoDetails = await db
      .selectFrom("periodo_academico")
      .select(["estado", "nombre", "porcentaje", "id_anio", "id_colegio", "trimestre"])
      .where("id_periodo", "=", numPeriodo)
      .executeTakeFirst();

    console.log('[getStudentBoletin] Period query result:', periodoDetails);
    if (!periodoDetails || periodoDetails.estado !== 'CERRADO') {
      console.log('[getStudentBoletin] Rejection: Period is not closed or not found');
      return res.status(400).json({ error: 'No hay suficientes registros académicos para generar el boletín. Deberá esperar hasta el cierre de periodo.' });
    }
    const idAnio = periodoDetails.id_anio;

    // 2. Fetch Student Info (including school calendar type)
    const studentInfo = await db
      .selectFrom("estudiante as e")
      .leftJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .innerJoin("colegio as c", "c.id_colegio", "e.id_colegio")
      .leftJoin("matricula as m", (join) =>
        join
          .onRef("m.id_estudiante", "=", "e.id_estudiante")
          .on("m.id_anio", "=", idAnio)
      )
      .leftJoin("grupos as gr", "gr.id_grupo", "m.id_grupo")
      .leftJoin("jornada as j", "j.id_jornada", "gr.id_jornada")
      .leftJoin("nivel_escolar as ne", "ne.id_nivel", "gr.id_nivel")
      .leftJoin("secciones as s", "s.id_seccion", "gr.id_seccion")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "gr.id_tipo_grado")
      .leftJoin("anio_lectivo as al", (join) =>
        join
          .onRef("al.id_colegio", "=", "c.id_colegio")
          .on("al.id_anio", "=", idAnio || new Date().getFullYear())
      )
      .select([
        "e.id_estudiante",
        "e.nombre as estudiante_nombre",
        "e.apellido as estudiante_apellido",
        "u.documento",
        "e.codigo",
        "e.id_colegio",
        "c.nombre as colegio_nombre",
        "c.sede",
        "c.dane",
        "c.escudo_url",
        "c.color_primario",
        "c.color_secundario",
        sql<string>`COALESCE(c.tipo_calendario, 'A')`.as("tipo_calendario"),
        "ne.nombre as nivel",
        "s.nombre as seccion",
        "tg.nombre as grado_nombre",
        "j.nombre as jornada_nombre",
        "al.calendario"
      ])
      .where("e.id_estudiante", "=", numEstudiante)
      .executeTakeFirst();

    if (!studentInfo) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== Number(studentInfo.id_colegio)) {
      return res.status(403).json({ error: "No tiene permiso para generar el boletín de este estudiante." });
    }

    // 4. Fetch Todas las Materias y Profesores del año filtrado (Únicas por Materia)
    const materiasRes = await db
      .selectFrom("detalle_grados as dg")
      .innerJoin("matricula as mat", "mat.id_grupo", "dg.id_grupo")
      .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
      .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
      .distinctOn("m.id_materia")
      .select([
        "dg.id_materia",
        "m.nombre as materia",
        "d.nombre as docente_nombre",
        "d.apellido as docente_apellido"
      ])
      .where("mat.id_estudiante", "=", numEstudiante)
      .where("mat.id_anio", "=", idAnio)
      .orderBy("m.id_materia")
      .orderBy("dg.id_detallegrado", "desc")
      .execute();
    
    // 5. Fetch Notas Historicas del Año (Agrupadas por Materia y Periodo)
    const studentGroupSubquery = db
      .selectFrom("matricula")
      .select("id_grupo")
      .where("id_estudiante", "=", numEstudiante)
      .where("id_anio", "=", idAnio)
      .limit(1);

    const calcSubquery = db
      .selectFrom("notas_actividad as na")
      .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
      .innerJoin("detalle_grados as dg_am", "dg_am.id_detallegrado", "am.id_detallegrado")
      .select([
        "dg_am.id_materia",
        "am.id_periodo",
        sql<number>`ROUND(SUM(na.nota * (am.porcentaje / 100.0))::numeric, 2)`.as("promedio_calculado")
      ])
      .where("na.id_estudiante", "=", numEstudiante)
      .groupBy(["dg_am.id_materia", "am.id_periodo"])
      .as("calc");

    const raSubquery = db
      .selectFrom("resultado_academico as ra_inner")
      .innerJoin("detalle_grados as dg_ra", "dg_ra.id_detallegrado", "ra_inner.id_detallegrado")
      .select([
        "dg_ra.id_materia",
        "ra_inner.id_periodo",
        sql<number>`MAX(ra_inner.promedio)`.as("promedio")
      ])
      .where("ra_inner.id_estudiante", "=", numEstudiante)
      .groupBy(["dg_ra.id_materia", "ra_inner.id_periodo"])
      .as("ra");

    const groupMateriasSubquery = db
      .selectFrom("detalle_grados as dg")
      .select("dg.id_materia")
      .distinctOn("dg.id_materia")
      .where("dg.id_grupo", "=", studentGroupSubquery)
      .as("gm");

    const notasRes = await db
      .selectFrom(groupMateriasSubquery)
      .innerJoin("periodo_academico as p", (join) =>
        join
          .on("p.id_anio", "=", idAnio)
          .on("p.id_colegio", "=", Number(studentInfo.id_colegio))
      )
      .leftJoin(raSubquery, (join) =>
        join
          .onRef("ra.id_materia", "=", "gm.id_materia")
          .onRef("ra.id_periodo", "=", "p.id_periodo")
      )
      .leftJoin(calcSubquery, (join) =>
        join
          .onRef("calc.id_materia", "=", "gm.id_materia")
          .onRef("calc.id_periodo", "=", "p.id_periodo")
      )
      .leftJoin("escala_valoracion as ev", (join) =>
        join
          .on("ev.id_colegio", "=", Number(studentInfo.id_colegio))
          .on(sql`COALESCE(ra.promedio, calc.promedio_calculado)`, ">=", sql.ref("ev.valor_minimo"))
          .on(sql`COALESCE(ra.promedio, calc.promedio_calculado)`, "<=", sql.ref("ev.valor_maximo"))
      )
      .select([
        "gm.id_materia",
        "p.nombre as periodo_nombre",
        "p.id_periodo",
        "p.trimestre",
        sql<number>`COALESCE(ra.promedio, calc.promedio_calculado)`.as("calificacion"),
        "ev.nivel as desempeno"
      ])
      .orderBy("p.trimestre", "asc")
      .orderBy("gm.id_materia", "asc")
      .execute();

    // 6. Fetch Observaciones del Periodo Actual
    const obsRes = await db
      .selectFrom("observacion_estudiante as oe")
      .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "oe.id_detallegrado")
      .select(["dg.id_materia", "oe.fortalezas", "oe.debilidades", "oe.recomendaciones", "oe.tipo"])
      .where("oe.id_estudiante", "=", numEstudiante)
      .where("oe.id_periodo", "=", numPeriodo)
      .execute();

    // 7. Fetch Desempeños (Competencias y Evidencias) del grupo y periodo
    const compRes = await db
      .selectFrom("competencias as c")
      .innerJoin("matricula as mat", "mat.id_grupo", "c.id_grupo")
      .innerJoin("evidencia_aprendizaje as ea", "ea.id_competencia", "c.id_competencia")
      .select(["c.id_materia", "ea.descripcion"])
      .where("mat.id_estudiante", "=", numEstudiante)
      .where("mat.id_anio", "=", idAnio)
      .where("c.id_periodo", "=", numPeriodo)
      .execute();

    // 8. Fetch Ausencias por Materia
    const ausenciasRes = await db
      .selectFrom("registro_asistencia as ra2")
      .innerJoin("detalle_grados as dg", "dg.id_detallegrado", "ra2.id_detallegrado")
      .innerJoin("cierre_materia as cm", (join) =>
        join
          .onRef("cm.id_detallegrado", "=", "dg.id_detallegrado")
          .on("cm.id_periodo", "=", numPeriodo)
      )
      .select([
        "dg.id_materia",
        sql<number>`COUNT(*) FILTER (WHERE ra2.estado = 'AUSENTE')`.as("faltas")
      ])
      .where("ra2.id_estudiante", "=", numEstudiante)
      .groupBy("dg.id_materia")
      .execute();

    // Map all data into the required format
    const materias = materiasRes.map(m => {
      const mId = Number(m.id_materia);
      const targetTrimestre = periodoDetails.trimestre || 1;
      
      const notas = notasRes.filter(n => 
        Number(n.id_materia) === mId && 
        Number(n.trimestre) <= targetTrimestre
      );
      
      const subjectObservations = obsRes.filter(o => Number(o.id_materia) === mId).map(o => {
        return {
          tipo: o.tipo,
          fortalezas: o.fortalezas ? o.fortalezas.split(/\r?\n|\./).filter((f: string) => f.trim().length > 0).map((f: string) => f.trim()) : [],
          debilidades: o.debilidades ? o.debilidades.split(/\r?\n|\./).filter((f: string) => f.trim().length > 0).map((f: string) => f.trim()) : [],
          recomendaciones: o.recomendaciones || ''
        };
      });

      const ausencias = ausenciasRes.find(a => Number(a.id_materia) === mId)?.faltas || 0;
      const desempenos = Array.from(
        new Set(compRes.filter(c => Number(c.id_materia) === mId).map(c => c.descripcion))
      ).slice(0, 3);

      return {
        materia: m.materia,
        docente_nombre: m.docente_nombre,
        docente_apellido: m.docente_apellido,
        ausencias: ausencias,
        notas_historicas: notas,
        desempenos: desempenos,
        observaciones: subjectObservations
      };
    });

    // Calculate General Average based ONLY on the current period
    let promedioGlobal = 0;
    const currentPeriodGrades = notasRes.filter(n => n.id_periodo === numPeriodo);
    if (currentPeriodGrades.length > 0) {
      const sum = currentPeriodGrades.reduce((acc, curr) => acc + parseFloat(String(curr.calificacion || '0')), 0);
      promedioGlobal = sum / currentPeriodGrades.length;
    }

    // 9. Fetch Ranking (Puesto) en el Grupo
    const calcSubqueryRanking = db
      .selectFrom("notas_actividad as na")
      .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
      .select([
        "am.id_detallegrado",
        "na.id_estudiante",
        sql<number>`ROUND(SUM(na.nota * (am.porcentaje / 100.0))::numeric, 2)`.as("promedio_calculado")
      ])
      .where("am.id_periodo", "=", numPeriodo)
      .groupBy(["am.id_detallegrado", "na.id_estudiante"])
      .as("calc");

    const groupAveragesCte = db
      .selectFrom("matricula as m2")
      .innerJoin("detalle_grados as dg2", "dg2.id_grupo", "m2.id_grupo")
      .leftJoin("resultado_academico as ra2", (join) =>
        join
          .onRef("ra2.id_estudiante", "=", "m2.id_estudiante")
          .onRef("ra2.id_detallegrado", "=", "dg2.id_detallegrado")
          .on("ra2.id_periodo", "=", numPeriodo)
      )
      .leftJoin(calcSubqueryRanking, (join) =>
        join
          .onRef("calc.id_detallegrado", "=", "dg2.id_detallegrado")
          .onRef("calc.id_estudiante", "=", "m2.id_estudiante")
      )
      .select([
        "m2.id_estudiante",
        sql<number>`ROUND(AVG(COALESCE(ra2.promedio, calc.promedio_calculado, 0))::numeric, 2)`.as("student_avg")
      ])
      .where("m2.id_grupo", "=",
        db.selectFrom("matricula").select("id_grupo").where("id_estudiante", "=", numEstudiante).where("id_anio", "=", idAnio).limit(1)
      )
      .where("m2.estado", "=", 'ACTIVA')
      .groupBy("m2.id_estudiante");

    const rankedCte = db
      .with("group_averages", () => groupAveragesCte)
      .selectFrom("group_averages")
      .select([
        "id_estudiante",
        "student_avg",
        sql<number>`RANK() OVER (ORDER BY student_avg DESC)`.as("puesto"),
        sql<number>`COUNT(*) OVER ()`.as("total_grupo")
      ]);

    const rankingRow = await db
      .with("group_averages", () => groupAveragesCte)
      .with("ranked", () => rankedCte)
      .selectFrom("ranked")
      .select(["puesto", "total_grupo", "student_avg"])
      .where("id_estudiante", "=", numEstudiante)
      .executeTakeFirst();

    // 10. Fetch Escala de Valoración Completa del colegio
    const escalaRows = await db
      .selectFrom("escala_valoracion")
      .select(["nivel", "valor_minimo", "valor_maximo"])
      .where("id_colegio", "=", Number(studentInfo.id_colegio))
      .orderBy("valor_minimo", "asc")
      .execute();

    let nivelDesempeno = 'Sin datos';
    if (escalaRows.length > 0) {
      const matchedLevel = escalaRows.find(
        (e: any) => promedioGlobal >= parseFloat(e.valor_minimo) && promedioGlobal <= parseFloat(e.valor_maximo)
      );
      nivelDesempeno = matchedLevel?.nivel || escalaRows[escalaRows.length - 1]?.nivel || 'Sin datos';
    }

    // 11. Fetch Firmas (Titular y Rector)
    const titularRow = await db
      .selectFrom("docente as d")
      .innerJoin("grupos as g", "g.id_docente", "d.id_docente")
      .select(sql<string>`d.nombre || ' ' || d.apellido`.as("nombre_completo"))
      .where("g.id_grupo", "=",
        db.selectFrom("matricula").select("id_grupo").where("id_estudiante", "=", numEstudiante).where("id_anio", "=", idAnio).limit(1)
      )
      .executeTakeFirst();

    const rectorRow = await db
      .selectFrom("directivo as d")
      .innerJoin("usuario as u", "u.id_usuario", "d.id_usuario")
      .select(sql<string>`u.nombre || ' ' || u.apellido`.as("nombre_completo"))
      .where("d.id_colegio", "=", Number(studentInfo.id_colegio))
      .where("d.cargo", "=", "RECTOR")
      .executeTakeFirst();

    const ranking = rankingRow || { puesto: null, total_grupo: null, student_avg: 0 };
    const firmas = {
      titular: titularRow ? titularRow.nombre_completo : null,
      rector: rectorRow ? rectorRow.nombre_completo : null
    };

    res.json({
      periodo: periodoDetails.nombre,
      ano_lectivo: studentInfo.calendario,
      estudiante: {
         ...studentInfo,
         nombre: studentInfo.estudiante_nombre,
         apellido: studentInfo.estudiante_apellido,
         dane: studentInfo.dane || '183001000940',
         ciudad: (studentInfo as any).ciudad || 'Neiva - Huila'
      },
      materias: materias,
      promedioGeneral: promedioGlobal.toFixed(2),
      nivelDesempeno: nivelDesempeno,
      ranking: {
        puesto: ranking.puesto,
        total: ranking.total_grupo,
        promedio: ranking.student_avg
      },
      escala: escalaRows,
      firmas: firmas,
      asistencia: {
        faltasInjustificadas: parseInt(String(ausenciasRes[0]?.faltas || '0'), 10)
      }
    });

  } catch (error) {
    console.error('[getStudentBoletin] ERROR:', error);
    res.status(500).json({ error: 'Error generando boletín' });
  }
};

/**
 * Get Report Cards for an entire grade (mass generation)
 */
export const getGradeBoletines = async (req: Request, res: Response) => {
  const { id_grupo, id_periodo } = req.params;
  try {
    const periodRes = await db
      .selectFrom("periodo_academico")
      .select("estado")
      .where("id_periodo", "=", Number(id_periodo))
      .executeTakeFirst();

    if (!periodRes || periodRes.estado !== 'CERRADO') {
      return res.status(400).json({ error: 'No se puede generar el boletín masivo en un periodo abierto' });
    }

    const studentsRes = await db
      .selectFrom("matricula")
      .select("id_estudiante")
      .where("id_grupo", "=", Number(id_grupo))
      .where("estado", "in", ['ACTIVA', 'APROBADA'])
      .execute();

    const studentIds = studentsRes.map(r => r.id_estudiante);
    res.json({ students: studentIds });
  } catch (error) {
    console.error('[getGradeBoletines] ERROR:', error);
    res.status(500).json({ error: 'Error generando boletines masivos' });
  }
};

/**
 * GET /api/boletines/transfer-partial-report/:id_estudiante
 * Genera el Certificado / Informe Académico Parcial de Notas para Traslado o Retiro Estudiantil.
 * Cumple con el mandato del Decreto 1075 de 2015 Art. 2.3.3.3.3.17.
 * Consolida las notas de periodos CERRADOS (resultado_academico) y el periodo ABIERTO actual (notas_actividad acumuladas).
 */
export const getStudentTransferPartialReport = async (req: Request, res: Response) => {
  const { id_estudiante } = req.params;
  const numEstudiante = Number(id_estudiante);
  const reqYearId = req.query.id_anio || req.query.yearId;

  try {
    // 1. Obtener Matrícula y Datos del Estudiante (Incluso si está ACTIVA, TRASLADADO o RETIRADO)
    let matriculaQuery = db
      .selectFrom("matricula as m")
      .innerJoin("estudiante as e", "e.id_estudiante", "m.id_estudiante")
      .leftJoin("usuario as u", "u.id_usuario", "e.id_usuario")
      .innerJoin("colegio as c", "c.id_colegio", "e.id_colegio")
      .leftJoin("grupos as gr", "gr.id_grupo", "m.id_grupo")
      .leftJoin("jornada as j", "j.id_jornada", "gr.id_jornada")
      .leftJoin("nivel_escolar as ne", "ne.id_nivel", "gr.id_nivel")
      .leftJoin("secciones as s", "s.id_seccion", "gr.id_seccion")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "gr.id_tipo_grado")
      .leftJoin("anio_lectivo as al", "al.id_anio", "m.id_anio")
      .select([
        "e.id_estudiante",
        "e.nombre as estudiante_nombre",
        "e.apellido as estudiante_apellido",
        "u.documento",
        "e.codigo",
        "e.id_colegio",
        "c.nombre as colegio_nombre",
        "c.sede",
        "c.dane",
        "c.escudo_url",
        "c.color_primario",
        "c.color_secundario",
        sql<string>`COALESCE(c.tipo_calendario, 'A')`.as("tipo_calendario"),
        "ne.nombre as nivel",
        "s.nombre as seccion",
        "tg.nombre as grado_nombre",
        "j.nombre as jornada_nombre",
        "m.id_anio",
        "m.id_grupo",
        "m.estado as estado_matricula",
        "al.calendario"
      ])
      .where("e.id_estudiante", "=", numEstudiante);

    if (reqYearId) {
      matriculaQuery = matriculaQuery.where("m.id_anio", "=", Number(reqYearId));
    }

    let matriculaRes = await matriculaQuery.orderBy("m.id_matricula", "desc").executeTakeFirst();

    // Si no encontró matrícula en el año solicitado, buscar la matrícula más reciente
    if (!matriculaRes && reqYearId) {
      matriculaRes = await db
        .selectFrom("matricula as m")
        .innerJoin("estudiante as e", "e.id_estudiante", "m.id_estudiante")
        .leftJoin("usuario as u", "u.id_usuario", "e.id_usuario")
        .innerJoin("colegio as c", "c.id_colegio", "e.id_colegio")
        .leftJoin("grupos as gr", "gr.id_grupo", "m.id_grupo")
        .leftJoin("jornada as j", "j.id_jornada", "gr.id_jornada")
        .leftJoin("nivel_escolar as ne", "ne.id_nivel", "gr.id_nivel")
        .leftJoin("secciones as s", "s.id_seccion", "gr.id_seccion")
        .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "gr.id_tipo_grado")
        .leftJoin("anio_lectivo as al", "al.id_anio", "m.id_anio")
        .select([
          "e.id_estudiante",
          "e.nombre as estudiante_nombre",
          "e.apellido as estudiante_apellido",
          "u.documento",
          "e.codigo",
          "e.id_colegio",
          "c.nombre as colegio_nombre",
          "c.sede",
          "c.dane",
          "c.escudo_url",
          "c.color_primario",
          "c.color_secundario",
          sql<string>`COALESCE(c.tipo_calendario, 'A')`.as("tipo_calendario"),
          "ne.nombre as nivel",
          "s.nombre as seccion",
          "tg.nombre as grado_nombre",
          "j.nombre as jornada_nombre",
          "m.id_anio",
          "m.id_grupo",
          "m.estado as estado_matricula",
          "al.calendario"
        ])
        .where("e.id_estudiante", "=", numEstudiante)
        .orderBy("m.id_matricula", "desc")
        .executeTakeFirst();
    }

    if (!matriculaRes) {
      return res.status(404).json({ error: "Estudiante o matrícula no encontrada." });
    }

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== Number(matriculaRes.id_colegio)) {
      return res.status(403).json({ error: "No tiene permiso para acceder al reporte de este estudiante." });
    }

    const idAnio = matriculaRes.id_anio;
    const idGrupo = matriculaRes.id_grupo;

    // 2. Obtener todos los periodos del año lectivo
    const periodos = await db
      .selectFrom("periodo_academico as p")
      .select(["p.id_periodo", "p.nombre", "p.trimestre", "p.estado", "p.porcentaje"])
      .where("p.id_anio", "=", idAnio)
      .where("p.id_colegio", "=", Number(matriculaRes.id_colegio))
      .orderBy("p.trimestre", "asc")
      .execute();

    if (periodos.length === 0) {
      return res.status(400).json({ error: "No hay periodos configurados para el año lectivo de la matrícula." });
    }

    // 3. Obtener materias y docentes del grupo correspondientes a ese AÑO LECTIVO
    let materiasRes = await db
      .selectFrom("detalle_grados as dg")
      .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
      .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
      .distinctOn("m.id_materia")
      .select([
        "dg.id_detallegrado",
        "dg.id_materia",
        "m.nombre as materia",
        "d.nombre as docente_nombre",
        "d.apellido as docente_apellido"
      ])
      .where("dg.id_grupo", "=", idGrupo)
      .where("dg.id_anio", "=", idAnio)
      .orderBy("m.id_materia")
      .orderBy("dg.id_detallegrado", "desc")
      .execute();

    // Si no encontró materias con filtro de año en detalle_grados, consultar por grupo general
    if (materiasRes.length === 0) {
      materiasRes = await db
        .selectFrom("detalle_grados as dg")
        .innerJoin("materias as m", "m.id_materia", "dg.id_materia")
        .innerJoin("docente as d", "d.id_docente", "dg.id_docente")
        .distinctOn("m.id_materia")
        .select([
          "dg.id_detallegrado",
          "dg.id_materia",
          "m.nombre as materia",
          "d.nombre as docente_nombre",
          "d.apellido as docente_apellido"
        ])
        .where("dg.id_grupo", "=", idGrupo)
        .orderBy("m.id_materia")
        .orderBy("dg.id_detallegrado", "desc")
        .execute();
    }

    // 4. Escala de valoración del colegio
    const escalaRows = await db
      .selectFrom("escala_valoracion")
      .select(["nivel", "valor_minimo", "valor_maximo"])
      .where("id_colegio", "=", Number(matriculaRes.id_colegio))
      .orderBy("valor_minimo", "asc")
      .execute();

    const getDesempeno = (nota: number | null): string => {
      if (nota === null || isNaN(nota)) return "Sin evaluar";
      const match = escalaRows.find(e => nota >= Number(e.valor_minimo) && nota <= Number(e.valor_maximo));
      return match ? cleanMojibake(match.nivel) : (nota >= 3.0 ? "BÁSICO" : "BAJO");
    };

    // 5. Para cada materia y periodo, consolidar nota cerrada o acumulada abierta
    const materias = await Promise.all(
      materiasRes.map(async (m) => {
        const mId = Number(m.id_materia);
        const dgId = Number(m.id_detallegrado);

        const notasHistoricas = await Promise.all(
          periodos.map(async (p) => {
            const pId = Number(p.id_periodo);
            let calificacion: number | null = null;
            let esParcial = false;
            let actividadesCalificadas = 0;

            if (p.estado === "CERRADO") {
              // Buscar en resultado_academico cruzando por id_materia e id_periodo
              const ra = await db
                .selectFrom("resultado_academico as ra")
                .innerJoin("detalle_grados as dg_ra", "dg_ra.id_detallegrado", "ra.id_detallegrado")
                .select(["ra.promedio"])
                .where("ra.id_estudiante", "=", numEstudiante)
                .where("ra.id_periodo", "=", pId)
                .where("dg_ra.id_materia", "=", mId)
                .executeTakeFirst();

              if (ra && ra.promedio !== null) {
                calificacion = Number(ra.promedio);
              } else {
                // Fallback directo por id_detallegrado
                const raDirect = await db
                  .selectFrom("resultado_academico")
                  .select(["promedio"])
                  .where("id_estudiante", "=", numEstudiante)
                  .where("id_periodo", "=", pId)
                  .where("id_detallegrado", "=", dgId)
                  .executeTakeFirst();

                if (raDirect && raDirect.promedio !== null) {
                  calificacion = Number(raDirect.promedio);
                } else {
                  // Fallback cálculo actividades
                  const calc = await db
                    .selectFrom("notas_actividad as na")
                    .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
                    .innerJoin("detalle_grados as dg_am", "dg_am.id_detallegrado", "am.id_detallegrado")
                    .select(sql<number>`ROUND(SUM(na.nota * (am.porcentaje / 100.0))::numeric, 2)`.as("promedio_calculado"))
                    .where("na.id_estudiante", "=", numEstudiante)
                    .where("am.id_periodo", "=", pId)
                    .where("dg_am.id_materia", "=", mId)
                    .executeTakeFirst();
                  calificacion = calc?.promedio_calculado ? Number(calc.promedio_calculado) : null;
                }
              }
              esParcial = false;
            } else {
              // Periodo ABIERTO: calcular acumulado a la fecha
              const actRes = await db
                .selectFrom("notas_actividad as na")
                .innerJoin("actividad_materia as am", "am.id_actividadmateria", "na.id_actividadmateria")
                .innerJoin("detalle_grados as dg_am", "dg_am.id_detallegrado", "am.id_detallegrado")
                .select([
                  sql<number>`ROUND(AVG(na.nota)::numeric, 2)`.as("promedio_parcial"),
                  sql<number>`COUNT(na.id_nota)`.as("total_actividades")
                ])
                .where("na.id_estudiante", "=", numEstudiante)
                .where("am.id_periodo", "=", pId)
                .where("dg_am.id_materia", "=", mId)
                .executeTakeFirst();

              if (actRes && Number(actRes.total_actividades) > 0) {
                calificacion = Number(actRes.promedio_parcial);
                actividadesCalificadas = Number(actRes.total_actividades);
                esParcial = true;
              }
            }

            return {
              id_materia: mId,
              id_periodo: pId,
              periodo_nombre: cleanMojibake(p.nombre),
              trimestre: p.trimestre,
              estado_periodo: p.estado,
              calificacion: calificacion,
              desempeno: getDesempeno(calificacion),
              es_parcial: esParcial,
              actividades_evaluadas: actividadesCalificadas
            };
          })
        );

        // Ausencias por materia
        const ausenciasRow = await db
          .selectFrom("registro_asistencia as ra")
          .innerJoin("detalle_grados as dg_ra", "dg_ra.id_detallegrado", "ra.id_detallegrado")
          .select(sql<number>`COUNT(*) FILTER (WHERE ra.estado = 'AUSENTE')`.as("faltas"))
          .where("ra.id_estudiante", "=", numEstudiante)
          .where("dg_ra.id_materia", "=", mId)
          .executeTakeFirst();

        // Observaciones cualitativas para la materia
        const obsMateria = await db
          .selectFrom("observacion_estudiante as oe")
          .innerJoin("detalle_grados as dg_oe", "dg_oe.id_detallegrado", "oe.id_detallegrado")
          .select(["oe.fortalezas", "oe.debilidades", "oe.recomendaciones", "oe.tipo"])
          .where("oe.id_estudiante", "=", numEstudiante)
          .where("dg_oe.id_materia", "=", mId)
          .execute();

        // Desempeños y competencias para la materia
        const compMateria = await db
          .selectFrom("competencias as comp")
          .innerJoin("evidencia_aprendizaje as ea", "ea.id_competencia", "comp.id_competencia")
          .select(["ea.descripcion"])
          .where("comp.id_grupo", "=", Number(idGrupo))
          .where("comp.id_materia", "=", mId)
          .execute();

        const formattedObs = obsMateria.map(o => ({
          tipo: o.tipo,
          fortalezas: (Array.isArray(o.fortalezas) ? o.fortalezas : (o.fortalezas ? [o.fortalezas] : [])).map(f => cleanMojibake(String(f))),
          debilidades: (Array.isArray(o.debilidades) ? o.debilidades : (o.debilidades ? [o.debilidades] : [])).map(d => cleanMojibake(String(d))),
          recomendaciones: cleanMojibake(o.recomendaciones || '')
        }));

        const formattedDesempenos = compMateria
          .map(c => cleanMojibake(c.descripcion))
          .filter(Boolean);

        return {
          materia: cleanMojibake(m.materia),
          docente_nombre: cleanMojibake(m.docente_nombre),
          docente_apellido: cleanMojibake(m.docente_apellido),
          ausencias: Number(ausenciasRow?.faltas || 0),
          notas_historicas: notasHistoricas,
          desempenos: formattedDesempenos,
          observaciones: formattedObs
        };
      })
    );

    // Calcular promedio general acumulado de todas las materias evaluadas
    const allValidGrades: number[] = [];
    materias.forEach(m => {
      m.notas_historicas.forEach(nh => {
        if (nh.calificacion !== null && !isNaN(nh.calificacion)) {
          allValidGrades.push(nh.calificacion);
        }
      });
    });

    const promedioAcumulado = allValidGrades.length > 0
      ? (allValidGrades.reduce((a, b) => a + b, 0) / allValidGrades.length).toFixed(2)
      : "0.00";

    // Firmas Institucionales
    const titularRow = await db
      .selectFrom("docente as d")
      .innerJoin("grupos as g", "g.id_docente", "d.id_docente")
      .select(sql<string>`d.nombre || ' ' || d.apellido`.as("nombre_completo"))
      .where("g.id_grupo", "=", Number(idGrupo))
      .executeTakeFirst();

    const rectorRow = await db
      .selectFrom("directivo as d")
      .innerJoin("usuario as u", "u.id_usuario", "d.id_usuario")
      .select(sql<string>`u.nombre || ' ' || u.apellido`.as("nombre_completo"))
      .where("d.id_colegio", "=", Number(matriculaRes.id_colegio))
      .where("d.cargo", "=", "RECTOR")
      .executeTakeFirst();

    res.json({
      es_informe_traslado: true,
      tipo_documento: "INFORME_PARCIAL_TRASLADO",
      normativa_legal: "Decreto 1075 de 2015 Art. 2.3.3.3.3.17 / Ley 115 de 1994",
      fecha_expedicion: new Date().toISOString(),
      periodo: "Corte Parcial a la Fecha (Traslado)",
      ano_lectivo: matriculaRes.calendario,
      estudiante: {
        ...matriculaRes,
        nombre: cleanMojibake(matriculaRes.estudiante_nombre),
        apellido: cleanMojibake(matriculaRes.estudiante_apellido),
        dane: matriculaRes.dane || '183001000940',
        ciudad: cleanMojibake((matriculaRes as any).ciudad) || 'Neiva - Huila'
      },
      materias: materias,
      promedioGeneral: promedioAcumulado,
      nivelDesempeno: getDesempeno(Number(promedioAcumulado)),
      ranking: {
        puesto: null,
        total: null,
        promedio: Number(promedioAcumulado),
        nota: "Puesto no aplicable en informe parcial por traslado"
      },
      escala: escalaRows,
      firmas: {
        titular: titularRow ? cleanMojibake(titularRow.nombre_completo) : null,
        rector: rectorRow ? cleanMojibake(rectorRow.nombre_completo) : null
      }
    });
  } catch (error) {
    console.error('[getStudentTransferPartialReport] ERROR:', error);
    res.status(500).json({ error: "Error generando informe parcial de traslado." });
  }
};
