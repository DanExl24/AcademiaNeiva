import { pool } from "../../src/config/db";

async function run() {
  try {
    const sql = `
      -- 1. Eliminar tablas personalizadas previas
      DROP TABLE IF EXISTS documento_solicitud;
      DROP TABLE IF EXISTS solicitud_matricula;

      -- 2. Modificar tabla matricula original
      -- Hacer id_estudiante nullable
      ALTER TABLE matricula ALTER COLUMN id_estudiante DROP NOT NULL;
      
      -- Añadir correo_padre si no existe
      DO $$ 
      BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matricula' AND column_name='correo_padre') THEN
              ALTER TABLE matricula ADD COLUMN correo_padre CHARACTER VARYING(100);
          END IF;
      END $$;

      -- 3. Asegurar que documento_matriculas esté limpio o listo
      -- (No necesita cambios estructurales si ya tiene id_matricula)
    `;
    await pool.query(sql);
    console.log('Database migration successful: id_estudiante is now nullable and correo_padre added to matricula.');
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await pool.end();
  }
}

run();
