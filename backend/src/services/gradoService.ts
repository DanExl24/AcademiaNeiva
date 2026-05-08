import { pool } from "../config/db";

export class GradoService {
  static async getAvailable(idColegio: number) {
    const query = `
      SELECT g.id_grado, g.nivel, g.tipo_grado, j.nombre as jornada, g.cupos_totales,
        (g.cupos_totales - (
          SELECT COUNT(*) FROM matricula m 
          WHERE m.id_grado = g.id_grado AND m.estado = 'ACTIVA'
        )) as cupos_restantes
      FROM grados g
      LEFT JOIN jornada j ON g.id_jornada = j.id_jornada
      WHERE g.id_colegio = $1
    `;
    const res = await pool.query(query, [idColegio]);
    return res.rows;
  }
}
