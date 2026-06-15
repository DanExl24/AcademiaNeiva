"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function runSeedStudents() {
    const client = await db_1.pool.connect();
    try {
        console.log("Iniciando la generación de estudiantes semilla...");
        await client.query("BEGIN");
        // Obtener los IDs de los roles "padre" y "estudiante"
        const rolesRes = await client.query('SELECT id_rol, nombre FROM rol WHERE nombre IN ($1, $2)', ['padre', 'estudiante']);
        const roleIds = {};
        for (const r of rolesRes.rows) {
            roleIds[r.nombre] = r.id_rol;
        }
        if (!roleIds['padre'] || !roleIds['estudiante']) {
            throw new Error("No se encontraron los roles padre o estudiante en la base de datos.");
        }
        // Obtener todos los grupos
        const groupsRes = await client.query('SELECT id_grupo, id_nivel, id_colegio FROM grupos');
        const groups = groupsRes.rows;
        if (groups.length === 0) {
            console.warn("No hay grupos (cursos) creados en la base de datos. Debes ejecutar el reseteo primero.");
            return;
        }
        // Obtener años lectivos por colegio
        const yearRes = await client.query('SELECT "id_año", id_colegio FROM año_lectivo');
        const years = yearRes.rows.reduce((acc, y) => {
            acc[y.id_colegio] = y.id_año;
            return acc;
        }, {});
        const parentHash = await bcrypt_1.default.hash("padre123", 10);
        const studentHash = await bcrypt_1.default.hash("estudiante123", 10);
        let studentCounter = 1;
        let studentsCreated = 0;
        for (const group of groups) {
            const yearId = years[group.id_colegio];
            if (!yearId)
                continue;
            // Generar 3 estudiantes por cada grupo
            for (let i = 1; i <= 3; i++) {
                const idx = studentCounter++;
                // 1. Crear Usuario Padre
                const pEmail = `padre${idx}@correo.com`;
                const pUserRes = await client.query(`INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo) VALUES ($1, $2, $3, $4, $5, true) RETURNING id_usuario`, [pEmail, parentHash, `PadreMock ${idx}`, `ApellidoP ${idx}`, group.id_colegio]);
                const idPadreUser = pUserRes.rows[0].id_usuario;
                await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [idPadreUser, roleIds['padre']]);
                // 2. Crear Registro en Padre de Familia
                const pFamRes = await client.query(`INSERT INTO padre_familia (nombre, apellido, documeno, id_tipodocumento, id_colegio, id_usuario) VALUES ($1, $2, $3, 1, $4, $5) RETURNING id_padrefamilia`, [`PadreMock ${idx}`, `ApellidoP ${idx}`, `1000${idx}`, group.id_colegio, idPadreUser]);
                const idPadreFamilia = pFamRes.rows[0].id_padrefamilia;
                // 3. Crear Usuario Estudiante
                const sEmail = `estudiante${idx}@correo.com`;
                const sUserRes = await client.query(`INSERT INTO usuario (email, password, nombre, apellido, id_colegio, activo) VALUES ($1, $2, $3, $4, $5, true) RETURNING id_usuario`, [sEmail, studentHash, `EstudianteMock ${idx}`, `ApellidoS ${idx}`, group.id_colegio]);
                const idEstUser = sUserRes.rows[0].id_usuario;
                await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)`, [idEstUser, roleIds['estudiante']]);
                // 4. Crear Registro Estudiante
                const estRes = await client.query(`INSERT INTO estudiante (nombre, apellido, documento, codigo, id_tipodocumento, id_nivel, id_colegio, id_usuario) VALUES ($1, $2, $3, $4, 1, $5, $6, $7) RETURNING id_estudiante`, [`EstudianteMock ${idx}`, `ApellidoS ${idx}`, `2000${idx}`, `EST-MOCK-${idx}`, group.id_nivel, group.id_colegio, idEstUser]);
                const idEstudiante = estRes.rows[0].id_estudiante;
                // 5. Vincular Padre y Estudiante
                await client.query(`INSERT INTO detalle_padrefamilia (id_padrefamilia, id_estudiante, id_colegio) VALUES ($1, $2, $3)`, [idPadreFamilia, idEstudiante, group.id_colegio]);
                // 6. Matricular al Estudiante en el Grupo
                await client.query(`INSERT INTO matricula (id_estudiante, id_nivel, id_colegio, "id_año", estado, correo_padre, id_grupo) VALUES ($1, $2, $3, $4, 'ACTIVA', $5, $6)`, [idEstudiante, group.id_nivel, group.id_colegio, yearId, pEmail, group.id_grupo]);
                studentsCreated++;
            }
        }
        await client.query("COMMIT");
        console.log(`✅ ¡Éxito! Se crearon ${studentsCreated} estudiantes borrador (y sus padres respectivos) repartidos en los grupos existentes.`);
        // Generate sample attendance for these new students
        console.log("Generando asistencia para los nuevos estudiantes...");
        await generateAttendanceForMockStudents(client);
        console.log(`Contraseña para padres: padre123`);
        console.log(`Contraseña para estudiantes: estudiante123`);
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Ocurrió un error al generar estudiantes de prueba:", error);
    }
    finally {
        client.release();
        await db_1.pool.end();
    }
}
async function generateAttendanceForMockStudents(client) {
    // Get all students created today or with MOCK in their code
    const studentsRes = await client.query(`
    SELECT e.id_estudiante, e.id_colegio, m.id_grupo, al."id_año"
    FROM estudiante e
    JOIN matricula m ON m.id_estudiante = e.id_estudiante
    JOIN "año_lectivo" al ON m."id_año" = al."id_año"
    WHERE e.codigo LIKE 'EST-MOCK-%'
  `);
    const justifications = [
        "Cita médica", "Calamidad doméstica", "Gripe", "Evento deportivo", "Retraso transporte"
    ];
    for (const student of studentsRes.rows) {
        const { id_estudiante, id_colegio, id_grupo, id_año } = student;
        const dgRes = await client.query(`
      SELECT id_detallegrado FROM detalle_grados WHERE id_grupo = $1 AND id_colegio = $2
    `, [id_grupo, id_colegio]);
        const periodsRes = await client.query(`
      SELECT id_periodo, mes_inicio, mes_fin, dia_inicio, dia_fin
      FROM periodo_academico 
      WHERE id_colegio = $1 AND "id_año" = $2
    `, [id_colegio, id_año]);
        for (const period of periodsRes.rows) {
            const { mes_inicio, mes_fin, dia_inicio, dia_fin } = period;
            const batchValues = [];
            const batchSize = 100;
            for (let m = mes_inicio; m <= mes_fin; m++) {
                for (let d = (dia_inicio || 1); d <= (dia_fin || 28); d++) {
                    const date = new Date(2026, m - 1, d);
                    if (date.getDay() === 0 || date.getDay() === 6)
                        continue;
                    const dateStr = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    for (const dg of dgRes.rows) {
                        const rand = Math.random();
                        let estado = "PRESENTE";
                        let just = null;
                        if (rand > 0.98) {
                            estado = "JUSTIFICADA";
                            just = justifications[Math.floor(Math.random() * justifications.length)];
                        }
                        else if (rand > 0.95) {
                            estado = "AUSENTE";
                        }
                        batchValues.push({
                            id_estudiante,
                            id_detallegrado: dg.id_detallegrado,
                            fecha: dateStr,
                            estado,
                            justificacion: just,
                            id_colegio
                        });
                        if (batchValues.length >= batchSize) {
                            await flushAttendanceBatch(client, batchValues);
                            batchValues.length = 0;
                        }
                    }
                }
            }
            if (batchValues.length > 0) {
                await flushAttendanceBatch(client, batchValues);
            }
        }
    }
}
async function flushAttendanceBatch(client, batch) {
    const values = batch.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(',');
    const params = batch.flatMap(r => [r.id_estudiante, r.id_detallegrado, r.fecha, r.estado, r.justificacion, r.id_colegio]);
    await client.query(`
    INSERT INTO registro_asistencia (id_estudiante, id_detallegrado, fecha, estado, justificacion, id_colegio)
    VALUES ${values}
  `, params);
}
runSeedStudents();
