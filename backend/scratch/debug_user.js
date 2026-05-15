const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/AcademiaNeiva"
});

async function checkUser() {
  try {
    const res = await pool.query('SELECT u.*, string_agg(r.nombre, \', \') as roles FROM usuario u LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario LEFT JOIN rol r ON ur.id_rol = r.id_rol WHERE u.correo = $1 GROUP BY u.id_usuario', ['coakminor@gmail.com']);
    console.log('User found:', res.rows);
    
    if (res.rows.length === 0) {
        console.log('User NOT found in database.');
    } else {
        const bcrypt = require('bcrypt');
        const match = await bcrypt.compare('padre123', res.rows[0].password);
        console.log('Password match (padre123):', match);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

checkUser();
