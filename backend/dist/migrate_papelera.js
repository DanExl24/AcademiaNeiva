"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });
const pool = new pg_1.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});
async function migrate() {
    const client = await pool.connect();
    try {
        console.log(`Conectando a la base de datos: ${process.env.DB_NAME}...`);
        const query = `
      CREATE TABLE IF NOT EXISTS papelera_materias (
        id_papelera SERIAL PRIMARY KEY,
        id_colegio INT,
        nombre_materia VARCHAR(255),
        data_respaldo JSONB,
        fecha_borrado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
        await client.query(query);
        console.log('Tabla "papelera_materias" creada correctamente.');
        // Verificar creación
        const check = await client.query("SELECT to_regclass('public.papelera_materias') as exists;");
        if (check.rows[0].exists) {
            console.log('Verificación exitosa: La tabla existe.');
        }
        else {
            console.log('Error: La tabla no se pudo crear.');
        }
    }
    catch (err) {
        console.error('Error durante la migración:', err);
    }
    finally {
        client.release();
        await pool.end();
    }
}
migrate();
