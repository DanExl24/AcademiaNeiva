"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function seed() {
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        console.log("Iniciando seeder...");
        // 1. Roles
        console.log("Insertando roles...");
        await client.query(`
      INSERT INTO rol (id_rol, nombre) 
      VALUES (1, 'DIRECTIVO'), (2, 'DOCENTE'), (3, 'ESTUDIANTE'), (4, 'PADRE_FAMILIA') 
      ON CONFLICT (id_rol) DO NOTHING
    `);
        // 2. Colegios
        console.log("Insertando colegios...");
        await client.query(`
      INSERT INTO colegio (id_colegio, nombre, tipo_colegio, sede, contacto, correo, dane) 
      VALUES 
      (1, 'Institución Educativa Neiva Central', 'PUBLICO', 'PRINCIPAL', 3101234567, 'rectoria@neivacentral.edu.co', '123456789012'),
      (2, 'Colegio Técnico Superior Neiva', 'PUBLICO', 'PUBLICO', 3209876543, 'admin@tecnicosuperior.edu.co', '987654321098')
      ON CONFLICT (id_colegio) DO NOTHING
    `);
        // 3. Usuarios Directivos
        console.log("Insertando usuarios directivos...");
        const hashedPass = await bcrypt_1.default.hash("admin123", 10);
        await client.query(`
      INSERT INTO usuario (id_usuario, email, password, nombre, apellido, id_colegio, activo) 
      VALUES 
      (1, 'directivo1@neiva.edu.co', $1, 'Carlos', 'Ramírez', 1, true),
      (2, 'directivo2@tecnico.edu.co', $1, 'Ana', 'Gómez', 2, true)
      ON CONFLICT (id_usuario) DO NOTHING
    `, [hashedPass]);
        // 4. Relación Usuario-Rol (Directivo)
        console.log("Asignando roles a usuarios...");
        await client.query(`
      INSERT INTO usuario_rol (id_usuario, id_rol) 
      SELECT 1, 1 WHERE NOT EXISTS (SELECT 1 FROM usuario_rol WHERE id_usuario = 1 AND id_rol = 1);
    `);
        await client.query(`
      INSERT INTO usuario_rol (id_usuario, id_rol) 
      SELECT 2, 1 WHERE NOT EXISTS (SELECT 1 FROM usuario_rol WHERE id_usuario = 2 AND id_rol = 1);
    `);
        // 5. Tabla Directivo
        console.log("Insertando en tabla directivo...");
        await client.query(`
      INSERT INTO directivo (id, id_colegio, id_usuario) 
      VALUES (1, 1, 1), (2, 2, 2)
      ON CONFLICT (id) DO NOTHING
    `);
        // 6. Tipos de Documentos Básicos
        console.log("Insertando tipos de documentos...");
        await client.query(`
      INSERT INTO tipo_documento (id_tipodocumento, tipo) 
      VALUES (1, 'Cédula de Ciudadanía'), (2, 'Tarjeta de Identidad'), (3, 'Registro Civil') 
      ON CONFLICT (id_tipodocumento) DO NOTHING
    `);
        await client.query("COMMIT");
        console.log("===============================");
        console.log("✅ Seed completado exitosamente");
        console.log("Directivo 1: directivo1@neiva.edu.co | Pass: admin123");
        console.log("Directivo 2: directivo2@tecnico.edu.co | Pass: admin123");
        console.log("===============================");
    }
    catch (e) {
        await client.query("ROLLBACK");
        console.error("❌ Error en el seed:", e);
    }
    finally {
        client.release();
        process.exit();
    }
}
seed();
