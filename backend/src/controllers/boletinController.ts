import { Request, Response } from 'express';
import { pool } from '../config/db';

/**
 * Validates if a period is closed for the entire school
 */
export const validatePeriodClosed = async (req: Request, res: Response) => {
  const { id_periodo, id_colegio } = req.params;
  try {
    const periodRes = await pool.query(
      `SELECT estado FROM periodo_academico WHERE id_periodo = $1 AND id_colegio = $2`,
      [id_periodo, id_colegio]
    );

    if (periodRes.rows.length === 0) {
      return res.status(404).json({ error: 'Periodo no encontrado' });
    }

    if (periodRes.rows[0].estado !== 'CERRADO') {
      return res.status(400).json({ error: 'El periodo académico debe estar cerrado para generar boletines.' });
    }

    res.json({ message: 'El periodo está cerrado, se pueden generar boletines.' });
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
  try {
    // 1. Check if period is closed
    const periodRes = await pool.query(
      `SELECT estado, nombre, porcentaje, "id_año", id_colegio, trimestre FROM periodo_academico WHERE id_periodo = $1`,
      [id_periodo]
    );
    if (!periodRes.rows.length || periodRes.rows[0].estado !== 'CERRADO') {
      return res.status(400).json({ error: 'No se puede generar el boletín en un periodo abierto' });
    }
    const periodoDetails = periodRes.rows[0];
    const idAnio = periodoDetails["id_año"] || periodoDetails["id_año".toLowerCase()];

    // 2. Fetch Student Info
    const studentRes = await pool.query(`
      SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.codigo,
             e.id_colegio,
             c.nombre as colegio_nombre, c.sede, c.dane,
             g.nivel, g.seccion, tg.nombre as grado_nombre,
             j.nombre as jornada_nombre,
             al.calendario
      FROM estudiante e
      JOIN colegio c ON c.id_colegio = e.id_colegio
      LEFT JOIN matricula m ON m.id_estudiante = e.id_estudiante
      LEFT JOIN grupos gr ON gr.id_grupo = m.id_grupo
      LEFT JOIN jornada j ON j.id_jornada = gr.id_jornada
      LEFT JOIN grados g ON g.id_jornada = gr.id_jornada AND g.id_colegio = gr.id_colegio AND g.seccion = gr.id_seccion::varchar
      LEFT JOIN tipo_grado tg ON tg.id_tipo_grado = gr.id_tipo_grado
      LEFT JOIN "año_lectivo" al ON al.id_colegio = c.id_colegio AND al."id_año" = $2
      WHERE e.id_estudiante = $1
      LIMIT 1
    `, [id_estudiante, idAnio || new Date().getFullYear()]);

    if (!studentRes.rows.length) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    const studentInfo = studentRes.rows[0];

    // 4. Fetch Todas las Materias y Profesores
    const materiasRes = await pool.query(`
      SELECT dg.id_materia, m.nombre as materia,
             d.nombre as docente_nombre, d.apellido as docente_apellido
      FROM detalle_grados dg
      JOIN matricula mat ON mat.id_grupo = dg.id_grupo
      JOIN materias m ON m.id_materia = dg.id_materia
      JOIN docente d ON d.id_docente = dg.id_docente
      WHERE mat.id_estudiante = $1
    `, [id_estudiante]);
    
    // 5. Fetch Notas Historicas del Año - Robust logic: use pre-calculated or calculate on-the-fly
    const notasRes = await pool.query(`
      SELECT 
        dg.id_materia,
        p.nombre AS periodo_nombre,
        p.id_periodo,
        p.trimestre,
        COALESCE(ra.promedio, calc.promedio_calculado) AS calificacion,
        ev.nivel AS desempeno
      FROM detalle_grados dg
      JOIN periodo_academico p ON p."id_año" = $2 AND p.id_colegio = dg.id_colegio
      LEFT JOIN resultado_academico ra ON ra.id_detallegrado = dg.id_detallegrado AND ra.id_periodo = p.id_periodo AND ra.id_estudiante = $1
      LEFT JOIN (
        SELECT am.id_detallegrado, am.id_periodo, ROUND(AVG(na.nota)::numeric, 2) as promedio_calculado
        FROM notas_actividad na
        JOIN actividad_materia am ON am.id_actividadmateria = na.id_actividadmateria
        WHERE na.id_estudiante = $1
        GROUP BY am.id_detallegrado, am.id_periodo
      ) calc ON calc.id_detallegrado = dg.id_detallegrado AND calc.id_periodo = p.id_periodo
      LEFT JOIN escala_valoracion ev 
             ON ev.id_colegio = dg.id_colegio 
            AND COALESCE(ra.promedio, calc.promedio_calculado) >= ev.valor_minimo 
            AND COALESCE(ra.promedio, calc.promedio_calculado) <= ev.valor_maximo
      WHERE dg.id_grupo IN (SELECT id_grupo FROM matricula WHERE id_estudiante = $1)
      ORDER BY p.trimestre, dg.id_materia
    `, [id_estudiante, idAnio]);

    // 6. Fetch Observaciones del Periodo Actual
    const obsRes = await pool.query(`
      SELECT dg.id_materia, oe.fortalezas, oe.debilidades, oe.recomendaciones
      FROM observacion_estudiante oe
      JOIN detalle_grados dg ON dg.id_detallegrado = oe.id_detallegrado
      WHERE oe.id_estudiante = $1 AND oe.id_periodo = $2
    `, [id_estudiante, id_periodo]);

    // 7. Fetch Desempeños (Competencias y Evidencias) del grupo y periodo
    const compRes = await pool.query(`
      SELECT c.id_materia, ea.descripcion
      FROM competencias c
      JOIN matricula mat ON mat.id_grupo = c.id_grupo
      JOIN evidencia_aprendizaje ea ON ea.id_competencia = c.id_competencia
      WHERE mat.id_estudiante = $1 AND c.id_periodo = $2
    `, [id_estudiante, id_periodo]);

    // 8. Fetch Ausencias por Materia - registro_asistencia tiene id_detallegrado directo
    const ausenciasRes = await pool.query(`
      SELECT dg.id_materia, COUNT(*) FILTER (WHERE ra2.estado = 'AUSENTE') AS faltas
      FROM registro_asistencia ra2
      JOIN detalle_grados dg ON dg.id_detallegrado = ra2.id_detallegrado
      JOIN cierre_materia cm ON cm.id_detallegrado = dg.id_detallegrado AND cm.id_periodo = $2
      WHERE ra2.id_estudiante = $1
      GROUP BY dg.id_materia
    `, [id_estudiante, id_periodo]);

    // Map all data into the required format
    const materias = materiasRes.rows.map(m => {
      const mId = Number(m.id_materia);
      const targetTrimestre = periodoDetails.trimestre || 1;
      
      const notas = notasRes.rows.filter(n => 
        Number(n.id_materia) === mId && 
        Number(n.trimestre) <= targetTrimestre
      );
      
      const obs = obsRes.rows.find(o => Number(o.id_materia) === mId);
      const ausencias = ausenciasRes.rows.find(a => Number(a.id_materia) === mId)?.faltas || 0;
      const desempenos = compRes.rows.filter(c => Number(c.id_materia) === mId).map(c => c.descripcion);
      
      const fortalezas = obs?.fortalezas 
        ? obs.fortalezas.split(/\\r?\\n|\\./).filter((f: string) => f.trim().length > 0).map((f: string) => f.trim()) 
        : [];
      
      const debilidades = obs?.debilidades 
        ? obs.debilidades.split(/\\r?\\n|\\./).filter((f: string) => f.trim().length > 0).map((f: string) => f.trim()) 
        : [];

      return {
        materia: m.materia,
        docente_nombre: m.docente_nombre,
        docente_apellido: m.docente_apellido,
        ausencias: ausencias,
        notas_historicas: notas,
        desempenos: desempenos,
        fortalezas: fortalezas,
        debilidades: debilidades
      };
    });

    // Calculate General Average based ONLY on the current period
    let promedioGlobal = 0;
    const currentPeriodGrades = notasRes.rows.filter(n => n.id_periodo === parseInt(id_periodo as string, 10));
    if (currentPeriodGrades.length > 0) {
      const sum = currentPeriodGrades.reduce((acc, curr) => acc + parseFloat(curr.calificacion || '0'), 0);
      promedioGlobal = sum / currentPeriodGrades.length;
    }

    // 9. Fetch Ranking (Puesto) en el Grupo — usa m2.id_estudiante para evitar errores por LEFT JOIN nullable
    const rankingRes = await pool.query(`
      WITH group_averages AS (
        SELECT 
          m2.id_estudiante,
          ROUND(AVG(COALESCE(ra2.promedio, calc.promedio_calculado, 0))::numeric, 2) as student_avg
        FROM matricula m2
        JOIN detalle_grados dg2 ON dg2.id_grupo = m2.id_grupo
        LEFT JOIN resultado_academico ra2 
          ON ra2.id_estudiante = m2.id_estudiante 
          AND ra2.id_detallegrado = dg2.id_detallegrado 
          AND ra2.id_periodo = $2
        LEFT JOIN (
          SELECT am.id_detallegrado, na.id_estudiante, ROUND(AVG(na.nota)::numeric, 2) as promedio_calculado
          FROM notas_actividad na
          JOIN actividad_materia am ON am.id_actividadmateria = na.id_actividadmateria
          WHERE am.id_periodo = $2
          GROUP BY am.id_detallegrado, na.id_estudiante
        ) calc ON calc.id_detallegrado = dg2.id_detallegrado AND calc.id_estudiante = m2.id_estudiante
        WHERE m2.id_grupo = (SELECT id_grupo FROM matricula WHERE id_estudiante = $1 LIMIT 1)
          AND m2.estado = 'ACTIVA'
        GROUP BY m2.id_estudiante
      ),
      ranked AS (
        SELECT 
          id_estudiante,
          student_avg,
          RANK() OVER (ORDER BY student_avg DESC) as puesto,
          COUNT(*) OVER () as total_grupo
        FROM group_averages
      )
      SELECT puesto, total_grupo, student_avg
      FROM ranked
      WHERE id_estudiante = $1;
    `, [id_estudiante, id_periodo]);

    // 10. Fetch Escala de Valoración Completa del colegio
    const escalaRes = await pool.query(`
      SELECT nivel, valor_minimo, valor_maximo 
      FROM escala_valoracion 
      WHERE id_colegio = $1 
      ORDER BY valor_minimo
    `, [studentInfo.id_colegio]);

    // Calcular Nivel de Desempeño real desde la escala del colegio
    const escalaRows = escalaRes.rows;
    let nivelDesempeno = 'Sin datos';
    if (escalaRows.length > 0) {
      const matchedLevel = escalaRows.find(
        (e: any) => promedioGlobal >= parseFloat(e.valor_minimo) && promedioGlobal <= parseFloat(e.valor_maximo)
      );
      nivelDesempeno = matchedLevel?.nivel || escalaRows[escalaRows.length - 1]?.nivel || 'Sin datos';
    }

    // 11. Fetch Firmas (Titular y Rector)
    const firmasRes = await pool.query(`
      SELECT 
        (SELECT d.nombre || ' ' || d.apellido FROM docente d JOIN grupos g ON g.id_docente = d.id_docente WHERE g.id_grupo = (SELECT id_grupo FROM matricula WHERE id_estudiante = $1 LIMIT 1)) as titular,
        (SELECT u.nombre || ' ' || u.apellido FROM directivo d JOIN usuario u ON u.id_usuario = d.id_usuario WHERE d.id_colegio = $2 AND d.cargo = 'RECTOR' LIMIT 1) as rector
    `, [id_estudiante, studentInfo.id_colegio]);

    const ranking = rankingRes.rows[0] || { puesto: null, total_grupo: null, student_avg: 0 };
    const firmas = firmasRes.rows[0] || { titular: null, rector: null };

    res.json({
      periodo: periodoDetails.nombre,
      ano_lectivo: idAnio,
      estudiante: {
         ...studentInfo,
         dane: studentInfo.dane || '183001000940',
         resolucion: studentInfo.resolucion || 'Resol. Jornada Única No. 070 del 01 de Feb. de 2021 Expedida por la Secretaría de Educación Municipal',
         ciudad: studentInfo.ciudad || 'Florencia - Caquetá'
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
        faltasInjustificadas: parseInt(ausenciasRes.rows[0]?.faltas || '0')

      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generando boletín' });
  }
};

/**
 * Get Report Cards for an entire grade (mass generation)
 */
export const getGradeBoletines = async (req: Request, res: Response) => {
  const { id_grupo, id_periodo } = req.params;
  try {
    // Check period
    const periodRes = await pool.query(
      `SELECT estado FROM periodo_academico WHERE id_periodo = $1`,
      [id_periodo]
    );
    if (!periodRes.rows.length || periodRes.rows[0].estado !== 'CERRADO') {
      return res.status(400).json({ error: 'No se puede generar el boletín masivo en un periodo abierto' });
    }

    // Get all students in this group
    const studentsRes = await pool.query(`
       SELECT id_estudiante FROM matricula WHERE id_grupo = $1 AND estado = 'ACTIVA'
    `, [id_grupo]);

    const studentIds = studentsRes.rows.map(r => r.id_estudiante);
    // Real implementation would batch fetch or use the getStudentBoletin logic internally
    // For now we will return the list of student IDs to be processed by the frontend or mapped later
    
    res.json({ students: studentIds });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error generando boletines masivos' });
  }
};

