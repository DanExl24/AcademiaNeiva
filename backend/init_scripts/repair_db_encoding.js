const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './.env.local' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'AcademiaNeiva',
});

function fixMojibake(str) {
  if (!str || typeof str !== 'string') return str;
  if (!/[\u00C2\u00C3\u00C4\u00C5\u00E2]/.test(str)) return str;
  try {
    const fixed = Buffer.from(str, 'latin1').toString('utf8');
    if (!fixed.includes('\uFFFD')) {
      return fixed;
    }
  } catch {}
  return str;
}

async function repairTable(client, tableName, idCol, columns) {
  try {
    const res = await client.query(`SELECT ${idCol}, ${columns.join(', ')} FROM ${tableName}`);
    let updated = 0;
    for (const row of res.rows) {
      const updates = [];
      const values = [];
      let idx = 1;
      for (const col of columns) {
        const originalVal = row[col];
        if (typeof originalVal === 'string') {
          const cleanedVal = fixMojibake(originalVal);
          if (cleanedVal !== originalVal) {
            updates.push(`${col} = $${idx}`);
            values.push(cleanedVal);
            idx++;
          }
        }
      }
      if (updates.length > 0) {
        values.push(row[idCol]);
        await client.query(`UPDATE ${tableName} SET ${updates.join(', ')} WHERE ${idCol} = $${idx}`, values);
        updated++;
      }
    }
    console.log(`✅ [${tableName}] Reparadas ${updated} filas de ${res.rows.length}.`);
  } catch (err) {
    console.log(`⚠️ [${tableName}] Omitida o error: ${err.message}`);
  }
}

async function main() {
  const client = await pool.connect();
  console.log('Conectado a la base de datos para reparación de codificación UTF-8...');
  try {
    await repairTable(client, 'estudiante', 'id_estudiante', ['nombre', 'apellido', 'motivo_estado']);
    await repairTable(client, 'usuario', 'id_usuario', ['nombre', 'apellido', 'motivo_baneo']);
    await repairTable(client, 'docente', 'id_docente', ['nombre', 'apellido']);
    await repairTable(client, 'padre_familia', 'id_padrefamilia', ['nombre', 'apellido']);
    await repairTable(client, 'materias', 'id_materia', ['nombre']);
    await repairTable(client, 'competencias', 'id_competencia', ['nombre', 'descripcion']);
    await repairTable(client, 'dba', 'id_dba', ['enunciado', 'area']);
    await repairTable(client, 'evidencia_aprendizaje', 'id_evidencia', ['descripcion']);
    await repairTable(client, 'resultado_academico', 'id_resultado', ['observacion']);
    await repairTable(client, 'colegio', 'id_colegio', ['nombre', 'sede', 'motivo_rechazo']);
    await repairTable(client, 'auditoria_supervision', 'id_auditoria', ['motivo_solicitud']);
    console.log('✨ Reparación completada exitosamente.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
