"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
async function run() {
    const client = await db_1.pool.connect();
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
        }
        else {
            console.log('No se encontraron tablas en el esquema public.');
        }
        await client.query('COMMIT');
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('Error durante el truncado:', err);
    }
    finally {
        client.release();
        await db_1.pool.end();
    }
}
run();
