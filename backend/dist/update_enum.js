"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
async function run() {
    const client = await db_1.pool.connect();
    try {
        // 1. Cambiar el enum de tipo_grado para que acepte todos los grados específicos
        console.log('Actualizando enum tipo_grado...');
        // Verificamos si ya existe el nuevo enum para no fallar
        const checkEnum = await client.query("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'tipo_grado'");
        const currentLabels = checkEnum.rows.map(r => r.enumlabel);
        if (!currentLabels.includes('PRIMERO')) {
            await client.query("TRUNCATE grados CASCADE");
            // Forma segura de recrear enum en Postgres
            await client.query("ALTER TYPE tipo_grado RENAME TO tipo_grado_old");
            await client.query(`
         CREATE TYPE tipo_grado AS ENUM (
           'PREJARDIN', 'JARDIN', 'TRANSICION', 
           'PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 
           'SEXTO', 'SEPTIMO', 'OCTAVO', 'NOVENO', 
           'DECIMO', 'ONCE'
         )
       `);
            await client.query("ALTER TABLE grados ALTER COLUMN tipo_grado TYPE tipo_grado USING tipo_grado::text::tipo_grado");
            await client.query("DROP TYPE tipo_grado_old");
        }
        console.log('Enum actualizado exitosamente.');
    }
    catch (err) {
        console.error('Error actualizando enum:', err);
    }
    finally {
        client.release();
        await db_1.pool.end();
    }
}
run();
