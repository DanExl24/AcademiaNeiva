import { pool } from "./config/db";

async function testDashboard() {
  // Auto-detect a valid teacher userId
  const docenteFindRes = await pool.query(`
    SELECT d.id_docente, d.id_usuario, u.nombre 
    FROM docente d JOIN usuario u ON u.id_usuario = d.id_usuario 
    LIMIT 3
  `);
  console.log('Available docentes:', JSON.stringify(docenteFindRes.rows));
  if (docenteFindRes.rows.length === 0) { console.log('No docentes found'); await pool.end(); return; }
  const userId = docenteFindRes.rows[0].id_usuario;
  console.log('Testing with userId:', userId);

  try {
    console.log('=== Testing getTeacherDashboard logic step by step ===');
    
    // Step 1: Find docente
    console.log('\n[STEP 1] Looking up docente for userId:', userId);
    const docenteRes = await pool.query("SELECT id_docente FROM docente WHERE id_usuario = $1", [userId]);
    console.log('docente rows:', docenteRes.rows);
    if (docenteRes.rows.length === 0) {
      console.log('ERROR: No docente found for userId', userId);
      return;
    }
    const idDocente = docenteRes.rows[0].id_docente;
    console.log('idDocente:', idDocente);

    // Step 2: Find courses
    console.log('\n[STEP 2] Getting courses for idDocente:', idDocente);
    const coursesRes = await pool.query(`
      SELECT dg.id_detallegrado, m.nombre as materia_nombre, 
             tg.nombre as grado_nombre, s.nombre as seccion, j.nombre as jornada
      FROM detalle_grados dg
      JOIN grupos g ON dg.id_grupo = g.id_grupo
      JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
      JOIN secciones s ON g.id_seccion = s.id_seccion
      JOIN jornada j ON g.id_jornada = j.id_jornada
      JOIN materias m ON dg.id_materia = m.id_materia
      WHERE dg.id_docente = $1
    `, [idDocente]);
    console.log('courses count:', coursesRes.rows.length);

    // Step 3: Count active students
    console.log('\n[STEP 3] Counting active students');
    const studentsRes = await pool.query(`
      SELECT count(distinct m.id_estudiante) as total_students
      FROM detalle_grados dg
      JOIN matricula m ON dg.id_grupo = m.id_grupo
      WHERE dg.id_docente = $1 AND m.estado = 'ACTIVA'
    `, [idDocente]);
    console.log('total_students:', studentsRes.rows[0].total_students);

    // Step 4: Find active period
    console.log('\n[STEP 4] Finding active period');
    const periodRes = await pool.query("SELECT id_periodo FROM periodo_academico WHERE estado = 'ABIERTO' LIMIT 1");
    console.log('active period:', periodRes.rows);

    if (periodRes.rows.length === 0) {
      console.log('No active period found — dashboard would return empty data');
      return;
    }
    const activePeriodId = periodRes.rows[0].id_periodo;

    // Step 5: Test course students query for first course
    const firstCourse = coursesRes.rows[0];
    if (firstCourse) {
      console.log('\n[STEP 5] Testing courseStudents query for dgId:', firstCourse.id_detallegrado);
      const courseStudentsRes = await pool.query(`
        SELECT e.id_estudiante, e.nombre, e.apellido
        FROM estudiante e
        JOIN matricula m ON e.id_estudiante = m.id_estudiante
        JOIN detalle_grados dg ON m.id_grupo = dg.id_grupo
        WHERE dg.id_detallegrado = $1 AND m.estado = 'ACTIVA'
      `, [firstCourse.id_detallegrado]);
      console.log('courseStudents count:', courseStudentsRes.rows.length);

      // Step 6: Test notas_actividad query
      console.log('\n[STEP 6] Testing actividades query for dgId:', firstCourse.id_detallegrado, 'periodId:', activePeriodId);
      const activitiesRes = await pool.query(`
        SELECT am.id_actividadmateria, am.porcentaje, am.nombre
        FROM actividad_materia am
        JOIN competencias c ON am.id_competencia = c.id_competencia
        WHERE am.id_detallegrado = $1 AND c.id_periodo = $2
      `, [firstCourse.id_detallegrado, activePeriodId]);
      console.log('activities count:', activitiesRes.rows.length);

      // Step 7: Test asistencia query
      console.log('\n[STEP 7] Testing registro_asistencia query');
      const asistRes = await pool.query(`
        SELECT count(*)::int as faltas
        FROM registro_asistencia
        WHERE id_estudiante = $1 AND id_detallegrado = $2 AND estado = 'AUSENTE'
      `, [courseStudentsRes.rows[0]?.id_estudiante || 1, firstCourse.id_detallegrado]);
      console.log('asistencia faltas:', asistRes.rows[0].faltas);
    }

    console.log('\n=== All queries passed! ===');
  } catch (err: any) {
    console.error('QUERY FAILED:', err.message);
    console.error('DETAIL:', err.hint || err.detail);
    console.error('FULL ERROR:', err);
  } finally {
    await pool.end();
  }
}
testDashboard();
