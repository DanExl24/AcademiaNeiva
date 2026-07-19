const { Client } = require('pg');
require('dotenv').config({ path: 'c:\\Users\\alejo\\Downloads\\segundoProyecto\\backend\\.env' });

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'AcademiaNeiva',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function main() {
  await client.connect();
  console.log("Connected to DB!");
  
  // Listar columnas de tabla usuario
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'usuario'
  `);
  
  console.log("Columns in 'usuario' table:");
  console.log(res.rows);
  
  await client.end();
}

main().catch(err => {
  console.error(err);
});
