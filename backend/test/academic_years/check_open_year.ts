import { pool } from "../../src/config/db";

async function main() {
  const yearsRes = await pool.query(`SELECT id_anio, id_colegio, calendario, estado FROM anio_lectivo WHERE id_colegio = 1 ORDER BY id_anio DESC`);
  console.log("School 1 years:", yearsRes.rows);

  const openYear = await pool.query(`
    SELECT id_anio, calendario, estado 
    FROM anio_lectivo 
    WHERE id_colegio = 1 
    ORDER BY CASE WHEN estado = 'ABIERTO' THEN 0 ELSE 1 END, id_anio DESC 
    LIMIT 1
  `);
  console.log("Open year result:", openYear.rows);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
