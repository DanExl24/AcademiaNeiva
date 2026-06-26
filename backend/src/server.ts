import http from "http";
import app from "./app";
import { ensureCompetencySchema } from "./config/competencyMigration";
import { SchedulerService } from "./services/schedulerService";
import { socketManager } from "./services/socketManager";

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await ensureCompetencySchema();
    
    // Iniciar tareas en segundo plano (Scheduler)
    SchedulerService.start();

    // Crear servidor HTTP y adjuntar Socket.io
    const httpServer = http.createServer(app);
    socketManager.init(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo preparar el esquema de competencias:", error);
    process.exit(1);
  }
}

startServer();

