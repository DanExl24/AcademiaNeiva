import { Request, Response } from 'express';
import { pool } from '../config/db';

/**
 * Gets closed academic years for a specific student's school
 */
export const getStudentAcademicYears = async (req: Request, res: Response) => {
  const { id_estudiante } = req.params;
  try {
    const result = await pool.query(`
      SELECT DISTINCT al.id_anio, al.calendario
      FROM anio_lectivo al
      JOIN estudiante e ON e.id_colegio = al.id_colegio
      WHERE e.id_estudiante = $1
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
      WHERE e.id_estudiante = $1 AND p.id_anio = $2 AND p.estado = 'CERRADO'
      ORDER BY p.trimestre ASC
    `, [id_estudiante, id_anio]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching closed periods:', error);
    res.status(500).json({ error: 'Error al obtener periodos cerrados' });
  }
};

/**
 * Gets all periods (open and closed) for a specific student and academic year
 */
export const getStudentAllPeriods = async (req: Request, res: Response) => {
  const { id_estudiante, id_anio } = req.params;
  try {
    const result = await pool.query(`
      SELECT p.id_periodo, p.nombre, p.trimestre, p.porcentaje, p.estado
      FROM periodo_academico p
      JOIN estudiante e ON e.id_colegio = p.id_colegio
      WHERE e.id_estudiante = $1 AND p.id_anio = $2 AND p.estado != 'PENDIENTE'
      ORDER BY p.trimestre ASC
    `, [id_estudiante, id_anio]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all periods:', error);
    res.status(500).json({ error: 'Error al obtener todos los periodos' });
  }
};

/**
 * Gets grades for a specific student and closed period
 */
export const getStudentGrades = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo } = req.params;
  try {
    // 1. Verify period exists and is not pending
    const periodCheck = await pool.query(
      'SELECT estado, id_colegio FROM periodo_academico WHERE id_periodo = $1',
      [id_periodo]
    );
    if (!periodCheck.rows.length || periodCheck.rows[0].estado === 'PENDIENTE') {
      return res.status(400).json({ error: 'El periodo seleccionado no está disponible' });
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
    // Auto-expire sanctions
    await pool.query(`
      UPDATE public.sancion SET estado = 'VENCIDA' WHERE estado = 'ACTIVA' AND fecha_fin < CURRENT_DATE
    `);
    await pool.query(`
      UPDATE public.estudiante 
      SET estado = 'ACTIVO' 
      WHERE estado = 'SANCIONADO' 
        AND id_estudiante NOT IN (SELECT id_estudiante FROM public.sancion WHERE estado = 'ACTIVA')
    `);

    const result = await pool.query(`
      SELECT 
        e.id_estudiante, 
        e.nombre, 
        e.apellido, 
        e.codigo, 
        e.estado,
        tg.nombre as grado, 
        s.nombre as grupo,
        sanc.fecha_fin as sancion_hasta,
        sanc.motivo as sancion_motivo,
        sanc.tipo_nombre as sancion_tipo
      FROM estudiante e
      LEFT JOIN matricula m ON m.id_estudiante = e.id_estudiante AND m.estado = 'ACTIVA'
      LEFT JOIN grupos gr ON gr.id_grupo = m.id_grupo
      LEFT JOIN secciones s ON s.id_seccion = gr.id_seccion
      LEFT JOIN tipo_grado tg ON tg.id_tipo_grado = gr.id_tipo_grado
      LEFT JOIN LATERAL (
        SELECT sa.fecha_fin, sa.motivo, ts.nombre as tipo_nombre
        FROM public.sancion sa
        JOIN public.tipo_sancion ts ON sa.id_tipo_sancion = ts.id_tipo_sancion
        WHERE sa.id_estudiante = e.id_estudiante
          AND sa.estado = 'ACTIVA'
          AND CURRENT_DATE BETWEEN sa.fecha_inicio AND sa.fecha_fin
        ORDER BY sa.fecha_fin DESC
        LIMIT 1
      ) sanc ON TRUE
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
             tg.nombre as grado, s.nombre as grupo, dpf.id_colegio, col.nombre as colegio_nombre
      FROM padre_familia pf
      JOIN detalle_padrefamilia dpf ON dpf.id_padrefamilia = pf.id_padrefamilia
      JOIN estudiante e ON e.id_estudiante = dpf.id_estudiante
      LEFT JOIN colegio col ON col.id_colegio = dpf.id_colegio
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
    const params: any[] = [id_estudiante];
    let paramIndex = 2;
    let filterClauses = '';

    // Standard Period filter (used unless a specific date is provided)
    if (fecha) {
      filterClauses += ` AND ra.fecha = $${paramIndex}`;
      params.push(fecha);
      paramIndex++;
    } else {
      filterClauses += `
        AND ra.fecha >= (
          SELECT (al.calendario || '-' || LPAD(pa.mes_inicio::text, 2, '0') || '-' || LPAD(pa.dia_inicio::text, 2, '0'))::date
          FROM periodo_academico pa
          JOIN anio_lectivo al ON al.id_anio = pa.id_anio
          WHERE pa.id_periodo = $${paramIndex}
        )
        AND ra.fecha <= (
          SELECT (al.calendario || '-' || LPAD(pa.mes_fin::text, 2, '0') || '-' || LPAD(pa.dia_fin::text, 2, '0'))::date
          FROM periodo_academico pa
          JOIN anio_lectivo al ON al.id_anio = pa.id_anio
          WHERE pa.id_periodo = $${paramIndex}
        )
      `;
      params.push(id_periodo);
      paramIndex++;
    }

    // Optional dynamic filters
    if (id_materia && id_materia !== 'all') {
      filterClauses += ` AND dg.id_materia = $${paramIndex}`;
      params.push(id_materia);
      paramIndex++;
    }

    if (estado && estado !== 'all') {
      filterClauses += ` AND ra.estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    // 1. Fetch filtered records
    const recordsQuery = `
      SELECT 
        ra.fecha,
        ra.estado,
        ra.justificacion,
        TO_CHAR(ra.hora_llegada, 'HH24:MI') as hora_llegada,
        m.nombre as materia,
        doc.nombre || ' ' || doc.apellido as docente
      FROM registro_asistencia ra
      JOIN detalle_grados dg ON dg.id_detallegrado = ra.id_detallegrado
      JOIN materias m ON m.id_materia = dg.id_materia
      JOIN docente doc ON doc.id_docente = dg.id_docente
      WHERE ra.id_estudiante = $1 ${filterClauses}
      ORDER BY ra.fecha DESC
    `;
    const recordsRes = await pool.query(recordsQuery, params);

    // 2. Calculate filtered statistics
    const statsQuery = `
      SELECT 
        estado,
        COUNT(*) as count
      FROM registro_asistencia ra
      JOIN detalle_grados dg ON dg.id_detallegrado = ra.id_detallegrado
      WHERE ra.id_estudiante = $1 ${filterClauses}
      GROUP BY estado
    `;
    const statsRes = await pool.query(statsQuery, params);
    
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
      let targetTipo = tipo;
      if (tipo === 'CONVIVENCIAL') {
        targetTipo = 'CONVIVENCIA';
      }
      query += ` AND oe.tipo = $3`;
      params.push(targetTipo);
    }

    query += ` ORDER BY m.nombre ASC`;

    const result = await pool.query(query, params);
    const mappedRows = result.rows.map(row => ({
      ...row,
      tipo: row.tipo === 'CONVIVENCIA' ? 'CONVIVENCIAL' : row.tipo
    }));
    res.json(mappedRows);
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
        m.id_anio
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

    const schoolId = req.query.id_colegio ? parseInt(req.query.id_colegio as string) : children[0].id_colegio;
    const filteredChildren = children.filter(c => c.id_colegio === schoolId);

    if (filteredChildren.length === 0) {
      return res.json({ 
        children, 
        studentStats: [], 
        recentActivity: [], 
        activePeriod: null,
        periods: [] 
      });
    }

    // 2. Get all available periods for the picker for the selected school
    const allPeriodsRes = await pool.query(`
      SELECT 
        pa.id_periodo, pa.nombre, pa.trimestre, pa.estado,
        (al.calendario || '-' || lpad(pa.mes_inicio::text, 2, '0') || '-' || lpad(pa.dia_inicio::text, 2, '0'))::date as fecha_inicio,
        (al.calendario || '-' || lpad(pa.mes_fin::text, 2, '0') || '-' || lpad(pa.dia_fin::text, 2, '0'))::date as fecha_fin
      FROM periodo_academico pa
      JOIN anio_lectivo al ON al.id_anio = pa.id_anio
      WHERE pa.id_colegio = $1 AND pa.estado != 'PENDIENTE'
      ORDER BY pa.trimestre ASC
    `, [schoolId]);
    const periods = allPeriodsRes.rows;

    // 3. Determine active period (either from query or auto-detected)
    let id_periodo: number | null = null;
    let activePeriod = null;
    const periodQuery = req.query.id_periodo as string;

    if (periodQuery === 'all') {
      id_periodo = null;
      activePeriod = null;
    } else {
      id_periodo = periodQuery ? parseInt(periodQuery) : null;
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
        
        id_periodo = activePeriod?.id_periodo || null;
      }
    }

    // 4. Aggregate stats per child (only for the selected school)
    const statsPromises = filteredChildren.map(async (child) => {
      // Average and At Risk
      let gradesRes;
      if (id_periodo) {
        gradesRes = await pool.query(`
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
      } else {
        // Mode "Todos los periodos": calculate accumulative average for all activities in the current academic year
        gradesRes = await pool.query(`
          SELECT 
            m.nombre as materia,
            COALESCE(calc.promedio_calculado, 0) as calificacion
          FROM detalle_grados dg
          JOIN materias m ON m.id_materia = dg.id_materia
          LEFT JOIN (
            SELECT am.id_detallegrado, na.id_estudiante, ROUND(AVG(na.nota)::numeric, 2) as promedio_calculado
            FROM notas_actividad na
            JOIN actividad_materia am ON am.id_actividadmateria = na.id_actividadmateria
            JOIN periodo_academico pa ON pa.id_periodo = am.id_periodo
            WHERE pa.id_anio = $2 AND na.id_estudiante = $1 AND pa.estado != 'PENDIENTE'
            GROUP BY am.id_detallegrado, na.id_estudiante
          ) calc ON calc.id_detallegrado = dg.id_detallegrado
          WHERE dg.id_grupo = $3
        `, [child.id_estudiante, child.id_anio, child.id_grupo]);
      }

      const grades = gradesRes.rows.map(r => ({ ...r, calificacion: parseFloat(r.calificacion) }));
      const avg = grades.length > 0 ? (grades.reduce((a, b) => a + b.calificacion, 0) / grades.length) : 0;
      const atRisk = grades.filter(g => g.calificacion < 3.0 && g.calificacion > 0);

      // Attendance Filtered by Period Dates or overall academic year
      let attRes;
      if (id_periodo && activePeriod) {
        attRes = await pool.query(`
          SELECT 
            COUNT(*) filter (where estado = 'PRESENTE') as presentes,
            COUNT(*) filter (where estado = 'AUSENTE') as ausentes,
            COUNT(*) filter (where estado = 'TARDE') as tardes,
            COUNT(*) as total
          FROM registro_asistencia
          WHERE id_estudiante = $1 AND id_colegio = $2
          AND fecha BETWEEN $3 AND $4
        `, [child.id_estudiante, child.id_colegio, activePeriod.fecha_inicio, activePeriod.fecha_fin]);
      } else {
        // Without period date bounds (takes all year attendance for the student)
        attRes = await pool.query(`
          SELECT 
            COUNT(*) filter (where estado = 'PRESENTE') as presentes,
            COUNT(*) filter (where estado = 'AUSENTE') as ausentes,
            COUNT(*) filter (where estado = 'TARDE') as tardes,
            COUNT(*) as total
          FROM registro_asistencia
          WHERE id_estudiante = $1 AND id_colegio = $2
        `, [child.id_estudiante, child.id_colegio]);
      }
      
      const attStats = attRes.rows[0];
      const attRate = attStats.total > 0 ? (parseInt(attStats.presentes) / parseInt(attStats.total)) * 100 : 100;

      // Pending Activities
      let pendingRes;
      if (id_periodo) {
        pendingRes = await pool.query(`
          SELECT COUNT(*) as count
          FROM actividad_materia am
          JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
          LEFT JOIN notas_actividad na ON na.id_actividadmateria = am.id_actividadmateria AND na.id_estudiante = $1
          WHERE dg.id_grupo = $2 AND am.id_periodo = $3 AND na.nota IS NULL
        `, [child.id_estudiante, child.id_grupo, id_periodo]);
      } else {
        pendingRes = await pool.query(`
          SELECT COUNT(*) as count
          FROM actividad_materia am
          JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
          JOIN periodo_academico pa ON pa.id_periodo = am.id_periodo
          LEFT JOIN notas_actividad na ON na.id_actividadmateria = am.id_actividadmateria AND na.id_estudiante = $1
          WHERE dg.id_grupo = $2 AND pa.id_anio = $3 AND pa.estado != 'PENDIENTE' AND na.nota IS NULL
        `, [child.id_estudiante, child.id_grupo, child.id_anio]);
      }

      // Evolution (by period)
      const evolutionRes = await pool.query(`
        SELECT pa.nombre as periodo, ROUND(AVG(ra.promedio)::numeric, 2) as promedio
        FROM resultado_academico ra
        JOIN periodo_academico pa ON pa.id_periodo = ra.id_periodo
        WHERE ra.id_estudiante = $1 AND pa.id_anio = $2
        GROUP BY pa.id_periodo, pa.nombre, pa.trimestre
        ORDER BY pa.trimestre ASC
      `, [child.id_estudiante, child.id_anio]);

      // Sort to get top best and worst subjects
      const sortedGrades = [...grades].sort((a, b) => b.calificacion - a.calificacion);
      const top_materias_mejores = sortedGrades.slice(0, 5);
      const top_materias_peores = [...sortedGrades].reverse().slice(0, 5);

      return {
        id_estudiante: child.id_estudiante,
        average: parseFloat(avg.toFixed(2)),
        atRisk: atRisk.length,
        atRiskSubjects: atRisk.map(s => s.materia),
        attendanceRate: Math.round(attRate),
        pendingActivities: parseInt(pendingRes.rows[0].count),
        evolution: evolutionRes.rows,
        grades,
        top_materias_mejores,
        top_materias_peores,
        attendanceDetails: {
          presentes: parseInt(attStats.presentes || 0),
          ausentes: parseInt(attStats.ausentes || 0),
          tardes: parseInt(attStats.tardes || 0),
          total: parseInt(attStats.total || 0)
        }
      };
    });

    console.log(`[Dashboard] Found ${children.length} children, using id_periodo: ${id_periodo}`);
    const studentStats = await Promise.all(statsPromises);
    console.log(`[Dashboard] Calculated stats for ${studentStats.length} students`);

    // 5. Recent Activity (use filtered studentIds)
    const studentIds = filteredChildren.map(c => c.id_estudiante);
    let recentActivityRes;
    if (id_periodo) {
      recentActivityRes = await pool.query(`
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
          WHERE na.id_estudiante = ANY($1) AND am.id_periodo = $2
        )
        UNION ALL
        (
          SELECT 
            'OBSERVACION' as tipo_actividad,
            m.nombre as materia,
            oe.tipo::text as detalle,
            oe.id_observacion::text as valor,
            oe.fecha as fecha,
            e.nombre || ' ' || e.apellido as estudiante
          FROM observacion_estudiante oe
          JOIN detalle_grados dg ON dg.id_detallegrado = oe.id_detallegrado
          JOIN materias m ON m.id_materia = dg.id_materia
          JOIN estudiante e ON e.id_estudiante = oe.id_estudiante
          WHERE oe.id_estudiante = ANY($1) AND oe.id_periodo = $2
        )
        ORDER BY fecha DESC
        LIMIT 10
      `, [studentIds, id_periodo]);
    } else {
      recentActivityRes = await pool.query(`
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
            oe.tipo::text as detalle,
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
    }

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

/**
 * Gets aggregated dashboard statistics for a specific student and period
 */
export const getStudentDashboardStats = async (req: Request, res: Response) => {
  const { id_estudiante, id_periodo } = req.params;

  try {
    const studentIdInt = parseInt(id_estudiante as string);
    const periodIdInt = parseInt(id_periodo as string);

    if (isNaN(studentIdInt) || isNaN(periodIdInt)) {
      return res.status(400).json({ error: 'Parámetros numéricos inválidos' });
    }

    // 1. Get student basic info and group
    const studentCheck = await pool.query(`
      SELECT e.id_estudiante, e.id_colegio, m.id_grupo
      FROM estudiante e
      LEFT JOIN matricula m ON m.id_estudiante = e.id_estudiante AND m.estado = 'ACTIVA'
      WHERE e.id_estudiante = $1
      LIMIT 1
    `, [studentIdInt]);

    if (!studentCheck.rows.length) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const { id_colegio, id_grupo } = studentCheck.rows[0];

    // Get school grading approval limit
    const configRes = await pool.query(
      'SELECT nota_aprobacion FROM configuracion_colegio WHERE id_colegio = $1',
      [id_colegio]
    );
    const nota_aprobacion = configRes.rows.length ? parseFloat(configRes.rows[0].nota_aprobacion) : 3.0;

    // 2. Fetch all student subjects and their grades for this period
    const gradesRes = await pool.query(`
      SELECT 
        m.id_materia,
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
      ORDER BY m.nombre ASC
    `, [studentIdInt, periodIdInt, id_grupo]);

    const grades = gradesRes.rows.map(row => ({
      id_materia: row.id_materia,
      materia: row.materia,
      calificacion: parseFloat(row.calificacion)
    }));

    // Check if any actual grades or results exist in the database for this period and student
    const notesCountRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM notas_actividad na
      JOIN actividad_materia am ON am.id_actividadmateria = na.id_actividadmateria
      WHERE am.id_periodo = $1 AND na.id_estudiante = $2
    `, [periodIdInt, studentIdInt]);
    
    const resultsCountRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM resultado_academico
      WHERE id_periodo = $1 AND id_estudiante = $2
    `, [periodIdInt, studentIdInt]);
    
    const has_calificaciones = parseInt(notesCountRes.rows[0].count) > 0 || parseInt(resultsCountRes.rows[0].count) > 0;

    // Calculate grades aggregates
    let promedio_general = null;
    let materias_aprobadas: number | null = null;
    let materias_reprobadas: number | null = null;

    if (has_calificaciones && grades.length > 0) {
      const sum = grades.reduce((acc, curr) => acc + curr.calificacion, 0);
      promedio_general = sum / grades.length;
      
      let aprobadas = 0;
      let reprobadas = 0;
      grades.forEach(g => {
        if (g.calificacion >= nota_aprobacion) {
          aprobadas++;
        } else {
          reprobadas++;
        }
      });
      materias_aprobadas = aprobadas;
      materias_reprobadas = reprobadas;
    }

    // Sort to get top best and worst subjects
    const sortedGrades = [...grades].sort((a, b) => b.calificacion - a.calificacion);
    const top_materias_mejores = sortedGrades.slice(0, 5);
    const top_materias_peores = [...sortedGrades].reverse().slice(0, 5);

    // 3. Attendance statistics
    const attendanceRes = await pool.query(`
      SELECT 
        estado,
        COUNT(*) as count
      FROM registro_asistencia ra
      JOIN detalle_grados dg ON dg.id_detallegrado = ra.id_detallegrado
      WHERE ra.id_estudiante = $1
        AND ra.fecha >= (
          SELECT (al.calendario || '-' || LPAD(pa.mes_inicio::text, 2, '0') || '-' || LPAD(pa.dia_inicio::text, 2, '0'))::date
          FROM periodo_academico pa
          JOIN anio_lectivo al ON al.id_anio = pa.id_anio
          WHERE pa.id_periodo = $2
        )
        AND ra.fecha <= (
          SELECT (al.calendario || '-' || LPAD(pa.mes_fin::text, 2, '0') || '-' || LPAD(pa.dia_fin::text, 2, '0'))::date
          FROM periodo_academico pa
          JOIN anio_lectivo al ON al.id_anio = pa.id_anio
          WHERE pa.id_periodo = $2
        )
      GROUP BY estado
    `, [studentIdInt, periodIdInt]);

    const attCounts: any = { PRESENTE: 0, AUSENTE: 0, TARDE: 0, JUSTIFICADA: 0 };
    let attendance_total = 0;

    attendanceRes.rows.forEach(row => {
      if (attCounts.hasOwnProperty(row.estado)) {
        const count = parseInt(row.count);
        attCounts[row.estado] = count;
        attendance_total += count;
      }
    });

    const inasistencias_total = attCounts.AUSENTE;
    const has_asistencia = attendance_total > 0;
    const asistencia_porcentaje = has_asistencia
      ? Math.round(((attendance_total - inasistencias_total) / attendance_total) * 100)
      : null;

    // 4. Observations count by type
    const observationsRes = await pool.query(`
      SELECT tipo, COUNT(*) as count
      FROM observacion_estudiante
      WHERE id_estudiante = $1 AND id_periodo = $2
      GROUP BY tipo
    `, [studentIdInt, periodIdInt]);

    const reportes_conteo = {
      ACADEMICA: 0,
      DISCIPLINARIA: 0,
      CONVIVENCIAL: 0
    };

    observationsRes.rows.forEach(row => {
      if (row.tipo === 'ACADEMICA') {
        reportes_conteo.ACADEMICA = parseInt(row.count);
      } else if (row.tipo === 'CONVIVENCIA') {
        reportes_conteo.CONVIVENCIAL = parseInt(row.count);
      } else if (row.tipo === 'DISCIPLINARIA') {
        reportes_conteo.DISCIPLINARIA = parseInt(row.count);
      }
    });

    // 5. Recent activities
    const activitiesRes = await pool.query(`
      SELECT 
        am.nombre as actividad,
        am.porcentaje,
        m.nombre as materia,
        (CASE WHEN na.nota IS NOT NULL THEN true ELSE false END) as calificada,
        na.nota
      FROM actividad_materia am
      JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
      JOIN materias m ON m.id_materia = dg.id_materia
      LEFT JOIN notas_actividad na ON na.id_actividadmateria = am.id_actividadmateria AND na.id_estudiante = $1
      WHERE dg.id_grupo = $2 AND am.id_periodo = $3
      ORDER BY am.id_actividadmateria DESC
      LIMIT 5
    `, [studentIdInt, id_grupo, periodIdInt]);

    const actividades_recientes = activitiesRes.rows.map(row => ({
      actividad: row.actividad,
      porcentaje: parseFloat(row.porcentaje),
      materia: row.materia,
      calificada: row.calificada,
      nota: row.nota ? parseFloat(row.nota) : null
    }));

    // 6. Student ranking / academic position in group
    let puesto = null;
    let total_estudiantes = 0;

    if (id_grupo) {
      const rankingRes = await pool.query(`
        WITH promedios_estudiantes AS (
          SELECT 
            mat.id_estudiante,
            ROUND(AVG(COALESCE(ra.promedio, calc.promedio_calculado, 0))::numeric, 2) as promedio_general
          FROM matricula mat
          JOIN detalle_grados dg ON dg.id_grupo = mat.id_grupo
          LEFT JOIN resultado_academico ra ON ra.id_detallegrado = dg.id_detallegrado AND ra.id_periodo = $2 AND ra.id_estudiante = mat.id_estudiante
          LEFT JOIN (
            SELECT am.id_detallegrado, na.id_estudiante, AVG(na.nota) as promedio_calculado
            FROM notas_actividad na
            JOIN actividad_materia am ON am.id_actividadmateria = na.id_actividadmateria
            WHERE am.id_periodo = $2
            GROUP BY am.id_detallegrado, na.id_estudiante
          ) calc ON calc.id_detallegrado = dg.id_detallegrado AND calc.id_estudiante = mat.id_estudiante
          WHERE mat.id_grupo = $1 AND mat.estado = 'ACTIVA'
          GROUP BY mat.id_estudiante
        ),
        ranking_estudiantes AS (
          SELECT 
            id_estudiante,
            promedio_general,
            RANK() OVER (ORDER BY promedio_general DESC) as puesto,
            COUNT(*) OVER () as total_estudiantes
          FROM promedios_estudiantes
        )
        SELECT puesto, total_estudiantes
        FROM ranking_estudiantes
        WHERE id_estudiante = $3
      `, [id_grupo, periodIdInt, studentIdInt]);

      if (rankingRes.rows.length) {
        puesto = parseInt(rankingRes.rows[0].puesto);
        total_estudiantes = parseInt(rankingRes.rows[0].total_estudiantes);
      }
    }

    res.json({
      promedio_general: (has_calificaciones && promedio_general !== null) ? parseFloat(promedio_general.toFixed(2)) : null,
      materias_aprobadas,
      materias_reprobadas,
      asistencia_porcentaje,
      inasistencias_total: has_asistencia ? inasistencias_total : null,
      reportes_conteo,
      top_materias_mejores: has_calificaciones ? top_materias_mejores : [],
      top_materias_peores: has_calificaciones ? top_materias_peores : [],
      actividades_recientes,
      puesto_academico: (has_calificaciones && puesto) ? { puesto, total_estudiantes } : null,
      has_calificaciones,
      has_asistencia
    });

  } catch (error) {
    console.error('Error fetching student dashboard stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas del estudiante' });
  }
};
