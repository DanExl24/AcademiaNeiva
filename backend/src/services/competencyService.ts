import { PoolClient } from "pg";
import { sql } from "kysely";
import { randomUUID } from "crypto";

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
  client: any,
  schoolId: number,
  groupId: number
): Promise<number[]> => {
  if (client && typeof client.selectFrom === "function") {
    const group = await client
      .selectFrom("grupos")
      .select(["id_tipo_grado"])
      .where("id_grupo", "=", groupId)
      .where("id_colegio", "=", schoolId)
      .executeTakeFirst();

    if (!group) return [];

    const peers = await client
      .selectFrom("grupos")
      .select("id_grupo")
      .where("id_colegio", "=", schoolId)
      .where("id_tipo_grado", "=", group.id_tipo_grado)
      .orderBy("id_grupo", "asc")
      .execute();

    return peers.map((row: any) => Number(row.id_grupo));
  }

  const groupRes = await (client as PoolClient).query<{
    id_tipo_grado: number;
  }>(
    `SELECT id_tipo_grado
     FROM grupos
     WHERE id_grupo = $1 AND id_colegio = $2`,
    [groupId, schoolId]
  );

  if (groupRes.rows.length === 0) {
    return [];
  }

  const { id_tipo_grado } = groupRes.rows[0];
  const peersRes = await (client as PoolClient).query<{ id_grupo: number }>(
    `SELECT id_grupo
     FROM grupos
     WHERE id_colegio = $1
       AND id_tipo_grado = $2
     ORDER BY id_grupo`,
    [schoolId, id_tipo_grado]
  );

  return peersRes.rows.map((row: any) => Number(row.id_grupo));
};

const normalizeCompetencyDescription = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

export const ensureDefaultEvidencias = async (
  client: any,
  competencyId: number,
  schoolId: number
): Promise<void> => {
  if (client && typeof client.selectFrom === "function") {
    const check = await client
      .selectFrom("evidencia_aprendizaje")
      .select("id_evidencia")
      .where("id_competencia", "=", competencyId)
      .limit(1)
      .executeTakeFirst();

    if (!check) {
      await client
        .insertInto("evidencia_aprendizaje")
        .values([
          { id_competencia: competencyId, descripcion: "Reconoce y aplica los conceptos fundamentales de la unidad temática.", orden: 1, id_colegio: schoolId },
          { id_competencia: competencyId, descripcion: "Demuestra capacidad analítica y pensamiento crítico en la resolución de problemas.", orden: 2, id_colegio: schoolId },
          { id_competencia: competencyId, descripcion: "Participa activamente y colabora con sus compañeros en el entorno de aprendizaje.", orden: 3, id_colegio: schoolId }
        ])
        .execute();
    }
    return;
  }

  const checkRes = await client.query(
    "SELECT 1 FROM evidencia_aprendizaje WHERE id_competencia = $1 LIMIT 1",
    [competencyId]
  );
  if (checkRes.rows.length === 0) {
    await client.query(
      `INSERT INTO evidencia_aprendizaje (id_competencia, descripcion, orden, id_colegio)
       VALUES 
         ($1, 'Reconoce y aplica los conceptos fundamentales de la unidad temática.', 1, $2),
         ($1, 'Demuestra capacidad analítica y pensamiento crítico en la resolución de problemas.', 2, $2),
         ($1, 'Participa activamente y colabora con sus compañeros en el entorno de aprendizaje.', 3, $2)`,
      [competencyId, schoolId]
    );
  }
};

export const syncCompetencyAcrossGrade = async (
  client: any,
  context: TeachingContext,
  periodId: number,
  descripcion?: string,
  competencyId?: number,
  idDimension?: number | null
): Promise<CompetencyRow> => {
  const peerGroups = await getGradePeerGroups(client, context.idColegio, context.idGrupo);
  if (peerGroups.length === 0) {
    throw new Error("No se encontraron cursos para sincronizar la competencia del grado");
  }

  const chosenDescription =
    descripcion && normalizeCompetencyDescription(descripcion)
      ? normalizeCompetencyDescription(descripcion)
      : null;

  let syncUuid: string;

  if (client && typeof client.selectFrom === "function") {
    if (competencyId) {
      const compRes = await client
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
        await client
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
      const d = await client
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
        const checkPeer = await client
          .selectFrom("competencias")
          .selectAll()
          .where("sync_uuid", "=", syncUuid)
          .where("id_grupo", "=", peerGroupId)
          .executeTakeFirst();

        if (checkPeer) {
          compRow = await client
            .updateTable("competencias")
            .set({
              descripcion: sharedDescription,
              id_dimension: idDimension !== undefined ? idDimension : null,
            })
            .where("sync_uuid", "=", syncUuid)
            .where("id_grupo", "=", peerGroupId)
            .returningAll()
            .executeTakeFirstOrThrow();
        } else {
          compRow = await client
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
            .executeTakeFirstOrThrow();
          await ensureDefaultEvidencias(client, compRow.id_competencia, context.idColegio);
        }
      } else {
        compRow = await client
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
          .executeTakeFirstOrThrow();
        await ensureDefaultEvidencias(client, compRow.id_competencia, context.idColegio);
      }

      syncedRows.push(compRow);
    }

    const currentGroupRow = syncedRows.find((row) => Number(row.id_grupo) === context.idGrupo);
    if (!currentGroupRow) {
      throw new Error("No se pudo resolver la competencia sincronizada para el curso actual");
    }

    return currentGroupRow;
  }

  if (competencyId) {
    const compRes = await (client as PoolClient).query<{ sync_uuid: string | null }>(
      `SELECT sync_uuid FROM public.competencias WHERE id_competencia = $1`,
      [competencyId]
    );
    if (compRes.rows.length === 0) {
      throw new Error("Competencia no encontrada para editar");
    }

    if (compRes.rows[0].sync_uuid) {
      syncUuid = compRes.rows[0].sync_uuid;
    } else {
      syncUuid = randomUUID();
      await (client as PoolClient).query(
        `UPDATE public.competencias SET sync_uuid = $1 WHERE id_competencia = $2`,
        [syncUuid, competencyId]
      );
    }
  } else {
    syncUuid = randomUUID();
  }

  const sharedDescription =
    chosenDescription ??
    (competencyId
      ? (await (client as PoolClient).query<{ descripcion: string }>(
          `SELECT descripcion FROM public.competencias WHERE id_competencia = $1`,
          [competencyId]
        )).rows[0]?.descripcion
      : null) ??
    DEFAULT_COMPETENCY_DESCRIPTION;

  const syncedRows: CompetencyRow[] = [];
  for (const peerGroupId of peerGroups) {
    let syncedRes;
    if (competencyId) {
      const checkPeer = await (client as PoolClient).query<CompetencyRow>(
        `SELECT * FROM public.competencias WHERE sync_uuid = $1 AND id_grupo = $2`,
        [syncUuid, peerGroupId]
      );
      if (checkPeer.rows.length > 0) {
        syncedRes = await (client as PoolClient).query<CompetencyRow>(
          `UPDATE public.competencias 
           SET descripcion = $1, id_dimension = $2 
           WHERE sync_uuid = $3 AND id_grupo = $4
           RETURNING *`,
          [sharedDescription, idDimension !== undefined ? idDimension : null, syncUuid, peerGroupId]
        );
      } else {
        syncedRes = await (client as PoolClient).query<CompetencyRow>(
          `INSERT INTO public.competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, id_dimension)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [context.idAnio, peerGroupId, context.idMateria, periodId, sharedDescription, context.idColegio, syncUuid, idDimension !== undefined ? idDimension : null]
        );
        await ensureDefaultEvidencias(client, syncedRes.rows[0].id_competencia, context.idColegio);
      }
    } else {
      syncedRes = await (client as PoolClient).query<CompetencyRow>(
        `INSERT INTO public.competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid, id_dimension)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [context.idAnio, peerGroupId, context.idMateria, periodId, sharedDescription, context.idColegio, syncUuid, idDimension !== undefined ? idDimension : null]
      );
      await ensureDefaultEvidencias(client, syncedRes.rows[0].id_competencia, context.idColegio);
    }

    const compRow = syncedRes.rows[0];
    syncedRows.push(compRow);
  }

  const currentGroupRow = syncedRows.find((row) => Number(row.id_grupo) === context.idGrupo);
  if (!currentGroupRow) {
    throw new Error("No se pudo resolver la competencia sincronizada para el curso actual");
  }

  return currentGroupRow;
};

export const harmonizeCompetenciesForSchoolYear = async (
  client: any,
  schoolId: number,
  yearId: number
): Promise<void> => {
  const isKysely = client && typeof client.selectFrom === "function";
  if (isKysely) {
    const competenciesRes = await sql<{
      sync_uuid: string;
      id_grupo: number;
      id_materia: number;
      id_periodo: number;
      descripcion: string;
    }>`SELECT DISTINCT ON (c.sync_uuid) c.sync_uuid, c.id_grupo, c.id_materia, c.id_periodo, c.descripcion
       FROM public.competencias c
       WHERE c.id_colegio = ${schoolId} AND c.id_anio = ${yearId} AND c.sync_uuid IS NOT NULL`.execute(client);

    for (const row of competenciesRes.rows) {
      const peerGroups = await getGradePeerGroups(client, schoolId, row.id_grupo);
      for (const peerGroupId of peerGroups) {
        const existCheck = await sql`SELECT id_competencia FROM public.competencias WHERE sync_uuid = ${row.sync_uuid} AND id_grupo = ${peerGroupId}`.execute(client);
        if (existCheck.rows.length === 0) {
          const insertRes = await sql<{ id_competencia: number }>`INSERT INTO public.competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid)
             VALUES (${yearId}, ${peerGroupId}, ${row.id_materia}, ${row.id_periodo}, ${row.descripcion}, ${schoolId}, ${row.sync_uuid})
             RETURNING id_competencia`.execute(client);
          await ensureDefaultEvidencias(client, insertRes.rows[0].id_competencia, schoolId);
        } else {
          await sql`UPDATE public.competencias SET descripcion = ${row.descripcion} WHERE sync_uuid = ${row.sync_uuid} AND id_grupo = ${peerGroupId}`.execute(client);
        }
      }
    }
    return;
  }

  const competenciesRes = await (client as PoolClient).query<{
    sync_uuid: string;
    id_grupo: number;
    id_materia: number;
    id_periodo: number;
    descripcion: string;
  }>(
    `SELECT DISTINCT ON (c.sync_uuid) c.sync_uuid, c.id_grupo, c.id_materia, c.id_periodo, c.descripcion
     FROM public.competencias c
     WHERE c.id_colegio = $1 AND c.id_anio = $2 AND c.sync_uuid IS NOT NULL`,
    [schoolId, yearId]
  );

  for (const row of competenciesRes.rows) {
    const peerGroups = await getGradePeerGroups(client, schoolId, row.id_grupo);
    for (const peerGroupId of peerGroups) {
      const existCheck = await client.query(
        `SELECT id_competencia FROM public.competencias WHERE sync_uuid = $1 AND id_grupo = $2`,
        [row.sync_uuid, peerGroupId]
      );
      if (existCheck.rows.length === 0) {
        const insertRes = await client.query(
          `INSERT INTO public.competencias (id_anio, id_grupo, id_materia, id_periodo, descripcion, id_colegio, sync_uuid)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id_competencia`,
          [yearId, peerGroupId, row.id_materia, row.id_periodo, row.descripcion, schoolId, row.sync_uuid]
        );
        await ensureDefaultEvidencias(client, insertRes.rows[0].id_competencia, schoolId);
      } else {
        await client.query(
          `UPDATE public.competencias SET descripcion = $1 WHERE sync_uuid = $2 AND id_grupo = $3`,
          [row.descripcion, row.sync_uuid, peerGroupId]
        );
      }
    }
  }
};

export const ensureCompetencyForContext = async (
  client: any,
  context: TeachingContext,
  periodId: number
): Promise<CompetencyRow | null> => {
  if (client && typeof client.selectFrom === "function") {
    const existRes = await client
      .selectFrom("competencias")
      .selectAll()
      .where("id_anio", "=", context.idAnio)
      .where("id_grupo", "=", context.idGrupo)
      .where("id_materia", "=", context.idMateria)
      .where("id_periodo", "=", periodId)
      .where("id_colegio", "=", context.idColegio)
      .orderBy(
        sql`CASE WHEN descripcion = 'Competencia pendiente por definir.' THEN 1 ELSE 0 END`,
        "asc"
      )
      .orderBy("id_competencia", "asc")
      .limit(1)
      .executeTakeFirst();

    return (existRes as CompetencyRow) || null;
  }

  const existRes = await (client as PoolClient).query<CompetencyRow>(
    `SELECT * FROM public.competencias 
     WHERE id_anio = $1 AND id_grupo = $2 AND id_materia = $3 AND id_periodo = $4 AND id_colegio = $5
     ORDER BY CASE WHEN descripcion = 'Competencia pendiente por definir.' THEN 1 ELSE 0 END ASC, id_competencia ASC
     LIMIT 1`,
    [context.idAnio, context.idGrupo, context.idMateria, periodId, context.idColegio]
  );

  if (existRes.rows.length > 0) {
    return existRes.rows[0];
  }

  return null;
};
