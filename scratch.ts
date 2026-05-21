import { pool } from "./backend/src/config/db";

async function getColumns() {
  const tables = ['estudiante', 'padre_familia', 'usuario'];
  const client = await pool.connect();
  
  for (const table of tables) {
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [table]);
    console.log(`Table ${table} columns:`, res.rows.map(r => r.column_name).join(', '));
  }
  
  client.release();
  process.exit(0);
}

getColumns();
