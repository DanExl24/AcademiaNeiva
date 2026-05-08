import { pool } from "./config/db";

async function run() {
  try {
    await pool.query(`
      INSERT INTO nivel_escolar (id_nivel, nombre, id_colegio) 
      VALUES 
        (1, 'Primera Infancia', 1), 
        (2, 'Primaria', 1), 
        (3, 'Secundaria', 1), 
        (4, 'Bachillerato', 1) 
      ON CONFLICT DO NOTHING
    `);
    console.log('Niveles escolares asegurados');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
