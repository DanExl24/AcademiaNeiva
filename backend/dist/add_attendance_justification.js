"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
async function run() {
    try {
        const sql = `
      ALTER TABLE registro_asistencia ADD COLUMN IF NOT EXISTS justificacion TEXT;
    `;
        await db_1.pool.query(sql);
        console.log('Column justificacion added successfully to registro_asistencia table.');
    }
    catch (err) {
        console.error('Error during justificacion migration:', err);
    }
    finally {
        await db_1.pool.end();
    }
}
run();
