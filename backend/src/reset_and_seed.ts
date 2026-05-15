import { pool } from "./config/db";
import bcrypt from "bcrypt";

async function run() {
  const client = await pool.connect();
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
      await client.query(
        `INSERT INTO colegio (id_colegio, nombre, tipo_colegio, sede, contacto, correo, dane) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [i + 1, nombre, tipo, sede, contacto, correo, dane]
      );
    }

    console.log('Insertando año lectivo actual para todos los colegios...');
    for (let cId = 1; cId <= colegios.length; cId++) {
      await client.query(`
        INSERT INTO "año_lectivo" ("id_año", calendario, id_colegio) VALUES 
        ($1, 'A', $1)
      `, [cId]);
    }

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

    // Niveles Escolares (Asignados a todos los colegios para pruebas)
    for (let cId = 1; cId <= colegios.length; cId++) {
      await client.query(`
        INSERT INTO nivel_escolar (nombre, id_colegio) VALUES 
        ('Primera Infancia', $1), ('Primaria', $1), ('Secundaria', $1), ('Bachillerato', $1)
      `, [cId]);
    }

    // Jornadas para todos los colegios
    for (let cId = 1; cId <= 5; cId++) {
      await client.query(`
        INSERT INTO jornada (id_jornada, nombre, id_colegio) VALUES 
        ($1, 'MAÑANA', $4), ($2, 'TARDE', $4), ($3, 'UNICA', $4)
      `, [(cId-1)*3 + 1, (cId-1)*3 + 2, (cId-1)*3 + 3, cId]);
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
              await client.query(
                `INSERT INTO grados (id_grado, nivel, tipo_grado, id_jornada, id_colegio, cupos_totales, seccion) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [gradoId++, nivel.level, gType, idJornada, cId, 30, seccion]
              );
            }
          }
        }
      }
    }

    console.log('Creando usuarios de prueba (Directivos y Docentes)...');
    const hashedAdmin = await bcrypt.hash('admin123', 10);
    const hashedDocente = await bcrypt.hash('docente123', 10);

    for (let i = 0; i < colegios.length; i++) {
      const cId = i + 1;
      const [nombre, tipo, sede, contacto, correoColegio, dane] = colegios[i];
      const domain = (correoColegio as string).split('@')[1];

      // 1. Directivo
      const dirUserRes = await client.query(
        `INSERT INTO usuario (correo, password, id_colegio) VALUES ($1, $2, $3) RETURNING id_usuario`,
        [correoColegio, hashedAdmin, cId]
      );
      const idDirUser = dirUserRes.rows[0].id_usuario;
      await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, 1)`, [idDirUser]);
      await client.query(`INSERT INTO directivo (id_colegio, id_usuario) VALUES ($1, $2)`, [cId, idDirUser]);

      // 2. Docente
      const correoDocente = `docente@${domain}`;
      const docUserRes = await client.query(
        `INSERT INTO usuario (correo, password, id_colegio) VALUES ($1, $2, $3) RETURNING id_usuario`,
        [correoDocente, hashedDocente, cId]
      );
      const idDocUser = docUserRes.rows[0].id_usuario;
      await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, 2)`, [idDocUser]);
      await client.query(
        `INSERT INTO docente (nombre, apellido, documento, id_tipodocumento, id_colegio, id_usuario) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Docente', `Prueba ${cId}`, `DOC-${cId}`, 3, cId, idDocUser]
      );
    }

    await client.query('COMMIT');
    console.log(`Base de datos reseteada. Se crearon 5 colegios con ${gradoId - 1} grados en total.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error durante el reseteo:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
