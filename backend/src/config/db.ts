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
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

// Manejo de errores en clientes inactivos para evitar caídas del proceso (Unhandled 'error' event)
pool.on('error', (err: Error) => {
  console.warn('⚠️ [PostgreSQL Pool] Error o desconexión en cliente inactivo:', err.message);
});