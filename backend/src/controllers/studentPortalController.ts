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
 * Gets attendance records for a specific student and period
 */
export const getStudentAttendance = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo } = req.params;
  const { id_materia, estado, fecha } = req.query; // Optional filters

  try {
    // 1. Get info about the attendance using a query that handles the period context
    let query = `
      SELECT 
        ra.fecha,
        ra.estado,
        ra.justificacion,
        m.nombre as materia,
        doc.nombre || ' ' || doc.apellido as docente
      FROM registro_asistencia ra
      JOIN detalle_grados dg ON dg.id_detallegrado = ra.id_detallegrado
      JOIN materias m ON m.id_materia = dg.id_materia
      JOIN docente doc ON doc.id_docente = dg.id_docente
      WHERE 
        ra.id_estudiante = $1 
    `;

    const params: any[] = [id_estudiante];
    let paramIndex = 2;

    // Apply period range only if no specific date is provided, or as an additional constraint
    if (!fecha) {
      query += `
        AND ra.fecha >= (
          SELECT (al.calendario || '-' || LPAD(pa.mes_inicio::text, 2, '0') || '-' || LPAD(pa.dia_inicio::text, 2, '0'))::date
          FROM periodo_academico pa
          JOIN "año_lectivo" al ON al."id_año" = pa."id_año"
          WHERE pa.id_periodo = $${paramIndex}
        )
        AND ra.fecha <= (
          SELECT (al.calendario || '-' || LPAD(pa.mes_fin::text, 2, '0') || '-' || LPAD(pa.dia_fin::text, 2, '0'))::date
          FROM periodo_academico pa
          JOIN "año_lectivo" al ON al."id_año" = pa."id_año"
          WHERE pa.id_periodo = $${paramIndex}
        )
      `;
      params.push(id_periodo);
      paramIndex++;
    } else {
      query += ` AND ra.fecha = $${paramIndex}`;
      params.push(fecha);
      paramIndex++;
    }

    if (id_materia && id_materia !== 'all') {
      query += ` AND dg.id_materia = $${paramIndex}`;
      params.push(id_materia);
      paramIndex++;
    }

    if (estado && estado !== 'all') {
      query += ` AND ra.estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    query += ` ORDER BY ra.fecha DESC`;

    const recordsRes = await pool.query(query, params);

    // 2. Calculate statistics (always based on the period, regardless of the list filters)
    const statsQuery = `
      SELECT 
        estado,
        COUNT(*) as count
      FROM registro_asistencia ra
      JOIN detalle_grados dg ON dg.id_detallegrado = ra.id_detallegrado
      WHERE 
        ra.id_estudiante = $1
        AND ra.fecha >= (
          SELECT (al.calendario || '-' || LPAD(pa.mes_inicio::text, 2, '0') || '-' || LPAD(pa.dia_inicio::text, 2, '0'))::date
          FROM periodo_academico pa
          JOIN "año_lectivo" al ON al."id_año" = pa."id_año"
          WHERE pa.id_periodo = $2
        )
        AND ra.fecha <= (
          SELECT (al.calendario || '-' || LPAD(pa.mes_fin::text, 2, '0') || '-' || LPAD(pa.dia_fin::text, 2, '0'))::date
          FROM periodo_academico pa
          JOIN "año_lectivo" al ON al."id_año" = pa."id_año"
          WHERE pa.id_periodo = $2
        )
      GROUP BY estado
    `;

    const statsRes = await pool.query(statsQuery, [id_estudiante, id_periodo]);
    
    const stats: any = {
      PRESENTE: 0,
      AUSENTE: 0,
      TARDE: 0,
      JUSTIFICADA: 0
    };

    statsRes.rows.forEach(row => {
      if (stats.hasOwnProperty(row.estado)) {
        stats[row.estado] = parseInt(row.count);
      }
    });

    res.json({
      records: recordsRes.rows,
      stats
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({ error: 'Error al obtener registros de asistencia' });
  }
};

/**
 * Gets academic observations for a specific student and period
 */
export const getStudentObservations = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo } = req.params;
  const { tipo } = req.query;

  try {
    let query = `
      SELECT 
        oe.id_observacion,
        oe.fortalezas,
        oe.debilidades,
        oe.recomendaciones,
        oe.fecha,
        oe.tipo,
        m.nombre as materia,
        d.nombre || ' ' || d.apellido as docente
      FROM observacion_estudiante oe
      JOIN detalle_grados dg ON dg.id_detallegrado = oe.id_detallegrado
      JOIN materias m ON m.id_materia = dg.id_materia
      JOIN docente d ON d.id_docente = dg.id_docente
      WHERE oe.id_estudiante = $1 AND oe.id_periodo = $2
    `;

    const params: any[] = [id_estudiante, id_periodo];

    if (tipo && tipo !== 'all') {
      query += ` AND oe.tipo = $3`;
      params.push(tipo);
    }

    query += ` ORDER BY m.nombre ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching student observations:', error);
    res.status(500).json({ error: 'Error al obtener las observaciones académicas' });
  }
};

/**
 * Gets a comprehensive summary for the parent dashboard including analytics
 */
export const getParentDashboardData = async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id_usuario as string);
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'ID de usuario inválido' });
  }

  try {
    // 1. Get children basic info and current enrollment
    const childrenRes = await pool.query(`
      SELECT 
        e.id_estudiante, 
        e.nombre, 
        e.apellido, 
        e.codigo,
        tg.nombre as grado, 
        s.nombre as grupo, 
        e.id_colegio,
        m.id_grupo,
        m."id_año"
      FROM padre_familia pf
      JOIN detalle_padrefamilia dpf ON dpf.id_padrefamilia = pf.id_padrefamilia
      JOIN estudiante e ON e.id_estudiante = dpf.id_estudiante
      LEFT JOIN matricula m ON m.id_estudiante = e.id_estudiante AND m.estado = 'ACTIVA'
      LEFT JOIN grupos gr ON gr.id_grupo = m.id_grupo
      LEFT JOIN secciones s ON s.id_seccion = gr.id_seccion
      LEFT JOIN tipo_grado tg ON tg.id_tipo_grado = gr.id_tipo_grado
      WHERE pf.id_usuario = $1
    `, [userId]);

    const children = childrenRes.rows;
    if (children.length === 0) {
      return res.json({ 
        children: [], 
        studentStats: [], 
        recentActivity: [], 
        activePeriod: null,
        periods: [] 
      });
    }

    const id_colegio = children[0].id_colegio;

    // 2. Get all available periods for the picker
    const allPeriodsRes = await pool.query(`
      SELECT 
        pa.id_periodo, pa.nombre, pa.trimestre, pa.estado,
        (al.calendario || '-' || lpad(pa.mes_inicio::text, 2, '0') || '-' || lpad(pa.dia_inicio::text, 2, '0'))::date as fecha_inicio,
        (al.calendario || '-' || lpad(pa.mes_fin::text, 2, '0') || '-' || lpad(pa.dia_fin::text, 2, '0'))::date as fecha_fin
      FROM periodo_academico pa
      JOIN "año_lectivo" al ON al."id_año" = pa."id_año"
      WHERE pa.id_colegio = $1 
      ORDER BY pa.trimestre ASC
    `, [id_colegio]);
    const periods = allPeriodsRes.rows;

    // 3. Determine active period (either from query or auto-detected)
    let id_periodo = req.query.id_periodo ? parseInt(req.query.id_periodo as string) : null;
    let activePeriod = null;

    if (id_periodo) {
      activePeriod = periods.find(p => p.id_periodo === id_periodo);
    }

    if (!activePeriod) {
      // Periodo ABIERTO
      activePeriod = periods.find(p => p.estado === 'ABIERTO');
      
      // Fallback a último CERRADO si no hay abierto
      if (!activePeriod && periods.length > 0) {
        activePeriod = periods[periods.length - 1];
      }
      
      id_periodo = activePeriod?.id_periodo;
    }

    // 4. Aggregate stats per child
    // This is complex, we'll do some loops for clarity or a very long query.
    // Let's do a combined stats query for efficiency.
    
    const statsPromises = children.map(async (child) => {
      // Average and At Risk
      const gradesRes = await pool.query(`
        SELECT 
          m.nombre as materia,
          COALESCE(ra.promedio, calc.promedio_calculado, 0) as calificacion
        FROM detalle_grados dg
        JOIN materias m ON m.id_materia = dg.id_materia
        LEFT JOIN resultado_academico ra ON ra.id_detallegrado = dg.id_detallegrado AND ra.id_periodo = $2 AND ra.id_estudiante = $1
        LEFT JOIN (
          SELECT am.id_detallegrado, na.id_estudiante, ROUND(AVG(na.nota)::numeric, 2) as promedio_calculado
          FROM notas_actividad na
          JOIN actividad_materia am ON am.id_actividadmateria = na.id_actividadmateria
          WHERE am.id_periodo = $2 AND na.id_estudiante = $1
          GROUP BY am.id_detallegrado, na.id_estudiante
        ) calc ON calc.id_detallegrado = dg.id_detallegrado
        WHERE dg.id_grupo = $3
      `, [child.id_estudiante, id_periodo, child.id_grupo]);

      const grades = gradesRes.rows.map(r => ({ ...r, calificacion: parseFloat(r.calificacion) }));
      const avg = grades.length > 0 ? (grades.reduce((a, b) => a + b.calificacion, 0) / grades.length) : 0;
      const atRisk = grades.filter(g => g.calificacion < 3.0 && g.calificacion > 0);

      // Attendance Filtered by Period Dates
      const attRes = await pool.query(`
        SELECT 
          COUNT(*) filter (where estado = 'PRESENTE') as presentes,
          COUNT(*) filter (where estado = 'AUSENTE') as ausentes,
          COUNT(*) filter (where estado = 'TARDE') as tardes,
          COUNT(*) as total
        FROM registro_asistencia
        WHERE id_estudiante = $1 AND id_colegio = $2
        AND fecha BETWEEN $3 AND $4
      `, [child.id_estudiante, id_colegio, activePeriod.fecha_inicio, activePeriod.fecha_fin]);
      
      const attStats = attRes.rows[0];
      const attRate = attStats.total > 0 ? (parseInt(attStats.presentes) / parseInt(attStats.total)) * 100 : 100;

      // Pending Activities (simplified: activities in current period without grade in notas_actividad)
      const pendingRes = await pool.query(`
        SELECT COUNT(*) as count
        FROM actividad_materia am
        JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
        LEFT JOIN notas_actividad na ON na.id_actividadmateria = am.id_actividadmateria AND na.id_estudiante = $1
        WHERE dg.id_grupo = $2 AND am.id_periodo = $3 AND na.nota IS NULL
      `, [child.id_estudiante, child.id_grupo, id_periodo]);

      // Evolution (by period)
      const evolutionRes = await pool.query(`
        SELECT pa.nombre as periodo, ROUND(AVG(ra.promedio)::numeric, 2) as promedio
        FROM resultado_academico ra
        JOIN periodo_academico pa ON pa.id_periodo = ra.id_periodo
        WHERE ra.id_estudiante = $1 AND pa."id_año" = $2
        GROUP BY pa.id_periodo, pa.nombre, pa.trimestre
        ORDER BY pa.trimestre ASC
      `, [child.id_estudiante, child.id_año]);

      return {
        id_estudiante: child.id_estudiante,
        average: parseFloat(avg.toFixed(2)),
        atRisk: atRisk.length,
        atRiskSubjects: atRisk.map(s => s.materia),
        attendanceRate: Math.round(attRate),
        pendingActivities: parseInt(pendingRes.rows[0].count),
        evolution: evolutionRes.rows,
        attendanceDetails: {
          presentes: parseInt(attStats.presentes),
          ausentes: parseInt(attStats.ausentes),
          tardes: parseInt(attStats.tardes),
          total: parseInt(attStats.total)
        }
      };
    });

    console.log(`[Dashboard] Found ${children.length} children, using id_periodo: ${id_periodo}`);
    const studentStats = await Promise.all(statsPromises);
    console.log(`[Dashboard] Calculated stats for ${studentStats.length} students`);

    // 4. Recent Activity (Already implemented, just use studentIds)
    const studentIds = children.map(c => c.id_estudiante);
    const recentActivityRes = await pool.query(`
      (
        SELECT 
          'CALIFICACION' as tipo_actividad,
          m.nombre as materia,
          am.nombre as detalle,
          na.nota::text as valor,
          NULL::date as fecha,
          e.nombre || ' ' || e.apellido as estudiante
        FROM notas_actividad na
        JOIN actividad_materia am ON am.id_actividadmateria = na.id_actividadmateria
        JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
        JOIN materias m ON m.id_materia = dg.id_materia
        JOIN estudiante e ON e.id_estudiante = na.id_estudiante
        WHERE na.id_estudiante = ANY($1)
      )
      UNION ALL
      (
        SELECT 
          'OBSERVACION' as tipo_actividad,
          m.nombre as materia,
          oe.tipo as detalle,
          oe.id_observacion::text as valor,
          oe.fecha as fecha,
          e.nombre || ' ' || e.apellido as estudiante
        FROM observacion_estudiante oe
        JOIN detalle_grados dg ON dg.id_detallegrado = oe.id_detallegrado
        JOIN materias m ON m.id_materia = dg.id_materia
        JOIN estudiante e ON e.id_estudiante = oe.id_estudiante
        WHERE oe.id_estudiante = ANY($1)
      )
      ORDER BY fecha DESC
      LIMIT 10
    `, [studentIds]);

    res.json({
      children,
      studentStats,
      recentActivity: recentActivityRes.rows,
      activePeriod,
      periods
    });
  } catch (error) {
    console.error('Error fetching parent dashboard data:', error);
    // Return empty structure instead of just error to prevent frontend crash
    res.status(500).json({ 
      error: 'Error al obtener datos del dashboard',
      children: [],
      studentStats: [],
      recentActivity: [],
      activePeriod: null,
      periods: []
    });
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
