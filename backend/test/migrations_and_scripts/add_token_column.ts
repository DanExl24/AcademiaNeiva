import { pool } from "../../src/config/db";

async function run() {
  try {
    const sql = `
      -- Añadir columna token_seguimiento a la tabla matricula
      -- Usamos UUID para que no sea predecible
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      ALTER TABLE matricula ADD COLUMN IF NOT EXISTS token_seguimiento UUID DEFAULT uuid_generate_v4();
      
      -- Actualizar registros existentes con un token único
      UPDATE matricula SET token_seguimiento = uuid_generate_v4() WHERE token_seguimiento IS NULL;
      
      -- Hacerlo NOT NULL y UNIQUE para seguridad
      ALTER TABLE matricula ALTER COLUMN token_seguimiento SET NOT NULL;
      ALTER TABLE matricula ADD CONSTRAINT matricula_token_key UNIQUE (token_seguimiento);
    `;
    await pool.query(sql);
    console.log('Column token_seguimiento added successfully to matricula table.');
  } catch (err) {
    console.error('Error during token migration:', err);
  } finally {
    await pool.end();
  }
}

run();
