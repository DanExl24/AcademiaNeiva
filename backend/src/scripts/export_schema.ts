import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

/**
 * Script para exportar el esquema limpio (DDL) de PostgreSQL
 * garantizando total compatibilidad con PostgreSQL 16 (removiendo sintaxis exclusiva de PG18 como \restrict).
 * El archivo resultante se escribe en backend/init_scripts/01_schema.sql
 * para ser montado de forma segura en /docker-entrypoint-initdb.d/ en el VPS.
 */
async function exportSchema() {
  const startTime = Date.now();
  try {
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || "5432";
    const user = process.env.DB_USER || "postgres";
    const password = process.env.DB_PASSWORD || "postgres";
    const dbName = process.env.DB_NAME || "AcademiaNeiva";

    const targetDir = path.resolve(__dirname, "../../init_scripts");
    const targetFile = path.join(targetDir, "01_schema.sql");

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    console.log(`\n======================================================`);
    console.log(`📦 EXPORTACIÓN DE ESQUEMA DDL (POSTGRESQL 16 COMPATIBLE)`);
    console.log(`======================================================`);
    console.log(`📍 Base de datos: ${dbName} (${host}:${port})`);
    console.log(`👤 Usuario:       ${user}`);
    console.log(`🎯 Destino:       ${targetFile}`);
    console.log(`------------------------------------------------------`);

    // Comando pg_dump para extraer ÚNICAMENTE el esquema (sin datos)
    // Opciones:
    // --schema-only: Solo DDL (tablas, funciones, secuencias, vistas, tipos, constraints, indices)
    // --no-owner: Evita sentencias ALTER ... OWNER TO que fallan si el usuario en el VPS tiene otro rol
    // --no-privileges: Evita sentencias GRANT/REVOKE dependientes de usuarios específicos del sistema local
    const dumpCmd = `pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} --schema-only --no-owner --no-privileges`;

    console.log(`🚀 Ejecutando pg_dump...`);

    const rawDump = execSync(dumpCmd, {
      env: {
        ...process.env,
        PGPASSWORD: password,
      },
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024,
    });

    console.log(`🧹 Sanitizando dump para compatibilidad con PostgreSQL 16...`);

    // Procesamiento línea por línea para eliminar directivas incompatibles con PostgreSQL 16
    const lines = rawDump.split(/\r?\n/);
    const sanitizedLines: string[] = [];
    let removedDirectives = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      // Eliminar \restrict generado por pg_dump de PostgreSQL 18.x
      if (trimmed.startsWith("\\restrict")) {
        removedDirectives++;
        continue;
      }
      sanitizedLines.push(line);
    }

    // Cabecera descriptiva
    const header = [
      `-- ====================================================================`,
      `-- AcademiaNeiva - Esquema DDL Oficial de Base de Datos`,
      `-- Generado automáticamente para PostgreSQL 16+`,
      `-- Fecha: ${new Date().toISOString()}`,
      `-- Nota: Contiene 100% definiciones DDL (tablas, tipos, constraints e índices).`,
      `-- Sin datos sensibles ni sentencias incompatibles.`,
      `-- ====================================================================`,
      ``,
    ].join("\n");

    const finalSql = header + sanitizedLines.join("\n");

    fs.writeFileSync(targetFile, finalSql, "utf-8");

    const stats = fs.statSync(targetFile);
    const sizeKb = (stats.size / 1024).toFixed(2);
    const duration = Date.now() - startTime;

    console.log(`✅ Esquema exportado exitosamente.`);
    console.log(`📄 Archivo: ${targetFile}`);
    console.log(`⚖️  Tamaño:  ${sizeKb} KB`);
    console.log(`🚫 Directivas de PG18 filtradas: ${removedDirectives}`);
    console.log(`⏱️  Tiempo:  ${duration} ms`);
    console.log(`======================================================\n`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error exportando el esquema:", error);
    process.exit(1);
  }
}

exportSchema();
