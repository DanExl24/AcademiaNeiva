const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/AcademiaNeiva"
});

async function createTestUser() {
  const client = await pool.connect();
  try {
    const pass = '$2b$10$gs95FEXtMzhVXh3OzS4QjesqIYZ8ic40ElxmF7vaC0d0.RAaQHerm'; // test123
    const suffix = Date.now();

    // 1. Get College
    const colRes = await client.query('SELECT id_colegio FROM colegio LIMIT 1');
    if (colRes.rows.length === 0) throw new Error('No colleges found');
    const id_colegio = colRes.rows[0].id_colegio;

    // 2. Get/Create Grade
    let gradeRes = await client.query('SELECT id_grado, nivel FROM grados WHERE id_colegio = $1 LIMIT 1', [id_colegio]);
    if (gradeRes.rows.length === 0) {
      gradeRes = await client.query(
        "INSERT INTO grados (nivel, id_colegio, cupos_totales, tipo_grado, seccion) VALUES ($1, $2, $3, $4, $5) RETURNING id_grado, nivel",
        ['PRIMARIA', id_colegio, 30, 'PRIMERO', 'A']
      );
    }
    const { id_grado, nivel } = gradeRes.rows[0];

    // 3. Create Docente
    const docRes = await client.query(
      'INSERT INTO docente (nombre, apellido, documento, id_tipodocumento, id_colegio) VALUES ($1, $2, $3, $4, $5) RETURNING id_docente',
      ['Docente', 'Prueba', `DOC-${suffix}`.substring(0, 10), 2, id_colegio]
    );
    const id_docente = docRes.rows[0].id_docente;

    // 4. Create Materia
    const matRes = await client.query(
      'INSERT INTO materias (nombre, id_colegio) VALUES ($1, $2) RETURNING id_materia',
      ['Matemáticas', id_colegio]
    );
    const id_materia = matRes.rows[0].id_materia;

    // 5. Create Detalle_Grados
    const dgRes = await client.query(
      'INSERT INTO detalle_grados (id_grado, id_materia, id_docente, id_colegio) VALUES ($1, $2, $3, $4) RETURNING id_detallegrado',
      [id_grado, id_materia, id_docente, id_colegio]
    );
    const id_detallegrado = dgRes.rows[0].id_detallegrado;

    // 6. User / Roles / Entity
    const email = `test_${suffix}@academia.com`;
    const userRes = await client.query(
      'INSERT INTO usuario (correo, password, id_colegio) VALUES ($1, $2, $3) RETURNING id_usuario',
      [email, pass, id_colegio]
    );
    const id_usuario = userRes.rows[0].id_usuario;
    await client.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, 3)', [id_usuario]);
    await client.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, 4)', [id_usuario]);

    const parentRes = await client.query(
      'INSERT INTO padre_familia (nombre, apellido, documeno, id_tipodocumento, id_usuario, id_colegio) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_padrefamilia',
      ['Padre', 'Test', `123${suffix}`.substring(0, 10), 2, id_usuario, id_colegio]
    );
    const id_padre = parentRes.rows[0].id_padrefamilia;

    const studentRes = await client.query(
      'INSERT INTO estudiante (nombre, apellido, documento, codigo, id_tipodocumento, id_grado, id_colegio, id_usuario) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_estudiante',
      ['Hijo', 'Test', `321${suffix}`.substring(0, 12), `ACM-T-${suffix}`.substring(0, 20), 1, id_grado, id_colegio, id_usuario]
    );
    const id_estudiante = studentRes.rows[0].id_estudiante;

    await client.query(
      'INSERT INTO detalle_padrefamilia (id_padrefamilia, id_estudiante, id_colegio) VALUES ($1, $2, $3)',
      [id_padre, id_estudiante, id_colegio]
    );

    // 7. Academic Data
    let periodRes = await client.query('SELECT id_periodo FROM periodo_academico WHERE id_colegio = $1 LIMIT 1', [id_colegio]);
    if (periodRes.rows.length === 0) {
      periodRes = await client.query(
        "INSERT INTO periodo_academico (nombre, estado, porcentaje, id_colegio) VALUES ($1, $2, $3, $4) RETURNING id_periodo",
        ['PRIMER PERIODO', 'ABIERTO', 25, id_colegio]
      );
    }
    const id_periodo = periodRes.rows[0].id_periodo;

    let escalaRes = await client.query('SELECT id_escalavaloracion FROM escala_valoracion WHERE id_colegio = $1 LIMIT 1', [id_colegio]);
    if (escalaRes.rows.length === 0) {
      escalaRes = await client.query(
        "INSERT INTO escala_valoracion (nivel, valor_minimo, valor_maximo, id_colegio) VALUES ($1, $2, $3, $4) RETURNING id_escalavaloracion",
        ['SUPERIOR', 4.6, 5.0, id_colegio]
      );
    }
    const id_escala = escalaRes.rows[0].id_escalavaloracion;

    const actRes = await client.query(
      "INSERT INTO actividad_materia (id_detallegrado, id_periodo, nombre, porcentaje, id_colegio) VALUES ($1, $2, $3, $4, $5) RETURNING id_actividadmateria",
      [id_detallegrado, id_periodo, "Evaluación Diagnóstica", 20, id_colegio]
    );
    const id_act = actRes.rows[0].id_actividadmateria;

    await client.query(
      "INSERT INTO notas_actividad (id_actividadmateria, id_estudiante, id_escalavaloracion, nota, id_colegio) VALUES ($1, $2, $3, $4, $5)",
      [id_act, id_estudiante, id_escala, 4.8, id_colegio]
    );

    await client.query(
      "INSERT INTO registro_asistencia (id_estudiante, id_detallegrado, fecha, estado, id_colegio) VALUES ($1, $2, $3, $4, $5)",
      [id_estudiante, id_detallegrado, new Date(), "PRESENTE", id_colegio]
    );

    console.log('✅ Test User and Academic Data Created!');
    console.log('Email:', email);
    console.log('Pass: test123');
    console.log('College ID:', id_colegio);
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestUser();
