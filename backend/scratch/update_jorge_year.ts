import { pool } from '../src/config/db';

async function main() {
  const updateRes = await pool.query(`UPDATE detalle_grados SET id_anio = 2 WHERE id_docente = 8 AND (id_anio IS NULL OR id_anio = 1)`);
  console.log("Updated rows:", updateRes.rowCount);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
