import { pool } from '../src/config/db';

async function main() {
  const dg = await pool.query(`SELECT id_detallegrado, id_docente, id_colegio, id_materia, id_grupo, id_anio FROM detalle_grados WHERE id_docente = 8`);
  console.log("Teacher Jorge (id_docente=8) assignments in detalle_grados:", dg.rows);

  const ra = await pool.query(`SELECT * FROM registro_asistencia WHERE id_detallegrado IN (SELECT id_detallegrado FROM detalle_grados WHERE id_docente = 8)`);
  console.log("Teacher Jorge attendance records:", ra.rows);

  const cm = await pool.query(`SELECT * FROM cierre_materia WHERE id_detallegrado IN (SELECT id_detallegrado FROM detalle_grados WHERE id_docente = 8)`);
  console.log("Teacher Jorge subject closures:", cm.rows);

  const act = await pool.query(`SELECT * FROM actividad_materia WHERE id_detallegrado IN (SELECT id_detallegrado FROM detalle_grados WHERE id_docente = 8)`);
  console.log("Teacher Jorge activities:", act.rows);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
