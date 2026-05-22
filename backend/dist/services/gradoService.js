"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradoService = void 0;
const db_1 = require("../config/db");
class GradoService {
    static async getAvailable(idColegio) {
        const query = `
      SELECT 
        g.id_grupo as id_grado, 
        ne.nombre as nivel, 
        tg.nombre as tipo_grado, 
        s.nombre as seccion,
        j.nombre as jornada, 
        g.cupos_totales,
        (g.cupos_totales - (
          SELECT COUNT(*) FROM matricula m 
          WHERE m.id_grupo = g.id_grupo AND m.estado IN ('ACTIVA', 'TRASLADADA')
        )) as cupos_restantes
      FROM grupos g
      LEFT JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
      LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
      LEFT JOIN secciones s ON g.id_seccion = s.id_seccion
      LEFT JOIN jornada j ON g.id_jornada = j.id_jornada
      WHERE g.id_colegio = $1
    `;
        const res = await db_1.pool.query(query, [idColegio]);
        return res.rows;
    }
}
exports.GradoService = GradoService;
