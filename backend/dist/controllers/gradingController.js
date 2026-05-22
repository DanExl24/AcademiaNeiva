"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveGrades = exports.getGrades = exports.deleteActivity = exports.updateActivity = exports.createActivity = exports.updateCompetency = exports.getActivities = exports.getPeriods = void 0;
const db_1 = require("../config/db");
const competencyMigration_1 = require("../config/competencyMigration");
const ensurePeriodOpen = async (periodId) => {
    const result = await db_1.pool.query(`SELECT 1
     FROM periodo_academico
     WHERE id_periodo = $1
       AND estado = 'ABIERTO'`, [periodId]);
    return result.rows.length > 0;
};
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
        const result = await db_1.pool.query("SELECT id_periodo, nombre, estado, porcentaje FROM periodo_academico WHERE id_colegio = $1 ORDER BY id_periodo", [schoolId]);
        res.json(result.rows);
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
        const context = await resolveTeachingContext(gradeId, subjectId, periodId, userId);
        if (!context) {
            res.status(404).json({ error: "No se encontró la asignación académica" });
            return;
        }
        const client = await db_1.pool.connect();
        try {
            const competencia = await (0, competencyMigration_1.ensureCompetencyForContext)(client, context, periodId);
            const activities = await client.query(`SELECT *
         FROM actividad_materia
         WHERE id_competencia = $1
         ORDER BY id_actividadmateria ASC`, [competencia.id_competencia]);
            res.json({
                competencia,
                activities: activities.rows,
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
    try {
        const periodRes = await db_1.pool.query(`SELECT id_periodo
       FROM competencias
       WHERE id_competencia = $1`, [id]);
        if (periodRes.rows.length === 0) {
            res.status(404).json({ error: "Competencia no encontrada" });
            return;
        }
        const periodOpen = await ensurePeriodOpen(Number(periodRes.rows[0].id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se puede modificar la competencia porque el periodo está cerrado" });
            return;
        }
        const updated = await db_1.pool.query(`UPDATE competencias
       SET descripcion = $1
       WHERE id_competencia = $2
       RETURNING *`, [descripcion.trim(), id]);
        if (updated.rows.length === 0) {
            res.status(404).json({ error: "Competencia no encontrada" });
            return;
        }
        res.json(updated.rows[0]);
    }
    catch (error) {
        console.error("Error updating competency:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.updateCompetency = updateCompetency;
// Crear nueva actividad
const createActivity = async (req, res) => {
    const { id_competencia, nombre, porcentaje, id_colegio } = req.body;
    if (!id_competencia) {
        res.status(400).json({ error: "La actividad debe estar asociada a una competencia" });
        return;
    }
    try {
        const competencyRes = await db_1.pool.query("SELECT id_competencia, id_periodo FROM competencias WHERE id_competencia = $1", [id_competencia]);
        if (competencyRes.rows.length === 0) {
            res.status(404).json({ error: "Competencia no encontrada" });
            return;
        }
        const periodOpen = await ensurePeriodOpen(Number(competencyRes.rows[0].id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se pueden crear actividades porque el periodo está cerrado" });
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
        const newActivity = await db_1.pool.query(`INSERT INTO actividad_materia (id_competencia, nombre, porcentaje, id_colegio)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [id_competencia, nombre, porcentaje, id_colegio]);
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
        const periodOpen = await ensurePeriodOpen(Number(currentActRes.rows[0].id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se puede modificar la actividad porque el periodo está cerrado" });
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
        const periodOpen = await ensurePeriodOpen(Number(currentActRes.rows[0].id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se puede eliminar la actividad porque el periodo está cerrado" });
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
// Obtener todas las notas de un curso/periodo
const getGrades = async (req, res) => {
    const gradeId = Number(req.params.gradeId);
    const subjectId = Number(req.params.subjectId);
    const periodId = Number(req.params.periodId);
    try {
        const grades = await db_1.pool.query(`SELECT n.*
       FROM notas_actividad n
       JOIN actividad_materia a ON n.id_actividadmateria = a.id_actividadmateria
       JOIN competencias c ON a.id_competencia = c.id_competencia
       WHERE c.id_grupo = $1
         AND c.id_materia = $2
         AND c.id_periodo = $3`, [gradeId, subjectId, periodId]);
        res.json(grades.rows);
    }
    catch (error) {
        console.error("Error fetching grades:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getGrades = getGrades;
// Guardar notas en lote (Upsert)
const saveGrades = async (req, res) => {
    const { grades, schoolId } = req.body;
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        const activityIds = Array.from(new Set((Array.isArray(grades) ? grades : [])
            .map((item) => Number(item.id_actividadmateria))
            .filter((value) => !Number.isNaN(value))));
        if (activityIds.length === 0) {
            await client.query("ROLLBACK");
            res.status(400).json({ error: "No hay actividades válidas para guardar notas" });
            return;
        }
        const periodsRes = await client.query(`SELECT DISTINCT c.id_periodo
       FROM actividad_materia a
       JOIN competencias c ON c.id_competencia = a.id_competencia
       WHERE a.id_actividadmateria = ANY($1::int[])`, [activityIds]);
        for (const row of periodsRes.rows) {
            const periodOpen = await ensurePeriodOpen(Number(row.id_periodo));
            if (!periodOpen) {
                await client.query("ROLLBACK");
                res.status(409).json({ error: "No se pueden guardar notas porque el periodo está cerrado" });
                return;
            }
        }
        const escalaRes = await client.query("SELECT id_escalavaloracion, valor_minimo, valor_maximo FROM escala_valoracion WHERE id_colegio = $1", [schoolId]);
        const escalas = escalaRes.rows;
        const settingsRes = await client.query(`SELECT nota_minima, nota_maxima
       FROM configuracion_colegio
       WHERE id_colegio = $1`, [schoolId]);
        const notaMinima = settingsRes.rows.length > 0 ? Number(settingsRes.rows[0].nota_minima) : 0;
        const notaMaxima = settingsRes.rows.length > 0 ? Number(settingsRes.rows[0].nota_maxima) : 5;
        for (const item of grades) {
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
