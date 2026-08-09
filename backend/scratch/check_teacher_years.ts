import { pool } from '../src/config/db';
import { getUserEligibleAcademicYears } from '../src/controllers/academicAdminController';

async function main() {
  const teacherUser = await pool.query(`
    SELECT u.id_usuario, u.email, u.nombre, u.apellido, d.id_docente, d.id_colegio
    FROM docente d
    JOIN usuario u ON u.id_usuario = d.id_usuario
    ORDER BY d.id_docente DESC
    LIMIT 5
  `);
  console.log("Teachers in DB:", teacherUser.rows);

  for (const t of teacherUser.rows) {
    const eligible = await getUserEligibleAcademicYears(t.id_usuario, t.email, ['docente'], t.id_colegio);
    console.log(`Teacher ${t.nombre} ${t.apellido} (id_usuario=${t.id_usuario}, email=${t.email}) eligible years:`, eligible);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
