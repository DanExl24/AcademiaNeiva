const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/AcademiaNeiva"
});

async function resetDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('--- Reseteando base de datos ---');
    
    // 1. Limpiar todas las tablas
    const tables = [
      'notas_actividad', 'actividad_materia', 'registro_asistencia', 'observacion_estudiante',
      'cierre_materia', 'detalle_padrefamilia', 'detalle_grados', 'periodo_academico',
      'estudiante', 'padre_familia', 'matricula', 'documento_matriculas',
      'directivo', 'docente', 'materias', 'grados', 'jornada', 'escala_valoracion',
      'año_lectivo', 'usuario_rol', 'usuario', 'colegio', 'rol'
    ];
    
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE public.${table} RESTART IDENTITY CASCADE`);
    }
    console.log('✅ Tablas vaciadas.');

    // 2. Crear Roles
    const roles = [
      [1, 'DIRECTIVO'],
      [2, 'DOCENTE'],
      [3, 'PADRE_FAMILIA'],
      [4, 'ESTUDIANTE'],
      [5, 'ADMIN']
    ];
    for (const [id, name] of roles) {
      await client.query('INSERT INTO rol (id_rol, nombre) VALUES ($1, $2)', [id, name]);
    }
    console.log('✅ Roles creados.');

    // 3. Crear Colegios
    const colegios = [
      'CEA School Empresarial de los Andes',
      'Institución Educativa El Caguán',
      'Colegio Heisenberg Neiva',
      'Colegio Claretiano de Neiva',
      'Colegio IDESA'
    ];
    
    const hashedPass = '$2b$10$gs95FEXtMzhVXh3OzS4QjesqIYZ8ic40ElxmF7vaC0d0.RAaQHerm'; // test123

    for (let i = 0; i < colegios.length; i++) {
      const colName = colegios[i];
      const colRes = await client.query(
        'INSERT INTO colegio (nombre, tipo_colegio, sede, contacto, correo, dane) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_colegio',
        [colName, 'PRIVADO', 'Principal', 1234567, `contacto@${colName.toLowerCase().replace(/ /g, '')}.edu.co`, `DANE${i+1}`]
      );
      const id_colegio = colRes.rows[0].id_colegio;

      // 4. Crear Directivo
      const dirUserRes = await client.query(
        'INSERT INTO usuario (correo, password, id_colegio) VALUES ($1, $2, $3) RETURNING id_usuario',
        [`directivo@${colName.toLowerCase().replace(/ /g, '')}.edu.co`, hashedPass, id_colegio]
      );
      const id_user_dir = dirUserRes.rows[0].id_usuario;
      await client.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, 1)', [id_user_dir]);
      await client.query('INSERT INTO directivo (id_colegio, id_usuario) VALUES ($1, $2)', [id_colegio, id_user_dir]);

      // 5. Crear Docente
      const docUserRes = await client.query(
        'INSERT INTO usuario (correo, password, id_colegio) VALUES ($1, $2, $3) RETURNING id_usuario',
        [`docente@${colName.toLowerCase().replace(/ /g, '')}.edu.co`, hashedPass, id_colegio]
      );
      const id_user_doc = docUserRes.rows[0].id_usuario;
      await client.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, 2)', [id_user_doc]);
      await client.query(
        'INSERT INTO docente (nombre, apellido, documento, id_tipodocumento, id_colegio, id_usuario) VALUES ($1, $2, $3, $4, $5, $6)',
        ['Docente', 'Prueba', `DOC${id_colegio}`, 2, id_colegio, id_user_doc]
      );

      // 6. Crear Periodos
      const periodos = ['Primer Periodo', 'Segundo Periodo', 'Tercer Periodo', 'Cuarto Periodo'];
      for (const pName of periodos) {
        await client.query(
          'INSERT INTO periodo_academico (nombre, estado, porcentaje, id_colegio) VALUES ($1, $2, $3, $4)',
          [pName, 'ABIERTO', 25, id_colegio]
        );
      }

      // 7. Crear Materias Generales
      const materias = ['Matemáticas', 'Lengua Castellana', 'Ciencias Naturales', 'Ciencias Sociales', 'Inglés', 'Educación Física', 'Ética y Valores'];
      for (const mName of materias) {
        await client.query('INSERT INTO materias (nombre, id_colegio) VALUES ($1, $2)', [mName, id_colegio]);
      }

      console.log(`✅ Colegio "${colName}" configurado.`);
    }

    await client.query('COMMIT');
    console.log('\n--- Reseteo completado con éxito ---');
    console.log('Credenciales sugeridas para todos: password = test123');

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error fatal:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

resetDatabase();
