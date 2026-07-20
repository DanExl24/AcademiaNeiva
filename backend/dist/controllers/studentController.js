"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graduateStudent = exports.getStudentSummary = exports.deleteStudent = exports.changeStudentGrade = exports.getTipoSanciones = exports.updateStudentStatus = exports.updateStudent = exports.getAllStudents = void 0;
const db_1 = require("../config/db");
const notificationService_1 = require("../services/notificationService");
const getAllStudents = async (req, res) => {
    try {
        const { idColegio } = req.params;
        const { estado, id_nivel, id_tipo_grado, id_jornada, grado, busqueda } = req.query;
        let query = `
      SELECT e.*, 
             u.email, 
             td.tipo as tipo_documento_nombre,
             n.nombre as nivel_nombre,
             m.id_grupo,
             m.estado AS matricula_estado,
             tg.nombre as grado_nombre,
             s.nombre as seccion_nombre,
             j.nombre as jornada_nombre,
             pf.nombre as acudiente_nombre,
             pf.apellido as acudiente_apellido,
             pf.documento as acudiente_documento
      FROM estudiante e
      LEFT JOIN usuario u ON e.id_usuario = u.id_usuario
      LEFT JOIN tipo_documento td ON e.id_tipodocumento = td.id_tipodocumento
      LEFT JOIN nivel_escolar n ON e.id_nivel = n.id_nivel
      LEFT JOIN matricula m ON e.id_estudiante = m.id_estudiante AND m.estado = 'ACTIVA'
      LEFT JOIN grupos g ON m.id_grupo = g.id_grupo
      LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
      LEFT JOIN secciones s ON g.id_seccion = s.id_seccion
      LEFT JOIN jornada j ON g.id_jornada = j.id_jornada
      LEFT JOIN (
        SELECT DISTINCT ON (id_estudiante) id_estudiante, id_padrefamilia
        FROM detalle_padrefamilia
      ) dp ON e.id_estudiante = dp.id_estudiante
      LEFT JOIN padre_familia pf ON dp.id_padrefamilia = pf.id_padrefamilia
      WHERE e.id_colegio = $1
    `;
        const params = [idColegio];
        let paramCount = 1;
        if (estado && estado !== 'TODOS') {
            paramCount++;
            query += ` AND e.estado = $${paramCount}`;
            params.push(estado);
        }
        const levelId = id_nivel || grado;
        if (levelId) {
            paramCount++;
            query += ` AND e.id_nivel = $${paramCount}`;
            params.push(levelId);
        }
        if (id_tipo_grado) {
            paramCount++;
            query += ` AND g.id_tipo_grado = $${paramCount}`;
            params.push(id_tipo_grado);
        }
        if (id_jornada) {
            paramCount++;
            query += ` AND g.id_jornada = $${paramCount}`;
            params.push(id_jornada);
        }
        if (busqueda) {
            paramCount++;
            query += ` AND (
        e.nombre ILIKE $${paramCount} OR 
        e.apellido ILIKE $${paramCount} OR 
        e.documento ILIKE $${paramCount} OR 
        e.codigo ILIKE $${paramCount} OR
        tg.nombre ILIKE $${paramCount} OR
        s.nombre ILIKE $${paramCount} OR
        j.nombre::text ILIKE $${paramCount} OR
        (tg.nombre || '-' || s.nombre) ILIKE $${paramCount} OR
        (tg.nombre || ' ' || s.nombre) ILIKE $${paramCount}
      )`;
            params.push(`%${busqueda}%`);
        }
        query += " ORDER BY e.apellido ASC, e.nombre ASC";
        const result = await db_1.pool.query(query, params);
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllStudents = getAllStudents;
const updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, documento, id_tipodocumento, codigo } = req.body;
        const result = await db_1.pool.query(`UPDATE estudiante 
       SET nombre = $1, apellido = $2, documento = $3, id_tipodocumento = $4, codigo = $5
       WHERE id_estudiante = $6
       RETURNING *`, [nombre, apellido, documento, id_tipodocumento, codigo, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Estudiante no encontrado" });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateStudent = updateStudent;
const updateStudentStatus = async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        const { id } = req.params; // id_estudiante
        const { estado, motivo, id_tipo_sancion, fecha_inicio, fecha_fin, observaciones } = req.body;
        if (!estado) {
            return res.status(400).json({ error: "El estado es obligatorio" });
        }
        const currentUserId = req.user?.id;
        if (!currentUserId) {
            return res.status(401).json({ error: "No autorizado" });
        }
        const directivoRes = await client.query("SELECT id FROM directivo WHERE id_usuario = $1", [currentUserId]);
        const id_directivo = directivoRes.rows[0]?.id;
        if (!id_directivo) {
            return res.status(403).json({ error: "El usuario actual no está registrado como directivo" });
        }
        if (estado === 'SANCIONADO') {
            if (!id_tipo_sancion) {
                return res.status(400).json({ error: "El tipo de sanción es obligatorio" });
            }
            if (!fecha_inicio || !fecha_fin) {
                return res.status(400).json({ error: "Las fechas de inicio y fin son obligatorias" });
            }
            if (new Date(fecha_fin) < new Date(fecha_inicio)) {
                return res.status(400).json({ error: "La fecha de fin no puede ser anterior a la de inicio" });
            }
            if (!motivo || motivo.trim().length < 10) {
                return res.status(400).json({ error: "El motivo es requerido y debe tener al menos 10 caracteres" });
            }
            // Insert new active sanction
            await client.query(`INSERT INTO public.sancion (id_estudiante, id_tipo_sancion, motivo, fecha_inicio, fecha_fin, estado, observaciones, id_directivo)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVA', $6, $7)`, [id, id_tipo_sancion, motivo.trim(), fecha_inicio, fecha_fin, observaciones ? observaciones.trim() : null, id_directivo]);
        }
        else if (estado === 'EXPULSADO') {
            if (!motivo || motivo.trim().length < 10) {
                return res.status(400).json({ error: "El motivo de la expulsión es obligatorio y debe tener al menos 10 caracteres" });
            }
            // Revoke any existing active sanctions
            await client.query(`UPDATE public.sancion 
         SET estado = 'REVOCADA', observaciones = COALESCE(observaciones, '') || '\nSanción revocada por expulsión del estudiante.' 
         WHERE id_estudiante = $1 AND estado = 'ACTIVA'`, [id]);
            // Find expulsion type ID
            const typeRes = await client.query("SELECT id_tipo_sancion FROM tipo_sancion WHERE nombre = 'EXPULSION' LIMIT 1");
            const expulsionTypeId = typeRes.rows[0]?.id_tipo_sancion;
            if (!expulsionTypeId) {
                return res.status(500).json({ error: "No se encontró el tipo de sanción EXPULSION en el sistema." });
            }
            // Insert active expulsion sanction with end date '9999-12-31'
            await client.query(`INSERT INTO public.sancion (id_estudiante, id_tipo_sancion, motivo, fecha_inicio, fecha_fin, estado, observaciones, id_directivo)
         VALUES ($1, $2, $3, CURRENT_DATE, '9999-12-31', 'ACTIVA', NULL, $4)`, [id, expulsionTypeId, motivo.trim(), id_directivo]);
        }
        else {
            // If student is changed to ACTIVO, RETIRADO, etc., revoke any active sanctions
            await client.query(`UPDATE public.sancion 
         SET estado = 'REVOCADA', observaciones = COALESCE(observaciones, '') || '\nSanción revocada por cambio de estado del estudiante.' 
         WHERE id_estudiante = $1 AND estado = 'ACTIVA'`, [id]);
        }
        const motivoValue = (estado === 'SANCIONADO' || estado === 'EXPULSADO') ? motivo.trim() : null;
        const result = await client.query("UPDATE estudiante SET estado = $1, motivo_estado = $2 WHERE id_estudiante = $3 RETURNING *", [estado, motivoValue, id]);
        if (result.rowCount === 0) {
            throw new Error("Estudiante no encontrado");
        }
        await client.query("COMMIT");
        res.json(result.rows[0]);
    }
    catch (error) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: error.message });
    }
    finally {
        client.release();
    }
};
exports.updateStudentStatus = updateStudentStatus;
const getTipoSanciones = async (req, res) => {
    try {
        const result = await db_1.pool.query("SELECT * FROM tipo_sancion ORDER BY id_tipo_sancion ASC");
        res.json(result.rows);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getTipoSanciones = getTipoSanciones;
const changeStudentGrade = async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        const { id } = req.params;
        const { id_grupo, id_nivel, motivo } = req.body;
        if (!motivo) {
            return res.status(400).json({ error: "El motivo del traslado es obligatorio" });
        }
        // 0. Obtener información necesaria para el correo ANTES del cambio
        const infoQuery = `
      SELECT 
        e.nombre as student_name,
        e.apellido as student_lastname,
        c.nombre as school_name,
        u_padre.nombre as parent_name,
        u_padre.email as parent_email,
        tg_old.nombre as old_grade_name,
        s_old.nombre as old_section_name
      FROM estudiante e
      JOIN colegio c ON e.id_colegio = c.id_colegio
      JOIN detalle_padrefamilia dp ON e.id_estudiante = dp.id_estudiante
      JOIN padre_familia pf ON dp.id_padrefamilia = pf.id_padrefamilia
      JOIN usuario u_padre ON pf.id_usuario = u_padre.id_usuario
      LEFT JOIN matricula m ON e.id_estudiante = m.id_estudiante AND m.estado = 'ACTIVA'
      LEFT JOIN grupos g_old ON m.id_grupo = g_old.id_grupo
      LEFT JOIN tipo_grado tg_old ON g_old.id_tipo_grado = tg_old.id_tipo_grado
      LEFT JOIN secciones s_old ON g_old.id_seccion = s_old.id_seccion
      WHERE e.id_estudiante = $1
      LIMIT 1
    `;
        const infoRes = await client.query(infoQuery, [id]);
        if (infoRes.rowCount === 0) {
            throw new Error("No se pudo encontrar la información del estudiante o su acudiente");
        }
        const { student_name, student_lastname, school_name, parent_name, parent_email, old_grade_name, old_section_name } = infoRes.rows[0];
        // Obtener nombre del NUEVO grado
        const newGradeRes = await client.query(`SELECT tg.nombre, s.nombre as seccion 
       FROM grupos g 
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado 
       JOIN secciones s ON g.id_seccion = s.id_seccion
       WHERE g.id_grupo = $1`, [id_grupo]);
        const new_grade_name = newGradeRes.rows[0]?.nombre + " - " + newGradeRes.rows[0]?.seccion;
        // 1. Actualizar el nivel en la ficha del estudiante
        await client.query("UPDATE estudiante SET id_nivel = $1 WHERE id_estudiante = $2", [id_nivel, id]);
        // 2. Actualizar la matrícula activa
        await client.query(`UPDATE matricula 
       SET id_grupo = $1, id_nivel = $2 
       WHERE id_estudiante = $3 AND estado = 'ACTIVA'`, [id_grupo, id_nivel, id]);
        await client.query("COMMIT");
        // 3. Enviar notificación por correo (fuera de la transacción para no bloquear)
        notificationService_1.NotificationService.sendStudentTransferEmail(parent_email, parent_name, `${student_name} ${student_lastname}`, `${old_grade_name || 'N/A'} - ${old_section_name || 'N/A'}`, new_grade_name, motivo, school_name).catch((err) => console.error("Error enviando email tras compromiso:", err));
        res.json({ message: "Cambio de grado realizado y notificación enviada" });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error en changeStudentGrade:", error);
        res.status(500).json({ error: error.message });
    }
    finally {
        client.release();
    }
};
exports.changeStudentGrade = changeStudentGrade;
const deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;
        // Realizamos una eliminación lógica cambiando el estado a RETIRADO en lugar de borrar físicamente
        // si el usuario así lo prefiere, o borrado físico si no tiene registros académicos.
        // Para simplificar y mantener integridad, el usuario pidió "Expulsar (No eliminar)".
        // Aquí implementaremos el borrado físico solo si el administrador realmente lo solicita y no hay conflictos.
        const result = await db_1.pool.query("DELETE FROM estudiante WHERE id_estudiante = $1", [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Estudiante no encontrado" });
        }
        res.json({ message: "Estudiante eliminado exitosamente" });
    }
    catch (error) {
        if (error.code === '23503') {
            res.status(400).json({
                error: "No se puede eliminar el estudiante porque tiene registros académicos asociados. Use 'Retirar' o 'Expulsar' en su lugar."
            });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
};
exports.deleteStudent = deleteStudent;
const getStudentSummary = async (req, res) => {
    try {
        const { id } = req.params;
        // 1. Basic Student and Group Info
        const studentRes = await db_1.pool.query(`
      SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.codigo, e.estado, e.id_usuario, e.id_colegio, e.motivo_estado,
             tg.nombre as grado_nombre, s.nombre as seccion_nombre, n.nombre as nivel_nombre,
             m.id_grupo, u.email as student_email, u.fecha_creacion as user_created_at
      FROM estudiante e
      LEFT JOIN usuario u ON e.id_usuario = u.id_usuario
      LEFT JOIN matricula m ON e.id_estudiante = m.id_estudiante AND m.estado IN ('ACTIVA', 'CULMINADA')
      LEFT JOIN grupos g ON m.id_grupo = g.id_grupo
      LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
      LEFT JOIN secciones s ON g.id_seccion = s.id_seccion
      LEFT JOIN nivel_escolar n ON e.id_nivel = n.id_nivel
      WHERE e.id_estudiante = $1
    `, [id]);
        if (studentRes.rows.length === 0) {
            return res.status(404).json({ error: "Estudiante no encontrado" });
        }
        const student = studentRes.rows[0];
        const { id_colegio, id_grupo } = student;
        // 2. Parent Contact Details
        const parentRes = await db_1.pool.query(`
      SELECT pf.nombre, pf.apellido, u.email
      FROM detalle_padrefamilia dpf
      JOIN padre_familia pf ON dpf.id_padrefamilia = pf.id_padrefamilia
      LEFT JOIN usuario u ON pf.id_usuario = u.id_usuario
      WHERE dpf.id_estudiante = $1
      LIMIT 1
    `, [id]);
        const parent = parentRes.rows[0] || null;
        // 3. Find active period (state = 'ABIERTO') or fallback to latest period
        let periodRes = await db_1.pool.query(`
      SELECT id_periodo, nombre 
      FROM periodo_academico 
      WHERE id_colegio = $1 AND estado = 'ABIERTO' 
      LIMIT 1
    `, [id_colegio]);
        if (periodRes.rows.length === 0) {
            periodRes = await db_1.pool.query(`
        SELECT id_periodo, nombre 
        FROM periodo_academico 
        WHERE id_colegio = $1 
        ORDER BY id_periodo DESC 
        LIMIT 1
      `, [id_colegio]);
        }
        const periodId = periodRes.rows[0]?.id_periodo || null;
        const periodName = periodRes.rows[0]?.nombre || 'Sin Periodo Activo';
        // 4. Failed subjects and overall average
        let grades = [];
        let promedioGeneral = 0;
        let materiasReprobadas = [];
        if (id_grupo && periodId) {
            const gradesRes = await db_1.pool.query(`
        WITH period_grades AS (
          SELECT 
            dg.id_materia,
            p.id_periodo,
            COALESCE(ra.promedio, calc.promedio_calculado) as nota_periodo
          FROM detalle_grados dg
          CROSS JOIN (
            SELECT id_periodo 
            FROM periodo_academico 
            WHERE id_colegio = $1 AND id_anio = (
              SELECT id_anio FROM periodo_academico WHERE id_colegio = $1 AND (estado = 'ABIERTO' OR estado = 'CERRADO') ORDER BY id_periodo DESC LIMIT 1
            )
          ) p
          LEFT JOIN resultado_academico ra 
                 ON ra.id_detallegrado = dg.id_detallegrado 
                AND ra.id_periodo = p.id_periodo 
                AND ra.id_estudiante = $2
          LEFT JOIN (
            SELECT am.id_detallegrado, am.id_periodo, ROUND(AVG(na.nota)::numeric, 2) as promedio_calculado
            FROM notas_actividad na
            JOIN actividad_materia am ON am.id_actividadmateria = na.id_actividadmateria
            WHERE na.id_estudiante = $2
            GROUP BY am.id_detallegrado, am.id_periodo
          ) calc ON calc.id_detallegrado = dg.id_detallegrado AND calc.id_periodo = p.id_periodo
          WHERE dg.id_grupo = $3
        )
        SELECT 
          m.id_materia,
          m.nombre as materia,
          COALESCE(ROUND(AVG(pg.nota_periodo), 2), 0)::numeric as calificacion
        FROM period_grades pg
        JOIN materias m ON m.id_materia = pg.id_materia
        GROUP BY m.id_materia, m.nombre
        ORDER BY m.nombre ASC
      `, [id_colegio, id, id_grupo]);
            grades = gradesRes.rows.map(g => ({
                id_materia: g.id_materia,
                materia: g.materia,
                calificacion: parseFloat(g.calificacion || 0)
            }));
            if (grades.length > 0) {
                const sum = grades.reduce((acc, curr) => acc + curr.calificacion, 0);
                promedioGeneral = parseFloat((sum / grades.length).toFixed(2));
            }
            materiasReprobadas = grades.filter(g => g.calificacion < 3.0);
        }
        // 5. Total Absences (where state is 'AUSENTE')
        const absencesRes = await db_1.pool.query(`
      SELECT COUNT(*)::integer as count 
      FROM registro_asistencia 
      WHERE id_estudiante = $1 AND estado = 'AUSENTE'
    `, [id]);
        const totalInasistencias = absencesRes.rows[0]?.count || 0;
        // 6. Disciplinary observations count
        const observationsRes = await db_1.pool.query(`
      SELECT COUNT(*)::integer as count 
      FROM observacion_estudiante 
      WHERE id_estudiante = $1 AND tipo = 'DISCIPLINARIA'
    `, [id]);
        const totalObservacionesDisciplinarias = observationsRes.rows[0]?.count || 0;
        // 7. Last system activity logic
        let ultimaActividad = 'No registrada';
        if (student.id_usuario) {
            ultimaActividad = student.user_created_at
                ? new Date(student.user_created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'Reciente';
        }
        // 8. Academic State classification
        let estadoAcademico = 'Normal';
        if (materiasReprobadas.length >= 3 || (promedioGeneral < 3.0 && grades.length > 0)) {
            estadoAcademico = 'Crítico';
        }
        else if (materiasReprobadas.length > 0) {
            estadoAcademico = 'En riesgo';
        }
        // 9. Fetch graduation registry if graduated
        let graduationInfo = null;
        if (student.estado === 'GRADUADO') {
            const gradRes = await db_1.pool.query(`SELECT fecha_graduacion, observaciones 
         FROM registro_graduados 
         WHERE id_estudiante = $1`, [id]);
            if (gradRes.rows.length > 0) {
                graduationInfo = gradRes.rows[0];
            }
        }
        // 10. Fetch active sanction details if student is SANCIONADO or EXPULSADO
        let sanctionInfo = null;
        if (student.estado === 'SANCIONADO' || student.estado === 'EXPULSADO') {
            const sancRes = await db_1.pool.query(`SELECT s.id_sancion, s.motivo, s.fecha_inicio, s.fecha_fin, s.estado, s.observaciones,
                ts.nombre as tipo_nombre, ts.descripcion as tipo_descripcion,
                u.nombre || ' ' || u.apellido as directivo_nombre
         FROM public.sancion s
         JOIN public.tipo_sancion ts ON s.id_tipo_sancion = ts.id_tipo_sancion
         JOIN public.directivo d ON s.id_directivo = d.id
         JOIN public.usuario u ON d.id_usuario = u.id_usuario
         WHERE s.id_estudiante = $1 AND s.estado = 'ACTIVA'
         ORDER BY s.id_sancion DESC
         LIMIT 1`, [id]);
            if (sancRes.rows.length > 0) {
                sanctionInfo = sancRes.rows[0];
            }
        }
        res.json({
            id_estudiante: student.id_estudiante,
            nombre_completo: `${student.nombre} ${student.apellido}`,
            nombre: student.nombre,
            apellido: student.apellido,
            id_usuario: student.id_usuario,
            documento: student.documento,
            codigo: student.codigo,
            curso: student.grado_nombre && student.seccion_nombre ? `${student.grado_nombre}-${student.seccion_nombre}` : 'Sin Grupo',
            nivel: student.nivel_nombre || 'Sin Nivel',
            estado_estudiante: student.estado,
            motivo_estado: student.motivo_estado,
            estado_academico: estadoAcademico,
            gpa: promedioGeneral,
            periodo_nombre: periodName,
            total_inasistencias: totalInasistencias,
            total_disciplinarias: totalObservacionesDisciplinarias,
            parent: parent ? {
                nombre: `${parent.nombre} ${parent.apellido}`,
                email: parent.email || 'Sin correo registrado'
            } : null,
            failed_subjects_count: materiasReprobadas.length,
            failed_subjects: materiasReprobadas,
            ultima_actividad: ultimaActividad,
            graduation: graduationInfo,
            sanction: sanctionInfo
        });
    }
    catch (error) {
        console.error("Error in getStudentSummary:", error);
        res.status(500).json({ error: error.message });
    }
};
exports.getStudentSummary = getStudentSummary;
const graduateStudent = async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { id } = req.params;
        const { fecha_graduacion, observaciones, registrar_por } = req.body;
        await client.query("BEGIN");
        // 1. Check student and active grade
        const studentRes = await client.query(`SELECT e.id_estudiante, e.nombre, e.apellido, e.id_colegio, tg.nombre as grado_nombre, m.id_matricula, m.id_grupo
       FROM estudiante e
       LEFT JOIN matricula m ON e.id_estudiante = m.id_estudiante AND m.estado = 'ACTIVA'
       LEFT JOIN grupos g ON m.id_grupo = g.id_grupo
       LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       WHERE e.id_estudiante = $1`, [id]);
        if (studentRes.rows.length === 0) {
            res.status(404).json({ error: "Estudiante no encontrado" });
            await client.query("ROLLBACK");
            return;
        }
        const student = studentRes.rows[0];
        // RN-01: Only student of 11th grade (ONCE) can graduate
        if (student.grado_nombre !== 'ONCE') {
            res.status(400).json({ error: "Solo los estudiantes de grado Undécimo (ONCE) pueden ser graduados" });
            await client.query("ROLLBACK");
            return;
        }
        // 2. Academic check (RN-02)
        let periodRes = await client.query(`
      SELECT id_periodo 
      FROM periodo_academico 
      WHERE id_colegio = $1 AND estado = 'ABIERTO' 
      LIMIT 1
    `, [student.id_colegio]);
        if (periodRes.rows.length === 0) {
            periodRes = await client.query(`
        SELECT id_periodo 
        FROM periodo_academico 
        WHERE id_colegio = $1 
        ORDER BY id_periodo DESC 
        LIMIT 1
      `, [student.id_colegio]);
        }
        const periodId = periodRes.rows[0]?.id_periodo || null;
        if (!periodId || !student.id_grupo) {
            res.status(400).json({ error: "El estudiante no tiene matrícula activa o no hay periodo académico configurado" });
            await client.query("ROLLBACK");
            return;
        }
        // Fetch cumulative grades for the current school year
        const gradesRes = await client.query(`
      WITH period_grades AS (
        SELECT 
          dg.id_materia,
          p.id_periodo,
          COALESCE(ra.promedio, calc.promedio_calculado) as nota_periodo
        FROM detalle_grados dg
        CROSS JOIN (
          SELECT id_periodo 
          FROM periodo_academico 
          WHERE id_colegio = $1 AND id_anio = (
            SELECT id_anio FROM periodo_academico WHERE id_colegio = $1 AND (estado = 'ABIERTO' OR estado = 'CERRADO') ORDER BY id_periodo DESC LIMIT 1
          )
        ) p
        LEFT JOIN resultado_academico ra 
               ON ra.id_detallegrado = dg.id_detallegrado 
              AND ra.id_periodo = p.id_periodo 
              AND ra.id_estudiante = $2
        LEFT JOIN (
          SELECT am.id_detallegrado, am.id_periodo, ROUND(AVG(na.nota)::numeric, 2) as promedio_calculado
          FROM notas_actividad na
          JOIN actividad_materia am ON am.id_actividadmateria = na.id_actividadmateria
          WHERE na.id_estudiante = $2
          GROUP BY am.id_detallegrado, am.id_periodo
        ) calc ON calc.id_detallegrado = dg.id_detallegrado AND calc.id_periodo = p.id_periodo
        WHERE dg.id_grupo = $3
      )
      SELECT 
        m.id_materia,
        m.nombre as materia,
        COALESCE(ROUND(AVG(pg.nota_periodo), 2), 0)::numeric as calificacion
      FROM period_grades pg
      JOIN materias m ON m.id_materia = pg.id_materia
      GROUP BY m.id_materia, m.nombre
      ORDER BY m.nombre ASC
    `, [student.id_colegio, id, student.id_grupo]);
        const grades = gradesRes.rows.map(g => ({
            id_materia: g.id_materia,
            materia: g.materia,
            calificacion: parseFloat(g.calificacion || 0)
        }));
        let promedioGeneral = 0;
        if (grades.length > 0) {
            const sum = grades.reduce((acc, curr) => acc + curr.calificacion, 0);
            promedioGeneral = parseFloat((sum / grades.length).toFixed(2));
        }
        const materiasReprobadas = grades.filter(g => g.calificacion < 3.0);
        // RN-02: Must have approved academic requirements (GPA >= 3.0, 0 failed subjects)
        if (promedioGeneral < 3.0 || materiasReprobadas.length > 0) {
            res.status(400).json({
                error: "El estudiante no cumple con los requisitos académicos para graduarse",
                gpa: promedioGeneral,
                failed_subjects_count: materiasReprobadas.length,
                failed_subjects: materiasReprobadas
            });
            await client.query("ROLLBACK");
            return;
        }
        // 3. Update student status to GRADUADO
        await client.query(`UPDATE estudiante SET estado = 'GRADUADO' WHERE id_estudiante = $1`, [id]);
        // 4. Change active enrollment (matricula) state to CULMINADA
        if (student.id_matricula) {
            await client.query(`UPDATE matricula SET estado = 'CULMINADA' WHERE id_matricula = $1`, [student.id_matricula]);
        }
        // 5. Insert record to registro_graduados
        const gradDate = fecha_graduacion ? new Date(fecha_graduacion) : new Date();
        await client.query(`INSERT INTO registro_graduados (id_estudiante, fecha_graduacion, observaciones, id_usuario_registro)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_estudiante) DO UPDATE 
       SET fecha_graduacion = EXCLUDED.fecha_graduacion, observaciones = EXCLUDED.observaciones, id_usuario_registro = EXCLUDED.id_usuario_registro`, [id, gradDate, observaciones || null, registrar_por || null]);
        // RN-05: Audit log
        console.log(`[AUDIT] Estudiante ${student.nombre} ${student.apellido} (ID: ${id}) cambiado a estado GRADUADO por usuario ID ${registrar_por || 'sistema'} en fecha ${gradDate.toISOString()}.`);
        await client.query("COMMIT");
        res.json({ message: "Estudiante graduado exitosamente" });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Error in graduateStudent:", error);
        res.status(500).json({ error: error.message });
    }
    finally {
        client.release();
    }
};
exports.graduateStudent = graduateStudent;
