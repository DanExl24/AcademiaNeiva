import { pool } from '../src/config/db';

async function main() {
  const res = await pool.query(`
    SELECT t.relname as table_name, conname, pg_get_constraintdef(c.oid) as definition
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname IN ('docente', 'usuario', 'estudiante')
    ORDER BY t.relname, conname
  `);
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
