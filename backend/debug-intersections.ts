import { pool } from "./src/config/db";

async function run() {
  try {
    console.log("=== Debugging Teacher-Course-Student Intersections ===");
    
    // Docente Andrea = 1
    const docenteId = 1;

    // Get groups assigned to this docente in detalle_grados
    const docenteGroupsRes = await pool.query(`
      SELECT DISTINCT id_grupo 
      FROM detalle_grados 
      WHERE id_docente = $1
    `, [docenteId]);
    const docenteGroupIds = docenteGroupsRes.rows.map(r => r.id_grupo);
    console.log(`Groups assigned to Docente ${docenteId}:`, docenteGroupIds);

    // Get groups that actually have active students
    const activeStudentGroupsRes = await pool.query(`
      SELECT id_grupo, COUNT(*) as active_students 
      FROM matricula 
      WHERE estado = 'ACTIVA' 
      GROUP BY id_grupo
      ORDER BY id_grupo
    `);
    console.log("Groups with active students:", activeStudentGroupsRes.rows);

    // Intersection
    const intersection = docenteGroupIds.filter(id => 
      activeStudentGroupsRes.rows.some(r => r.id_grupo === id)
    );
    console.log("Intersection (Groups assigned to Docente that have active students):", intersection);

    // Let's check a course for Andrea, e.g. dgId = 1
    const courseRes = await pool.query(`
      SELECT dg.id_detallegrado, dg.id_grupo, dg.id_materia, m.nombre as materia_nombre
      FROM detalle_grados dg
      JOIN materias m ON dg.id_materia = m.id_materia
      WHERE dg.id_docente = $1 LIMIT 5
    `, [docenteId]);
    console.log("Andrea's first 5 assignments:", courseRes.rows);

  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

run();
