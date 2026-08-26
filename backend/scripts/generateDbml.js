const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const sqlPath = path.join(rootDir, 'guides', 'AcademiaNeivaBD.sql');
const dbmlPath = path.join(rootDir, 'guides', 'AcademiaNeivaBD.dbml');

console.log('🔄 Generando archivo DBML desde PostgreSQL DDL...');

try {
  // 1. Ejecutar sql2dbml
  execSync(`npx -y -p @dbml/cli sql2dbml "${sqlPath}" -o "${dbmlPath}" --postgres`, {
    cwd: rootDir,
    stdio: 'pipe'
  });

  // 2. Leer el DBML generado y adaptarlo a la especificación estándar compatible con DrawDB
  let dbml = fs.readFileSync(dbmlPath, 'utf8');

  // a. Eliminar bloques 'Checks { ... }' completamente (DrawDB no soporta Checks dentro de Table)
  dbml = dbml.replace(/\n\s*Checks\s*\{[\s\S]*?\n\s*\}/g, '');

  // b. Normalizar operadores de relación con '?' (DBML v3 nullability) a operadores DBML v2 estándar
  dbml = dbml.replace(/\s*\?\<\?\s*/g, ' < ');
  dbml = dbml.replace(/\s*\<\?\s*/g, ' < ');
  dbml = dbml.replace(/\s*\?\<\s*/g, ' < ');
  dbml = dbml.replace(/\s*\?\>\?\s*/g, ' > ');
  dbml = dbml.replace(/\s*\?\>\s*/g, ' > ');
  dbml = dbml.replace(/\s*\>\?\s*/g, ' > ');
  dbml = dbml.replace(/\s*\?-\?\s*/g, ' - ');
  dbml = dbml.replace(/\s*\?-\s*/g, ' - ');
  dbml = dbml.replace(/\s*-\?\s*/g, ' - ');

  // c. Limpiar saltos de línea redundantes
  dbml = dbml.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(dbmlPath, dbml, 'utf8');
  
  // 3. Replicar también en guides/arquitectura_y_datos/
  const archDbmlPath = path.join(rootDir, 'guides', 'arquitectura_y_datos', 'AcademiaNeivaBD.dbml');
  const archSqlPath = path.join(rootDir, 'guides', 'arquitectura_y_datos', 'AcademiaNeivaBD.sql');
  
  fs.writeFileSync(archDbmlPath, dbml, 'utf8');
  if (fs.existsSync(sqlPath)) {
    fs.copyFileSync(sqlPath, archSqlPath);
  }

  console.log(`✅ Archivo DBML generado exitosamente y 100% compatible con DrawDB:`);
  console.log(`   -> ${dbmlPath}`);
  console.log(`   -> ${archDbmlPath}`);
} catch (error) {
  console.error('❌ Error generando DBML:', error.message);
  if (error.stdout) console.log(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  process.exit(1);
}
