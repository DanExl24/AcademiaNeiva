"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closePeriodForTeacher = exports.getClosureStatus = exports.saveGrades = exports.getGrades = exports.deleteCriterion = exports.createCriterion = exports.deleteActivity = exports.updateActivity = exports.createActivity = exports.updateCompetency = exports.getActivities = exports.getPeriods = void 0;
const db_1 = require("../config/db");
const competencyMigration_1 = require("../config/competencyMigration");
const periodHelpers_1 = require("../utils/periodHelpers");
const resolveTeachingContext = async (gradeId, subjectId, periodId, userId) => {
    const params = [gradeId, subjectId, periodId];
    let teacherFilter = "";
    if (typeof userId === "number" && !Number.isNaN(userId)) {
        teacherFilter = "AND d.id_usuario = $4";
        params.push(userId);
    }
    const result = await db_1.pool.query(`SELECT
       dg.id_detallegrado AS "idDetalleGrado",
       dg.id_grupo AS "idGrupo",
       dg.id_materia AS "idMateria",
       dg.id_colegio AS "idColegio",
       p."id_año" AS "idAnio"
     FROM detalle_grados dg
     JOIN periodo_academico p
       ON p.id_periodo = $3
      AND p.id_colegio = dg.id_colegio
     LEFT JOIN docente d ON dg.id_docente = d.id_docente
     WHERE dg.id_grupo = $1
       AND dg.id_materia = $2
       ${teacherFilter}
     LIMIT 1`, params);
    return result.rows[0] ?? null;
};
// Obtener periodos del colegio
const getPeriods = async (req, res) => {
    const { schoolId } = req.params;
    try {
        const currentPeriod = await (0, periodHelpers_1.getCurrentAllowedPeriodForSchool)(Number(schoolId));
        res.json(currentPeriod ? [currentPeriod] : []);
    }
    catch (error) {
        console.error("Error fetching periods:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getPeriods = getPeriods;
// Obtener competencia y actividades de un curso/materia/periodo
const getActivities = async (req, res) => {
    const gradeId = Number(req.params.gradeId);
    const subjectId = Number(req.params.subjectId);
    const periodId = Number(req.params.periodId);
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    try {
        const contextPreview = await resolveTeachingContext(gradeId, subjectId, periodId, userId);
        if (!contextPreview) {
            res.status(404).json({ error: "No se encontró la asignación académica" });
            return;
        }
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, contextPreview.idColegio, periodId))) {
            return;
        }
        const context = contextPreview;
        const client = await db_1.pool.connect();
        try {
            const competencia = await (0, competencyMigration_1.ensureCompetencyForContext)(client, context, periodId);
            const activities = await client.query(`SELECT *
         FROM actividad_materia
         WHERE id_competencia = $1
         ORDER BY id_actividadmateria ASC`, [competencia.id_competencia]);
            const evidencias = await client.query(`SELECT id_evidencia, descripcion, orden
         FROM evidencia_aprendizaje
         WHERE id_competencia = $1
         ORDER BY orden, id_evidencia`, [competencia.id_competencia]);
            const activityIds = activities.rows.map(a => a.id_actividadmateria);
            let criterios = [];
            if (activityIds.length > 0) {
                const critRes = await client.query(`SELECT * FROM criterio_evaluacion WHERE id_actividadmateria = ANY($1::int[]) ORDER BY id_criterio ASC`, [activityIds]);
                criterios = critRes.rows;
            }
            activities.rows.forEach(a => {
                a.criterios = criterios.filter(c => c.id_actividadmateria === a.id_actividadmateria);
            });
            res.json({
                competencia,
                activities: activities.rows,
                evidencias: evidencias.rows,
            });
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error("Error fetching activities:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getActivities = getActivities;
const updateCompetency = async (req, res) => {
    const { id } = req.params;
    const { descripcion } = req.body;
    if (typeof descripcion !== "string" || !descripcion.trim()) {
        res.status(400).json({ error: "La descripción de la competencia es obligatoria" });
        return;
    }
    const client = await db_1.pool.connect();
    try {
        const periodRes = await client.query(`SELECT c.id_periodo, c.id_materia, c.id_grupo, c.id_año, c.id_colegio
       FROM competencias
       WHERE id_competencia = $1`, [id]);
        if (periodRes.rows.length === 0) {
            res.status(404).json({ error: "Competencia no encontrada" });
            return;
        }
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, Number(periodRes.rows[0].id_colegio), Number(periodRes.rows[0].id_periodo)))) {
            return;
        }
        const periodOpen = await (0, periodHelpers_1.ensurePeriodOpen)(Number(periodRes.rows[0].id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se puede modificar la competencia porque el periodo está cerrado institucionalmente" });
            return;
        }
        const dgRes = await client.query(`SELECT id_detallegrado FROM detalle_grados
       WHERE id_grupo = $1 AND id_materia = $2 AND id_colegio = $3
       LIMIT 1`, [periodRes.rows[0].id_grupo, periodRes.rows[0].id_materia, periodRes.rows[0].id_colegio]);
        if (dgRes.rows.length > 0 && !(await (0, periodHelpers_1.ensureSubjectOpen)(dgRes.rows[0].id_detallegrado, Number(periodRes.rows[0].id_periodo)))) {
            res.status(409).json({ error: "No se puede modificar la competencia porque ya has cerrado esta materia para este periodo" });
            return;
        }
        const context = {
            idDetalleGrado: 0,
            idGrupo: Number(periodRes.rows[0].id_grupo),
            idMateria: Number(periodRes.rows[0].id_materia),
            idColegio: Number(periodRes.rows[0].id_colegio),
            idAnio: Number(periodRes.rows[0].id_año),
        };
        await client.query("BEGIN");
        const updated = await (0, competencyMigration_1.syncCompetencyAcrossGrade)(client, context, Number(periodRes.rows[0].id_periodo), descripcion.trim());
        await client.query("COMMIT");
        res.json(updated);
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating competency:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
    finally {
        client.release();
    }
};
exports.updateCompetency = updateCompetency;
// Crear nueva actividad
const createActivity = async (req, res) => {
    const { id_competencia, nombre, porcentaje, id_colegio, id_evidencia } = req.body;
    if (!id_competencia) {
        res.status(400).json({ error: "La actividad debe estar asociada a una competencia" });
        return;
    }
    if (!id_evidencia) {
        res.status(400).json({ error: "La actividad debe estar asociada a una evidencia de aprendizaje" });
        return;
    }
    try {
        const competencyRes = await db_1.pool.query("SELECT id_competencia, id_periodo, id_grupo, id_materia, id_colegio FROM competencias WHERE id_competencia = $1", [id_competencia]);
        if (competencyRes.rows.length === 0) {
            res.status(404).json({ error: "Competencia no encontrada" });
            return;
        }
        const comp = competencyRes.rows[0];
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, Number(comp.id_colegio), Number(comp.id_periodo)))) {
            return;
        }
        const periodOpen = await (0, periodHelpers_1.ensurePeriodOpen)(Number(comp.id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se pueden crear actividades porque el periodo está cerrado" });
            return;
        }
        // Resolver id_detallegrado desde el contexto de la competencia
        const dgRes = await db_1.pool.query(`SELECT id_detallegrado FROM detalle_grados
       WHERE id_grupo = $1 AND id_materia = $2 AND id_colegio = $3
       LIMIT 1`, [comp.id_grupo, comp.id_materia, comp.id_colegio]);
        const idDetalleGrado = dgRes.rows.length > 0 ? dgRes.rows[0].id_detallegrado : null;
        if (idDetalleGrado && !(await (0, periodHelpers_1.ensureSubjectOpen)(idDetalleGrado, Number(comp.id_periodo)))) {
            res.status(409).json({ error: "No se pueden crear actividades porque ya has cerrado esta materia para este periodo" });
            return;
        }
        const sumRes = await db_1.pool.query(`SELECT COALESCE(SUM(porcentaje), 0) AS total
       FROM actividad_materia
       WHERE id_competencia = $1`, [id_competencia]);
        const currentTotal = parseFloat(sumRes.rows[0].total || "0");
        if (currentTotal + parseFloat(porcentaje) > 100) {
            res.status(400).json({
                error: `La suma de porcentajes no puede exceder el 100%. Actual: ${currentTotal}%`,
            });
            return;
        }
        const newActivity = await db_1.pool.query(`INSERT INTO actividad_materia (id_competencia, id_evidencia, id_detallegrado, id_periodo, nombre, porcentaje, id_colegio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, [id_competencia, id_evidencia, idDetalleGrado, comp.id_periodo, nombre, porcentaje, id_colegio]);
        res.status(201).json(newActivity.rows[0]);
    }
    catch (error) {
        console.error("Error creating activity:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.createActivity = createActivity;
// Actualizar actividad
const updateActivity = async (req, res) => {
    const { id } = req.params;
    const { nombre, porcentaje } = req.body;
    try {
        const currentActRes = await db_1.pool.query(`SELECT a.id_competencia, c.id_periodo
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = $1`, [id]);
        if (currentActRes.rows.length === 0) {
            res.status(404).json({ error: "Actividad no encontrada" });
            return;
        }
        const schoolRes = await db_1.pool.query(`SELECT c.id_colegio
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = $1`, [id]);
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, Number(schoolRes.rows[0].id_colegio), Number(currentActRes.rows[0].id_periodo)))) {
            return;
        }
        const periodOpen = await (0, periodHelpers_1.ensurePeriodOpen)(Number(currentActRes.rows[0].id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se puede modificar la actividad porque el periodo está cerrado institucionalmente" });
            return;
        }
        const dgRes = await db_1.pool.query(`SELECT id_detallegrado FROM actividad_materia WHERE id_actividadmateria = $1`, [id]);
        if (dgRes.rows.length > 0 && !(await (0, periodHelpers_1.ensureSubjectOpen)(dgRes.rows[0].id_detallegrado, Number(currentActRes.rows[0].id_periodo)))) {
            res.status(409).json({ error: "No se puede modificar la actividad porque ya has cerrado esta materia para este periodo" });
            return;
        }
        const { id_competencia } = currentActRes.rows[0];
        const sumRes = await db_1.pool.query(`SELECT COALESCE(SUM(porcentaje), 0) AS total
       FROM actividad_materia
       WHERE id_competencia = $1
         AND id_actividadmateria != $2`, [id_competencia, id]);
        const otherTotal = parseFloat(sumRes.rows[0].total || "0");
        if (otherTotal + parseFloat(porcentaje) > 100) {
            res.status(400).json({
                error: `La suma de porcentajes no puede exceder el 100%. Otros: ${otherTotal}%`,
            });
            return;
        }
        const updated = await db_1.pool.query(`UPDATE actividad_materia
       SET nombre = $1, porcentaje = $2
       WHERE id_actividadmateria = $3
       RETURNING *`, [nombre, porcentaje, id]);
        res.json(updated.rows[0]);
    }
    catch (error) {
        console.error("Error updating activity:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.updateActivity = updateActivity;
// Eliminar actividad
const deleteActivity = async (req, res) => {
    const { id } = req.params;
    try {
        const currentActRes = await db_1.pool.query(`SELECT c.id_periodo
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = $1`, [id]);
        if (currentActRes.rows.length === 0) {
            res.status(404).json({ error: "Actividad no encontrada" });
            return;
        }
        const schoolRes = await db_1.pool.query(`SELECT c.id_colegio
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = $1`, [id]);
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, Number(schoolRes.rows[0].id_colegio), Number(currentActRes.rows[0].id_periodo)))) {
            return;
        }
        const periodOpen = await (0, periodHelpers_1.ensurePeriodOpen)(Number(currentActRes.rows[0].id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se puede eliminar la actividad porque el periodo está cerrado institucionalmente" });
            return;
        }
        const dgRes = await db_1.pool.query(`SELECT id_detallegrado FROM actividad_materia WHERE id_actividadmateria = $1`, [id]);
        if (dgRes.rows.length > 0 && !(await (0, periodHelpers_1.ensureSubjectOpen)(dgRes.rows[0].id_detallegrado, Number(currentActRes.rows[0].id_periodo)))) {
            res.status(409).json({ error: "No se puede eliminar la actividad porque ya has cerrado esta materia para este periodo" });
            return;
        }
        await db_1.pool.query("DELETE FROM actividad_materia WHERE id_actividadmateria = $1", [id]);
        res.json({ message: "Actividad eliminada correctamente" });
    }
    catch (error) {
        console.error("Error deleting activity:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.deleteActivity = deleteActivity;
// Crear nuevo criterio
const createCriterion = async (req, res) => {
    const { id_actividadmateria, id_evidencia, descripcion, porcentaje, id_colegio } = req.body;
    if (!id_actividadmateria || !descripcion || !porcentaje || !id_colegio) {
        res.status(400).json({ error: "Faltan campos requeridos" });
        return;
    }
    try {
        const actRes = await db_1.pool.query(`SELECT a.id_competencia, c.id_periodo
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = $1 AND a.id_colegio = $2`, [id_actividadmateria, id_colegio]);
        if (actRes.rows.length === 0) {
            res.status(404).json({ error: "Actividad no encontrada" });
            return;
        }
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, id_colegio, Number(actRes.rows[0].id_periodo)))) {
            return;
        }
        const periodOpen = await (0, periodHelpers_1.ensurePeriodOpen)(Number(actRes.rows[0].id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se puede modificar la actividad porque el periodo está cerrado institucionalmente" });
            return;
        }
        const dgRes = await db_1.pool.query(`SELECT id_detallegrado FROM actividad_materia WHERE id_actividadmateria = $1`, [id_actividadmateria]);
        if (dgRes.rows.length > 0 && !(await (0, periodHelpers_1.ensureSubjectOpen)(dgRes.rows[0].id_detallegrado, Number(actRes.rows[0].id_periodo)))) {
            res.status(409).json({ error: "No se puede agregar criterios porque ya has cerrado esta materia para este periodo" });
            return;
        }
        const sumRes = await db_1.pool.query(`SELECT COALESCE(SUM(porcentaje), 0) AS total
       FROM criterio_evaluacion
       WHERE id_actividadmateria = $1`, [id_actividadmateria]);
        const currentTotal = parseFloat(sumRes.rows[0].total || "0");
        if (currentTotal + parseFloat(porcentaje) > 100) {
            res.status(400).json({
                error: `La suma de porcentajes de los criterios no puede exceder el 100%. Actual: ${currentTotal}%`,
            });
            return;
        }
        const newCrit = await db_1.pool.query(`INSERT INTO criterio_evaluacion (id_actividadmateria, id_evidencia, descripcion, porcentaje, id_colegio)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [id_actividadmateria, id_evidencia || null, descripcion, porcentaje, id_colegio]);
        res.status(201).json(newCrit.rows[0]);
    }
    catch (error) {
        console.error("Error creating criterion:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.createCriterion = createCriterion;
// Eliminar criterio
const deleteCriterion = async (req, res) => {
    const { id } = req.params;
    try {
        const critRes = await db_1.pool.query(`SELECT c.id_periodo, ce.id_colegio
       FROM criterio_evaluacion ce
       JOIN actividad_materia a ON a.id_actividadmateria = ce.id_actividadmateria
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE ce.id_criterio = $1`, [id]);
        if (critRes.rows.length === 0) {
            res.status(404).json({ error: "Criterio no encontrado" });
            return;
        }
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, Number(critRes.rows[0].id_colegio), Number(critRes.rows[0].id_periodo)))) {
            return;
        }
        const periodOpen = await (0, periodHelpers_1.ensurePeriodOpen)(Number(critRes.rows[0].id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se puede eliminar el criterio porque el periodo está cerrado institucionalmente" });
            return;
        }
        const dgRes = await db_1.pool.query(`SELECT a.id_detallegrado 
       FROM criterion_evaluacion ce 
       JOIN actividad_materia a ON ce.id_actividadmateria = a.id_actividadmateria 
       WHERE ce.id_criterio = $1`, [id]);
        if (dgRes.rows.length > 0 && !(await (0, periodHelpers_1.ensureSubjectOpen)(dgRes.rows[0].id_detallegrado, Number(critRes.rows[0].id_periodo)))) {
            res.status(409).json({ error: "No se puede eliminar el criterio porque ya has cerrado esta materia para este periodo" });
            return;
        }
        await db_1.pool.query("DELETE FROM criterio_evaluacion WHERE id_criterio = $1", [id]);
        res.json({ message: "Criterio eliminado correctamente" });
    }
    catch (error) {
        console.error("Error deleting criterion:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.deleteCriterion = deleteCriterion;
// Obtener todas las notas de un curso/periodo
const getGrades = async (req, res) => {
    const gradeId = Number(req.params.gradeId);
    const subjectId = Number(req.params.subjectId);
    const periodId = Number(req.params.periodId);
    try {
        const context = await resolveTeachingContext(gradeId, subjectId, periodId);
        if (!context) {
            res.status(404).json({ error: "No se encontró la asignación académica" });
            return;
        }
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, context.idColegio, periodId))) {
            return;
        }
        const grades = await db_1.pool.query(`SELECT n.*
       FROM notas_actividad n
       JOIN actividad_materia a ON n.id_actividadmateria = a.id_actividadmateria
       JOIN competencias c ON a.id_competencia = c.id_competencia
       WHERE c.id_grupo = $1
         AND c.id_materia = $2
         AND c.id_periodo = $3`, [gradeId, subjectId, periodId]);
        const criteriaGrades = await db_1.pool.query(`SELECT nc.*, ce.id_actividadmateria
       FROM nota_criterio nc
       JOIN criterio_evaluacion ce ON nc.id_criterio = ce.id_criterio
       JOIN actividad_materia a ON ce.id_actividadmateria = a.id_actividadmateria
       JOIN competencias c ON a.id_competencia = c.id_competencia
       WHERE c.id_grupo = $1
         AND c.id_materia = $2
         AND c.id_periodo = $3`, [gradeId, subjectId, periodId]);
        res.json({
            activityGrades: grades.rows,
            criteriaGrades: criteriaGrades.rows
        });
    }
    catch (error) {
        console.error("Error fetching grades:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getGrades = getGrades;
const saveGrades = async (req, res) => {
    const { activityGrades = [], criteriaGrades = [], schoolId } = req.body;
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        const activityIds = Array.from(new Set((Array.isArray(activityGrades) ? activityGrades : [])
            .map((item) => Number(item.id_actividadmateria))
            .filter((value) => !Number.isNaN(value))));
        const criteriaIds = Array.from(new Set((Array.isArray(criteriaGrades) ? criteriaGrades : [])
            .map((item) => Number(item.id_criterio))
            .filter((value) => !Number.isNaN(value))));
        if (activityIds.length === 0 && criteriaIds.length === 0) {
            await client.query("ROLLBACK");
            res.status(400).json({ error: "No hay notas válidas para guardar" });
            return;
        }
        let periodIds = new Set();
        let colIds = new Set();
        if (activityIds.length > 0) {
            const periodsRes = await client.query(`SELECT DISTINCT c.id_periodo, c.id_colegio
         FROM actividad_materia a
         JOIN competencias c ON c.id_competencia = a.id_competencia
         WHERE a.id_actividadmateria = ANY($1::int[])`, [activityIds]);
            periodsRes.rows.forEach(r => {
                periodIds.add(Number(r.id_periodo));
                colIds.add(Number(r.id_colegio));
            });
        }
        if (criteriaIds.length > 0) {
            const periodsRes = await client.query(`SELECT DISTINCT c.id_periodo, c.id_colegio
         FROM criterio_evaluacion ce
         JOIN actividad_materia a ON a.id_actividadmateria = ce.id_actividadmateria
         JOIN competencias c ON c.id_competencia = a.id_competencia
         WHERE ce.id_criterio = ANY($1::int[])`, [criteriaIds]);
            periodsRes.rows.forEach(r => {
                periodIds.add(Number(r.id_periodo));
                colIds.add(Number(r.id_colegio));
            });
        }
        for (const pId of Array.from(periodIds)) {
            for (const cId of Array.from(colIds)) {
                if (!(await (0, periodHelpers_1.ensureCurrentPeriodForSchool)(cId, pId))) {
                    await client.query("ROLLBACK");
                    res.status(409).json({ error: "Solo se pueden guardar notas en el periodo académico actual" });
                    return;
                }
            }
            const periodOpen = await (0, periodHelpers_1.ensurePeriodOpen)(pId);
            if (!periodOpen) {
                await client.query("ROLLBACK");
                res.status(409).json({ error: "No se pueden guardar notas porque el periodo está cerrado institucionalmente" });
                return;
            }
            // Lock por cierre de docente
            const assignments = await client.query(`SELECT DISTINCT id_detallegrado FROM actividad_materia WHERE id_actividadmateria = ANY($1::int[])
         UNION
         SELECT DISTINCT ce.id_actividadmateria as id_detallegrado 
         FROM criterio_evaluacion ce WHERE ce.id_criterio = ANY($2::int[])`, [activityIds, criteriaIds]);
            for (const assig of assignments.rows) {
                if (!(await (0, periodHelpers_1.ensureSubjectOpen)(assig.id_detallegrado, pId))) {
                    await client.query("ROLLBACK");
                    res.status(409).json({ error: "No se pueden guardar notas porque ya has cerrado la materia para este periodo" });
                    return;
                }
            }
        }
        const escalaRes = await client.query("SELECT id_escalavaloracion, valor_minimo, valor_maximo FROM escala_valoracion WHERE id_colegio = $1", [schoolId]);
        const escalas = escalaRes.rows;
        const settingsRes = await client.query(`SELECT nota_minima, nota_maxima
       FROM configuracion_colegio
       WHERE id_colegio = $1`, [schoolId]);
        const notaMinima = settingsRes.rows.length > 0 ? Number(settingsRes.rows[0].nota_minima) : 0;
        const notaMaxima = settingsRes.rows.length > 0 ? Number(settingsRes.rows[0].nota_maxima) : 5;
        // Guardar activityGrades
        for (const item of activityGrades) {
            const notaNum = Number(parseFloat(item.nota).toFixed(1));
            if (Number.isNaN(notaNum) || notaNum < notaMinima || notaNum > notaMaxima) {
                await client.query("ROLLBACK");
                res.status(400).json({
                    error: `Todas las notas deben estar dentro del rango institucional ${notaMinima.toFixed(1)} - ${notaMaxima.toFixed(1)}`,
                });
                return;
            }
            const escala = escalas.find((entry) => notaNum >= parseFloat(entry.valor_minimo) &&
                notaNum <= parseFloat(entry.valor_maximo));
            const idEscala = escala?.id_escalavaloracion ??
                escalas[escalas.length - 1]?.id_escalavaloracion;
            await client.query(`INSERT INTO notas_actividad (id_actividadmateria, id_estudiante, nota, id_escalavaloracion, id_colegio)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id_actividadmateria, id_estudiante)
         DO UPDATE SET nota = EXCLUDED.nota, id_escalavaloracion = EXCLUDED.id_escalavaloracion`, [item.id_actividadmateria, item.id_estudiante, notaNum, idEscala, schoolId]);
        }
        // Guardar criteriaGrades
        for (const item of criteriaGrades) {
            const notaNum = Number(parseFloat(item.nota).toFixed(1));
            if (Number.isNaN(notaNum) || notaNum < notaMinima || notaNum > notaMaxima) {
                await client.query("ROLLBACK");
                res.status(400).json({
                    error: `Todas las notas deben estar dentro del rango institucional ${notaMinima.toFixed(1)} - ${notaMaxima.toFixed(1)}`,
                });
                return;
            }
            await client.query(`INSERT INTO nota_criterio (id_criterio, id_estudiante, nota, id_colegio)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id_criterio, id_estudiante)
         DO UPDATE SET nota = EXCLUDED.nota`, [item.id_criterio, item.id_estudiante, notaNum, schoolId]);
        }
        await client.query("COMMIT");
        res.json({ message: "Notas guardadas correctamente" });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error saving grades:", error);
        res.status(500).json({ error: "Error al guardar notas" });
    }
    finally {
        client.release();
    }
};
exports.saveGrades = saveGrades;
const getClosureStatus = async (req, res) => {
    const detailGradeId = Number(req.params.detailGradeId);
    const periodId = Number(req.params.periodId);
    try {
        const closedRes = await db_1.pool.query(`SELECT estado, fecha_cierre
       FROM cierre_materia
       WHERE id_detallegrado = $1 AND id_periodo = $2`, [detailGradeId, periodId]);
        const isClosed = closedRes.rows.length > 0 && closedRes.rows[0].estado === 'CERRADO';
        // También verificamos si faltan alumnos por calificar
        const studentsRes = await db_1.pool.query(`SELECT e.id_estudiante, e.nombre, e.apellido
       FROM estudiante e
       JOIN matricula m ON e.id_estudiante = m.id_estudiante
       JOIN detalle_grados dg ON m.id_grupo = dg.id_grupo
       WHERE dg.id_detallegrado = $1 AND m.estado = 'ACTIVA'`, [detailGradeId]);
        const missingGrades = [];
        for (const student of studentsRes.rows) {
            // Un alumno tiene nota si tiene el promedio calculado en resultado_academico 
            // o verificamos si tiene todas las actividades calificadas.
            // Siguiendo la regla de negocio: todas las actividades deben tener nota.
            const gradeCheck = await db_1.pool.query(`SELECT COUNT(*) as count
         FROM actividad_materia am
         JOIN competencias c ON am.id_competencia = c.id_competencia
         JOIN detalle_grados dg ON am.id_detallegrado = dg.id_detallegrado
         WHERE dg.id_detallegrado = $1 AND c.id_periodo = $2
           AND NOT EXISTS (
             SELECT 1 FROM notas_actividad na 
             WHERE na.id_actividadmateria = am.id_actividadmateria 
             AND na.id_estudiante = $3
           )`, [detailGradeId, periodId, student.id_estudiante]);
            if (Number(gradeCheck.rows[0].count) > 0) {
                missingGrades.push({
                    id_estudiante: student.id_estudiante,
                    nombre: `${student.nombre} ${student.apellido}`,
                    missing_count: Number(gradeCheck.rows[0].count)
                });
            }
        }
        // Calcular suma de porcentajes y conteo de actividades
        const statsRes = await db_1.pool.query(`SELECT COALESCE(SUM(am.porcentaje), 0) AS total_percentage, COUNT(am.id_actividadmateria) as activity_count
       FROM actividad_materia am
       JOIN competencias c ON am.id_competencia = c.id_competencia
       WHERE am.id_detallegrado = $1 AND c.id_periodo = $2`, [detailGradeId, periodId]);
        const totalPercentage = Number(statsRes.rows[0].total_percentage);
        const activityCount = Number(statsRes.rows[0].activity_count);
        // Calcular promedio grupal actual
        let groupAverage = null;
        if (activityCount > 0) {
            const avgRes = await db_1.pool.query(`SELECT AVG(promedio_estudiante) as group_avg 
         FROM (
           SELECT SUM(na.nota * (am.porcentaje / 100)) as promedio_estudiante
           FROM notas_actividad na
           JOIN actividad_materia am ON na.id_actividadmateria = am.id_actividadmateria
           JOIN competencias c ON am.id_competencia = c.id_competencia
           WHERE am.id_detallegrado = $1 AND c.id_periodo = $2
           GROUP BY na.id_estudiante
         ) as promedios`, [detailGradeId, periodId]);
            groupAverage = avgRes.rows[0].group_avg ? Number(Number(avgRes.rows[0].group_avg).toFixed(2)) : null;
        }
        res.json({
            isClosed,
            closureData: closedRes.rows[0] || null,
            missingGrades,
            totalPercentage,
            activityCount,
            groupAverage
        });
    }
    catch (error) {
        console.error("Error getting closure status:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getClosureStatus = getClosureStatus;
const closePeriodForTeacher = async (req, res) => {
    const { detailGradeId, periodId, userId } = req.body;
    if (!detailGradeId || !periodId || !userId) {
        res.status(400).json({ error: "Faltan parámetros descriptivos" });
        return;
    }
    const client = await db_1.pool.connect();
    try {
        // 1. Validar que el docente es el dueño de la asignación
        const ownershipRes = await client.query(`SELECT dg.id_detallegrado, dg.id_docente, d.id_usuario, dg.id_colegio
       FROM detalle_grados dg
       JOIN docente d ON dg.id_docente = d.id_docente
       WHERE dg.id_detallegrado = $1 AND d.id_usuario = $2`, [detailGradeId, userId]);
        if (ownershipRes.rows.length === 0) {
            res.status(403).json({ error: "No tienes permiso para cerrar este periodo" });
            return;
        }
        const { id_colegio, id_docente } = ownershipRes.rows[0];
        // 2. Validar que el periodo esté abierto institucionalmente
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodForSchool)(id_colegio, periodId))) {
            res.status(409).json({ error: "El periodo no es el actual o está cerrado institucionalmente" });
            return;
        }
        // 3. Validar que no esté ya cerrado por el docente
        const closedCheck = await client.query(`SELECT estado FROM cierre_materia WHERE id_detallegrado = $1 AND id_periodo = $2`, [detailGradeId, periodId]);
        if (closedCheck.rows.length > 0 && closedCheck.rows[0].estado === 'CERRADO') {
            res.status(409).json({ error: "La materia ya se encuentra cerrada para este periodo" });
            return;
        }
        // 4. Validar suma de porcentajes de actividades = 100%
        const sumRes = await client.query(`SELECT COALESCE(SUM(am.porcentaje), 0) AS total
       FROM actividad_materia am
       JOIN competencias c ON am.id_competencia = c.id_competencia
       WHERE am.id_detallegrado = $1 AND c.id_periodo = $2`, [detailGradeId, periodId]);
        if (Math.round(Number(sumRes.rows[0].total)) !== 100) {
            res.status(400).json({ error: `La suma de los porcentajes de las actividades debe ser 100%. Actual: ${sumRes.rows[0].total}%` });
            return;
        }
        // 5. Validar que todos los estudiantes activos tengan todas las notas
        const studentsRes = await client.query(`SELECT e.id_estudiante
       FROM estudiante e
       JOIN matricula m ON e.id_estudiante = m.id_estudiante
       JOIN detalle_grados dg ON m.id_grupo = dg.id_grupo
       WHERE dg.id_detallegrado = $1 AND m.estado = 'ACTIVA'`, [detailGradeId]);
        for (const student of studentsRes.rows) {
            const gradeCheck = await client.query(`SELECT COUNT(*) as count
         FROM actividad_materia am
         JOIN competencias c ON am.id_competencia = c.id_competencia
         WHERE am.id_detallegrado = $1 AND c.id_periodo = $2
           AND NOT EXISTS (
             SELECT 1 FROM notas_actividad na 
             WHERE na.id_actividadmateria = am.id_actividadmateria 
             AND na.id_estudiante = $3
           )`, [detailGradeId, periodId, student.id_estudiante]);
            if (Number(gradeCheck.rows[0].count) > 0) {
                res.status(400).json({ error: `Existen estudiantes con actividades sin calificar` });
                return;
            }
        }
        await client.query("BEGIN");
        // 6. Marcar como CERRADO — ya validamos que no existe un registro CERRADO
        // Verificamos si hay un registro ABIERTO existente
        const existingRes = await client.query(`SELECT id_cierremateria FROM cierre_materia WHERE id_detallegrado = $1 AND id_periodo = $2`, [detailGradeId, periodId]);
        if (existingRes.rows.length > 0) {
            await client.query(`UPDATE cierre_materia SET estado = 'CERRADO', fecha_cierre = NOW() WHERE id_cierremateria = $1`, [existingRes.rows[0].id_cierremateria]);
        }
        else {
            await client.query(`INSERT INTO cierre_materia (id_detallegrado, id_periodo, estado, fecha_cierre)
         VALUES ($1, $2, 'CERRADO', NOW())`, [detailGradeId, periodId]);
        }
        await client.query("COMMIT");
        res.json({ message: "Periodo cerrado exitosamente para esta materia" });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error closing period:", error);
        res.status(500).json({ error: "Error al cerrar el periodo" });
    }
    finally {
        client.release();
    }
};
exports.closePeriodForTeacher = closePeriodForTeacher;
