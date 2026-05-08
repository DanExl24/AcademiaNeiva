import { pool } from "./config/db";

async function run() {
  try {
    const sql = `
ALTER TABLE solicitud_matricula DROP COLUMN grado;
ALTER TABLE solicitud_matricula ADD COLUMN id_grado INTEGER NOT NULL;
ALTER TABLE solicitud_matricula ADD CONSTRAINT fk_solicitud_grado FOREIGN KEY (id_grado) REFERENCES grados(id_grado);
    `;
    await pool.query(sql);
    console.log('Table solicitud_matricula updated successfully');
  } catch (err) {
    console.error('Error updating table:', err);
  } finally {
    await pool.end();
  }
}

run();
