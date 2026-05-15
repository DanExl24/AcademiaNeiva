const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/AcademiaNeiva"
});

async function seedDirectivos() {
  const client = await pool.connect();
  try {
    const pass = '$2b$10$gs95FEXtMzhVXh3OzS4QjesqIYZ8ic40ElxmF7vaC0d0.RAaQHerm'; // test123
    
    // 1. Get all colleges
    const collegesRes = await client.query('SELECT id_colegio, nombre FROM colegio');
    const colleges = collegesRes.rows;

    console.log(`Found ${colleges.length} colleges. Creating directivos...`);

    for (const college of colleges) {
      const email = `directivo_${college.id_colegio}@academia.com`;
      
      // Check if user exists
      const checkRes = await client.query('SELECT id_usuario FROM usuario WHERE correo = $1', [email]);
      let id_usuario;

      if (checkRes.rows.length === 0) {
        // Create User
        const userRes = await client.query(
          'INSERT INTO usuario (correo, password, id_colegio) VALUES ($1, $2, $3) RETURNING id_usuario',
          [email, pass, college.id_colegio]
        );
        id_usuario = userRes.rows[0].id_usuario;
        
        // Assign Role 1 (DIRECTIVO)
        await client.query('INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, 1)', [id_usuario]);
        
        // Create Directivo record
        await client.query(
          'INSERT INTO directivo (id_colegio, id_usuario) VALUES ($1, $2)',
          [college.id_colegio, id_usuario]
        );
        
        console.log(`✅ Created directivo for ${college.nombre}: ${email}`);
      } else {
        console.log(`ℹ️ Directivo for ${college.nombre} already exists (${email})`);
      }
    }

    console.log('\nAll directivos created/verified!');
    console.log('Password for all: test123');

  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDirectivos();
