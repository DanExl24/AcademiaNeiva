import { pool } from "./src/config/db";

async function run() {
  try {
    console.log("=== Debugging Matriculas ===");
    
    // Count matriculas by state
    const statesRes = await pool.query(`
      SELECT estado, COUNT(*) as count 
      FROM matricula 
      GROUP BY estado
    `);
    console.log("Matricula counts by state:", statesRes.rows);

    // List some groups
    const groupsRes = await pool.query(`
      SELECT id_grupo, id_colegio, cupos_totales 
      FROM grupos 
      LIMIT 10
    `);
    console.log("Some groups:", groupsRes.rows);

    // List some matriculas
    const matriculasRes = await pool.query(`
      SELECT id_matricula, id_estudiante, id_grupo, estado 
      FROM matricula 
      LIMIT 10
    `);
    console.log("Some matriculas:", matriculasRes.rows);

    // Check what is returned by the query in getStudentsByGrade for one of the groups
    if (groupsRes.rows.length > 0) {
      for (const group of groupsRes.rows) {
        const gradeId = group.id_grupo;
        const studentsRes = await pool.query(
          `SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.codigo 
           FROM estudiante e
           JOIN matricula m ON e.id_estudiante = m.id_estudiante
           WHERE m.id_grupo = $1 AND m.estado IN ('ACTIVA', 'TRASLADADA')
           ORDER BY e.apellido, e.nombre`,
          [gradeId]
        );
        console.log(`Students in group ${gradeId} with ACTIVA/TRASLADADA:`, studentsRes.rows.length);

        const studentsAllRes = await pool.query(
          `SELECT e.id_estudiante, e.nombre, e.apellido, m.estado
           FROM estudiante e
           JOIN matricula m ON e.id_estudiante = m.id_estudiante
           WHERE m.id_grupo = $1`,
          [gradeId]
        );
        console.log(`Any students in group ${gradeId}:`, studentsAllRes.rows.map(r => ({ id: r.id_estudiante, name: r.nombre, state: r.estado })));
      }
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

run();
