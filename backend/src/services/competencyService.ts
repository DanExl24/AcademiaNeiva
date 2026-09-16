import { Kysely, Transaction, sql } from "kysely";
import { randomUUID } from "crypto";
import { DB } from "../types/db.types";
import { db } from "../config/kysely";

export type DbOrTrx = Kysely<DB> | Transaction<DB>;

export const DEFAULT_COMPETENCY_DESCRIPTION = "Competencia pendiente por definir.";
export const DEFAULT_COMPETENCY_TEXT = DEFAULT_COMPETENCY_DESCRIPTION;

export interface TeachingContext {
  idDetalleGrado: number;
  idGrupo: number;
  idMateria: number;
  idColegio: number;
  idAnio: number;
}

export interface CompetencyRow {
  id_competencia: number;
  id_anio: number;
  id_grupo: number;
  id_materia: number;
  id_periodo: number;
  descripcion: string;
  id_colegio: number;
  sync_uuid?: string | null;
  id_dimension?: number | null;
}

export const getGradePeerGroups = async (
  client: DbOrTrx = db,
  schoolId: number,
  groupId: number
): Promise<number[]> => {
  const executor = (client && typeof (client as any).selectFrom === "function") ? client : db;

  const group = await executor
    .selectFrom("grupos")
    .select(["id_tipo_grado"])
    .where("id_grupo", "=", groupId)
    .where("id_colegio", "=", schoolId)
    .executeTakeFirst();

  if (!group) return [];

  const peers = await executor
    .selectFrom("grupos")
    .select("id_grupo")
    .where("id_colegio", "=", schoolId)
    .where("id_tipo_grado", "=", group.id_tipo_grado)
    .orderBy("id_grupo", "asc")
    .execute();

  return peers.map((row) => Number(row.id_grupo));
};

const normalizeCompetencyDescription = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

export const ensureDefaultEvidencias = async (
  client: DbOrTrx = db,
  competencyId: number,
  schoolId: number
): Promise<void> => {
  const executor = (client && typeof (client as any).selectFrom === "function") ? client : db;

  const check = await executor
    .selectFrom("evidencia_aprendizaje")
    .select("id_evidencia")
    .where("id_competencia", "=", competencyId)
    .limit(1)
    .executeTakeFirst();

  if (!check) {
    await executor
      .insertInto("evidencia_aprendizaje")
      .values([
        { id_competencia: competencyId, descripcion: "Reconoce y aplica los conceptos fundamentales de la unidad temática.", orden: 1, id_colegio: schoolId },
        { id_competencia: competencyId, descripcion: "Demuestra capacidad analítica y pensamiento crítico en la resolución de problemas.", orden: 2, id_colegio: schoolId },
        { id_competencia: competencyId, descripcion: "Participa activamente y colabora con sus compañeros en el entorno de aprendizaje.", orden: 3, id_colegio: schoolId }
      ])
      .execute();
  }
};

export const syncCompetencyAcrossGrade = async (
  client: DbOrTrx = db,
  context: TeachingContext,
  periodId: number,
  descripcion?: string,
  competencyId?: number,
  idDimension?: number | null
): Promise<CompetencyRow> => {
  const executor = (client && typeof (client as any).selectFrom === "function") ? client : db;

  const peerGroups = await getGradePeerGroups(executor, context.idColegio, context.idGrupo);
  if (peerGroups.length === 0) {
    throw new Error("No se encontraron cursos para sincronizar la competencia del grado");
  }

  const chosenDescription =
    descripcion && normalizeCompetencyDescription(descripcion)
      ? normalizeCompetencyDescription(descripcion)
      : null;

  let syncUuid: string;

  if (competencyId) {
    const compRes = await executor
      .selectFrom("competencias")
      .select("sync_uuid")
      .where("id_competencia", "=", competencyId)
      .executeTakeFirst();
    if (!compRes) {
      throw new Error("Competencia no encontrada para editar");
    }

    if (compRes.sync_uuid) {
      syncUuid = compRes.sync_uuid;
    } else {
      syncUuid = randomUUID();
      await executor
        .updateTable("competencias")
        .set({ sync_uuid: syncUuid })
        .where("id_competencia", "=", competencyId)
        .execute();
    }
  } else {
    syncUuid = randomUUID();
  }

  let sharedDescription = chosenDescription;
  if (!sharedDescription && competencyId) {
    const d = await executor
      .selectFrom("competencias")
      .select("descripcion")
      .where("id_competencia", "=", competencyId)
      .executeTakeFirst();
    sharedDescription = d?.descripcion ?? null;
  }
  if (!sharedDescription) {
    sharedDescription = DEFAULT_COMPETENCY_DESCRIPTION;
  }

  const syncedRows: CompetencyRow[] = [];
  for (const peerGroupId of peerGroups) {
    let compRow: CompetencyRow;
    if (competencyId) {
      const checkPeer = await executor
        .selectFrom("competencias")
        .selectAll()
        .where("sync_uuid", "=", syncUuid)
        .where("id_grupo", "=", peerGroupId)
        .executeTakeFirst();

      if (checkPeer) {
        compRow = (await executor
          .updateTable("competencias")
          .set({
            descripcion: sharedDescription,
            id_dimension: idDimension !== undefined ? idDimension : null,
          })
          .where("sync_uuid", "=", syncUuid)
          .where("id_grupo", "=", peerGroupId)
          .returningAll()
          .executeTakeFirstOrThrow()) as CompetencyRow;
      } else {
        compRow = (await executor
          .insertInto("competencias")
          .values({
            id_anio: context.idAnio,
            id_grupo: peerGroupId,
            id_materia: context.idMateria,
            id_periodo: periodId,
            descripcion: sharedDescription,
            id_colegio: context.idColegio,
            sync_uuid: syncUuid,
            id_dimension: idDimension !== undefined ? idDimension : null,
          })
          .returningAll()
          .executeTakeFirstOrThrow()) as CompetencyRow;
        await ensureDefaultEvidencias(executor, compRow.id_competencia, context.idColegio);
      }
    } else {
      compRow = (await executor
        .insertInto("competencias")
        .values({
          id_anio: context.idAnio,
          id_grupo: peerGroupId,
          id_materia: context.idMateria,
          id_periodo: periodId,
          descripcion: sharedDescription,
          id_colegio: context.idColegio,
          sync_uuid: syncUuid,
          id_dimension: idDimension !== undefined ? idDimension : null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()) as CompetencyRow;
      await ensureDefaultEvidencias(executor, compRow.id_competencia, context.idColegio);
    }

    syncedRows.push(compRow);
  }

  const currentGroupRow = syncedRows.find((row) => Number(row.id_grupo) === context.idGrupo);
  if (!currentGroupRow) {
    throw new Error("No se pudo resolver la competencia sincronizada para el curso actual");
  }

  return currentGroupRow;
};

export const harmonizeCompetenciesForSchoolYear = async (
  client: DbOrTrx = db,
  schoolId: number,
  yearId: number
): Promise<void> => {
  const executor = (client && typeof (client as any).selectFrom === "function") ? client : db;

  const competencies = await executor
    .selectFrom("competencias as c")
    .distinctOn("c.sync_uuid")
    .select(["c.sync_uuid", "c.id_grupo", "c.id_materia", "c.id_periodo", "c.descripcion"])
    .where("c.id_colegio", "=", schoolId)
    .where("c.id_anio", "=", yearId)
    .where("c.sync_uuid", "is not", null)
    .execute();

  for (const row of competencies) {
    if (!row.sync_uuid) continue;
    const peerGroups = await getGradePeerGroups(executor, schoolId, row.id_grupo);
    for (const peerGroupId of peerGroups) {
      const existCheck = await executor
        .selectFrom("competencias")
        .select("id_competencia")
        .where("sync_uuid", "=", row.sync_uuid)
        .where("id_grupo", "=", peerGroupId)
        .executeTakeFirst();

      if (!existCheck) {
        const insertRes = await executor
          .insertInto("competencias")
          .values({
            id_anio: yearId,
            id_grupo: peerGroupId,
            id_materia: row.id_materia,
            id_periodo: row.id_periodo,
            descripcion: row.descripcion,
            id_colegio: schoolId,
            sync_uuid: row.sync_uuid,
          })
          .returning("id_competencia")
          .executeTakeFirstOrThrow();
        await ensureDefaultEvidencias(executor, insertRes.id_competencia, schoolId);
      } else {
        await executor
          .updateTable("competencias")
          .set({ descripcion: row.descripcion })
          .where("sync_uuid", "=", row.sync_uuid)
          .where("id_grupo", "=", peerGroupId)
          .execute();
      }
    }
  }
};

export const ensureCompetencyForContext = async (
  client: DbOrTrx = db,
  context: TeachingContext,
  periodId: number
): Promise<CompetencyRow | null> => {
  const executor = (client && typeof (client as any).selectFrom === "function") ? client : db;

  const existRes = await executor
    .selectFrom("competencias")
    .selectAll()
    .where("id_anio", "=", context.idAnio)
    .where("id_grupo", "=", context.idGrupo)
    .where("id_materia", "=", context.idMateria)
    .where("id_periodo", "=", periodId)
    .where("id_colegio", "=", context.idColegio)
    .orderBy(
      sql`CASE WHEN descripcion = ${DEFAULT_COMPETENCY_DESCRIPTION} THEN 1 ELSE 0 END`,
      "asc"
    )
    .orderBy("id_competencia", "asc")
    .limit(1)
    .executeTakeFirst();

  return (existRes as CompetencyRow) || null;
};
