import { pool } from "./config/db";
import { ensureCompetencySchema } from "./config/competencyMigration";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Asegurar estructura de autenticación primero
    console.log('Asegurando estructura de autenticación...');
    const authSql = fs.readFileSync(path.join(__dirname, 'config/auth.migration.sql'), 'utf8');
    await client.query(authSql);
    await ensureCompetencySchema();

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
        usuario_rol,
        materias,
        detalle_grados,
        competencias,
        periodo_academico,
        escala_valoracion,
        actividad_materia,
        notas_actividad
      RESTART IDENTITY CASCADE;
    `);

    console.log('Insertando roles...');
    const roles = ['admin', 'directivo', 'docente', 'estudiante', 'padre'];
    for (const role of roles) {
      await client.query('INSERT INTO rol (nombre) VALUES ($1) ON CONFLICT DO NOTHING', [role]);
    }

    console.log('Insertando colegios solicitados...');
    const colegios = [
      ['CEA School Empresarial de los Andes', 'Privado', 'Sede Principal', 3183118044, 'rectoria@ceaschool.edu.co', '341001005652', 'ceaschool.edu.co'],
      ['Institución Educativa El Caguán', 'Oficial', 'Sede Principal', 3180000000, 'iecaguan@alcaldianeiva.gov.co', '441001002747', 'iecaguan.edu.co'],
      ['Colegio Heisenberg Neiva', 'Privado', 'Sede Principal', 3169100003, 'colegioheisenberg@hotmail.com', 'DANE-H-001', 'heisenberg.edu.co'],
      ['Colegio Claretiano de Neiva', 'Privado', 'Sede Principal', 3161720175, 'admisiones@claretianoneiva.edu.co', 'DANE-C-002', 'claretianoneiva.edu.co'],
      ['Colegio IDESA', 'Privado', 'Sede Principal', 3153077861, 'info@colegioidesa.com.co', 'DANE-I-003', 'colegioidesa.edu.co']
    ];

    for (let i = 0; i < colegios.length; i++) {
      const [nombre, tipo, sede, contacto, correo, dane, domain] = colegios[i];
      await client.query(
        `INSERT INTO colegio (id_colegio, nombre, tipo_colegio, sede, contacto, correo, dane) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [i + 1, nombre, tipo, sede, contacto, correo, dane]
      );
    }

    console.log('Insertando datos base obligatorios...');
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

    // Insertar año lectivo actual...
    await client.query(`
      INSERT INTO "año_lectivo" ("id_año", calendario, id_colegio) VALUES 
      (1, 'A', 1)
    `);

    const passwordHash = await bcrypt.hash('docente123', 10);
    const directivoHash = await bcrypt.hash('directivo123', 10);

    for (let i = 0; i < colegios.length; i++) {
      const [nombre, tipo, sede, contacto, correo, dane, domain] = colegios[i];
      const cId = i + 1;

      // Crear Directivo de prueba para este colegio
      const dirEmail = `directivo@${domain}`;
      const dirUser = await client.query(
        `INSERT INTO usuario (email, password, nombre, id_colegio) VALUES ($1, $2, $3, $4) RETURNING id_usuario`,
        [dirEmail, directivoHash, `Directivo ${nombre}`, cId]
      );
      await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, (SELECT id_rol FROM rol WHERE nombre = 'directivo'))`, [dirUser.rows[0].id_usuario]);

      // Crear Docente de prueba para este colegio
      const docEmail = `docente@${domain}`;
      const docUser = await client.query(
        `INSERT INTO usuario (email, password, nombre, id_colegio) VALUES ($1, $2, $3, $4) RETURNING id_usuario`,
        [docEmail, passwordHash, `Docente ${nombre}`, cId]
      );
      const idUsuarioDocente = docUser.rows[0].id_usuario;
      await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, (SELECT id_rol FROM rol WHERE nombre = 'docente'))`, [idUsuarioDocente]);

      // Crear registro en tabla docente y vincular con usuario
      await client.query(
        `INSERT INTO docente (id_docente, nombre, apellido, documento, id_tipodocumento, id_colegio, id_usuario) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [i + 1, `Docente`, nombre, `DOC-${i+1}`, 3, cId, idUsuarioDocente]
      );
    }

    // Jornadas para todos los colegios
    for (let cId = 1; cId <= 5; cId++) {
      await client.query(`
        INSERT INTO jornada (id_jornada, nombre, id_colegio) VALUES 
        ($1, 'MAÑANA', $4), ($2, 'TARDE', $4), ($3, 'UNICA', $4)
      `, [(cId-1)*3 + 1, (cId-1)*3 + 2, (cId-1)*3 + 3, cId]);

      // Insertar Periodos Académicos
      await client.query(`
        INSERT INTO periodo_academico (id_periodo, nombre, estado, porcentaje, "id_año", id_colegio) VALUES
        ($1, 'Primer Periodo', 'ABIERTO', 25, 1, $5),
        ($2, 'Segundo Periodo', 'CERRADO', 25, 1, $5),
        ($3, 'Tercer Periodo', 'CERRADO', 25, 1, $5),
        ($4, 'Cuarto Periodo', 'CERRADO', 25, 1, $5)
      `, [(cId-1)*4 + 1, (cId-1)*4 + 2, (cId-1)*4 + 3, (cId-1)*4 + 4, cId]);

      // Insertar Escala de Valoración Nacional (0.0 a 5.0)
      await client.query(`
        INSERT INTO escala_valoracion (id_escalavaloracion, nivel, valor_minimo, valor_maximo, id_colegio) VALUES
        ($1, 'SUPERIOR', 4.6, 5.0, $5),
        ($2, 'ALTO', 4.0, 4.5, $5),
        ($3, 'BASICO', 3.0, 3.9, $5),
        ($4, 'BAJO', 0.0, 2.9, $5)
      `, [(cId-1)*4 + 1, (cId-1)*4 + 2, (cId-1)*4 + 3, (cId-1)*4 + 4, cId]);
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
    let gradosList = [];
    for (let cId = 1; cId <= 5; cId++) {
      for (let jIdx = 0; jIdx < 3; jIdx++) {
        const idJornada = (cId - 1) * 3 + (jIdx + 1);
        for (const nivel of nivelesMap) {
          for (const gType of nivel.grades) {
            for (const seccion of ['A', 'B']) {
              await client.query(
                `INSERT INTO grados (id_grado, nivel, tipo_grado, id_jornada, id_colegio, cupos_totales, seccion) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [gradoId, nivel.level, gType, idJornada, cId, 30, seccion]
              );
              gradosList.push({ id: gradoId, cId });
              gradoId++;
            }
          }
        }
      }
    }

    console.log('Insertando materias y asignaciones...');
    const materiasNombres = ['Matemáticas', 'Español', 'Inglés', 'Ciencias Naturales', 'Ciencias Sociales', 'Educación Física'];
    let materiaId = 1;
    let detalleGradoId = 1;

    for (let cId = 1; cId <= 5; cId++) {
      // 1. Crear materias para este colegio
      for (const mNombre of materiasNombres) {
        await client.query(
          `INSERT INTO materias (id_materia, nombre, id_colegio) VALUES ($1, $2, $3)`,
          [materiaId, mNombre, cId]
        );

        // 2. Asignar esta materia a algunos grados del colegio para el docente de prueba
        // Buscamos el docente de este colegio (creado previamente con id_docente = cId)
        const idDocente = cId;
        
        // Asignar a los primeros 3 grados encontrados para este colegio
        const gradosColegio = gradosList.filter(g => g.cId === cId).slice(0, 3);
        for (const g of gradosColegio) {
          await client.query(
            `INSERT INTO detalle_grados (id_detallegrado, id_grado, id_materia, id_docente, id_colegio) 
             VALUES ($1, $2, $3, $4, $5)`,
            [detalleGradoId++, g.id, materiaId, idDocente, cId]
          );
        }
        materiaId++;
      }
    }

    await client.query('COMMIT');
    await ensureCompetencySchema();
    console.log(`Base de datos reseteada. Se crearon 5 colegios con sus respectivos Directivos y Docentes.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error durante el reseteo:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
