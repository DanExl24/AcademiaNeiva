import { pool } from "./config/db";
import bcrypt from "bcrypt";

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Insertar Tipo de Documento
    await client.query(
      "INSERT INTO tipo_documento (id_tipodocumento, tipo) VALUES (1, 'Cédula de Ciudadanía') ON CONFLICT DO NOTHING"
    );

    // 2. Insertar Colegio
    await client.query(
      "INSERT INTO colegio (id_colegio, nombre, tipo_colegio, sede, contacto, correo, dane) VALUES (1, 'Institución Educativa Neiva Central', 'PUBLICO', 'PRINCIPAL', 3101234567, 'rectoria@neivacentral.edu.co', '123456789012') ON CONFLICT DO NOTHING"
    );

    // 2.5 Insertar Roles Básicos
    await client.query(
      "INSERT INTO rol (id_rol, nombre) VALUES (1, 'DIRECTIVO'), (2, 'DOCENTE'), (3, 'PADRE_FAMILIA'), (4, 'ESTUDIANTE') ON CONFLICT DO NOTHING"
    );

    // 3. Insertar Usuario y Directivo
    const hashedPass = await bcrypt.hash("admin123", 10);
    const dirUserRes = await client.query(
      "INSERT INTO usuario (id_usuario, correo, password, id_colegio) VALUES (1, 'directivo@prueba.com', $1, 1) ON CONFLICT DO NOTHING RETURNING id_usuario",
      [hashedPass]
    );
    
    // Si ya existía, dirUserRes.rows estará vacío. Por simplicidad en el seed asumimos que es 1.
    const idDirUser = dirUserRes.rows[0]?.id_usuario || 1;
    
    await client.query(
      "INSERT INTO usuario_rol (id_usuario_rol, id_usuario, id_rol) VALUES (1, $1, 1) ON CONFLICT DO NOTHING",
      [idDirUser]
    );

    await client.query(
      "INSERT INTO directivo (id, id_colegio, id_usuario) VALUES (1, 1, $1) ON CONFLICT DO NOTHING",
      [idDirUser]
    );

    // 4. Insertar Año Lectivo
    await client.query(
      "INSERT INTO \"año_lectivo\" (id_año, calendario, id_colegio) VALUES (1, 'A', 1) ON CONFLICT DO NOTHING"
    );

    // 5. Insertar Grados (Ejemplos)
    await client.query(
      "INSERT INTO grados (id_grado, nivel, tipo_grado, cupos_totales, id_colegio) VALUES (1, 'PREESCOLAR', 'TRANSICION', 25, 1) ON CONFLICT DO NOTHING"
    );

    // 6. Insertar Usuario Docente y Docente
    const hashedDocPass = await bcrypt.hash("docente123", 10);
    const docUserRes = await client.query(
      "INSERT INTO usuario (id_usuario, correo, password, id_colegio) VALUES (2, 'docente@prueba.com', $1, 1) ON CONFLICT DO NOTHING RETURNING id_usuario",
      [hashedDocPass]
    );
    const idDocUser = docUserRes.rows[0]?.id_usuario || 2;

    await client.query(
      "INSERT INTO usuario_rol (id_usuario_rol, id_usuario, id_rol) VALUES (2, $1, 2) ON CONFLICT DO NOTHING",
      [idDocUser]
    );

    await client.query(
      "INSERT INTO docente (id_docente, nombre, apellido, documento, id_tipodocumento, id_colegio, id_usuario) VALUES (1, 'Juan', 'Pérez', '12345678', 1, 1, $1) ON CONFLICT DO NOTHING",
      [idDocUser]
    );

    await client.query("COMMIT");
    console.log("Seed completado exitosamente");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Error en el seed:", e);
  } finally {
    client.release();
    process.exit();
  }
}

seed();
