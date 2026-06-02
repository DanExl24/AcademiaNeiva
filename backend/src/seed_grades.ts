import { pool } from "./config/db";

async function runSeedGrades() {
  const client = await pool.connect();
  try {
    console.log("Iniciando seeder de calificaciones (boletines)...");
    await client.query("BEGIN");

    // Get closed periods
    const closedPeriodsRes = await client.query(`SELECT id_periodo, id_colegio FROM periodo_academico WHERE estado = 'CERRADO'`);
    if (closedPeriodsRes.rows.length === 0) {
      console.log("No hay periodos cerrados para generar boletines.");
      return;
    }

    // Get active students
    const studentsRes = await client.query(`
      SELECT e.id_estudiante, e.id_colegio, m.id_grupo
      FROM estudiante e
      JOIN matricula m ON m.id_estudiante = e.id_estudiante
    `);
    
    // Get all groups with their subjects (detalle_grados)
    const detalleGradosRes = await client.query(`
      SELECT dg.id_detallegrado, dg.id_materia, dg.id_docente, dg.id_grupo, dg.id_colegio
      FROM detalle_grados dg
    `);
    
    // Competencias (mocking first one available)
    const competenciasRes = await client.query('SELECT id_competencia FROM competencias LIMIT 1');
    const defaultCompetenciaId = competenciasRes.rows.length ? competenciasRes.rows[0].id_competencia : 1;
    
    let notasAgregadas = 0;
    
    for (const period of closedPeriodsRes.rows) {
      for (const dg of detalleGradosRes.rows.filter(d => d.id_colegio === period.id_colegio)) {
        
        // Ensure cierre_materia exists
        await client.query(`
          INSERT INTO cierre_materia (id_detallegrado, id_periodo, estado, fecha_cierre)
          VALUES ($1, $2, 'CERRADO', NOW())
          ON CONFLICT DO NOTHING
        `, [dg.id_detallegrado, period.id_periodo]);

        // Ensure at least one activity
        const actRes = await client.query(`
          INSERT INTO actividad_materia (id_detallegrado, id_periodo, nombre, porcentaje, id_colegio, id_competencia)
          VALUES ($1, $2, 'Actividad Final (Mock)', 100.0, $3, $4)
          RETURNING id_actividadmateria
        `, [dg.id_detallegrado, period.id_periodo, dg.id_colegio, defaultCompetenciaId]);
        
        const actividadId = actRes.rows[0].id_actividadmateria;

        // Ensure at least one observation for the student in this period
        const studentsInGroup = studentsRes.rows.filter(s => s.id_grupo === dg.id_grupo);
        
        for (const student of studentsInGroup) {
          // Rand note 3.0 to 5.0
          const nota = (3 + Math.random() * 2).toFixed(1);
          // Scale IDs: 1 (Superior 4.6-5.0), 2 (Alto 4.0-4.5), 3 (Básico 3.0-3.9), 4 (Bajo <3.0)
          let escalaId = 3;
          if (parseFloat(nota) >= 4.6) escalaId = 1;
          else if (parseFloat(nota) >= 4.0) escalaId = 2;
          
          await client.query(`
            INSERT INTO notas_actividad (id_actividadmateria, id_estudiante, id_escalavaloracion, nota, id_colegio)
            VALUES ($1, $2, $3, $4, $5)
          `, [actividadId, student.id_estudiante, escalaId, nota, dg.id_colegio]);
          
          await client.query(`
            INSERT INTO resultado_academico (id_estudiante, id_detallegrado, id_periodo, promedio, estado, fecha_cierre, id_docente, observacion)
            VALUES ($1, $2, $3, $4, 'APROBADO', NOW(), $5, 'Buen desempeño')
          `, [student.id_estudiante, dg.id_detallegrado, period.id_periodo, nota, dg.id_docente]);
          
          await client.query(`
            INSERT INTO observacion_estudiante (id_estudiante, id_detallegrado, id_periodo, fortalezas, debilidades, recomendaciones, fecha, id_colegio)
            VALUES ($1, $2, $3, 'Estudiante sobresaliente', 'Ninguna', 'Continuar así', NOW(), $4)
          `, [student.id_estudiante, dg.id_detallegrado, period.id_periodo, dg.id_colegio]);
          
          notasAgregadas++;
        }
      }
    }

    await client.query("COMMIT");
    console.log(`✅ ¡Seeder de notas/calificaciones completado! Se agregaron ${notasAgregadas} notas ficticias para periodos cerrados.`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Error en el seeder de calificaciones:", error);
  } finally {
    client.release();
    process.exit();
  }
}

runSeedGrades();
