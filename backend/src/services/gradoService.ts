import { db } from "../config/kysely";
import { sql } from "kysely";

export class GradoService {
  static async getAvailable(idColegio: number) {
    const rows = await db
      .selectFrom("grupos as g")
      .leftJoin("nivel_escolar as ne", "ne.id_nivel", "g.id_nivel")
      .leftJoin("tipo_grado as tg", "tg.id_tipo_grado", "g.id_tipo_grado")
      .leftJoin("secciones as s", "s.id_seccion", "g.id_seccion")
      .leftJoin("jornada as j", "j.id_jornada", "g.id_jornada")
      .select([
        "g.id_grupo as id_grado",
        "ne.nombre as nivel",
        "tg.nombre as tipo_grado",
        "s.nombre as seccion",
        "j.nombre as jornada",
        "g.cupos_totales",
        sql<number>`(g.cupos_totales - (
          SELECT COUNT(*)::int FROM matricula m 
          WHERE m.id_grupo = g.id_grupo AND m.estado IN ('ACTIVA', 'TRASLADADA')
        ))`.as("cupos_restantes")
      ])
      .where("g.id_colegio", "=", idColegio)
      .execute();

    return rows;
  }
}
