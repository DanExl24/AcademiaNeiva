import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function diagnose() {
  const client = await pool.connect();
  try {
    console.log(`Diagnosing Database: ${process.env.DB_NAME}`);
    
    // Listar tablas y esquemas
    const res = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_schema, table_name;
    `);
    
    console.log('--- TABLES FOUND ---');
    res.rows.forEach(row => {
      console.log(`${row.table_schema}.${row.table_name}`);
    });
    console.log('--------------------');
    
    // Probar conteo de actividades_aprendizaje de forma flexible
    try {
      const countRes = await client.query('SELECT COUNT(*) FROM "actividades_aprendizaje"');
      console.log(`Conteo actividades_aprendizaje (quoted): ${countRes.rows[0].count}`);
    } catch (e) {
      console.log('Error consultando "actividades_aprendizaje" con comillas');
    }

    try {
      const countRes = await client.query('SELECT COUNT(*) FROM actividades_aprendizaje');
      console.log(`Conteo actividades_aprendizaje (unquoted): ${countRes.rows[0].count}`);
    } catch (e) {
      console.log('Error consultando actividades_aprendizaje sin comillas');
    }

  } catch (err) {
    console.error('Error durante diagnóstico:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

diagnose();
