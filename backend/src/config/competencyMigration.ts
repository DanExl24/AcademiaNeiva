import { pool } from "./db";
import { randomUUID } from "crypto";

// Re-export all domain logic and types from competencyService for backwards compatibility
export * from "../services/competencyService";

/**
 * ensureCompetencySchema
 * 
 * Verifica la conectividad inicial con PostgreSQL y realiza backfill seguro de sync_uuid
 * si existen competencias previas sin identificador de sincronización.
 */
export const ensureCompetencySchema = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    // 1. Verificar conexión activa con PostgreSQL
    await client.query("SELECT 1;");
    console.log("ℹ️ Conexión con PostgreSQL verificada.");

    // 2. Backfill seguro de sync_uuid para competencias existentes sin UUID asignado
    const unmigratedRes = await client.query(`
      SELECT id_colegio, id_anio, id_materia, id_periodo, descripcion, ARRAY_AGG(id_competencia) AS ids
      FROM public.competencias
      WHERE sync_uuid IS NULL
      GROUP BY id_colegio, id_anio, id_materia, id_periodo, descripcion
    `);
    for (const group of unmigratedRes.rows) {
      const uuid = randomUUID();
      await client.query(
        `UPDATE public.competencias SET sync_uuid = $1 WHERE id_competencia = ANY($2::int[])`,
        [uuid, group.ids]
      );
    }
  } catch (error) {
    console.error("Error en ensureCompetencySchema:", error);
    throw error;
  } finally {
    client.release();
  }
};
