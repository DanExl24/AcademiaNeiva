"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("./config/db");
/**
 * Grade distribution for realistic testing:
 *  - 15% fail (1.0 – 2.9): Below performance
 *  - 35% básico (3.0 – 3.9): Basic performance
 *  - 30% alto  (4.0 – 4.5): High performance
 *  - 20% superior (4.6 – 5.0): Superior performance
 *
 * This ensures the Directivo dashboard "Low Performance" block
 * can show meaningful data for testing.
 */
function getRealisticGrade() {
    const rand = Math.random();
    let nota;
    if (rand < 0.15) {
        // 15% failing: 1.0 – 2.9
        nota = 1.0 + Math.random() * 1.9;
    }
    else if (rand < 0.50) {
        // 35% basic: 3.0 – 3.9
        nota = 3.0 + Math.random() * 0.9;
    }
    else if (rand < 0.80) {
        // 30% high: 4.0 – 4.5
        nota = 4.0 + Math.random() * 0.5;
    }
    else {
        // 20% superior: 4.6 – 5.0
        nota = 4.6 + Math.random() * 0.4;
    }
    return Math.min(5.0, Math.round(nota * 10) / 10);
}
function getEscalaId(nota) {
    if (nota >= 4.6)
        return 1; // Superior
    if (nota >= 4.0)
        return 2; // Alto
    if (nota >= 3.0)
        return 3; // Básico
    return 4; // Bajo
}
function getEstado(nota) {
    return nota >= 3.0 ? "APROBADO" : "REPROBADO";
}
function getObservation(nota) {
    if (nota >= 4.6)
        return {
            fortalezas: "Excelente comprensión y dominio de los contenidos. Participación activa y propositiva en clase.",
            debilidades: "Puede enriquecer sus aprendizajes con lecturas complementarias.",
            recomendaciones: "Continuar con el mismo nivel de compromiso y apoyar a sus compañeros."
        };
    if (nota >= 4.0)
        return {
            fortalezas: "Buen manejo de los temas y actitud positiva frente al aprendizaje.",
            debilidades: "Algunas dificultades en los temas de mayor complejidad.",
            recomendaciones: "Reforzar los temas con mayor dificultad mediante ejercicios adicionales."
        };
    if (nota >= 3.0)
        return {
            fortalezas: "Ha cumplido con los requisitos mínimos de la asignatura.",
            debilidades: "Falta profundizar en varios temas y mejorar la presentación de trabajos.",
            recomendaciones: "Establecer un plan de estudio regular y solicitar asesoría al docente."
        };
    return {
        fortalezas: "Muestra disposición para asistir a clases.",
        debilidades: "Dificultades significativas en la comprensión de los contenidos y en la entrega de actividades.",
        recomendaciones: "Requiere plan de mejoramiento inmediato, apoyo familiar y asesoría permanente del docente."
    };
}
async function runSeedGrades() {
    const client = await db_1.pool.connect();
    try {
        console.log("🌱 Iniciando seeder de calificaciones (distribución realista)...");
        await client.query("BEGIN");
        // ─── CLEAR EXISTING GRADE DATA ───────────────────────────────────────────
        console.log("🔄 Limpiando datos anteriores de calificaciones...");
        await client.query("DELETE FROM resultado_academico");
        await client.query("DELETE FROM notas_actividad");
        await client.query("DELETE FROM nota_criterio");
        await client.query("DELETE FROM observacion_estudiante");
        await client.query("DELETE FROM actividad_materia");
        await client.query("DELETE FROM cierre_materia");
        console.log("✅ Datos anteriores eliminados.");
        // ─── FETCH BASE DATA ─────────────────────────────────────────────────────
        const closedPeriodsRes = await client.query(`SELECT id_periodo, id_colegio FROM periodo_academico WHERE estado = 'CERRADO'`);
        const openPeriodsRes = await client.query(`SELECT id_periodo, id_colegio FROM periodo_academico WHERE estado = 'ABIERTO'`);
        const allPeriods = [...closedPeriodsRes.rows, ...openPeriodsRes.rows];
        if (allPeriods.length === 0) {
            console.log("❌ No hay periodos disponibles. Se necesita al menos uno.");
            return;
        }
        const studentsRes = await client.query(`
      SELECT e.id_estudiante, e.id_colegio, m.id_grupo
      FROM estudiante e
      JOIN matricula m ON m.id_estudiante = e.id_estudiante
      WHERE m.estado = 'ACTIVA'
    `);
        const detalleGradosRes = await client.query(`
      SELECT dg.id_detallegrado, dg.id_materia, dg.id_docente, dg.id_grupo, dg.id_colegio
      FROM detalle_grados dg
    `);
        const competenciasRes = await client.query(`
      SELECT id_competencia, id_grupo, id_materia, id_colegio
      FROM competencias LIMIT 1
    `);
        const defaultCompetenciaId = competenciasRes.rows.length ? competenciasRes.rows[0].id_competencia : 1;
        let notasAgregadas = 0;
        for (const period of allPeriods) {
            const isClosed = closedPeriodsRes.rows.some(p => p.id_periodo === period.id_periodo);
            const detalleGradosDePeriodo = detalleGradosRes.rows.filter(d => d.id_colegio === period.id_colegio);
            for (const dg of detalleGradosDePeriodo) {
                // Register subject closure for CLOSED periods only
                if (isClosed) {
                    await client.query(`
            INSERT INTO cierre_materia (id_detallegrado, id_periodo, estado, fecha_cierre)
            VALUES ($1, $2, 'CERRADO', NOW())
            ON CONFLICT DO NOTHING
          `, [dg.id_detallegrado, period.id_periodo]);
                }
                // Create a single graded activity (100% weight)
                const actRes = await client.query(`
          INSERT INTO actividad_materia (id_detallegrado, id_periodo, nombre, porcentaje, id_colegio, id_competencia)
          VALUES ($1, $2, 'Actividad de evaluación', 100.0, $3, $4)
          RETURNING id_actividadmateria
        `, [dg.id_detallegrado, period.id_periodo, dg.id_colegio, defaultCompetenciaId]);
                const actividadId = actRes.rows[0].id_actividadmateria;
                const studentsInGroup = studentsRes.rows.filter(s => s.id_grupo === dg.id_grupo);
                for (const student of studentsInGroup) {
                    const nota = getRealisticGrade();
                    const escalaId = getEscalaId(nota);
                    const obs = getObservation(nota);
                    // Record in notas_actividad
                    await client.query(`
            INSERT INTO notas_actividad (id_actividadmateria, id_estudiante, id_escalavaloracion, nota, id_colegio)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
          `, [actividadId, student.id_estudiante, escalaId, nota, dg.id_colegio]);
                    // For CLOSED periods: also insert oficial result into resultado_academico
                    if (isClosed) {
                        await client.query(`
              INSERT INTO resultado_academico (id_estudiante, id_detallegrado, id_periodo, promedio, estado, fecha_cierre, id_docente, observacion)
              VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
              ON CONFLICT DO NOTHING
            `, [student.id_estudiante, dg.id_detallegrado, period.id_periodo, nota, getEstado(nota), dg.id_docente, obs.recomendaciones]);
                    }
                    // Observation per student per subject per period (academic type)
                    await client.query(`
            INSERT INTO observacion_estudiante (id_estudiante, id_detallegrado, id_periodo, fortalezas, debilidades, recomendaciones, fecha, id_colegio, tipo)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, 'ACADEMICA')
            ON CONFLICT DO NOTHING
          `, [student.id_estudiante, dg.id_detallegrado, period.id_periodo, obs.fortalezas, obs.debilidades, obs.recomendaciones, dg.id_colegio]);
                    notasAgregadas++;
                }
            }
        }
        await client.query("COMMIT");
        const failCount = await db_1.pool.query(`SELECT COUNT(*) as total FROM resultado_academico WHERE promedio < 3.0`);
        const passCount = await db_1.pool.query(`SELECT COUNT(*) as total FROM resultado_academico WHERE promedio >= 3.0`);
        console.log(`\n✅ Seeder completado exitosamente!`);
        console.log(`   📝 Notas agregadas: ${notasAgregadas}`);
        console.log(`   ✅ Aprobados (>= 3.0): ${passCount.rows[0].total}`);
        console.log(`   ❌ Reprobados (< 3.0): ${failCount.rows[0].total}`);
        console.log(`\n   ¡El dashboard ahora mostrará datos reales de bajo rendimiento! 🎉`);
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Error en el seeder de calificaciones:", error);
    }
    finally {
        client.release();
        process.exit();
    }
}
runSeedGrades();
