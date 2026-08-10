import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log(`Conectando a la base de datos: ${process.env.DB_NAME}...`);
    
    const query = `
      CREATE TABLE IF NOT EXISTS papelera_materias (
        id_papelera SERIAL PRIMARY KEY,
        id_colegio INT,
        nombre_materia VARCHAR(255),
        data_respaldo JSONB,
        fecha_borrado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(query);
    console.log('Tabla "papelera_materias" creada correctamente.');
    
    // Verificar creación
    const check = await client.query("SELECT to_regclass('public.papelera_materias') as exists;");
    if (check.rows[0].exists) {
      console.log('Verificación exitosa: La tabla existe.');
    } else {
      console.log('Error: La tabla no se pudo crear.');
    }

  } catch (err) {
    console.error('Error durante la migración:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
