"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
async function run() {
    const client = await db_1.pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Vacunando base de datos...');
        // Truncar todas las tablas relevantes (CASCADE elimina dependencias)
        await client.query(`
      TRUNCATE 
        matricula, 
        documento_matriculas, 
        estudiante, 
        padre_familia, 
        detalle_padrefamilia, 
        colegio, 
        nivel_escolar, 
        tipo_documento, 
        grados,
        jornada,
        "año_lectivo",
        usuario,
        rol,
        usuario_rol
      RESTART IDENTITY CASCADE;
    `);
        console.log('Insertando colegios solicitados...');
        const colegios = [
            ['CEA School Empresarial de los Andes', 'Privado', 'Sede Principal', 3183118044, 'rectoria@ceaschool.edu.co', '341001005652'],
            ['Institución Educativa El Caguán', 'Oficial', 'Sede Principal', 3180000000, 'iecaguan@alcaldianeiva.gov.co', '441001002747'],
            ['Colegio Heisenberg Neiva', 'Privado', 'Sede Principal', 3169100003, 'colegioheisenberg@hotmail.com', 'DANE-H-001'],
            ['Colegio Claretiano de Neiva', 'Privado', 'Sede Principal', 3161720175, 'admisiones@claretianoneiva.edu.co', 'DANE-C-002'],
            ['Colegio IDESA', 'Privado', 'Sede Principal', 3153077861, 'info@colegioidesa.com.co', 'DANE-I-003']
        ];
        for (let i = 0; i < colegios.length; i++) {
            const [nombre, tipo, sede, contacto, correo, dane] = colegios[i];
            await client.query(`INSERT INTO colegio (id_colegio, nombre, tipo_colegio, sede, contacto, correo, dane) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [i + 1, nombre, tipo, sede, contacto, correo, dane]);
        }
        console.log('Insertando año lectivo actual...');
        await client.query(`
      INSERT INTO "año_lectivo" ("id_año", calendario, id_colegio) VALUES 
      (1, 'A', 1)
    `);
        console.log('Insertando datos base obligatorios...');
        // Roles Básicos
        await client.query(`
      INSERT INTO rol (id_rol, nombre) VALUES 
      (1, 'DIRECTIVO'), (2, 'DOCENTE'), (3, 'PADRE_FAMILIA'), (4, 'ESTUDIANTE'), (5, 'ADMIN')
      ON CONFLICT DO NOTHING
    `);
        // Tipos de documento
        await client.query(`
      INSERT INTO tipo_documento (id_tipodocumento, tipo) VALUES 
      (1, 'Registro Civil'), (2, 'Tarjeta de Identidad'), (3, 'Cédula de Ciudadanía'), (4, 'Cédula de Extranjería'), (5, 'PEP / PPT')
    `);
        // Niveles Escolares (Asignados al primer colegio por defecto para pruebas)
        await client.query(`
      INSERT INTO nivel_escolar (id_nivel, nombre, id_colegio) VALUES 
      (1, 'Primera Infancia', 1), (2, 'Primaria', 1), (3, 'Secundaria', 1), (4, 'Bachillerato', 1)
    `);
        // Jornadas para todos los colegios
        for (let cId = 1; cId <= 5; cId++) {
            await client.query(`
        INSERT INTO jornada (id_jornada, nombre, id_colegio) VALUES 
        ($1, 'MAÑANA', $4), ($2, 'TARDE', $4), ($3, 'UNICA', $4)
      `, [(cId - 1) * 3 + 1, (cId - 1) * 3 + 2, (cId - 1) * 3 + 3, cId]);
        }
        console.log('Actualizando esquema de grados...');
        await client.query(`
      ALTER TABLE grados ADD COLUMN IF NOT EXISTS seccion VARCHAR(10) DEFAULT 'A';
    `);
        // Grados automáticos para todos los colegios y jornadas
        const nivelesMap = [
            { level: 'PREESCOLAR', grades: ['PREJARDIN', 'JARDIN', 'TRANSICION'] },
            { level: 'PRIMARIA', grades: ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO'] },
            { level: 'SECUNDARIA', grades: ['SEXTO', 'SEPTIMO', 'OCTAVO', 'NOVENO'] },
            { level: 'MEDIA', grades: ['DECIMO', 'ONCE'] }
        ];
        console.log('Generando estructura académica completa (Grados con Secciones A y B)...');
        let gradoId = 1;
        for (let cId = 1; cId <= 5; cId++) {
            for (let jIdx = 0; jIdx < 3; jIdx++) {
                const idJornada = (cId - 1) * 3 + (jIdx + 1);
                for (const nivel of nivelesMap) {
                    for (const gType of nivel.grades) {
                        for (const seccion of ['A', 'B']) {
                            await client.query(`INSERT INTO grados (id_grado, nivel, tipo_grado, id_jornada, id_colegio, cupos_totales, seccion) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`, [gradoId++, nivel.level, gType, idJornada, cId, 30, seccion]);
                        }
                    }
                }
            }
        }
        await client.query('COMMIT');
        console.log(`Base de datos reseteada. Se crearon 5 colegios con ${gradoId - 1} grados en total.`);
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Error durante el reseteo:', err);
    }
    finally {
        client.release();
        await db_1.pool.end();
    }
}
run();
