"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
async function seedAcademic() {
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        console.log("Iniciando seeder académico...");
        const idColegio = 1;
        // 1. Niveles Escolares
        console.log("Insertando niveles escolares...");
        await client.query(`
      INSERT INTO nivel_escolar (id_nivel, nombre, id_colegio) VALUES 
      (1, 'PREESCOLAR', $1), 
      (2, 'PRIMARIA', $1), 
      (3, 'SECUNDARIA', $1), 
      (4, 'MEDIA', $1)
      ON CONFLICT (id_nivel) DO NOTHING
    `, [idColegio]);
        // 2. Año Lectivo
        console.log("Insertando año lectivo...");
        await client.query(`
      INSERT INTO "año_lectivo" ("id_año", calendario, id_colegio) VALUES 
      (1, 'A', $1)
      ON CONFLICT ("id_año") DO NOTHING
    `, [idColegio]);
        // 3. Jornadas
        console.log("Insertando jornadas...");
        // Suponemos que id_jornada = 1,2,3 para el colegio 1
        await client.query(`
      INSERT INTO jornada (id_jornada, nombre, id_colegio) VALUES 
      (1, 'MAÑANA', $1), (2, 'TARDE', $1), (3, 'UNICA', $1)
      ON CONFLICT (id_jornada) DO NOTHING
    `, [idColegio]);
        // 4. Secciones
        console.log("Insertando secciones...");
        const seccionesIds = {};
        const secciones = ['A', 'B', 'C'];
        for (let i = 0; i < secciones.length; i++) {
            const result = await client.query(`
        INSERT INTO secciones (nombre) VALUES ($1)
        ON CONFLICT DO NOTHING
        RETURNING id_seccion
      `, [secciones[i]]);
            // Si ya existía, buscar el ID
            if (result.rows.length > 0) {
                seccionesIds[secciones[i]] = result.rows[0].id_seccion;
            }
            else {
                const queryRes = await client.query(`SELECT id_seccion FROM secciones WHERE nombre = $1`, [secciones[i]]);
                seccionesIds[secciones[i]] = queryRes.rows[0].id_seccion;
            }
        }
        // 5. Tipo Grado y Grupos
        const nivelesMap = [
            { id_nivel: 1, grades: ['PREJARDIN', 'JARDIN', 'TRANSICION'] },
            { id_nivel: 2, grades: ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO'] },
            { id_nivel: 3, grades: ['SEXTO', 'SEPTIMO', 'OCTAVO', 'NOVENO'] },
            { id_nivel: 4, grades: ['DECIMO', 'ONCE'] }
        ];
        console.log("Generando tipo_grado y grupos...");
        let grupoId = 1;
        let tipoGradoId = 1;
        for (const nivel of nivelesMap) {
            for (const gType of nivel.grades) {
                // Insertar tipo_grado
                const tipoResult = await client.query(`
          INSERT INTO tipo_grado (id_tipo_grado, nombre, id_nivel) 
          VALUES ($1, $2, $3)
          ON CONFLICT (id_tipo_grado) DO NOTHING
          RETURNING id_tipo_grado
        `, [tipoGradoId, gType, nivel.id_nivel]);
                let currentTipoGradoId = tipoGradoId;
                if (tipoResult.rows.length === 0) {
                    const queryRes = await client.query(`SELECT id_tipo_grado FROM tipo_grado WHERE nombre = $1 AND id_nivel = $2`, [gType, nivel.id_nivel]);
                    currentTipoGradoId = queryRes.rows[0].id_tipo_grado;
                }
                tipoGradoId++;
                // Generar grupos para las 3 jornadas (1,2,3) y 2 secciones (A, B)
                for (let idJornada = 1; idJornada <= 3; idJornada++) {
                    for (const seccionName of ['A', 'B']) {
                        const idSeccion = seccionesIds[seccionName];
                        await client.query(`
              INSERT INTO grupos (id_grupo, id_nivel, id_jornada, id_colegio, id_seccion, cupos_totales, id_tipo_grado)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (id_grupo) DO UPDATE SET
              id_nivel = EXCLUDED.id_nivel, id_jornada = EXCLUDED.id_jornada, id_seccion = EXCLUDED.id_seccion, 
              cupos_totales = EXCLUDED.cupos_totales, id_tipo_grado = EXCLUDED.id_tipo_grado
            `, [grupoId, nivel.id_nivel, idJornada, idColegio, idSeccion, 30, currentTipoGradoId]);
                        grupoId++;
                    }
                }
            }
        }
        await client.query("COMMIT");
        console.log("✅ Seed académico completado exitosamente");
    }
    catch (e) {
        await client.query("ROLLBACK");
        console.error("❌ Error en el seed académico:", e);
    }
    finally {
        client.release();
        process.exit();
    }
}
seedAcademic();
