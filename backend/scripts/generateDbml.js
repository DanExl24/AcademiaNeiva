const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const sqlPath = path.join(rootDir, 'guides', 'AcademiaNeivaBD.sql');
const dbmlPath = path.join(rootDir, 'guides', 'AcademiaNeivaBD.dbml');

console.log('🔄 Generando archivo DBML desde PostgreSQL DDL...');

try {
  // Ejecutar sql2dbml
  execSync(`npx -y -p @dbml/cli sql2dbml "${sqlPath}" -o "${dbmlPath}" --postgres`, {
    cwd: rootDir,
    stdio: 'pipe'
  });

  // Leer el DBML generado y normalizar operadores para máxima compatibilidad con DrawDB (DBML v2)
  let dbml = fs.readFileSync(dbmlPath, 'utf8');

  // Reemplazar operadores con '?' (v3 nullability) por operadores universales v2
  dbml = dbml.replace(/\s*\?\<\?\s*/g, ' < ');
  dbml = dbml.replace(/\s*\<\?\s*/g, ' < ');
  dbml = dbml.replace(/\s*\?\<\s*/g, ' < ');
  dbml = dbml.replace(/\s*\?\>\?\s*/g, ' > ');
  dbml = dbml.replace(/\s*\?\>\s*/g, ' > ');
  dbml = dbml.replace(/\s*\>\?\s*/g, ' > ');
  dbml = dbml.replace(/\s*\?-\?\s*/g, ' - ');
  dbml = dbml.replace(/\s*\?-\s*/g, ' - ');
  dbml = dbml.replace(/\s*-\?\s*/g, ' - ');

  fs.writeFileSync(dbmlPath, dbml, 'utf8');
  console.log(`✅ Archivo DBML generado exitosamente y 100% compatible con DrawDB:`);
  console.log(`   -> ${dbmlPath}`);
} catch (error) {
  console.error('❌ Error generando DBML:', error.message);
  if (error.stdout) console.log(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}
