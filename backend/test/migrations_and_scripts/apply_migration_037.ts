import fs from 'fs';
import path from 'path';
import { pool } from "../../src/config/db";

async function main() {
  const sqlPath = path.join(__dirname, "../../src/migrations/037_prevent_academic_writes_on_closed_subject.sql");
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log("✅ Migración 037 aplicada correctamente.");
  await pool.end();
}

main().catch(console.error);
