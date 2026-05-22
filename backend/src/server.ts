import app from "./app";
import { ensureCompetencySchema } from "./config/competencyMigration";

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await ensureCompetencySchema();
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo preparar el esquema de competencias:", error);
    process.exit(1);
  }
}

startServer();
