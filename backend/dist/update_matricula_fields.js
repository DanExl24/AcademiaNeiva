"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
async function run() {
    try {
        const sql = `
      -- Añadir campos necesarios para la lógica de negocio a la tabla matricula
      ALTER TABLE matricula ADD COLUMN IF NOT EXISTS tiene_discapacidad BOOLEAN DEFAULT FALSE;
      ALTER TABLE matricula ADD COLUMN IF NOT EXISTS es_extranjero BOOLEAN DEFAULT FALSE;
      
      -- Asegurar que id_estudiante sea opcional para el estado PENDIENTE
      ALTER TABLE matricula ALTER COLUMN id_estudiante DROP NOT NULL;
    `;
        await db_1.pool.query(sql);
        console.log('Table matricula updated with business logic fields.');
    }
    catch (err) {
        console.error('Error during update:', err);
    }
    finally {
        await db_1.pool.end();
    }
}
run();
