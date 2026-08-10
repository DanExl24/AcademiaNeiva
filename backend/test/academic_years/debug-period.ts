import { pool } from "../../src/config/db";
import { getCurrentAllowedPeriodForSchool } from "../../src/utils/periodHelpers";

async function run() {
  try {
    console.log("=== Debugging Period for School 1 ===");
    const period = await getCurrentAllowedPeriodForSchool(1);
    console.log("Allowed Period:", period);

    const allPeriodsRes = await pool.query("SELECT * FROM periodo_academico");
    console.log("All periods:", allPeriodsRes.rows);

    const schoolRes = await pool.query("SELECT * FROM colegio");
    console.log("All schools:", schoolRes.rows);
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await pool.end();
  }
}
run();
