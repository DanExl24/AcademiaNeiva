import { pool } from '../src/config/db';

async function main() {
  const teacher = await pool.query(`
    SELECT d.id_docente, d.id_usuario, d.id_colegio, u.nombre, u.apellido, u.email, u.fecha_creacion
    FROM docente d
    JOIN usuario u ON u.id_usuario = d.id_usuario
    WHERE u.email = 'alejopmotta@gmail.com'
  `);
  console.log("Teacher Jorge details:", teacher.rows);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
