import http from "http";
import app from "./app";
import { ensureCompetencySchema } from "./config/competencyMigration";
import { SchedulerService } from "./services/schedulerService";
import { socketManager } from "./services/socketManager";

const PORT = process.env.PORT || 3000;

async function startServer() {
  const maxRetries = 10;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await ensureCompetencySchema();
      console.log("Esquema de competencias y base de datos verificado correctamente.");
      break;
    } catch (error) {
      retries++;
      console.error(`Error preparando el esquema de competencias (Intento ${retries}/${maxRetries}):`, error);
      if (retries >= maxRetries) {
        console.error("No se pudo conectar a la base de datos tras múltiples intentos. Finalizando proceso.");
        process.exit(1);
      }
      console.log("Esperando 3 segundos antes de reintentar...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // Iniciar tareas en segundo plano (Scheduler)
  SchedulerService.start();

  // Crear servidor HTTP y adjuntar Socket.io
  const httpServer = http.createServer(app);
  socketManager.init(httpServer);

  httpServer.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Servidor corriendo en puerto ${PORT} (0.0.0.0)`);
  });
}

startServer();

