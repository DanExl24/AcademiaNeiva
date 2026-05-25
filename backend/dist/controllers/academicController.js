"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentsByGrade = exports.getTeacherCourses = void 0;
const db_1 = require("../config/db");
const getTeacherCourses = async (req, res) => {
    const { userId } = req.params; // id_usuario del docente
    try {
        // 1. Obtener el id_docente vinculado al usuario
        const docenteRes = await db_1.pool.query("SELECT id_docente FROM docente WHERE id_usuario = $1", [userId]);
        if (docenteRes.rows.length === 0) {
            res.status(404).json({ error: "Docente no encontrado" });
            return;
        }
        const idDocente = docenteRes.rows[0].id_docente;
        // 2. Obtener la jerarquía de Grados -> Materias
        const result = await db_1.pool.query(`SELECT 
        dg.id_detallegrado,
        g.id_grupo as id_grado, 
        tg.nombre as grado_nombre, 
        ne.nombre as nivel, 
        s.nombre as seccion,
        j.nombre as jornada_nombre,
        m.id_materia, 
        m.nombre as materia_nombre
       FROM detalle_grados dg
       JOIN grupos g ON dg.id_grupo = g.id_grupo
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       JOIN secciones s ON g.id_seccion = s.id_seccion
       JOIN jornada j ON g.id_jornada = j.id_jornada
       JOIN materias m ON dg.id_materia = m.id_materia
       WHERE dg.id_docente = $1`, [idDocente]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("Error fetching teacher courses:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getTeacherCourses = getTeacherCourses;
const getStudentsByGrade = async (req, res) => {
    const { gradeId } = req.params;
    try {
        const result = await db_1.pool.query(`SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.codigo 
       FROM estudiante e
       JOIN matricula m ON e.id_estudiante = m.id_estudiante
       WHERE m.id_grupo = $1 AND m.estado IN ('ACTIVA', 'TRASLADADA')
       ORDER BY e.apellido, e.nombre`, [gradeId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getStudentsByGrade = getStudentsByGrade;
