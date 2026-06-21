import { pool } from "./config/db";

async function run() {
  try {
    const sql = `
      ALTER TABLE colegio ADD COLUMN IF NOT EXISTS color_primario VARCHAR(50) DEFAULT NULL;
      ALTER TABLE colegio ADD COLUMN IF NOT EXISTS color_secundario VARCHAR(50) DEFAULT NULL;
    `;
    await pool.query(sql);
    console.log('Columns color_primario and color_secundario added successfully to colegio table.');
  } catch (err) {
    console.error('Error during colegio theme colors migration:', err);
  } finally {
    await pool.end();
  }
}

run();
