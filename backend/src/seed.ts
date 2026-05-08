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

    // 3. Insertar Directivo
    const hashedPass = await bcrypt.hash("admin123", 10);
    await client.query(
      "INSERT INTO directivo (id, correo, password, id_colegio) VALUES (1, 'directivo@prueba.com', $1, 1) ON CONFLICT DO NOTHING",
      [hashedPass]
    );

    // 4. Insertar Año Lectivo
    await client.query(
      "INSERT INTO \"año_lectivo\" (id_año, calendario, id_colegio) VALUES (1, 'A', 1) ON CONFLICT DO NOTHING"
    );

    // 5. Insertar Grados (Ejemplos)
    await client.query(
      "INSERT INTO grados (id_grado, nivel, tipo_grado, cupos_totales, id_colegio) VALUES (1, 'Transición', 'PREESCOLAR', 25, 1) ON CONFLICT DO NOTHING"
    );

    // 6. Insertar Docente
    await client.query(
      "INSERT INTO docente (id_docente, nombre, apellido, documento, id_tipodocumento, id_colegio) VALUES (1, 'Juan', 'Pérez', '12345678', 1, 1) ON CONFLICT DO NOTHING"
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
