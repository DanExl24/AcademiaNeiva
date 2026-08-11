"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const envDbHost = process.env.DB_HOST;
dotenv_1.default.config();
const dbHost = envDbHost || process.env.DB_HOST || 'localhost';
exports.pool = new pg_1.Pool({
    host: dbHost,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'AcademiaNeiva',
});
exports.pool.query(`
  ALTER TABLE public.anio_lectivo ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
  ALTER TABLE public.anio_lectivo ADD COLUMN IF NOT EXISTS fecha_fin DATE;
  ALTER TABLE public.docente DROP CONSTRAINT IF EXISTS docente_id_usuario_key;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'docente_id_usuario_id_colegio_key'
    ) THEN
      ALTER TABLE public.docente ADD CONSTRAINT docente_id_usuario_id_colegio_key UNIQUE (id_usuario, id_colegio);
    END IF;
  END $$;
`).catch((err) => console.error("Error adding fecha_inicio/fecha_fin or updating docente constraint:", err));
