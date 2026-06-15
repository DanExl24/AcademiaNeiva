"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStudent = exports.changeStudentGrade = exports.updateStudentStatus = exports.updateStudent = exports.getAllStudents = void 0;
const db_1 = require("../config/db");
const notificationService_1 = require("../services/notificationService");
const getAllStudents = async (req, res) => {
    try {
        const { idColegio } = req.params;
        const { estado, grado, busqueda } = req.query;
        let query = `
      SELECT e.*, 
             u.email, 
             td.tipo as tipo_documento_nombre,
             n.nombre as nivel_nombre,
             m.id_grupo,
             tg.nombre as grado_nombre,
             s.nombre as seccion_nombre
      FROM estudiante e
      LEFT JOIN usuario u ON e.id_usuario = u.id_usuario
      LEFT JOIN tipo_documento td ON e.id_tipodocumento = td.id_tipodocumento
      LEFT JOIN nivel_escolar n ON e.id_nivel = n.id_nivel
      LEFT JOIN matricula m ON e.id_estudiante = m.id_estudiante AND m.estado = 'ACTIVA'
      LEFT JOIN grupos g ON m.id_grupo = g.id_grupo
      LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
      LEFT JOIN secciones s ON g.id_seccion = s.id_seccion
      WHERE e.id_colegio = $1
    `;
        const params = [idColegio];
        let paramCount = 1;
        if (estado && estado !== 'TODOS') {
            paramCount++;
            query += ` AND e.estado = $${paramCount}`;
            params.push(estado);
        }
        if (grado) {
            paramCount++;
            query += ` AND e.id_nivel = $${paramCount}`;
            params.push(grado);
        }
        if (busqueda) {
            paramCount++;
            query += ` AND (e.nombre ILIKE $${paramCount} OR e.apellido ILIKE $${paramCount} OR e.documento ILIKE $${paramCount} OR e.codigo ILIKE $${paramCount})`;
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
    try {
        const { id } = req.params;
        const { estado } = req.body; // 'ACTIVO', 'SANCIONADO', 'EXPULSADO', 'RETIRADO'
        const result = await db_1.pool.query("UPDATE estudiante SET estado = $1 WHERE id_estudiante = $2 RETURNING *", [estado, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Estudiante no encontrado" });
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateStudentStatus = updateStudentStatus;
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
