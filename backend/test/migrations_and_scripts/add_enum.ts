import { pool } from "../../src/config/db";

async function run() {
    try {
        await pool.query("ALTER TYPE estado_matricula ADD VALUE 'CORRECCION';");
        console.log("Enum updated");
    } catch (e: any) {
        if (e.code === '42710') {
             console.log("Enum value already exists, ignoring");
        } else {
             console.error("Error", e);
        }
    } finally {
        pool.end();
    }
}

run();
