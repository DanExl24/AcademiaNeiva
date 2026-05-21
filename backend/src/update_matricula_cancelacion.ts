import { pool } from "./config/db";

async function run() {
  try {
    const sql = `
      ALTER TABLE matricula ADD COLUMN IF NOT EXISTS motivo_cancelacion VARCHAR(100);
      ALTER TABLE matricula ADD COLUMN IF NOT EXISTS detalles_cancelacion TEXT;
      ALTER TABLE matricula ADD COLUMN IF NOT EXISTS es_traslado BOOLEAN DEFAULT FALSE;
    `;
    await pool.query(sql);
    console.log('Table matricula updated with cancellation and transfer fields.');
  } catch (err) {
    console.error('Error during update:', err);
  } finally {
    await pool.end();
  }
}

run();
