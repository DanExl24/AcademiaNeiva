import { pool } from "../../src/config/db";

async function run() {
  try {
    console.log("=== Listing system users ===");
    const res = await pool.query(`
      SELECT u.id_usuario, u.email, u.nombre, array_agg(r.nombre) as roles
      FROM usuario u
      JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
      JOIN rol r ON ur.id_rol = r.id_rol
      GROUP BY u.id_usuario
      LIMIT 15
    `);
    console.log(res.rows);
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}
run();
