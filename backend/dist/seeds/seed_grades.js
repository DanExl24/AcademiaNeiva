"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../config/db");
/**
 * Grade distribution for realistic testing:
 *  - 15% fail (1.0 – 2.9): Below performance
 *  - 35% básico (3.0 – 3.9): Basic performance
 *  - 30% alto  (4.0 – 4.5): High performance
 *  - 20% superior (4.6 – 5.0): Superior performance
 */
function getRealisticGrade() {
    const rand = Math.random();
    let nota;
    if (rand < 0.15) {
        nota = 1.0 + Math.random() * 1.9;
    }
    else if (rand < 0.5) {
        nota = 3.0 + Math.random() * 0.9;
    }
    else if (rand < 0.8) {
        nota = 4.0 + Math.random() * 0.5;
    }
    else {
        nota = 4.6 + Math.random() * 0.4;
    }
    return Math.min(5.0, Math.round(nota * 10) / 10);
}
function getEstado(nota) {
    return nota >= 3.0 ? "APROBADO" : "REPROBADO";
}
// ─── OBSERVATION TEMPLATES BY TYPE ──────────────────────────────────────────────
function getAcademicObservation(nota) {
    if (nota >= 4.6)
        return {
            fortalezas: "Excelente comprensión y dominio de los contenidos. Participación activa y propositiva en clase.",
            debilidades: "Puede enriquecer sus aprendizajes con lecturas complementarias.",
            recomendaciones: "Continuar con el mismo nivel de compromiso y apoyar a sus compañeros.",
        };
    if (nota >= 4.0)
        return {
            fortalezas: "Buen manejo de los temas y actitud positiva frente al aprendizaje.",
            debilidades: "Algunas dificultades en los temas de mayor complejidad.",
            recomendaciones: "Reforzar los temas con mayor dificultad mediante ejercicios adicionales.",
        };
    if (nota >= 3.0)
        return {
            fortalezas: "Ha cumplido con los requisitos mínimos de la asignatura.",
            debilidades: "Falta profundizar en varios temas y mejorar la presentación de trabajos.",
            recomendaciones: "Establecer un plan de estudio regular y solicitar asesoría al docente.",
        };
    return {
        fortalezas: "Muestra disposición para asistir a clases.",
        debilidades: "Dificultades significativas en la comprensión de los contenidos y en la entrega de actividades.",
        recomendaciones: "Requiere plan de mejoramiento inmediato, apoyo familiar y asesoría permanente del docente.",
    };
}
const convivenciaObservations = [
    {
        fortalezas: "Demuestra excelente comportamiento en el aula y respeto hacia sus compañeros y docentes.",
        debilidades: "Ocasionalmente se distrae durante las explicaciones.",
        recomendaciones: "Mantener el buen comportamiento y trabajar en la concentración durante las clases.",
    },
    {
        fortalezas: "Es un líder natural en el grupo, promueve el trabajo colaborativo.",
        debilidades: "A veces interrumpe las intervenciones de otros compañeros.",
        recomendaciones: "Practicar la escucha activa y respetar los turnos de participación.",
    },
    {
        fortalezas: "Muestra empatía y solidaridad con sus compañeros.",
        debilidades: "Ha presentado dificultades para manejar situaciones de conflicto de manera pacífica.",
        recomendaciones: "Participar en talleres de resolución de conflictos y habilidades sociales.",
    },
    {
        fortalezas: "Cumple con las normas del manual de convivencia de manera consistente.",
        debilidades: "Presenta dificultades para integrarse en actividades grupales.",
        recomendaciones: "Fomentar la participación en actividades extracurriculares para fortalecer lazos sociales.",
    },
    {
        fortalezas: "Buena actitud frente a las correcciones y disposición para mejorar.",
        debilidades: "Ha tenido llamados de atención por uso inadecuado del uniforme.",
        recomendaciones: "Reforzar el cumplimiento del manual de convivencia en todos sus aspectos.",
    },
];
const generalObservations = [
    {
        fortalezas: "Se destaca por su puntualidad y asistencia regular a clases.",
        debilidades: "Podría mejorar su organización personal y manejo del tiempo.",
        recomendaciones: "Implementar una agenda o planificador para organizar sus actividades académicas.",
    },
    {
        fortalezas: "Participó activamente en la feria de ciencias institucional con un proyecto destacado.",
        debilidades: "Necesita mejorar la presentación escrita de sus proyectos.",
        recomendaciones: "Practicar la redacción y presentación formal de informes y proyectos.",
    },
    {
        fortalezas: "Representa al colegio en actividades deportivas/culturales con excelencia.",
        debilidades: "Las actividades extracurriculares han afectado parcialmente su rendimiento en algunas materias.",
        recomendaciones: "Establecer un equilibrio entre las actividades extracurriculares y las responsabilidades académicas.",
    },
    {
        fortalezas: "Ha mostrado mejora significativa respecto al periodo anterior.",
        debilidades: "Aún presenta inasistencias que afectan su proceso de aprendizaje.",
        recomendaciones: "Garantizar la asistencia regular y aprovechar los espacios de recuperación ofrecidos por los docentes.",
    },
];
// ─── MAIN SEEDER ────────────────────────────────────────────────────────────────
async function runSeedGrades() {
    const client = await db_1.pool.connect();
    try {
        console.log("🌱 Iniciando seeder de calificaciones (distribución realista)...");
        await client.query("BEGIN");
        await client.query("SET my.app.bypass_triggers = 'true';");
        // ─── CLEAR EXISTING GRADE DATA ──────────────────────────────────────────
        console.log("🔄 Limpiando datos anteriores de calificaciones...");
        await client.query("DELETE FROM resultado_academico");
        await client.query("DELETE FROM notas_actividad");
        await client.query("DELETE FROM nota_criterio");
        await client.query("DELETE FROM observacion_estudiante");
        await client.query("DELETE FROM actividad_materia");
        await client.query("DELETE FROM cierre_materia");
        console.log("✅ Datos anteriores eliminados.");
        // ─── FETCH BASE DATA ────────────────────────────────────────────────────
        const closedPeriodsRes = await client.query(`SELECT id_periodo, id_colegio, "id_año" FROM periodo_academico WHERE estado = 'CERRADO'`);
        const allPeriods = closedPeriodsRes.rows;
        if (allPeriods.length === 0) {
            console.log("❌ No hay periodos disponibles. Se necesita al menos uno.");
            return;
        }
        // Only ACTIVO and SANCIONADO students (not EXPULSADO or RETIRADO)
        const studentsRes = await client.query(`
      SELECT e.id_estudiante, e.id_colegio, m.id_grupo, e.estado as estado_estudiante
      FROM estudiante e
      JOIN matricula m ON m.id_estudiante = e.id_estudiante
      WHERE m.estado = 'ACTIVA' AND e.estado IN ('ACTIVO', 'SANCIONADO')
    `);
        const detalleGradosRes = await client.query(`
      SELECT dg.id_detallegrado, dg.id_materia, dg.id_docente, dg.id_grupo, dg.id_colegio
      FROM detalle_grados dg
    `);
        // Get escala_valoracion per school for proper FK
        const escalasRes = await client.query(`
      SELECT id_escalavaloracion, nivel, valor_minimo, valor_maximo, id_colegio
      FROM escala_valoracion
    `);
        // Build lookup: school -> nota -> escala_id
        const escalaBySchool = {};
        for (const row of escalasRes.rows) {
            if (!escalaBySchool[row.id_colegio])
                escalaBySchool[row.id_colegio] = [];
            escalaBySchool[row.id_colegio].push({
                id: row.id_escalavaloracion,
                min: parseFloat(row.valor_minimo),
                max: parseFloat(row.valor_maximo),
            });
        }
        function getEscalaId(nota, schoolId) {
            const escalas = escalaBySchool[schoolId] || [];
            const match = escalas.find((e) => nota >= e.min && nota <= e.max);
            return match?.id || escalas[escalas.length - 1]?.id || 1;
        }
        // Build competency lookup: (id_grupo, id_materia, id_periodo) -> id_competencia
        const competenciasRes = await client.query(`
      SELECT id_competencia, id_grupo, id_materia, id_periodo, id_colegio
      FROM competencias
    `);
        const competencyMap = new Map();
        for (const c of competenciasRes.rows) {
            const key = `${c.id_grupo}-${c.id_materia}-${c.id_periodo}`;
            competencyMap.set(key, c.id_competencia);
        }
        // Fallback: get any competency per school for groups without explicit match
        const fallbackCompetency = {};
        for (const c of competenciasRes.rows) {
            if (!fallbackCompetency[c.id_colegio])
                fallbackCompetency[c.id_colegio] = c.id_competencia;
        }
        let notasAgregadas = 0;
        let observacionesAcademicas = 0;
        let observacionesConvivencia = 0;
        let observacionesDisciplinarias = 0;
        let observacionesGenerales = 0;
        for (const period of allPeriods) {
            const isClosed = closedPeriodsRes.rows.some((p) => p.id_periodo === period.id_periodo);
            const detalleGradosDePeriodo = detalleGradosRes.rows.filter((d) => d.id_colegio === period.id_colegio);
            for (const dg of detalleGradosDePeriodo) {
                let shouldProcess = true;
                let gradePercentageOfStudents = 1.0;
                let shouldCloseSubject = false;
                // In open periods, simulate 60% academic load:
                // - 60% of subjects have activities/grades.
                // - 40% of subjects have no grades or activities.
                if (!isClosed) {
                    const randScenario = Math.random();
                    if (randScenario < 0.60) {
                        shouldProcess = true;
                        gradePercentageOfStudents = 1.0;
                        shouldCloseSubject = false;
                    }
                    else {
                        shouldProcess = false;
                    }
                }
                if (!shouldProcess) {
                    continue;
                }
                // Get the correct competency for this group+materia+periodo
                const compKey = `${dg.id_grupo}-${dg.id_materia}-${period.id_periodo}`;
                const competenciaId = competencyMap.get(compKey) || fallbackCompetency[dg.id_colegio] || null;
                // Register subject closure for CLOSED periods or completed open subjects
                if (isClosed || shouldCloseSubject) {
                    await client.query(`INSERT INTO cierre_materia (id_detallegrado, id_periodo, estado, fecha_cierre)
             VALUES ($1, $2, 'CERRADO', NOW()) ON CONFLICT DO NOTHING`, [dg.id_detallegrado, period.id_periodo]);
                }
                // Create a graded activity (100% weight)
                const actRes = await client.query(`INSERT INTO actividad_materia (id_detallegrado, id_periodo, nombre, porcentaje, id_colegio, id_competencia)
           VALUES ($1, $2, 'Evaluación integral', 100.0, $3, $4)
           RETURNING id_actividadmateria`, [dg.id_detallegrado, period.id_periodo, dg.id_colegio, competenciaId]);
                const actividadId = actRes.rows[0].id_actividadmateria;
                const studentsInGroup = studentsRes.rows.filter((s) => s.id_grupo === dg.id_grupo);
                let studentsToGrade = studentsInGroup;
                if (gradePercentageOfStudents < 1.0) {
                    const limit = Math.ceil(studentsInGroup.length * gradePercentageOfStudents);
                    studentsToGrade = studentsInGroup.slice(0, limit);
                }
                for (const student of studentsToGrade) {
                    const nota = getRealisticGrade();
                    const escalaId = getEscalaId(nota, dg.id_colegio);
                    const obsAcad = getAcademicObservation(nota);
                    // Grade
                    await client.query(`INSERT INTO notas_actividad (id_actividadmateria, id_estudiante, id_escalavaloracion, nota, id_colegio)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`, [actividadId, student.id_estudiante, escalaId, nota, dg.id_colegio]);
                    // Official result only for CLOSED periods
                    if (isClosed) {
                        await client.query(`INSERT INTO resultado_academico (id_estudiante, id_detallegrado, id_periodo, promedio, estado, fecha_cierre, id_docente, observacion)
               VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7) ON CONFLICT DO NOTHING`, [student.id_estudiante, dg.id_detallegrado, period.id_periodo, nota, getEstado(nota), dg.id_docente, obsAcad.recomendaciones]);
                    }
                    // ── ACADEMIC observation (always for graded students) ──
                    await client.query(`INSERT INTO observacion_estudiante (id_estudiante, id_detallegrado, id_periodo, fortalezas, debilidades, recomendaciones, fecha, id_colegio, tipo)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, 'ACADEMICA') ON CONFLICT DO NOTHING`, [student.id_estudiante, dg.id_detallegrado, period.id_periodo, obsAcad.fortalezas, obsAcad.debilidades, obsAcad.recomendaciones, dg.id_colegio]);
                    observacionesAcademicas++;
                    // ── CONVIVENCIA observation (~20% of students) ──
                    if (Math.random() < 0.20) {
                        const convObs = convivenciaObservations[Math.floor(Math.random() * convivenciaObservations.length)];
                        await client.query(`INSERT INTO observacion_estudiante (id_estudiante, id_detallegrado, id_periodo, fortalezas, debilidades, recomendaciones, fecha, id_colegio, tipo)
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, 'CONVIVENCIA')`, [student.id_estudiante, dg.id_detallegrado, period.id_periodo, convObs.fortalezas, convObs.debilidades, convObs.recomendaciones, dg.id_colegio]);
                        observacionesConvivencia++;
                    }
                    // ── DISCIPLINARIA observation (~10% of students) ──
                    if (Math.random() < 0.10) {
                        const discObs = convivenciaObservations[Math.floor(Math.random() * convivenciaObservations.length)];
                        await client.query(`INSERT INTO observacion_estudiante (id_estudiante, id_detallegrado, id_periodo, fortalezas, debilidades, recomendaciones, fecha, id_colegio, tipo)
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, 'DISCIPLINARIA')`, [student.id_estudiante, dg.id_detallegrado, period.id_periodo, discObs.fortalezas, discObs.debilidades, discObs.recomendaciones, dg.id_colegio]);
                        observacionesDisciplinarias++;
                    }
                    // ── GENERAL observation (~10% of students) ──
                    if (Math.random() < 0.10) {
                        const genObs = generalObservations[Math.floor(Math.random() * generalObservations.length)];
                        await client.query(`INSERT INTO observacion_estudiante (id_estudiante, id_detallegrado, id_periodo, fortalezas, debilidades, recomendaciones, fecha, id_colegio, tipo)
               VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, 'OTRO')`, [student.id_estudiante, dg.id_detallegrado, period.id_periodo, genObs.fortalezas, genObs.debilidades, genObs.recomendaciones, dg.id_colegio]);
                        observacionesGenerales++;
                    }
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
        console.log(`   📋 Observaciones ACADÉMICAS: ${observacionesAcademicas}`);
        console.log(`   🤝 Observaciones CONVIVENCIA: ${observacionesConvivencia}`);
        console.log(`   🚨 Observaciones DISCIPLINARIAS: ${observacionesDisciplinarias}`);
        console.log(`   📌 Observaciones GENERALES: ${observacionesGenerales}`);
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
