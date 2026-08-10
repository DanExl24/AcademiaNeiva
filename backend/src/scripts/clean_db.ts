import { pool } from "../config/db";
import bcrypt from "bcrypt";

const schools = [
  { id: 1, nombre: "CEA School Empresarial de los Andes", tipo: "Privado", sede: "Sede Principal", contacto: 3183118044, correo: "rectoria@cea.edu.co", dane: "341001005652", domain: "ceaschool.edu.co", tipo_calendario: "A" },
  { id: 2, nombre: "Institución Educativa El Caguán", tipo: "Oficial", sede: "Sede Principal", contacto: 3180000000, correo: "iecaguan@alcaldianeiva.gov.co", dane: "441001002747", domain: "iecaguan.edu.co", tipo_calendario: "A" },
  { id: 3, nombre: "Colegio Heisenberg Neiva", tipo: "Privado", sede: "Sede Principal", contacto: 3169100003, correo: "colegioheisenberg@hotmail.com", dane: "DANE-H-001", domain: "heisenberg.edu.co", tipo_calendario: "A" },
  { id: 4, nombre: "Colegio Claretiano de Neiva", tipo: "Privado", sede: "Sede Principal", contacto: 3161720175, correo: "admisiones@claretianoneiva.edu.co", dane: "DANE-C-002", domain: "claretianoneiva.edu.co", tipo_calendario: "A" },
  { id: 5, nombre: "Colegio IDESA", tipo: "Privado", sede: "Sede Principal", contacto: 3153077861, correo: "info@colegioidesa.com.co", dane: "DANE-I-003", domain: "colegioidesa.edu.co", tipo_calendario: "A" },
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Obteniendo tablas del esquema public...');
    const result = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    const tables = result.rows.map(row => `"${row.tablename}"`).join(', ');
    
    if (tables.length > 0) {
      console.log(`Truncando las siguientes tablas:\n${tables}`);
      await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE;`);
      console.log('Todas las tablas han sido truncadas correctamente.');
    } else {
      console.log('No se encontraron tablas en el esquema public.');
    }
    
    // ── Phase 1: Insert basic catalogs ──
    console.log("📋 Insertando catálogos base (roles, documentos, secciones)...");
    const roles = ["admin", "directivo", "docente", "estudiante", "padre", "admin_general"];
    const roleIds: Record<string, number> = {};
    for (const role of roles) {
      const res = await client.query<{ id_rol: number }>(
        `INSERT INTO rol (nombre) VALUES ($1) RETURNING id_rol`,
        [role]
      );
      roleIds[role] = res.rows[0].id_rol;
    }

    const documentTypes = [
      { id: 1, tipo: "Registro Civil" },
      { id: 2, tipo: "Tarjeta de Identidad" },
      { id: 3, tipo: "Cédula de Ciudadanía" },
      { id: 4, tipo: "Cédula de Extranjería" },
      { id: 5, tipo: "PEP / PPT" },
      { id: 6, tipo: "Pasaporte" },
    ];
    for (const dt of documentTypes) {
      await client.query(`INSERT INTO tipo_documento (id_tipodocumento, tipo) VALUES ($1, $2)`, [dt.id, dt.tipo]);
    }

    const sectionNames = ["A", "B"];
    for (const name of sectionNames) {
      await client.query(`INSERT INTO secciones (nombre) VALUES ($1)`, [name]);
    }

    // ── Phase 2: Create Admin General ──
    console.log("👑 Creando administrador general...");
    const adminGeneralPassword = "adminGeneral123";
    const adminGeneralHash = await bcrypt.hash(adminGeneralPassword, 10);
    const adminGeneralEmail = "admin.general@academianeiva.edu.co";
    const adminGeneralResult = await client.query<{ id_usuario: number }>(
      `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo, estado, id_tipodocumento, documento, telefono)
       VALUES ($1, $2, $3, $4, NULL, true, 'ACTIVO', 3, '1000000000', '3000000000') RETURNING id_usuario`,
      [adminGeneralEmail, adminGeneralHash, "Admin", "General"]
    );
    await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [
      adminGeneralResult.rows[0].id_usuario,
      roleIds.admin_general,
    ]);

    // Sembrar valores por defecto para la configuración de la plataforma (Duración de Supervisiones)
    await client.query(`
      INSERT INTO configuracion_plataforma (clave, valor)
      VALUES 
        ('supervision_duracion_minima_minutos', '5'),
        ('supervision_duracion_maxima_minutos', '300')
      ON CONFLICT (clave) DO NOTHING;
    `);

    // ── Phase 3: Create Schools and Directivos ──
    const DIRECTIVO_PASSWORD = "directivo123";
    const directivoHash = await bcrypt.hash(DIRECTIVO_PASSWORD, 10);

    for (const school of schools) {
      console.log(`🏫 Creando colegio: ${school.nombre}...`);
      await client.query(
        `INSERT INTO colegio (id_colegio, nombre, tipo_colegio, sede, contacto, correo, dane, tipo_calendario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [school.id, school.nombre, school.tipo, school.sede, school.contacto, school.correo, school.dane, school.tipo_calendario]
      );

      // --- Configuracion Colegio ---
      await client.query(
        `INSERT INTO configuracion_colegio (id_colegio, nota_minima, nota_maxima, nota_aprobacion, escala_modo)
         VALUES ($1, 0, 5, 3, 'AUTOMATICO')`,
        [school.id]
      );

      // --- Rector ---
      const rectorEmail = `rector@${school.domain}`;
      const rectorRes = await client.query<{ id_usuario: number }>(
        `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo, estado, id_tipodocumento, documento, telefono)
         VALUES ($1, $2, $3, $4, $5, true, 'ACTIVO', 3, $6, $7) RETURNING id_usuario`,
        [rectorEmail, directivoHash, "Rector", school.nombre, school.id, `10010000${school.id}`, String(school.contacto)]
      );
      const rectorUserId = rectorRes.rows[0].id_usuario;
      await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [rectorUserId, roleIds.directivo]);
      await client.query(`INSERT INTO directivo (id_colegio, id_usuario, cargo) VALUES ($1, $2, $3)`, [school.id, rectorUserId, "RECTOR"]);

      // --- Coordinador ---
      const directivoEmail = `directivo@${school.domain}`;
      const directivoResult = await client.query<{ id_usuario: number }>(
        `INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo, estado, id_tipodocumento, documento, telefono)
         VALUES ($1, $2, $3, $4, $5, true, 'ACTIVO', 3, $6, $7) RETURNING id_usuario`,
        [directivoEmail, directivoHash, "Directivo", school.nombre, school.id, `10020000${school.id}`, String(school.contacto)]
      );
      const directivoUserId = directivoResult.rows[0].id_usuario;
      await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [directivoUserId, roleIds.directivo]);
      await client.query(`INSERT INTO directivo (id_colegio, id_usuario, cargo) VALUES ($1, $2, $3)`, [school.id, directivoUserId, "COORDINADOR"]);
    }

    // ── Phase 4: Sync sequences ──
    console.log("🔄 Sincronizando secuencias de base de datos...");
    await client.query(`
      SELECT setval(pg_get_serial_sequence('colegio', 'id_colegio'), COALESCE(MAX(id_colegio), 1)) FROM colegio;
      SELECT setval(pg_get_serial_sequence('tipo_documento', 'id_tipodocumento'), COALESCE(MAX(id_tipodocumento), 1)) FROM tipo_documento;
    `);

    await client.query('COMMIT');
    console.log('✅ Base de datos limpiada y re-sembrada con colegios y directivos por defecto.');
    console.log('🔑 Credenciales disponibles:');
    console.log(`   - Administrador General: ${adminGeneralEmail} / ${adminGeneralPassword}`);
    for (const school of schools) {
      console.log(`   - [${school.nombre}]:`);
      console.log(`     * Rector: rector@${school.domain} / ${DIRECTIVO_PASSWORD}`);
      console.log(`     * Directivo: directivo@${school.domain} / ${DIRECTIVO_PASSWORD}`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante el truncado y sembrado:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
