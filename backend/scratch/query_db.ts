import { pool } from "../src/config/db";

async function run() {
  try {
    const years = await pool.query('SELECT * FROM "año_lectivo" ORDER BY "id_año"');
    console.log("=== AÑOS LECTIVOS ===");
    console.log(years.rows);

    const periods = await pool.query('SELECT id_periodo, nombre, estado, porcentaje, "id_año", id_colegio FROM periodo_academico ORDER BY id_periodo');
    console.log("=== PERIODOS ACADEMICOS ===");
    console.log(periods.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
