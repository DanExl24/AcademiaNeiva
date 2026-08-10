import { pool } from "../../src/config/db";

async function run() {
  try {
    const res = await pool.query('UPDATE "año_lectivo" SET calendario = \'2025\' WHERE "id_año" = 2025');
    console.log("Cleanup status:", res.rowCount);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
