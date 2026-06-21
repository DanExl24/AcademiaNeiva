"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
async function run() {
    try {
        const sql = `
      ALTER TABLE colegio ADD COLUMN IF NOT EXISTS escudo_url TEXT;
      ALTER TABLE colegio ADD COLUMN IF NOT EXISTS colores VARCHAR(255);
    `;
        await db_1.pool.query(sql);
        console.log('Columns escudo_url and colores added successfully to colegio table.');
    }
    catch (err) {
        console.error('Error during colegio table migration:', err);
    }
    finally {
        await db_1.pool.end();
    }
}
run();
