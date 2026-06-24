import { pool } from "./src/config/db";

async function run() {
  try {
    const userId = 4; // Andrea's id_usuario
    console.log("=== Debugging Teacher Courses Response ===");
    
    const docenteRes = await pool.query(
      "SELECT id_docente FROM docente WHERE id_usuario = $1",
      [userId]
    );
    const idDocente = docenteRes.rows[0].id_docente;

    const result = await pool.query(
      `SELECT 
        dg.id_detallegrado,
        g.id_grupo as id_grado, 
        tg.nombre as grado_nombre, 
        ne.nombre as nivel, 
        s.nombre as seccion,
        j.nombre as jornada_nombre,
        m.id_materia, 
        m.nombre as materia_nombre
       FROM detalle_grados dg
       JOIN grupos g ON dg.id_grupo = g.id_grupo
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       JOIN secciones s ON g.id_seccion = s.id_seccion
       JOIN jornada j ON g.id_jornada = j.id_jornada
       JOIN materias m ON dg.id_materia = m.id_materia
       WHERE dg.id_docente = $1`,
      [idDocente]
    );

    console.log("First 10 Courses returned:", result.rows.slice(0, 10));

    // Let's check if there are students in these groups
    for (const course of result.rows.slice(0, 10)) {
      const studentsRes = await pool.query(
        `SELECT COUNT(*) as count 
         FROM estudiante e
         JOIN matricula m ON e.id_estudiante = m.id_estudiante
         WHERE m.id_grupo = $1 AND m.estado IN ('ACTIVA', 'TRASLADADA')`,
        [course.id_grado]
      );
      console.log(`Course: Grado ${course.grado_nombre} Seccion ${course.seccion} Jornada ${course.jornada_nombre} (id_grado/id_grupo: ${course.id_grado}) - Active students count:`, studentsRes.rows[0].count);
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}

run();
