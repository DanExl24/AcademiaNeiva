import { pool } from "../config/db";

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("🚀 Iniciando migración: agregar columnas de horario a la tabla jornada...");

    // 1. Agregar columnas si no existen
    await client.query(`
      ALTER TABLE public.jornada 
        ADD COLUMN IF NOT EXISTS hora_inicio TIME,
        ADD COLUMN IF NOT EXISTS hora_fin TIME,
        ADD COLUMN IF NOT EXISTS descripcion VARCHAR(100);
    `);
    console.log("✅ Columnas hora_inicio, hora_fin y descripcion aseguradas en tabla jornada.");

    // 2. Backfill de valores predeterminados según el nombre de la jornada
    const updateResult = await client.query(`
      UPDATE public.jornada
      SET 
        hora_inicio = COALESCE(hora_inicio, CASE 
          WHEN nombre = 'MAÑANA' THEN '06:30:00'::time
          WHEN nombre = 'TARDE' THEN '12:30:00'::time
          WHEN nombre = 'UNICA' THEN '06:30:00'::time
          WHEN nombre = 'NOCTURNA' THEN '18:00:00'::time
          ELSE '07:00:00'::time
        END),
        hora_fin = COALESCE(hora_fin, CASE 
          WHEN nombre = 'MAÑANA' THEN '12:30:00'::time
          WHEN nombre = 'TARDE' THEN '18:30:00'::time
          WHEN nombre = 'UNICA' THEN '14:30:00'::time
          WHEN nombre = 'NOCTURNA' THEN '22:00:00'::time
          ELSE '13:00:00'::time
        END),
        descripcion = COALESCE(descripcion, CASE 
          WHEN nombre = 'MAÑANA' THEN 'Jornada Mañana (6:30 AM - 12:30 PM)'
          WHEN nombre = 'TARDE' THEN 'Jornada Tarde (12:30 PM - 6:30 PM)'
          WHEN nombre = 'UNICA' THEN 'Jornada Única (6:30 AM - 2:30 PM)'
          WHEN nombre = 'NOCTURNA' THEN 'Jornada Nocturna (6:00 PM - 10:00 PM)'
          ELSE nombre::text
        END)
      WHERE hora_inicio IS NULL OR hora_fin IS NULL;
    `);
    console.log(`✅ Backfill completado: ${updateResult.rowCount} jornadas actualizadas.`);

    // 3. Consultar datos actuales para verificar
    const check = await client.query(`
      SELECT id_jornada, id_colegio, nombre, hora_inicio, hora_fin, descripcion 
      FROM public.jornada 
      ORDER BY id_colegio, nombre;
    `);
    console.log("📊 Estado actual de jornadas:");
    console.table(check.rows);

  } catch (error) {
    console.error("❌ Error en migración de jornadas:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
