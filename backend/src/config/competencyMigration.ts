import { sql } from "kysely";
import { randomUUID } from "crypto";
import { db } from "./kysely";

// Re-export all domain logic and types from competencyService for backwards compatibility
export * from "../services/competencyService";

/**
 * ensureCompetencySchema
 * 
 * Verifica la conectividad inicial con PostgreSQL y realiza backfill seguro de sync_uuid
 * si existen competencias previas sin identificador de sincronización.
 */
export const ensureCompetencySchema = async (): Promise<void> => {
  try {
    // 1. Verificar conexión activa con PostgreSQL
    await sql`SELECT 1`.execute(db);
    console.log("ℹ️ Conexión con PostgreSQL verificada.");

    // 2. Backfill seguro de sync_uuid para competencias existentes sin UUID asignado
    const unmigrated = await db
      .selectFrom("competencias")
      .select([
        "id_colegio",
        "id_anio",
        "id_materia",
        "id_periodo",
        "descripcion",
        sql<number[]>`ARRAY_AGG(id_competencia)`.as("ids"),
      ])
      .where("sync_uuid", "is", null)
      .groupBy(["id_colegio", "id_anio", "id_materia", "id_periodo", "descripcion"])
      .execute();

    for (const group of unmigrated) {
      if (!group.ids || group.ids.length === 0) continue;
      const uuid = randomUUID();
      await db
        .updateTable("competencias")
        .set({ sync_uuid: uuid })
        .where("id_competencia", "in", group.ids)
        .execute();
    }
  } catch (error) {
    console.error("Error en ensureCompetencySchema:", error);
    throw error;
  }
};
