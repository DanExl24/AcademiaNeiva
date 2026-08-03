import { Pool } from "pg";
import dotenv from "dotenv";

const envDbHost = process.env.DB_HOST;
dotenv.config();

const dbHost = envDbHost || process.env.DB_HOST || 'localhost';

export const pool = new Pool({
  host: dbHost,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'AcademiaNeiva',
});

pool.query(`
  ALTER TABLE public.anio_lectivo ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
  ALTER TABLE public.anio_lectivo ADD COLUMN IF NOT EXISTS fecha_fin DATE;
`).catch((err: any) => console.error("Error adding fecha_inicio/fecha_fin to anio_lectivo:", err));