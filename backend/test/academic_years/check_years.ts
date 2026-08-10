import { pool } from "../../src/config/db";

async function main() {
  const columnsRes = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('anio_lectivo', 'usuario', 'docente', 'estudiante', 'padre_familia') 
      AND (column_name LIKE '%fecha%' OR column_name LIKE '%creac%' OR column_name LIKE '%anio%' OR column_name = 'calendario') 
    ORDER BY table_name, column_name
  `);
  console.log("Columns:", columnsRes.rows);

  const yearsRes = await pool.query(`
    SELECT id_anio, id_colegio, calendario, estado FROM anio_lectivo ORDER BY id_anio
  `);
  console.log("Years:", yearsRes.rows);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
