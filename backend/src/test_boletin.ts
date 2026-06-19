import { pool } from './config/db';

async function run() {
  try {
    console.log('--- DIAGNÓSTICO DE GENERACIÓN DE BOLETINES ---');
    // 1. Get closed periods
    const periodsRes = await pool.query("SELECT id_periodo, nombre, estado, id_colegio FROM periodo_academico WHERE estado = 'CERRADO'");
    console.log('Closed Periods in DB:', periodsRes.rows);

    // 2. Get active students
    const studentsRes = await pool.query(`
      SELECT e.id_estudiante, e.nombre, e.apellido, m.id_grupo, m.id_colegio 
      FROM estudiante e 
      JOIN matricula m ON e.id_estudiante = m.id_estudiante 
      WHERE m.estado = 'ACTIVA' 
      LIMIT 5
    `);
    console.log('Active Enrolled Students in DB:', studentsRes.rows);

    if (studentsRes.rows.length > 0 && periodsRes.rows.length > 0) {
      const student = studentsRes.rows[0];
      const period = periodsRes.rows.find(p => p.id_colegio === student.id_colegio) || periodsRes.rows[0];
      console.log(`\nTesting Queries for Student ID: ${student.id_estudiante} and Period ID: ${period.id_periodo}`);

      // Query 1: period
      console.log('\n- Executing Query 1: period_academico check...');
      const periodRes = await pool.query(
        `SELECT estado, nombre, porcentaje, "id_año", id_colegio, trimestre FROM periodo_academico WHERE id_periodo = $1`,
        [period.id_periodo]
      );
      console.log('Period state result:', periodRes.rows[0]);
      const idAnio = periodRes.rows[0]["id_año"];

      // Query 2: student info
      console.log('\n- Executing Query 2: student info join...');
      const studentQueryRes = await pool.query(`
        SELECT e.id_estudiante, e.nombre as estudiante_nombre, e.apellido as estudiante_apellido, e.documento, e.codigo,
               e.id_colegio,
               c.nombre as colegio_nombre, c.sede, c.dane,
               COALESCE(c.tipo_calendario, 'A') as tipo_calendario,
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
      `, [student.id_estudiante, idAnio]);
      console.log('Student Info Result (should not be empty):', studentQueryRes.rows[0]);

      // Query 4: materias
      console.log('\n- Executing Query 4: materias/docentes list...');
      const materiasRes = await pool.query(`
        SELECT dg.id_materia, m.nombre as materia,
               d.nombre as docente_nombre, d.apellido as docente_apellido
        FROM detalle_grados dg
        JOIN matricula mat ON mat.id_grupo = dg.id_grupo
        JOIN materias m ON m.id_materia = dg.id_materia
        JOIN docente d ON d.id_docente = dg.id_docente
        WHERE mat.id_estudiante = $1
      `, [student.id_estudiante]);
      console.log('Materias Result count:', materiasRes.rows.length);

      // Query 5: notas
      console.log('\n- Executing Query 5: notas_historicas and performance scale...');
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
      `, [student.id_estudiante, idAnio]);
      console.log('Notas Result count:', notasRes.rows.length);

      // Query 6: obs
      console.log('\n- Executing Query 6: observations...');
      const obsRes = await pool.query(`
        SELECT dg.id_materia, oe.fortalezas, oe.debilidades, oe.recomendaciones, oe.tipo
        FROM observacion_estudiante oe
        JOIN detalle_grados dg ON dg.id_detallegrado = oe.id_detallegrado
        WHERE oe.id_estudiante = $1 AND oe.id_periodo = $2
      `, [student.id_estudiante, period.id_periodo]);
      console.log('Obs Result count:', obsRes.rows.length);

      // Query 7: comp
      console.log('\n- Executing Query 7: competencies/evidences...');
      const compRes = await pool.query(`
        SELECT c.id_materia, ea.descripcion
        FROM competencias c
        JOIN matricula mat ON mat.id_grupo = c.id_grupo
        JOIN evidencia_aprendizaje ea ON ea.id_competencia = c.id_competencia
        WHERE mat.id_estudiante = $1 AND c.id_periodo = $2
      `, [student.id_estudiante, period.id_periodo]);
      console.log('Comp Result count:', compRes.rows.length);

      // Query 8: ausencias
      console.log('\n- Executing Query 8: absences...');
      const ausenciasRes = await pool.query(`
        SELECT dg.id_materia, COUNT(*) FILTER (WHERE ra2.estado = 'AUSENTE') AS faltas
        FROM registro_asistencia ra2
        JOIN detalle_grados dg ON dg.id_detallegrado = ra2.id_detallegrado
        JOIN cierre_materia cm ON cm.id_detallegrado = dg.id_detallegrado AND cm.id_periodo = $2
        WHERE ra2.id_estudiante = $1
        GROUP BY dg.id_materia
      `, [student.id_estudiante, period.id_periodo]);
      console.log('Ausencias Result rows:', ausenciasRes.rows);
    } else {
      console.log('No active students or closed periods found to test.');
    }
  } catch (e) {
    console.error('ERROR during query execution:', e);
  } finally {
    await pool.end();
  }
}
run();
