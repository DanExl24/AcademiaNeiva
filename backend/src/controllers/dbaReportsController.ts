import { Request, Response } from "express";
import { pool } from "../config/db";

// Helper to parse schoolId
const parseSchoolId = (val: any): number => {
  const id = Number(val);
  return Number.isNaN(id) ? 0 : id;
};

// ============================================================================
// 1. REPORTE DE COHERENCIA CURRICULAR (PLANEADO VS REAL)
// ============================================================================
export const obtenerReporteCoherenciaCurricular = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  const { id_anio, id_periodo, id_grupo, id_materia, id_docente } = req.query;

  if (!schoolId) {
    res.status(400).json({ error: "El ID de colegio es obligatorio" });
    return;
  }

  try {
    let query = `
      SELECT 
        am.id_actividadmateria,
        am.nombre AS actividad_nombre,
        am.porcentaje AS actividad_porcentaje,
        am.fecha_creacion AS actividad_fecha,
        c.id_competencia,
        c.descripcion AS competencia_descripcion,
        c.nombre AS competencia_nombre,
        p.id_periodo,
        p.nombre AS periodo_nombre,
        g.id_grupo,
        ne.nombre || ' - ' || tg.nombre || ' (' || s.nombre || ')' AS grupo_nombre,
        m.id_materia,
        m.nombre AS materia_nombre,
        d.id_docente,
        u.nombre || ' ' || u.apellido AS docente_nombre,
        edba.id_evidencia_dba,
        edba.descripcion AS evidencia_descripcion,
        edba.orden AS evidencia_orden,
        dba.id_dba,
        dba.numero_dba,
        dba.enunciado AS dba_enunciado,
        CASE 
          WHEN EXISTS (
            SELECT 1 
            FROM evidencia_aprendizaje ea
            WHERE ea.id_competencia = am.id_competencia 
              AND ea.id_evidencia_dba = aedba.id_evidencia_dba
          ) THEN 'PLANEADA'
          ELSE 'EXTRA'
        END AS estado_coherencia
      FROM actividad_evidencia_dba aedba
      JOIN actividad_materia am ON am.id_actividadmateria = aedba.id_actividadmateria
      JOIN competencias c ON c.id_competencia = am.id_competencia
      JOIN periodo_academico p ON p.id_periodo = c.id_periodo
      JOIN grupos g ON g.id_grupo = c.id_grupo
      JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
      JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
      JOIN secciones s ON s.id_seccion = g.id_seccion
      JOIN materias m ON m.id_materia = c.id_materia
      LEFT JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
      LEFT JOIN docente d ON d.id_docente = dg.id_docente
      LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
      WHERE c.id_colegio = $1
    `;

    const params: any[] = [schoolId];

    if (id_anio) {
      params.push(Number(id_anio));
      query += ` AND c.id_año = $${params.length}`;
    }

    if (id_periodo && id_periodo !== "TODOS") {
      params.push(Number(id_periodo));
      query += ` AND c.id_periodo = $${params.length}`;
    }

    if (id_grupo && id_grupo !== "TODOS") {
      params.push(Number(id_grupo));
      query += ` AND g.id_grupo = $${params.length}`;
    }

    if (id_materia && id_materia !== "TODOS") {
      params.push(Number(id_materia));
      query += ` AND c.id_materia = $${params.length}`;
    }

    if (id_docente && id_docente !== "TODOS") {
      params.push(Number(id_docente));
      query += ` AND d.id_docente = $${params.length}`;
    }

    query += ` ORDER BY p.id_periodo ASC, grupo_nombre ASC, m.nombre ASC, am.id_actividadmateria ASC, edba.orden ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error al obtener reporte de coherencia curricular:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// ============================================================================
// 2. REPORTE DE COBERTURA DE DBA (KPI'S Y LISTADO)
// ============================================================================
export const obtenerReporteCoberturaDba = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  const { id_periodo, id_materia, id_grupo } = req.query;

  if (!schoolId) {
    res.status(400).json({ error: "El ID de colegio es obligatorio" });
    return;
  }

  try {
    // 1. Obtener resumen de cobertura por Área y Grado
    let summaryQuery = `
      SELECT 
        cvc.area,
        cvc.grado,
        cvc.version_curricular,
        COUNT(DISTINCT edba.id_evidencia_dba)::int AS total_evidencias,
        COUNT(DISTINCT CASE WHEN aedba.id_evidencia_dba IS NOT NULL THEN edba.id_evidencia_dba END)::int AS evidencias_evaluadas
      FROM colegio_version_curricular cvc
      JOIN dba d ON d.area = cvc.area AND d.grado = cvc.grado AND d.version_curricular = cvc.version_curricular AND d.estado = 'ACTIVO'
      JOIN evidencias_dba edba ON edba.id_dba = d.id_dba AND edba.estado = 'ACTIVO'
      LEFT JOIN actividad_evidencia_dba aedba ON aedba.id_evidencia_dba = edba.id_evidencia_dba
        AND EXISTS (
          SELECT 1 
          FROM actividad_materia am
          JOIN competencias c ON c.id_competencia = am.id_competencia
          JOIN grupos g ON g.id_grupo = c.id_grupo
          WHERE am.id_actividadmateria = aedba.id_actividadmateria
            AND c.id_colegio = cvc.id_colegio
    `;

    const summaryParams: any[] = [schoolId];

    if (id_periodo && id_periodo !== "TODOS") {
      summaryParams.push(Number(id_periodo));
      summaryQuery += ` AND c.id_periodo = $${summaryParams.length}`;
    }

    if (id_materia && id_materia !== "TODOS") {
      summaryParams.push(Number(id_materia));
      summaryQuery += ` AND c.id_materia = $${summaryParams.length}`;
    }

    if (id_grupo && id_grupo !== "TODOS") {
      summaryParams.push(Number(id_grupo));
      summaryQuery += ` AND g.id_grupo = $${summaryParams.length}`;
    }

    summaryQuery += `
        )
      WHERE cvc.id_colegio = $1
    `;

    // Filtros externos de la versión curricular
    if (id_materia && id_materia !== "TODOS") {
      summaryQuery += ` AND cvc.area = (SELECT nombre FROM materias WHERE id_materia = ${summaryParams.length === 2 ? '$2' : summaryParams.length === 3 ? '$3' : '$4'})`;
    }

    summaryQuery += `
      GROUP BY cvc.area, cvc.grado, cvc.version_curricular
      ORDER BY cvc.area, 
        CASE cvc.grado
          WHEN 'PRIMERO' THEN 1
          WHEN 'SEGUNDO' THEN 2
          WHEN 'TERCERO' THEN 3
          WHEN 'CUARTO' THEN 4
          WHEN 'QUINTO' THEN 5
          WHEN 'SEXTO' THEN 6
          WHEN 'SEPTIMO' THEN 7
          WHEN 'OCTAVO' THEN 8
          WHEN 'NOVENO' THEN 9
          WHEN 'DECIMO' THEN 10
          WHEN 'ONCE' THEN 11
          ELSE 12
        END ASC
    `;

    const summaryRes = await pool.query(summaryQuery, summaryParams);

    // 2. Obtener lista detallada de evidencias y su estado de cobertura
    let detailsQuery = `
      SELECT 
        d.id_dba,
        d.numero_dba,
        d.enunciado AS dba_enunciado,
        d.area,
        d.grado,
        edba.id_evidencia_dba,
        edba.descripcion AS evidencia_descripcion,
        edba.orden AS evidencia_orden,
        COALESCE(
          (SELECT json_agg(
             json_build_object(
               'actividad_nombre', am.nombre,
               'actividad_porcentaje', am.porcentaje,
               'grupo_nombre', ne.nombre || ' - ' || tg.nombre,
               'docente_nombre', u.nombre || ' ' || u.apellido
             )
           )
           FROM actividad_evidencia_dba aedba
           JOIN actividad_materia am ON am.id_actividadmateria = aedba.id_actividadmateria
           JOIN competencias c ON c.id_competencia = am.id_competencia
           JOIN grupos g ON g.id_grupo = c.id_grupo
           JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
           JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
           LEFT JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
           LEFT JOIN docente doc ON doc.id_docente = dg.id_docente
           LEFT JOIN usuario u ON u.id_usuario = doc.id_usuario
           WHERE aedba.id_evidencia_dba = edba.id_evidencia_dba
             AND c.id_colegio = cvc.id_colegio
    `;

    const detailsParams: any[] = [schoolId];

    if (id_periodo && id_periodo !== "TODOS") {
      detailsParams.push(Number(id_periodo));
      detailsQuery += ` AND c.id_periodo = $${detailsParams.length}`;
    }

    if (id_grupo && id_grupo !== "TODOS") {
      detailsParams.push(Number(id_grupo));
      detailsQuery += ` AND g.id_grupo = $${detailsParams.length}`;
    }

    detailsQuery += `
          ), '[]'::json
        ) AS evaluaciones
      FROM colegio_version_curricular cvc
      JOIN dba d ON d.area = cvc.area AND d.grado = cvc.grado AND d.version_curricular = cvc.version_curricular AND d.estado = 'ACTIVO'
      JOIN evidencias_dba edba ON edba.id_dba = d.id_dba AND edba.estado = 'ACTIVO'
      WHERE cvc.id_colegio = $1
    `;

    if (id_materia && id_materia !== "TODOS") {
      detailsParams.push(Number(id_materia));
      detailsQuery += ` AND cvc.area = (SELECT nombre FROM materias WHERE id_materia = $${detailsParams.length})`;
    }

    detailsQuery += `
      ORDER BY cvc.area, 
        CASE cvc.grado
          WHEN 'PRIMERO' THEN 1
          WHEN 'SEGUNDO' THEN 2
          WHEN 'TERCERO' THEN 3
          WHEN 'CUARTO' THEN 4
          WHEN 'QUINTO' THEN 5
          WHEN 'SEXTO' THEN 6
          WHEN 'SEPTIMO' THEN 7
          WHEN 'OCTAVO' THEN 8
          WHEN 'NOVENO' THEN 9
          WHEN 'DECIMO' THEN 10
          WHEN 'ONCE' THEN 11
          ELSE 12
        END ASC, d.numero_dba ASC, edba.orden ASC
    `;

    const detailsRes = await pool.query(detailsQuery, detailsParams);

    res.json({
      resumen: summaryRes.rows,
      detalles: detailsRes.rows
    });
  } catch (error: any) {
    console.error("Error al obtener reporte de cobertura DBA:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};
