import { ensureCompetencySchema } from "./backend/src/config/competencyMigration";

async function run() {
  try {
    console.log("Running ensureCompetencySchema...");
    await ensureCompetencySchema();
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

run();
