import { pool } from "./config/db";

async function run() {
  try {
    const sql = `
      ALTER TABLE registro_asistencia ADD COLUMN IF NOT EXISTS justificacion TEXT;
    `;
    await pool.query(sql);
    console.log('Column justificacion added successfully to registro_asistencia table.');
  } catch (err) {
    console.error('Error during justificacion migration:', err);
  } finally {
    await pool.end();
  }
}

run();
