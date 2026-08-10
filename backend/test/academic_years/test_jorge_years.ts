import { pool } from "../../src/config/db";
import { getUserEligibleAcademicYears } from "../../src/controllers/academicAdminController";

async function main() {
  const years = await getUserEligibleAcademicYears(31, 'alejopmotta@gmail.com', ['docente'], 1);
  console.log("Eligible years for Jorge (id_usuario=31):", years);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
