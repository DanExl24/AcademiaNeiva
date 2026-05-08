import { pool } from "./config/db";

async function f() {
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%o_lectivo'");
  console.log(r.rows);
}
f().finally(() => pool.end());
