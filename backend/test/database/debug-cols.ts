import { pool } from "../../src/config/db";

async function main() {
  try {
    // Check periodo_academico columns
    const r1 = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'periodo_academico' ORDER BY ordinal_position`);
    console.log('periodo_academico columns:', JSON.stringify(r1.rows, null, 2));

    // Sample periodo_academico rows
    const r1b = await pool.query(`SELECT * FROM periodo_academico LIMIT 3`);
    console.log('periodo_academico sample rows:', JSON.stringify(r1b.rows, null, 2));

    // Check notas_actividad columns
    const r2 = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notas_actividad' ORDER BY ordinal_position`);
    console.log('notas_actividad columns:', JSON.stringify(r2.rows, null, 2));

    // Check registro_asistencia columns
    const r3 = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'registro_asistencia' ORDER BY ordinal_position`);
    console.log('registro_asistencia columns:', JSON.stringify(r3.rows, null, 2));

    // Check matricula columns
    const r4 = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'matricula' ORDER BY ordinal_position`);
    console.log('matricula columns:', JSON.stringify(r4.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}
main();
