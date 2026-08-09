"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCourseEvidenciasDba = exports.getCompetenciaEvidenciasDba = exports.closePeriodForTeacher = exports.getClosureStatus = exports.saveGrades = exports.getGrades = exports.deleteCriterion = exports.createCriterion = exports.deleteActivity = exports.updateActivity = exports.createActivity = exports.updateCompetency = exports.getActivities = exports.getPeriods = void 0;
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
       p.id_anio AS "idAnio"
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
    const targetYearId = req.query.yearId ? Number(req.query.yearId) : undefined;
    const authReq = req;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== Number(schoolId)) {
        res.status(403).json({ error: "No tiene permiso para ver los periodos de este colegio." });
        return;
    }
    try {
        const periods = await (0, periodHelpers_1.getAllPeriodsForSchool)(Number(schoolId), targetYearId);
        console.log(`[DEV] getPeriods - result count: ${periods.length}`);
        res.json(periods);
    }
    catch (error) {
        console.error(`[DEV] getPeriods ERROR - schoolId=${schoolId}:`, error.message, error.detail || '');
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
    console.log(`[DEV] getActivities called - gradeId=${gradeId}, subjectId=${subjectId}, periodId=${periodId}, userId=${userId}`);
    try {
        const contextPreview = await resolveTeachingContext(gradeId, subjectId, periodId, userId);
        console.log(`[DEV] getActivities - resolveTeachingContext result: ${contextPreview ? JSON.stringify(contextPreview) : 'null (not found)'}`);
        if (!contextPreview) {
            res.status(404).json({ error: "No se encontró la asignación académica" });
            return;
        }
        // Permite lectura de periodos cerrados (solo se protegen escrituras)
        const context = contextPreview;
        const client = await db_1.pool.connect();
        try {
            const competenciaBase = await (0, competencyMigration_1.ensureCompetencyForContext)(client, context, periodId);
            // Obtener todas las competencias del periodo/materia con sus evidencias anidadas y el número de DBA
            const compsRes = await client.query(`SELECT c.*,
                COALESCE(
                  (SELECT json_agg(
                     json_build_object(
                       'id_evidencia', ea.id_evidencia,
                       'id_evidencia_dba', ea.id_evidencia_dba,
                       'descripcion', ea.descripcion,
                       'orden', ea.orden,
                       'numero_dba', d.numero_dba
                     ) ORDER BY ea.orden, ea.id_evidencia
                   )
                   FROM evidencia_aprendizaje ea
                   LEFT JOIN evidencias_dba edba ON edba.id_evidencia_dba = ea.id_evidencia_dba
                   LEFT JOIN dba d ON d.id_dba = edba.id_dba
                   WHERE ea.id_competencia = c.id_competencia
                  ), '[]'::json
                ) AS evidencias
         FROM public.competencias c
         WHERE c.id_anio = $1 AND c.id_grupo = $2 AND c.id_materia = $3 AND c.id_periodo = $4 AND c.id_colegio = $5
         ORDER BY c.id_competencia ASC`, [context.idAnio, context.idGrupo, context.idMateria, periodId, context.idColegio]);
            const allComps = compsRes.rows;
            // Filtrar competencias que tengan descripciones válidas (no vacías)
            const validComps = allComps.filter(c => c.descripcion && c.descripcion.trim());
            // Unificar descripciones de las competencias
            let competencia = competenciaBase;
            if (competenciaBase && validComps.length > 1) {
                const descripcionUnificada = validComps
                    .map((c, idx) => `${idx + 1}. ${c.descripcion.trim()}`)
                    .join("\n\n");
                competencia = {
                    ...competenciaBase,
                    descripcion: descripcionUnificada
                };
            }
            const activities = await client.query(`SELECT am.*,
                COALESCE(
                  (SELECT json_agg(aedba.id_evidencia_dba)
                   FROM actividad_evidencia_dba aedba
                   WHERE aedba.id_actividadmateria = am.id_actividadmateria
                  ), '[]'::json
                ) AS evidencias_dba
         FROM actividad_materia am
         WHERE am.id_detallegrado = $1 AND am.id_periodo = $2
         ORDER BY am.id_actividadmateria ASC`, [context.idDetalleGrado, periodId]);
            // Traer las evidencias de aprendizaje de todas las competencias de este periodo
            const evidencias = await client.query(`SELECT ea.id_evidencia, ea.descripcion, ea.orden
         FROM evidencia_aprendizaje ea
         JOIN competencias c ON c.id_competencia = ea.id_competencia
         WHERE c.id_anio = $1 AND c.id_grupo = $2 AND c.id_materia = $3 AND c.id_periodo = $4 AND c.id_colegio = $5
         ORDER BY c.id_competencia ASC, ea.orden ASC, ea.id_evidencia ASC`, [context.idAnio, context.idGrupo, context.idMateria, periodId, context.idColegio]);
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
                competenciasList: validComps
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
        const periodRes = await client.query(`SELECT c.id_periodo, c.id_materia, c.id_grupo, c.id_anio, c.id_colegio
       FROM competencias
       WHERE id_competencia = $1`, [id]);
        if (periodRes.rows.length === 0) {
            res.status(404).json({ error: "Competencia no encontrada" });
            return;
        }
        const periodStatusRes = await client.query(`SELECT estado FROM periodo_academico WHERE id_periodo = $1`, [Number(periodRes.rows[0].id_periodo)]);
        if (periodStatusRes.rows.length > 0 && periodStatusRes.rows[0].estado === "CERRADO") {
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
            idAnio: Number(periodRes.rows[0].id_anio),
        };
        await client.query("BEGIN");
        const updated = await (0, competencyMigration_1.syncCompetencyAcrossGrade)(client, context, Number(periodRes.rows[0].id_periodo), descripcion.trim(), Number(id));
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
    const { id_competencia, id_detallegrado, id_periodo, nombre, porcentaje, id_colegio, id_evidencia, evidencias_dba, motivo_extra, justificacion_extra } = req.body;
    if (!id_evidencia && (!Array.isArray(evidencias_dba) || evidencias_dba.length === 0)) {
        res.status(400).json({ error: "La actividad debe estar asociada a una evidencia de aprendizaje" });
        return;
    }
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        let finalIdPeriodo = id_periodo ? Number(id_periodo) : null;
        let finalIdDetalleGrado = id_detallegrado ? Number(id_detallegrado) : null;
        let finalIdColegio = id_colegio ? Number(id_colegio) : null;
        const finalIdCompetencia = id_competencia ? Number(id_competencia) : null;
        if (finalIdCompetencia) {
            const competencyRes = await client.query("SELECT id_competencia, id_periodo, id_grupo, id_materia, id_colegio FROM competencias WHERE id_competencia = $1", [finalIdCompetencia]);
            if (competencyRes.rows.length === 0) {
                await client.query("ROLLBACK");
                res.status(404).json({ error: "Competencia no encontrada" });
                return;
            }
            const comp = competencyRes.rows[0];
            if (!finalIdPeriodo)
                finalIdPeriodo = Number(comp.id_periodo);
            if (!finalIdColegio)
                finalIdColegio = Number(comp.id_colegio);
            // Solo resolver id_detallegrado desde el contexto de la competencia si no venía especificado
            if (!finalIdDetalleGrado) {
                const dgRes = await client.query(`SELECT id_detallegrado FROM detalle_grados
           WHERE id_grupo = $1 AND id_materia = $2 AND id_colegio = $3
           LIMIT 1`, [comp.id_grupo, comp.id_materia, comp.id_colegio]);
                finalIdDetalleGrado = dgRes.rows.length > 0 ? dgRes.rows[0].id_detallegrado : null;
            }
        }
        if (!finalIdPeriodo || !finalIdDetalleGrado || !finalIdColegio) {
            await client.query("ROLLBACK");
            res.status(400).json({ error: "Faltan datos de asignación académica (periodo, grado/materia)" });
            return;
        }
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, finalIdColegio, finalIdPeriodo))) {
            await client.query("ROLLBACK");
            return;
        }
        const periodOpen = await (0, periodHelpers_1.ensurePeriodOpen)(finalIdPeriodo);
        if (!periodOpen) {
            await client.query("ROLLBACK");
            res.status(409).json({ error: "No se pueden crear actividades porque el periodo está cerrado" });
            return;
        }
        if (finalIdDetalleGrado && !(await (0, periodHelpers_1.ensureSubjectOpen)(finalIdDetalleGrado, finalIdPeriodo))) {
            await client.query("ROLLBACK");
            res.status(409).json({ error: "No se pueden crear actividades porque ya has cerrado esta materia para este periodo" });
            return;
        }
        const sumRes = await client.query(`SELECT COALESCE(SUM(porcentaje), 0) AS total
       FROM actividad_materia
       WHERE id_detallegrado = $1 AND id_periodo = $2`, [finalIdDetalleGrado, finalIdPeriodo]);
        const currentTotal = parseFloat(sumRes.rows[0].total || "0");
        if (currentTotal + parseFloat(porcentaje) > 100) {
            await client.query("ROLLBACK");
            res.status(400).json({
                error: `La suma de porcentajes no puede exceder el 100%. Actual: ${currentTotal}%`,
            });
            return;
        }
        // Validar si la evidencia es de otro periodo y requiere justificación
        if (Array.isArray(evidencias_dba) && evidencias_dba.length > 0) {
            const dgInfo = await client.query(`SELECT id_grupo, id_materia FROM detalle_grados WHERE id_detallegrado = $1`, [finalIdDetalleGrado]);
            if (dgInfo.rows.length > 0) {
                const { id_grupo, id_materia } = dgInfo.rows[0];
                // 1. Obtener evidencias planificadas en el periodo ACTUAL para este grado/materia
                const currentPeriodAssigned = await client.query(`SELECT DISTINCT ea.id_evidencia_dba
           FROM evidencia_aprendizaje ea
           JOIN competencias c ON c.id_competencia = ea.id_competencia
           WHERE c.id_colegio = $1
             AND c.id_materia = $2
             AND c.id_grupo IN (
               SELECT g2.id_grupo
               FROM grupos g1
               JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
               WHERE g1.id_grupo = $3 AND g1.id_colegio = $1
             )
             AND c.id_periodo = $4
             AND ea.id_evidencia_dba = ANY($5::int[])`, [finalIdColegio, id_materia, id_grupo, finalIdPeriodo, evidencias_dba]);
                const plannedInCurrentIds = new Set(currentPeriodAssigned.rows.map((r) => Number(r.id_evidencia_dba)));
                const unassignedInCurrent = evidencias_dba.filter((id) => !plannedInCurrentIds.has(Number(id)));
                // 2. Solo si hay evidencias NO planificadas en el periodo actual, verificar si fueron planificadas en OTRO periodo
                if (unassignedInCurrent.length > 0) {
                    const otherPeriodAssigned = await client.query(`SELECT DISTINCT ea.id_evidencia_dba, p.nombre as periodo_nombre
             FROM evidencia_aprendizaje ea
             JOIN competencias c ON c.id_competencia = ea.id_competencia
             JOIN periodo_academico p ON p.id_periodo = c.id_periodo
             WHERE c.id_colegio = $1
               AND c.id_materia = $2
               AND c.id_grupo IN (
                 SELECT g2.id_grupo
                 FROM grupos g1
                 JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
                 WHERE g1.id_grupo = $3 AND g1.id_colegio = $1
               )
               AND c.id_periodo != $4
               AND ea.id_evidencia_dba = ANY($5::int[])`, [finalIdColegio, id_materia, id_grupo, finalIdPeriodo, unassignedInCurrent]);
                    if (otherPeriodAssigned.rows.length > 0) {
                        if (!motivo_extra || typeof motivo_extra !== "string" || !motivo_extra.trim()) {
                            await client.query("ROLLBACK");
                            res.status(400).json({ error: "Debes seleccionar un motivo para evaluar evidencias planificadas en otros periodos." });
                            return;
                        }
                        if (motivo_extra === "OTRO" && (!justificacion_extra || typeof justificacion_extra !== "string" || !justificacion_extra.trim())) {
                            await client.query("ROLLBACK");
                            res.status(400).json({ error: "Debes escribir una justificación detallada para el motivo 'Otro'." });
                            return;
                        }
                    }
                }
            }
        }
        // Resolver id_evidencia para compatibilidad con código antiguo
        let finalIdEvidencia = id_evidencia ? Number(id_evidencia) : null;
        if (!finalIdEvidencia && Array.isArray(evidencias_dba) && evidencias_dba.length > 0 && finalIdCompetencia) {
            const localEvRes = await client.query(`SELECT id_evidencia FROM evidencia_aprendizaje 
         WHERE id_competencia = $1 AND id_evidencia_dba = $2 
         LIMIT 1`, [finalIdCompetencia, evidencias_dba[0]]);
            if (localEvRes.rows.length > 0) {
                finalIdEvidencia = localEvRes.rows[0].id_evidencia;
            }
        }
        const dgTeacherRes = await client.query(`SELECT id_docente FROM detalle_grados WHERE id_detallegrado = $1`, [finalIdDetalleGrado]);
        const creatorTeacherId = dgTeacherRes.rows[0]?.id_docente || null;
        const newActivityRes = await client.query(`INSERT INTO actividad_materia (id_competencia, id_evidencia, id_detallegrado, id_periodo, nombre, porcentaje, id_colegio, motivo_extra, justificacion_extra, id_docente_creador)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`, [
            finalIdCompetencia,
            finalIdEvidencia,
            finalIdDetalleGrado,
            finalIdPeriodo,
            nombre,
            porcentaje,
            finalIdColegio,
            motivo_extra || null,
            justificacion_extra || null,
            creatorTeacherId,
        ]);
        const newActivity = newActivityRes.rows[0];
        // Vincular evidencias del DBA si vienen especificadas
        if (Array.isArray(evidencias_dba) && evidencias_dba.length > 0) {
            for (const dbaEvId of evidencias_dba) {
                await client.query(`INSERT INTO actividad_evidencia_dba (id_actividadmateria, id_evidencia_dba)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`, [newActivity.id_actividadmateria, dbaEvId]);
            }
        }
        await client.query("COMMIT");
        newActivity.evidencias_dba = evidencias_dba || [];
        res.status(201).json(newActivity);
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error creating activity:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
    finally {
        client.release();
    }
};
exports.createActivity = createActivity;
// Actualizar actividad
const updateActivity = async (req, res) => {
    const { id } = req.params;
    const { nombre, porcentaje, id_evidencia, evidencias_dba, motivo_extra, justificacion_extra } = req.body;
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        const currentActRes = await client.query(`SELECT id_competencia, id_evidencia, id_periodo, id_detallegrado, id_colegio
       FROM actividad_materia
       WHERE id_actividadmateria = $1`, [id]);
        if (currentActRes.rows.length === 0) {
            await client.query("ROLLBACK");
            res.status(404).json({ error: "Actividad no encontrada" });
            return;
        }
        const currentAct = currentActRes.rows[0];
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, Number(currentAct.id_colegio), Number(currentAct.id_periodo)))) {
            await client.query("ROLLBACK");
            return;
        }
        const periodOpen = await client.query(`SELECT estado FROM periodo_academico WHERE id_periodo = $1`, [currentAct.id_periodo]);
        if (periodOpen.rows.length > 0 && periodOpen.rows[0].estado === 'CERRADO') {
            await client.query("ROLLBACK");
            res.status(409).json({ error: "No se puede modificar la actividad porque el periodo está cerrado institucionalmente" });
            return;
        }
        if (currentAct.id_detallegrado && !(await (0, periodHelpers_1.ensureSubjectOpen)(currentAct.id_detallegrado, Number(currentAct.id_periodo)))) {
            await client.query("ROLLBACK");
            res.status(409).json({ error: "No se puede modificar la actividad porque ya has cerrado esta materia para este periodo" });
            return;
        }
        const sumRes = await client.query(`SELECT COALESCE(SUM(porcentaje), 0) AS total
       FROM actividad_materia
       WHERE id_detallegrado = $1 AND id_periodo = $2
         AND id_actividadmateria != $3`, [currentAct.id_detallegrado, currentAct.id_periodo, id]);
        const otherTotal = parseFloat(sumRes.rows[0].total || "0");
        if (otherTotal + parseFloat(porcentaje) > 100) {
            await client.query("ROLLBACK");
            res.status(400).json({
                error: `La suma de porcentajes no puede exceder el 100%. Otros: ${otherTotal}%`,
            });
            return;
        }
        // Validar si la evidencia es de otro periodo y requiere justificación
        if (Array.isArray(evidencias_dba) && evidencias_dba.length > 0) {
            const dgInfo = await client.query(`SELECT id_grupo, id_materia FROM detalle_grados WHERE id_detallegrado = $1`, [currentAct.id_detallegrado]);
            if (dgInfo.rows.length > 0) {
                const { id_grupo, id_materia } = dgInfo.rows[0];
                // 1. Obtener evidencias planificadas en el periodo ACTUAL para este grado/materia
                const currentPeriodAssigned = await client.query(`SELECT DISTINCT ea.id_evidencia_dba
           FROM evidencia_aprendizaje ea
           JOIN competencias c ON c.id_competencia = ea.id_competencia
           WHERE c.id_colegio = $1
             AND c.id_materia = $2
             AND c.id_grupo IN (
               SELECT g2.id_grupo
               FROM grupos g1
               JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
               WHERE g1.id_grupo = $3 AND g1.id_colegio = $1
             )
             AND c.id_periodo = $4
             AND ea.id_evidencia_dba = ANY($5::int[])`, [currentAct.id_colegio, id_materia, id_grupo, currentAct.id_periodo, evidencias_dba]);
                const plannedInCurrentIds = new Set(currentPeriodAssigned.rows.map((r) => Number(r.id_evidencia_dba)));
                const unassignedInCurrent = evidencias_dba.filter((id) => !plannedInCurrentIds.has(Number(id)));
                // 2. Solo si hay evidencias NO planificadas en el periodo actual, verificar si fueron planificadas en OTRO periodo
                if (unassignedInCurrent.length > 0) {
                    const otherPeriodAssigned = await client.query(`SELECT DISTINCT ea.id_evidencia_dba, p.nombre as periodo_nombre
             FROM evidencia_aprendizaje ea
             JOIN competencias c ON c.id_competencia = ea.id_competencia
             JOIN periodo_academico p ON p.id_periodo = c.id_periodo
             WHERE c.id_colegio = $1
               AND c.id_materia = $2
               AND c.id_grupo IN (
                 SELECT g2.id_grupo
                 FROM grupos g1
                 JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
                 WHERE g1.id_grupo = $3 AND g1.id_colegio = $1
               )
               AND c.id_periodo != $4
               AND ea.id_evidencia_dba = ANY($5::int[])`, [currentAct.id_colegio, id_materia, id_grupo, currentAct.id_periodo, unassignedInCurrent]);
                    if (otherPeriodAssigned.rows.length > 0) {
                        if (!motivo_extra || typeof motivo_extra !== "string" || !motivo_extra.trim()) {
                            await client.query("ROLLBACK");
                            res.status(400).json({ error: "Debes seleccionar un motivo para evaluar evidencias planificadas en otros periodos." });
                            return;
                        }
                        if (motivo_extra === "OTRO" && (!justificacion_extra || typeof justificacion_extra !== "string" || !justificacion_extra.trim())) {
                            await client.query("ROLLBACK");
                            res.status(400).json({ error: "Debes escribir una justificación detallada para el motivo 'Otro'." });
                            return;
                        }
                    }
                }
            }
        }
        // Resolver id_evidencia para compatibilidad con código antiguo
        let finalIdEvidencia = id_evidencia ? Number(id_evidencia) : currentAct.id_evidencia;
        if (Array.isArray(evidencias_dba) && evidencias_dba.length > 0 && currentAct.id_competencia) {
            const localEvRes = await client.query(`SELECT id_evidencia FROM evidencia_aprendizaje 
         WHERE id_competencia = $1 AND id_evidencia_dba = $2 
         LIMIT 1`, [currentAct.id_competencia, evidencias_dba[0]]);
            if (localEvRes.rows.length > 0) {
                finalIdEvidencia = localEvRes.rows[0].id_evidencia;
            }
            else {
                finalIdEvidencia = null;
            }
        }
        else if (Array.isArray(evidencias_dba) && evidencias_dba.length > 0 && !currentAct.id_competencia) {
            finalIdEvidencia = null;
        }
        const updatedRes = await client.query(`UPDATE actividad_materia
       SET nombre = $1, porcentaje = $2, id_evidencia = $3, motivo_extra = $4, justificacion_extra = $5
       WHERE id_actividadmateria = $6
       RETURNING *`, [nombre, porcentaje, finalIdEvidencia, motivo_extra || null, justificacion_extra || null, id]);
        const updatedActivity = updatedRes.rows[0];
        // Sincronizar evidencias del DBA si vienen en la petición
        if (Array.isArray(evidencias_dba)) {
            await client.query(`DELETE FROM actividad_evidencia_dba WHERE id_actividadmateria = $1`, [id]);
            for (const dbaEvId of evidencias_dba) {
                await client.query(`INSERT INTO actividad_evidencia_dba (id_actividadmateria, id_evidencia_dba)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`, [id, dbaEvId]);
            }
        }
        await client.query("COMMIT");
        const finalDbaEvsRes = await client.query(`SELECT id_evidencia_dba FROM actividad_evidencia_dba WHERE id_actividadmateria = $1`, [id]);
        updatedActivity.evidencias_dba = finalDbaEvsRes.rows.map(r => r.id_evidencia_dba);
        res.json(updatedActivity);
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error updating activity:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
    finally {
        client.release();
    }
};
exports.updateActivity = updateActivity;
// Eliminar actividad
const deleteActivity = async (req, res) => {
    const { id } = req.params;
    try {
        const currentActRes = await db_1.pool.query(`SELECT id_periodo, id_colegio, id_detallegrado
       FROM actividad_materia
       WHERE id_actividadmateria = $1`, [id]);
        if (currentActRes.rows.length === 0) {
            res.status(404).json({ error: "Actividad no encontrada" });
            return;
        }
        const currentAct = currentActRes.rows[0];
        if (!(await (0, periodHelpers_1.ensureCurrentPeriodOrRespond)(res, Number(currentAct.id_colegio), Number(currentAct.id_periodo)))) {
            return;
        }
        const periodOpen = await (0, periodHelpers_1.ensurePeriodOpen)(Number(currentAct.id_periodo));
        if (!periodOpen) {
            res.status(409).json({ error: "No se puede eliminar la actividad porque el periodo está cerrado institucionalmente" });
            return;
        }
        if (currentAct.id_detallegrado && !(await (0, periodHelpers_1.ensureSubjectOpen)(currentAct.id_detallegrado, Number(currentAct.id_periodo)))) {
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
        const authReq = req;
        const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
        if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== context.idColegio) {
            res.status(403).json({ error: "No tiene permiso para acceder a las calificaciones de este colegio." });
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
        // 5.1 Verificar si hay evidencias DBA planeadas para este periodo/materia que no fueron evaluadas en ninguna actividad
        const dgInfo = await client.query(`SELECT id_grupo, id_materia FROM detalle_grados WHERE id_detallegrado = $1`, [detailGradeId]);
        let unevaluatedEvidences = [];
        if (dgInfo.rows.length > 0) {
            const { id_grupo, id_materia } = dgInfo.rows[0];
            const pendingEvRes = await client.query(`SELECT DISTINCT edba.id_evidencia_dba, d.numero_dba, edba.descripcion
         FROM evidencia_aprendizaje ea
         JOIN competencias c ON c.id_competencia = ea.id_competencia
         JOIN evidencias_dba edba ON edba.id_evidencia_dba = ea.id_evidencia_dba
         JOIN dba d ON d.id_dba = edba.id_dba
         WHERE c.id_colegio = $1
           AND c.id_materia = $2
           AND c.id_grupo IN (
             SELECT g2.id_grupo
             FROM grupos g1
             JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
             WHERE g1.id_grupo = $3 AND g1.id_colegio = $1
           )
           AND c.id_periodo = $4
           AND NOT EXISTS (
             SELECT 1
             FROM actividad_evidencia_dba aedba
             JOIN actividad_materia am ON am.id_actividadmateria = aedba.id_actividadmateria
             WHERE aedba.id_evidencia_dba = edba.id_evidencia_dba
               AND am.id_detallegrado = $5
               AND am.id_periodo = $4
           )`, [id_colegio, id_materia, id_grupo, periodId, detailGradeId]);
            unevaluatedEvidences = pendingEvRes.rows;
        }
        const { justificacion_evidencias_pendientes } = req.body;
        if (unevaluatedEvidences.length > 0 && (!justificacion_evidencias_pendientes || typeof justificacion_evidencias_pendientes !== 'string' || !justificacion_evidencias_pendientes.trim())) {
            res.status(422).json({
                requires_justification: true,
                unevaluated_evidences: unevaluatedEvidences,
                error: `Existen ${unevaluatedEvidences.length} evidencia(s) DBA planeadas para este periodo que aún no han sido evaluadas en ninguna actividad.`
            });
            return;
        }
        await client.query("BEGIN");
        // 6. Marcar como CERRADO guardando la justificación si existían evidencias pendientes
        const existingRes = await client.query(`SELECT id_cierremateria FROM cierre_materia WHERE id_detallegrado = $1 AND id_periodo = $2`, [detailGradeId, periodId]);
        if (existingRes.rows.length > 0) {
            await client.query(`UPDATE cierre_materia 
         SET estado = 'CERRADO', fecha_cierre = NOW(), justificacion_evidencias_pendientes = $2 
         WHERE id_cierremateria = $1`, [existingRes.rows[0].id_cierremateria, justificacion_evidencias_pendientes || null]);
        }
        else {
            await client.query(`INSERT INTO cierre_materia (id_detallegrado, id_periodo, estado, fecha_cierre, justificacion_evidencias_pendientes)
         VALUES ($1, $2, 'CERRADO', NOW(), $3)`, [detailGradeId, periodId, justificacion_evidencias_pendientes || null]);
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
// ============================================================================
// ─── Evidencias DBA para el Docente (Fase 2) ────────────────────────────────
// ============================================================================
const getCompetenciaEvidenciasDba = async (req, res) => {
    const competencyId = Number(req.params.competencyId);
    if (!competencyId) {
        res.status(400).json({ error: "ID de competencia es obligatorio" });
        return;
    }
    try {
        // 1. Obtener la competencia
        const compRes = await db_1.pool.query(`SELECT id_competencia, id_grupo, id_materia, id_colegio FROM competencias WHERE id_competencia = $1`, [competencyId]);
        if (compRes.rows.length === 0) {
            res.status(404).json({ error: "Competencia no encontrada" });
            return;
        }
        const comp = compRes.rows[0];
        // 2. Obtener versión curricular asignada al colegio para esta materia y grado
        const cvcRes = await db_1.pool.query(`SELECT cvc.version_curricular
       FROM colegio_version_curricular cvc
       WHERE cvc.id_colegio = $1
         AND cvc.area = (SELECT nombre FROM materias WHERE id_materia = $2)
         AND cvc.grado = (
           SELECT tg.nombre 
           FROM grupos g 
           JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado 
           WHERE g.id_grupo = $3
         )`, [comp.id_colegio, comp.id_materia, comp.id_grupo]);
        if (cvcRes.rows.length === 0) {
            // Si el colegio no tiene asignación de versión para esta materia/grado, no maneja DBA
            res.json({ usaDba: false, planeadas: [], extras: [] });
            return;
        }
        const versionCurricular = cvcRes.rows[0].version_curricular;
        // 3. Obtener las evidencias planeadas (vinculadas a la competencia)
        const planeadasRes = await db_1.pool.query(`SELECT ea.id_evidencia, ea.id_evidencia_dba, ea.descripcion, ea.orden, d.numero_dba
       FROM evidencia_aprendizaje ea
       JOIN evidencias_dba edba ON edba.id_evidencia_dba = ea.id_evidencia_dba
       JOIN dba d ON d.id_dba = edba.id_dba
       WHERE ea.id_competencia = $1 AND ea.id_evidencia_dba IS NOT NULL
       ORDER BY ea.orden, ea.id_evidencia`, [competencyId]);
        const planeadasIds = planeadasRes.rows.map(r => r.id_evidencia_dba);
        // 4. Obtener todas las evidencias activas del DBA de este grado/área
        const dbaEvsRes = await db_1.pool.query(`SELECT e.id_evidencia_dba, e.descripcion, e.orden, d.numero_dba
       FROM evidencias_dba e
       JOIN dba d ON d.id_dba = e.id_dba
       WHERE d.area = (SELECT nombre FROM materias WHERE id_materia = $1)
         AND d.grado = (
           SELECT tg.nombre 
           FROM grupos g 
           JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado 
           WHERE g.id_grupo = $2
         )
         AND d.version_curricular = $3
         AND d.estado = 'ACTIVO' AND e.estado = 'ACTIVO'
       ORDER BY d.numero_dba, e.orden`, [comp.id_materia, comp.id_grupo, versionCurricular]);
        // Separar en planeadas y extras
        const planeadas = planeadasRes.rows;
        const extras = dbaEvsRes.rows.filter(r => !planeadasIds.includes(r.id_evidencia_dba));
        res.json({
            usaDba: true,
            versionCurricular,
            planeadas,
            extras
        });
    }
    catch (error) {
        console.error("Error al obtener evidencias DBA de la competencia:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getCompetenciaEvidenciasDba = getCompetenciaEvidenciasDba;
const getCourseEvidenciasDba = async (req, res) => {
    const gradeId = Number(req.params.gradeId);
    const subjectId = Number(req.params.subjectId);
    const schoolId = Number(req.query.schoolId);
    const periodId = req.query.periodId ? Number(req.query.periodId) : null;
    if (!gradeId || !subjectId || !schoolId) {
        res.status(400).json({ error: "Faltan parámetros obligatorios" });
        return;
    }
    try {
        // 1. Obtener versión curricular asignada al colegio para esta materia y grado
        const cvcRes = await db_1.pool.query(`SELECT cvc.version_curricular
       FROM colegio_version_curricular cvc
       WHERE cvc.id_colegio = $1
         AND cvc.area = (SELECT nombre FROM materias WHERE id_materia = $2)
         AND cvc.grado = (
           SELECT tg.nombre 
           FROM grupos g 
           JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado 
           WHERE g.id_grupo = $3
         )`, [schoolId, subjectId, gradeId]);
        if (cvcRes.rows.length === 0) {
            res.json({ usaDba: false, dba: [] });
            return;
        }
        const versionCurricular = cvcRes.rows[0].version_curricular;
        // 2. Obtener las evidencias planeadas (vinculadas a la competencia del periodo actual)
        const planeadasParams = [gradeId, subjectId, schoolId];
        let planeadasFilter = "";
        if (periodId) {
            planeadasParams.push(periodId);
            planeadasFilter = ` AND c.id_periodo = $${planeadasParams.length}`;
        }
        const planeadasRes = await db_1.pool.query(`SELECT ea.id_evidencia, ea.id_evidencia_dba, ea.descripcion, ea.orden, d.numero_dba, d.id_dba, d.enunciado AS dba_enunciado, ea.id_competencia
       FROM evidencia_aprendizaje ea
       JOIN competencias c ON c.id_competencia = ea.id_competencia
       JOIN evidencias_dba edba ON edba.id_evidencia_dba = ea.id_evidencia_dba
       JOIN dba d ON d.id_dba = edba.id_dba
       WHERE c.id_grupo IN (
         SELECT g2.id_grupo
         FROM grupos g1
         JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
         WHERE g1.id_grupo = $1 AND g1.id_colegio = $3
       ) AND c.id_materia = $2 AND c.id_colegio = $3 AND ea.id_evidencia_dba IS NOT NULL${planeadasFilter}
       ORDER BY d.numero_dba, ea.orden, ea.id_evidencia`, planeadasParams);
        const planeadasIds = planeadasRes.rows.map(r => r.id_evidencia_dba);
        // 3. Obtener evidencias ya evaluadas en periodos CERRADOS (para excluirlas de extras)
        // RN-DBA-022: Una evidencia evaluada en un periodo cerrado no debe reaparecer
        // Excepción: si fue re-planeada explícitamente en el periodo actual (ya está en planeadasIds)
        let evaluadasEnCerradosIds = [];
        if (periodId) {
            const evaluadasRes = await db_1.pool.query(`SELECT DISTINCT aedba.id_evidencia_dba
         FROM actividad_evidencia_dba aedba
         JOIN actividad_materia am ON am.id_actividadmateria = aedba.id_actividadmateria
         JOIN periodo_academico p ON p.id_periodo = am.id_periodo
         WHERE p.estado = 'CERRADO'
           AND am.id_colegio = $1
           AND am.id_periodo != $2
           AND am.id_detallegrado IN (
             SELECT id_detallegrado FROM detalle_grados 
             WHERE id_grupo = $3 AND id_materia = $4 AND id_colegio = $1
           )`, [schoolId, periodId, gradeId, subjectId]);
            evaluadasEnCerradosIds = evaluadasRes.rows.map(r => r.id_evidencia_dba);
        }
        // 4. Obtener todos los DBA con evidencias del catálogo para este grado/materia
        const dbaEvsRes = await db_1.pool.query(`SELECT d.id_dba, d.numero_dba, d.enunciado AS dba_enunciado,
              e.id_evidencia_dba, e.descripcion, e.orden
       FROM evidencias_dba e
       JOIN dba d ON d.id_dba = e.id_dba
       WHERE d.area = (SELECT nombre FROM materias WHERE id_materia = $1)
         AND d.grado = (
           SELECT tg.nombre 
           FROM grupos g 
           JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado 
           WHERE g.id_grupo = $2
         )
         AND d.version_curricular = $3
         AND d.estado = 'ACTIVO' AND e.estado = 'ACTIVO'
       ORDER BY d.numero_dba, e.orden`, [subjectId, gradeId, versionCurricular]);
        let planeadasOtrosPeriodos = [];
        if (periodId) {
            const otrosRes = await db_1.pool.query(`SELECT DISTINCT ea.id_evidencia_dba, c.id_periodo, p.nombre as periodo_nombre
         FROM evidencia_aprendizaje ea
         JOIN competencias c ON c.id_competencia = ea.id_competencia
         JOIN periodo_academico p ON p.id_periodo = c.id_periodo
         WHERE c.id_colegio = $1
           AND c.id_anio = (SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 ORDER BY id_anio DESC LIMIT 1)
           AND c.id_materia = $2
           AND c.id_grupo IN (
             SELECT g2.id_grupo
             FROM grupos g1
             JOIN grupos g2 ON g2.id_nivel = g1.id_nivel AND g2.id_tipo_grado = g1.id_tipo_grado
             WHERE g1.id_grupo = $3 AND g1.id_colegio = $1
           )
           AND c.id_periodo != $4
           AND ea.id_evidencia_dba IS NOT NULL`, [schoolId, subjectId, gradeId, periodId]);
            planeadasOtrosPeriodos = otrosRes.rows.map(r => ({
                id_evidencia_dba: Number(r.id_evidencia_dba),
                id_periodo: Number(r.id_periodo),
                periodo_nombre: r.periodo_nombre
            }));
        }
        // 5. Agrupar por DBA y clasificar cada evidencia
        const dbaMap = new Map();
        for (const row of dbaEvsRes.rows) {
            if (!dbaMap.has(row.id_dba)) {
                dbaMap.set(row.id_dba, {
                    id_dba: row.id_dba,
                    numero_dba: row.numero_dba,
                    enunciado: row.dba_enunciado,
                    evidencias: [],
                });
            }
            const esPlaneada = planeadasIds.includes(row.id_evidencia_dba);
            const evaluadaEnCerrado = evaluadasEnCerradosIds.includes(row.id_evidencia_dba);
            // Si fue evaluada en un periodo cerrado Y no fue re-planeada, la ocultamos de extras
            if (evaluadaEnCerrado && !esPlaneada) {
                continue;
            }
            const otroPeriodo = planeadasOtrosPeriodos.find(p => p.id_evidencia_dba === row.id_evidencia_dba);
            const planeadaInfo = planeadasRes.rows.find(p => Number(p.id_evidencia_dba) === Number(row.id_evidencia_dba));
            const idCompetencia = planeadaInfo ? planeadaInfo.id_competencia : null;
            dbaMap.get(row.id_dba).evidencias.push({
                id_evidencia_dba: row.id_evidencia_dba,
                descripcion: row.descripcion,
                orden: row.orden,
                tipo: esPlaneada ? 'PLANEADA' : 'EXTRA',
                evaluada_en_cerrado: evaluadaEnCerrado,
                id_competencia: idCompetencia,
                planeada_otro_periodo_id: otroPeriodo ? otroPeriodo.id_periodo : null,
                planeada_otro_periodo_nombre: otroPeriodo ? otroPeriodo.periodo_nombre : null
            });
        }
        // También incluir planeadas que no estaban en el catálogo filtrado (por seguridad)
        for (const pl of planeadasRes.rows) {
            if (!dbaMap.has(pl.id_dba)) {
                dbaMap.set(pl.id_dba, {
                    id_dba: pl.id_dba,
                    numero_dba: pl.numero_dba,
                    enunciado: pl.dba_enunciado,
                    evidencias: [],
                });
            }
            const dbaEntry = dbaMap.get(pl.id_dba);
            if (!dbaEntry.evidencias.some(e => e.id_evidencia_dba === pl.id_evidencia_dba)) {
                dbaEntry.evidencias.push({
                    id_evidencia_dba: pl.id_evidencia_dba,
                    descripcion: pl.descripcion,
                    orden: pl.orden,
                    tipo: 'PLANEADA',
                    evaluada_en_cerrado: evaluadasEnCerradosIds.includes(pl.id_evidencia_dba),
                    id_competencia: pl.id_competencia
                });
            }
        }
        // Ordenar DBA por numero_dba
        const dbaList = Array.from(dbaMap.values()).sort((a, b) => a.numero_dba - b.numero_dba);
        // Mantener compatibilidad: también enviar planeadas y extras planas
        const planeadasFlat = planeadasRes.rows;
        const extrasFlat = dbaEvsRes.rows
            .filter(r => !planeadasIds.includes(r.id_evidencia_dba) && !(evaluadasEnCerradosIds.includes(r.id_evidencia_dba)))
            .map(row => {
            const otroPeriodo = planeadasOtrosPeriodos.find(p => p.id_evidencia_dba === row.id_evidencia_dba);
            return {
                ...row,
                planeada_otro_periodo_id: otroPeriodo ? otroPeriodo.id_periodo : null,
                planeada_otro_periodo_nombre: otroPeriodo ? otroPeriodo.periodo_nombre : null
            };
        });
        res.json({
            usaDba: true,
            versionCurricular,
            dba: dbaList,
            planeadas: planeadasFlat,
            extras: extrasFlat,
        });
    }
    catch (error) {
        console.error("Error al obtener evidencias DBA del curso:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getCourseEvidenciasDba = getCourseEvidenciasDba;
