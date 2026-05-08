import { pool } from "./config/db";

async function run() {
  const client = await pool.connect();
  try {
    console.log('Ejecutando limpieza de tipos...');
    await client.query("ALTER TABLE grados DROP COLUMN IF EXISTS tipo_grado");
    await client.query("DROP TYPE IF EXISTS tipo_grado CASCADE");
    await client.query("DROP TYPE IF EXISTS tipo_grado_old CASCADE");
    
    console.log('Creando nuevo enum tipo_grado...');
    await client.query(`
      CREATE TYPE tipo_grado AS ENUM (
        'PREJARDIN', 'JARDIN', 'TRANSICION', 
        'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 
        'SEXTO', 'SEPTIMO', 'OCTAVO', 'NOVENO', 
        'DECIMO', 'ONCE'
      )
    `);
    
    console.log('Restaurando columna tipo_grado en grados...');
    await client.query("ALTER TABLE grados ADD COLUMN tipo_grado tipo_grado NOT NULL DEFAULT 'TRANSICION'");
    
    console.log('Limpieza completada.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
