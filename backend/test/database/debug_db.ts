import { pool } from "../../src/config/db";

async function check() {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tipo_documento'");
  console.log("Columns of tipo_documento:", res.rows);
  const res2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'colegio'");
  console.log("Columns of colegio:", res2.rows);
  const res3 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'docente'");
  console.log("Columns of docente:", res3.rows);
  const res4 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'padre_familia'");
  console.log("Columns of padre_familia:", res4.rows);
  const res6 = await pool.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'matricula'");
  console.log("Nullability of matricula:", res6.rows);
  process.exit();
}
check();
