import { pool } from "../../src/config/db";
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    const migrationPath = path.join(__dirname, "../../src/migrations/038_traslados_y_usuario_colegio.sql");
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('Aplicando migración 038...');
    await pool.query(sql);
    console.log('✅ Migración 038 aplicada con éxito');

    const testQuery = await pool.query('SELECT COUNT(*)::int AS count FROM usuario_colegio');
    console.log(`Registros iniciales en usuario_colegio: ${testQuery.rows[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al aplicar migración 038:', error);
    process.exit(1);
  }
}

main();
