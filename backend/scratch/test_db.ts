import { pool } from '../src/config/db';
async function test() {
  const res = await pool.query("SELECT * FROM grados WHERE id_colegio = 1 AND nivel = 'PRIMARIA' AND tipo_grado = 'PRIMERO' AND id_jornada = 2");
  console.log('Found sections:', res.rows);
  const res2 = await pool.query("SELECT * FROM grados WHERE id_colegio = 1 LIMIT 5");
  console.log('Grados Colegio 1:', res2.rows);
  pool.end();
}
test();
