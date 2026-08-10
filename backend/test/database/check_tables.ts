import { pool } from "../../src/config/db";

async function run() {
  try {
    console.log("=== CHECKING MATRICULAS FOR GROUP 74 ===");
    
    // Query group details
    const groupRes = await pool.query(`
      SELECT g.id_grupo, tg.nombre as grado_nombre, s.nombre as seccion, j.nombre as jornada
      FROM grupos g
      JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
      JOIN secciones s ON g.id_seccion = s.id_seccion
      JOIN jornada j ON g.id_jornada = j.id_jornada
      WHERE g.id_grupo = 74
    `);
    console.log("Group 74 Info:", groupRes.rows);

    // Query all matriculas for group 74
    const matriculasRes = await pool.query(`
      SELECT m.id_matricula, m.id_estudiante, m.estado, e.nombre, e.apellido
      FROM matricula m
      JOIN estudiante e ON m.id_estudiante = e.id_estudiante
      WHERE m.id_grupo = 74
    `);
    console.log(`Found ${matriculasRes.rows.length} matricula(s) for group 74:`, matriculasRes.rows);

    // Let's also check if there are matriculas for group 73 (DECIMO A) to compare
    const matriculas73Res = await pool.query(`
      SELECT m.id_matricula, m.id_estudiante, m.estado, e.nombre, e.apellido
      FROM matricula m
      JOIN estudiante e ON m.id_estudiante = e.id_estudiante
      WHERE m.id_grupo = 73
    `);
    console.log(`Found ${matriculas73Res.rows.length} matricula(s) for group 73 (DECIMO A):`, matriculas73Res.rows);

  } catch (err: any) {
    console.error("Error running diagnostics:", err.message);
  } finally {
    await pool.end();
  }
}

run();
