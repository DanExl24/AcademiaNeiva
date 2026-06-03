import { Request, Response } from 'express';
import { pool } from '../config/db';

/**
 * Gets closed academic years for a specific student's school
 */
export const getStudentAcademicYears = async (req: Request, res: Response) => {
  const { id_estudiante } = req.params;
  try {
    const result = await pool.query(`
      SELECT DISTINCT al."id_año", al.calendario
      FROM "año_lectivo" al
      JOIN estudiante e ON e.id_colegio = al.id_colegio
      JOIN periodo_academico p ON p."id_año" = al."id_año"
      WHERE e.id_estudiante = $1 AND p.estado = 'CERRADO'
      ORDER BY al.calendario DESC
    `, [id_estudiante]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching academic years:', error);
    res.status(500).json({ error: 'Error al obtener años lectivos' });
  }
};

/**
 * Gets closed periods for a specific student and academic year
 */
export const getStudentClosedPeriods = async (req: Request, res: Response) => {
  const { id_estudiante, id_anio } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.id_periodo, p.nombre, p.trimestre, p.porcentaje
      FROM periodo_academico p
      JOIN estudiante e ON e.id_colegio = p.id_colegio
      WHERE e.id_estudiante = $1 AND p."id_año" = $2 AND p.estado = 'CERRADO'
      ORDER BY p.trimestre ASC
    `, [id_estudiante, id_anio]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching closed periods:', error);
    res.status(500).json({ error: 'Error al obtener periodos cerrados' });
  }
};

/**
 * Gets grades for a specific student and closed period
 */
export const getStudentGrades = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo } = req.params;
  try {
    // 1. Verify period is closed
    const periodCheck = await pool.query(
      'SELECT estado, id_colegio FROM periodo_academico WHERE id_periodo = $1',
      [id_periodo]
    );
    if (!periodCheck.rows.length || periodCheck.rows[0].estado !== 'CERRADO') {
      return res.status(400).json({ error: 'Solo se pueden consultar notas de periodos cerrados' });
    }
    const id_colegio = periodCheck.rows[0].id_colegio;

    // 2. Fetch grades using logic similar to boletin controller
    const result = await pool.query(`
      SELECT 
        m.id_materia,
        m.nombre as materia,
        d.nombre || ' ' || d.apellido as docente,
        COALESCE(ra.promedio, calc.promedio_calculado, 0) as calificacion,
        ev.nivel as desempeno
      FROM detalle_grados dg
      JOIN materias m ON m.id_materia = dg.id_materia
      JOIN docente d ON d.id_docente = dg.id_docente
      JOIN matricula mat ON mat.id_grupo = dg.id_grupo
      LEFT JOIN resultado_academico ra ON ra.id_detallegrado = dg.id_detallegrado AND ra.id_periodo = $2 AND ra.id_estudiante = $1
      LEFT JOIN (
        SELECT am.id_detallegrado, na.id_estudiante, ROUND(AVG(na.nota)::numeric, 2) as promedio_calculado
        FROM notas_actividad na
        JOIN actividad_materia am ON am.id_actividadmateria = na.id_actividadmateria
        WHERE am.id_periodo = $2 AND na.id_estudiante = $1
        GROUP BY am.id_detallegrado, na.id_estudiante
      ) calc ON calc.id_detallegrado = dg.id_detallegrado
      LEFT JOIN escala_valoracion ev 
             ON ev.id_colegio = $3
            AND COALESCE(ra.promedio, calc.promedio_calculado, 0) >= ev.valor_minimo 
            AND COALESCE(ra.promedio, calc.promedio_calculado, 0) <= ev.valor_maximo
      WHERE mat.id_estudiante = $1 AND mat.estado = 'ACTIVA'
      ORDER BY m.nombre ASC
    `, [id_estudiante, id_periodo, id_colegio]);

    // Calculate general average
    const grades = result.rows.map(row => ({
      ...row,
      calificacion: parseFloat(row.calificacion)
    }));
    
    let promedio_general = 0;
    if (grades.length > 0) {
      const sum = grades.reduce((acc, curr) => acc + curr.calificacion, 0);
      promedio_general = sum / grades.length;
    }

    // Get general performance level for the overall average
    const performanceRes = await pool.query(`
      SELECT nivel FROM escala_valoracion 
      WHERE id_colegio = $1 AND $2 >= valor_minimo AND $2 <= valor_maximo
    `, [id_colegio, promedio_general]);

    res.json({
      grades,
      promedio_general: parseFloat(promedio_general.toFixed(2)),
      nivel_desempeno: performanceRes.rows[0]?.nivel || 'N/A'
    });
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ error: 'Error al obtener calificaciones' });
  }
};

/**
 * Gets detailed activity grades for a subject and period
 */
export const getGradeDetails = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo, id_materia } = req.params;
  
  if (id_estudiante === 'undefined' || id_periodo === 'undefined' || id_materia === 'undefined') {
    return res.status(400).json({ error: 'Parámetros inválidos' });
  }

  try {
    const studentIdInt = parseInt(id_estudiante as any);
    const periodIdInt = parseInt(id_periodo as any);
    const materiaIdInt = parseInt(id_materia as any);

    if (isNaN(studentIdInt) || isNaN(periodIdInt) || isNaN(materiaIdInt)) {
      return res.status(400).json({ error: 'Parámetros numéricos inválidos' });
    }

    const result = await pool.query(`
      SELECT 
        am.nombre as actividad,
        am.porcentaje,
        na.nota,
        ce.descripcion as criterio,
        am.id_actividadmateria,
        m.nombre as materia,
        doc.nombre || ' ' || doc.apellido as docente
      FROM actividad_materia am
      JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
      JOIN materias m ON m.id_materia = dg.id_materia
      JOIN docente doc ON doc.id_docente = dg.id_docente
      JOIN matricula mat ON mat.id_grupo = dg.id_grupo
      LEFT JOIN notas_actividad na ON na.id_actividadmateria = am.id_actividadmateria AND na.id_estudiante = mat.id_estudiante
      LEFT JOIN criterio_evaluacion ce ON ce.id_actividadmateria = am.id_actividadmateria
      WHERE m.id_materia = $3 
        AND am.id_periodo = $2 
        AND mat.id_estudiante = $1
        AND mat.estado = 'ACTIVA'
      ORDER BY am.nombre ASC
    `, [studentIdInt, periodIdInt, materiaIdInt]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching grade details:', error);
    res.status(500).json({ error: 'Error al obtener detalle de calificaciones' });
  }
};

/**
 * Gets basic student info
 */
export const getStudentInfo = async (req: Request, res: Response) => {
  const { id_estudiante } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
        e.id_estudiante, 
        e.nombre, 
        e.apellido, 
        e.codigo, 
        tg.nombre as grado, 
        s.nombre as grupo
      FROM estudiante e
      LEFT JOIN matricula m ON m.id_estudiante = e.id_estudiante AND m.estado = 'ACTIVA'
      LEFT JOIN grupos gr ON gr.id_grupo = m.id_grupo
      LEFT JOIN secciones s ON s.id_seccion = gr.id_seccion
      LEFT JOIN tipo_grado tg ON tg.id_tipo_grado = gr.id_tipo_grado
      WHERE e.id_estudiante = $1
      LIMIT 1
    `, [id_estudiante]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student info:', error);
    res.status(500).json({ error: 'Error al obtener información del estudiante' });
  }
};

/**
 * Gets children for a specific parent user
 */
export const getParentChildren = async (req: Request, res: Response) => {
  const { id_usuario } = req.params;
  try {
    const result = await pool.query(`
      SELECT e.id_estudiante, e.nombre, e.apellido, e.codigo,
             tg.nombre as grado, s.nombre as grupo
      FROM padre_familia pf
      JOIN detalle_padrefamilia dpf ON dpf.id_padrefamilia = pf.id_padrefamilia
      JOIN estudiante e ON e.id_estudiante = dpf.id_estudiante
      LEFT JOIN matricula m ON m.id_estudiante = e.id_estudiante AND m.estado = 'ACTIVA'
      LEFT JOIN grupos gr ON gr.id_grupo = m.id_grupo
      LEFT JOIN secciones s ON s.id_seccion = gr.id_seccion
      LEFT JOIN tipo_grado tg ON tg.id_tipo_grado = gr.id_tipo_grado
      WHERE pf.id_usuario = $1
    `, [id_usuario]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching parent children:', error);
    res.status(500).json({ error: 'Error al obtener hijos' });
  }
};

/**
 * Gets student ID from user ID (for logged in students)
 */
export const getStudentIdByUserId = async (req: Request, res: Response) => {
  const { id_usuario } = req.params;
  try {
    const result = await pool.query(
      'SELECT id_estudiante FROM estudiante WHERE id_usuario = $1',
      [id_usuario]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Estudiante no vinculado a este usuario' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching student ID:', error);
    res.status(500).json({ error: 'Error al obtener vinculación de estudiante' });
  }
};
