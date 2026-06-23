"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const competencyMigration_1 = require("./config/competencyMigration");
const schedulerService_1 = require("./services/schedulerService");
const PORT = process.env.PORT || 3000;
async function startServer() {
    try {
        await (0, competencyMigration_1.ensureCompetencySchema)();
        // Iniciar tareas en segundo plano (Scheduler)
        schedulerService_1.SchedulerService.start();
        app_1.default.listen(PORT, () => {
            console.log(`Servidor corriendo en puerto ${PORT}`);
        });
    }
    catch (error) {
        console.error("No se pudo preparar el esquema de competencias:", error);
        process.exit(1);
    }
}
startServer();
