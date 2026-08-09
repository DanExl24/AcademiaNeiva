"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const competencyMigration_1 = require("./config/competencyMigration");
const schedulerService_1 = require("./services/schedulerService");
const socketManager_1 = require("./services/socketManager");
const PORT = process.env.PORT || 3000;
async function startServer() {
    const maxRetries = 10;
    let retries = 0;
    while (retries < maxRetries) {
        try {
            await (0, competencyMigration_1.ensureCompetencySchema)();
            console.log("Esquema de competencias y base de datos verificado correctamente.");
            break;
        }
        catch (error) {
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
    schedulerService_1.SchedulerService.start();
    // Crear servidor HTTP y adjuntar Socket.io
    const httpServer = http_1.default.createServer(app_1.default);
    socketManager_1.socketManager.init(httpServer);
    httpServer.listen(Number(PORT), "0.0.0.0", () => {
        console.log(`Servidor corriendo en puerto ${PORT} (0.0.0.0)`);
    });
}
startServer();
