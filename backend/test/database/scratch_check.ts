import { pool } from "../../src/config/db";

async function main() {
  try {
    console.log("=== BUSCANDO NOTAS REGISTRADAS EN COLEGIO 1 ===");
    
    const grades = await pool.query(
      `SELECT n.id_estudiante, n.id_actividadmateria, n.nota, 
              am.nombre AS actividad_nombre, am.id_periodo,
              dg.id_grupo, dg.id_materia, m.nombre AS materia_nombre,
              u.email AS docente_email
       FROM notas_actividad n
       JOIN actividad_materia am ON am.id_actividadmateria = n.id_actividadmateria
       JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
       JOIN materias m ON m.id_materia = dg.id_materia
       JOIN docente d ON d.id_docente = dg.id_docente
       JOIN usuario u ON u.id_usuario = d.id_usuario
       WHERE dg.id_colegio = 1
       LIMIT 10`
    );
    console.table(grades.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}
main();
