"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
async function run() {
    try {
        await db_1.pool.query("ALTER TYPE estado_matricula ADD VALUE 'CORRECCION';");
        console.log("Enum updated");
    }
    catch (e) {
        if (e.code === '42710') {
            console.log("Enum value already exists, ignoring");
        }
        else {
            console.error("Error", e);
        }
    }
    finally {
        db_1.pool.end();
    }
}
run();
