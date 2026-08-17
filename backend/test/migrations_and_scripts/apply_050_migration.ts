import { pool } from "../../src/config/db";
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    const migrationPath = path.join(__dirname, "../../src/migrations/050_drop_usuario_id_colegio.sql");
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('Aplicando migración 050 (drop usuario.id_colegio)...');
    await pool.query(sql);
    console.log('✅ Migración 050 aplicada con éxito');

    const checkRes = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'usuario' AND column_name = 'id_colegio'
    `);
    console.log(`Columna id_colegio en usuario presente: ${checkRes.rows.length > 0}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al aplicar migración 050:', error);
    process.exit(1);
  }
}

main();
