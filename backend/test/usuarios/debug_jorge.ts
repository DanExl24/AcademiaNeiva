import { pool } from "../../src/config/db";

async function main() {
  const years = await pool.query(`SELECT * FROM anio_lectivo WHERE id_colegio = 1`);
  console.log("School 1 years:", years.rows);

  const teacher = await pool.query(`SELECT * FROM docente WHERE id_usuario = 31`);
  console.log("Teacher Jorge row:", teacher.rows);

  if (teacher.rows.length > 0) {
    const dg = await pool.query(`SELECT * FROM detalle_grados WHERE id_docente = $1`, [teacher.rows[0].id_docente]);
    console.log("Teacher Jorge assignments:", dg.rows);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
