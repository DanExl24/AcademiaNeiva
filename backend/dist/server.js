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
    try {
        await (0, competencyMigration_1.ensureCompetencySchema)();
        // Iniciar tareas en segundo plano (Scheduler)
        schedulerService_1.SchedulerService.start();
        // Crear servidor HTTP y adjuntar Socket.io
        const httpServer = http_1.default.createServer(app_1.default);
        socketManager_1.socketManager.init(httpServer);
        httpServer.listen(PORT, () => {
            console.log(`Servidor corriendo en puerto ${PORT}`);
        });
    }
    catch (error) {
        console.error("No se pudo preparar el esquema de competencias:", error);
        process.exit(1);
    }
}
startServer();
