import { db } from "../config/kysely";
import { sql } from "kysely";

/**
 * Grade distribution for realistic testing:
 *  - 15% fail (1.0 – 2.9): Below performance
 *  - 35% básico (3.0 – 3.9): Basic performance
 *  - 30% alto  (4.0 – 4.5): High performance
 *  - 20% superior (4.6 – 5.0): Superior performance
 */
function getRealisticGrade(): number {
  const rand = Math.random();
  let nota: number;

  if (rand < 0.15) {
    nota = 1.0 + Math.random() * 1.9;
  } else if (rand < 0.5) {
    nota = 3.0 + Math.random() * 0.9;
  } else if (rand < 0.8) {
    nota = 4.0 + Math.random() * 0.5;
  } else {
    nota = 4.6 + Math.random() * 0.4;
  }

  return Math.min(5.0, Math.round(nota * 10) / 10);
}

function getEstado(nota: number): string {
  return nota >= 3.0 ? "APROBADO" : "REPROBADO";
}

// ─── OBSERVATION TEMPLATES BY TYPE ──────────────────────────────────────────────

function getAcademicObservation(nota: number) {
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
  try {
    console.log("🌱 Iniciando seeder de calificaciones (distribución realista)...");

    let notasAgregadas = 0;
    let observacionesAcademicas = 0;
    let observacionesConvivencia = 0;
    let observacionesDisciplinarias = 0;
    let observacionesGenerales = 0;

    await db.transaction().execute(async (trx) => {
      await sql`SET my.app.bypass_triggers = 'true';`.execute(trx);

      // ─── CLEAR EXISTING GRADE DATA ──────────────────────────────────────────
      console.log("🔄 Limpiando datos anteriores de calificaciones...");
      await trx.deleteFrom("resultado_academico").execute();
      await trx.deleteFrom("notas_actividad").execute();
      await trx.deleteFrom("nota_criterio").execute();
      await trx.deleteFrom("observacion_estudiante").execute();
      await trx.deleteFrom("actividad_materia").execute();
      await trx.deleteFrom("cierre_materia").execute();
      console.log("✅ Datos anteriores eliminados.");

      // ─── FETCH BASE DATA (Only Year 2025) ────────────────────────────────────
      const closedPeriods = await trx
        .selectFrom("periodo_academico as p")
        .innerJoin("anio_lectivo as al", "al.id_anio", "p.id_anio")
        .select(["p.id_periodo", "p.id_colegio", "p.id_anio"])
        .where((eb) => eb.or([eb("al.calendario", "=", "2025"), eb("al.calendario", "=", "2024-2025")]))
        .execute();

      const allPeriods = closedPeriods;

      if (allPeriods.length === 0) {
        console.log("❌ No hay periodos disponibles para el año 2025.");
        return;
      }

      // Only ACTIVO and SANCIONADO students (not EXPULSADO or RETIRADO)
      const students = await trx
        .selectFrom("estudiante as e")
        .innerJoin("matricula as m", "m.id_estudiante", "e.id_estudiante")
        .select(["e.id_estudiante", "e.id_colegio", "m.id_grupo", "e.estado as estado_estudiante"])
        .where("m.estado", "=", "ACTIVA")
        .where("e.estado", "in", ["ACTIVO", "SANCIONADO"])
        .execute();

      const detalleGrados = await trx
        .selectFrom("detalle_grados as dg")
        .innerJoin("anio_lectivo as al", "al.id_anio", "dg.id_anio")
        .select([
          "dg.id_detallegrado",
          "dg.id_materia",
          "dg.id_docente",
          "dg.id_grupo",
          "dg.id_colegio",
          "dg.id_anio",
        ])
        .where((eb) => eb.or([eb("al.calendario", "=", "2025"), eb("al.calendario", "=", "2024-2025")]))
        .execute();

      // Get escala_valoracion per school for proper FK
      const escalas = await trx
        .selectFrom("escala_valoracion")
        .select(["id_escalavaloracion", "nivel", "valor_minimo", "valor_maximo", "id_colegio"])
        .execute();

      // Build lookup: school -> nota -> escala_id
      const escalaBySchool: Record<number, { id: number; min: number; max: number }[]> = {};
      for (const row of escalas) {
        if (!escalaBySchool[row.id_colegio]) escalaBySchool[row.id_colegio] = [];
        escalaBySchool[row.id_colegio].push({
          id: row.id_escalavaloracion,
          min: parseFloat(String(row.valor_minimo)),
          max: parseFloat(String(row.valor_maximo)),
        });
      }

      function getEscalaId(nota: number, schoolId: number): number {
        const schoolEscalas = escalaBySchool[schoolId] || [];
        const match = schoolEscalas.find((e) => nota >= e.min && nota <= e.max);
        return match?.id || schoolEscalas[schoolEscalas.length - 1]?.id || 1;
      }

      // Build competency lookup: (id_grupo, id_materia, id_periodo) -> id_competencia
      const competencias = await trx
        .selectFrom("competencias")
        .select(["id_competencia", "id_grupo", "id_materia", "id_periodo", "id_colegio"])
        .execute();

      const competencyMap = new Map<string, number>();
      for (const c of competencias) {
        const key = `${c.id_grupo}-${c.id_materia}-${c.id_periodo}`;
        competencyMap.set(key, c.id_competencia);
      }

      // Fallback: get any competency per school for groups without explicit match
      const fallbackCompetency: Record<number, number> = {};
      for (const c of competencias) {
        if (!fallbackCompetency[c.id_colegio]) fallbackCompetency[c.id_colegio] = c.id_competencia;
      }

      for (const period of allPeriods) {
        const isClosed = closedPeriods.some((p) => p.id_periodo === period.id_periodo);
        const detalleGradosDePeriodo = detalleGrados.filter(
          (d) => d.id_colegio === period.id_colegio && d.id_anio === period.id_anio
        );

        for (const dg of detalleGradosDePeriodo) {
          let shouldProcess = true;
          let gradePercentageOfStudents = 1.0;
          let shouldCloseSubject = false;

          // In open periods, simulate 60% academic load
          if (!isClosed) {
            const randScenario = Math.random();
            if (randScenario < 0.6) {
              shouldProcess = true;
              gradePercentageOfStudents = 1.0;
              shouldCloseSubject = false;
            } else {
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
            await trx
              .insertInto("cierre_materia")
              .values({
                id_detallegrado: dg.id_detallegrado,
                id_periodo: period.id_periodo,
                estado: "CERRADO" as any,
                fecha_cierre: sql`NOW()` as any,
              })
              .onConflict((oc) => oc.doNothing())
              .execute();
          }

          // Create a graded activity (100% weight)
          const actRes = await trx
            .insertInto("actividad_materia")
            .values({
              id_detallegrado: dg.id_detallegrado,
              id_periodo: period.id_periodo,
              nombre: "Evaluación integral",
              porcentaje: 100.0,
              id_colegio: dg.id_colegio,
              id_competencia: competenciaId,
            })
            .returning("id_actividadmateria")
            .executeTakeFirstOrThrow();
          const actividadId = actRes.id_actividadmateria;

          // Asociar evidencias del DBA a la actividad para coherencia curricular
          if (competenciaId) {
            const evDbaRes = await trx
              .selectFrom("evidencia_aprendizaje")
              .select("id_evidencia_dba")
              .where("id_competencia", "=", competenciaId)
              .where("id_evidencia_dba", "is not", null)
              .execute();

            for (const evRow of evDbaRes) {
              if (evRow.id_evidencia_dba) {
                await trx
                  .insertInto("actividad_evidencia_dba")
                  .values({
                    id_actividadmateria: actividadId,
                    id_evidencia_dba: evRow.id_evidencia_dba,
                  })
                  .onConflict((oc) => oc.doNothing())
                  .execute();
              }
            }
          }

          const studentsInGroup = students.filter((s) => s.id_grupo === dg.id_grupo);
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
            await trx
              .insertInto("notas_actividad")
              .values({
                id_actividadmateria: actividadId,
                id_estudiante: student.id_estudiante,
                id_escalavaloracion: escalaId,
                nota,
                id_colegio: dg.id_colegio,
              })
              .onConflict((oc) => oc.doNothing())
              .execute();

            // Official result only for CLOSED periods
            if (isClosed) {
              await trx
                .insertInto("resultado_academico")
                .values({
                  id_estudiante: student.id_estudiante,
                  id_detallegrado: dg.id_detallegrado,
                  id_periodo: period.id_periodo,
                  promedio: nota,
                  estado: getEstado(nota) as any,
                  fecha_cierre: sql`NOW()` as any,
                  id_docente: dg.id_docente,
                  observacion: obsAcad.recomendaciones,
                })
                .onConflict((oc) => oc.doNothing())
                .execute();
            }

            // ── ACADEMIC observation (always for graded students) ──
            await trx
              .insertInto("observacion_estudiante")
              .values({
                id_estudiante: student.id_estudiante,
                id_detallegrado: dg.id_detallegrado,
                id_periodo: period.id_periodo,
                fortalezas: obsAcad.fortalezas,
                debilidades: obsAcad.debilidades,
                recomendaciones: obsAcad.recomendaciones,
                fecha: sql`NOW()` as any,
                id_colegio: dg.id_colegio,
                tipo: "ACADEMICA",
              })
              .onConflict((oc) => oc.doNothing())
              .execute();
            observacionesAcademicas++;

            // ── CONVIVENCIA observation (~20% of students) ──
            if (Math.random() < 0.2) {
              const convObs =
                convivenciaObservations[Math.floor(Math.random() * convivenciaObservations.length)];
              await trx
                .insertInto("observacion_estudiante")
                .values({
                  id_estudiante: student.id_estudiante,
                  id_detallegrado: dg.id_detallegrado,
                  id_periodo: period.id_periodo,
                  fortalezas: convObs.fortalezas,
                  debilidades: convObs.debilidades,
                  recomendaciones: convObs.recomendaciones,
                  fecha: sql`NOW()` as any,
                  id_colegio: dg.id_colegio,
                  tipo: "CONVIVENCIA",
                })
                .execute();
              observacionesConvivencia++;
            }

            // ── DISCIPLINARIA observation (~10% of students) ──
            if (Math.random() < 0.1) {
              const discObs =
                convivenciaObservations[Math.floor(Math.random() * convivenciaObservations.length)];
              await trx
                .insertInto("observacion_estudiante")
                .values({
                  id_estudiante: student.id_estudiante,
                  id_detallegrado: dg.id_detallegrado,
                  id_periodo: period.id_periodo,
                  fortalezas: discObs.fortalezas,
                  debilidades: discObs.debilidades,
                  recomendaciones: discObs.recomendaciones,
                  fecha: sql`NOW()` as any,
                  id_colegio: dg.id_colegio,
                  tipo: "DISCIPLINARIA",
                })
                .execute();
              observacionesDisciplinarias++;
            }

            // ── GENERAL observation (~10% of students) ──
            if (Math.random() < 0.1) {
              const genObs = generalObservations[Math.floor(Math.random() * generalObservations.length)];
              await trx
                .insertInto("observacion_estudiante")
                .values({
                  id_estudiante: student.id_estudiante,
                  id_detallegrado: dg.id_detallegrado,
                  id_periodo: period.id_periodo,
                  fortalezas: genObs.fortalezas,
                  debilidades: genObs.debilidades,
                  recomendaciones: genObs.recomendaciones,
                  fecha: sql`NOW()` as any,
                  id_colegio: dg.id_colegio,
                  tipo: "OTRO",
                })
                .execute();
              observacionesGenerales++;
            }

            notasAgregadas++;
          }
        }
      }
    });

    const failCount = await db
      .selectFrom("resultado_academico")
      .select(db.fn.count("id_resultado").as("total"))
      .where("promedio", "<", "3.0")
      .executeTakeFirst();
    const passCount = await db
      .selectFrom("resultado_academico")
      .select(db.fn.count("id_resultado").as("total"))
      .where("promedio", ">=", "3.0")
      .executeTakeFirst();

    console.log(`\n✅ Seeder completado exitosamente!`);
    console.log(`   📝 Notas agregadas: ${notasAgregadas}`);
    console.log(`   ✅ Aprobados (>= 3.0): ${passCount?.total || 0}`);
    console.log(`   ❌ Reprobados (< 3.0): ${failCount?.total || 0}`);
    console.log(`   📋 Observaciones ACADÉMICAS: ${observacionesAcademicas}`);
    console.log(`   🤝 Observaciones CONVIVENCIA: ${observacionesConvivencia}`);
    console.log(`   🚨 Observaciones DISCIPLINARIAS: ${observacionesDisciplinarias}`);
    console.log(`   📌 Observaciones GENERALES: ${observacionesGenerales}`);
    console.log(`\n   ¡El dashboard ahora mostrará datos reales de bajo rendimiento! 🎉`);
  } catch (error) {
    console.error("❌ Error en el seeder de calificaciones:", error);
  } finally {
    process.exit();
  }
}

runSeedGrades();
