import { sql } from "kysely";
import { db } from "../config/kysely";

async function countTables() {
  const startTime = Date.now();
  try {
    const dbName = process.env.DB_NAME || "AcademiaNeiva";
    const dbHost = process.env.DB_HOST || "localhost";
    const dbPort = process.env.DB_PORT || "5432";

    console.log(`\n======================================================`);
    console.log(`📊 CONTEO DE TABLAS - BASE DE DATOS`);
    console.log(`======================================================`);
    console.log(`📍 Base de datos: ${dbName} (${dbHost}:${dbPort})`);
    console.log(`📅 Fecha/Hora:    ${new Date().toLocaleString("es-CO")}`);
    console.log(`------------------------------------------------------`);

    // Consulta de tablas físicas en el esquema public usando Kysely
    const tablesResult = await sql<{
      table_name: string;
      approx_rows: string;
    }>`
      SELECT 
        t.table_name,
        COALESCE(c.reltuples::bigint, 0) AS approx_rows
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name ASC
    `.execute(db);

    const tables = tablesResult.rows;
    const totalTables = tables.length;

    console.log(`\n📦 Total de tablas físicas encontradas: ${totalTables}\n`);

    // Formato tabular legible en terminal
    console.log(` #   | Nombre de la Tabla                  | Filas aprox.`);
    console.log(`-----+-------------------------------------+--------------`);

    tables.forEach((row, index) => {
      const idx = String(index + 1).padStart(3, " ");
      const name = row.table_name.padEnd(35, " ");
      const rows = String(Math.max(0, Number(row.approx_rows))).padStart(10, " ");
      console.log(` ${idx} | ${name} | ${rows}`);
    });

    console.log(`-----+-------------------------------------+--------------`);
    console.log(` Total de tablas: ${totalTables}`);
    console.log(` Tiempo de ejecución: ${Date.now() - startTime} ms`);
    console.log(`======================================================\n`);

    // Cierre ordenado de conexiones
    await db.destroy();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error al contar las tablas de la base de datos:", error);
    try {
      await db.destroy();
    } catch (_) {}
    process.exit(1);
  }
}

countTables();
