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
  const { id_anio, yearId, id_periodo, id_grupo, grado, id_materia, id_docente } = req.query;
  const targetYear = id_anio || yearId;
  const targetGrade = (grado || id_grupo) as string;

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
        am.motivo_extra,
        am.justificacion_extra,
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
        COALESCE(u_creador.nombre || ' ' || u_creador.apellido, u.nombre || ' ' || u.apellido) AS docente_creador_nombre,
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
      JOIN evidencias_dba edba ON edba.id_evidencia_dba = aedba.id_evidencia_dba
      JOIN dba dba ON dba.id_dba = edba.id_dba
      JOIN actividad_materia am ON am.id_actividadmateria = aedba.id_actividadmateria
      JOIN competencias c ON c.id_competencia = am.id_competencia
      JOIN periodo_academico p ON p.id_periodo = c.id_periodo
      JOIN grupos g ON g.id_grupo = c.id_grupo
      JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
      JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
      JOIN secciones s ON s.id_seccion = g.id_seccion
      JOIN materias m ON m.id_materia = c.id_materia
      LEFT JOIN LATERAL (
        SELECT dg_cur.id_docente
        FROM detalle_grados dg_cur
        WHERE dg_cur.id_grupo = g.id_grupo AND dg_cur.id_materia = m.id_materia
        ORDER BY dg_cur.id_detallegrado DESC
        LIMIT 1
      ) dg ON true
      LEFT JOIN docente d ON d.id_docente = dg.id_docente
      LEFT JOIN usuario u ON u.id_usuario = d.id_usuario
      LEFT JOIN docente d_creador ON d_creador.id_docente = am.id_docente_creador
      LEFT JOIN usuario u_creador ON u_creador.id_usuario = d_creador.id_usuario
      WHERE c.id_colegio = $1
    `;

    const params: any[] = [schoolId];

    if (targetYear && targetYear !== "TODOS") {
      params.push(Number(targetYear));
      query += ` AND c.id_anio = $${params.length}`;
    }

    if (id_periodo && id_periodo !== "TODOS") {
      params.push(Number(id_periodo));
      query += ` AND c.id_periodo = $${params.length}`;
    }

    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        params.push(Number(targetGrade));
        query += ` AND g.id_grupo = $${params.length}`;
      } else {
        params.push(targetGrade.trim());
        query += ` AND LOWER(TRIM(tg.nombre)) = LOWER(TRIM($${params.length}))`;
      }
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
  const { id_anio, yearId, id_periodo, id_materia, id_grupo, grado } = req.query;
  const targetYear = (id_anio || yearId) as string;
  const targetGrade = (grado || id_grupo) as string;

  if (!schoolId) {
    res.status(400).json({ error: "El ID de colegio es obligatorio" });
    return;
  }

  const authReq = req as any;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para ver los reportes DBA de este colegio." });
    return;
  }

  try {
    const periodParam = (id_periodo && id_periodo !== "TODOS") ? Number(id_periodo) : null;
    const yearParam = (targetYear && targetYear !== "TODOS") ? Number(targetYear) : null;
    const summaryParams: any[] = [schoolId, periodParam, yearParam];

    let summaryQuery = `
      SELECT 
        cvc.area,
        cvc.grado,
        cvc.version_curricular,
        COUNT(DISTINCT CASE 
          WHEN $2::int IS NULL AND $3::int IS NULL THEN edba.id_evidencia_dba
          WHEN ea_plan.id_evidencia_dba IS NOT NULL OR aedba.id_evidencia_dba IS NOT NULL THEN edba.id_evidencia_dba
        END)::int AS total_evidencias,
        COUNT(DISTINCT CASE WHEN aedba.id_evidencia_dba IS NOT NULL THEN edba.id_evidencia_dba END)::int AS evidencias_evaluadas
      FROM colegio_version_curricular cvc
      JOIN dba d ON d.area = cvc.area AND d.grado = cvc.grado AND d.version_curricular = cvc.version_curricular AND d.estado = 'ACTIVO'
      JOIN evidencias_dba edba ON edba.id_dba = d.id_dba AND edba.estado = 'ACTIVO'
      LEFT JOIN evidencia_aprendizaje ea_plan ON ea_plan.id_evidencia_dba = edba.id_evidencia_dba
        AND EXISTS (
          SELECT 1 
          FROM competencias c
          JOIN grupos g ON g.id_grupo = c.id_grupo
          JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
          WHERE c.id_competencia = ea_plan.id_competencia
            AND c.id_colegio = cvc.id_colegio
            AND ($2::int IS NULL OR c.id_periodo = $2::int)
            AND ($3::int IS NULL OR c.id_anio = $3::int)
    `;

    if (id_materia && id_materia !== "TODOS") {
      summaryParams.push(Number(id_materia));
      summaryQuery += ` AND c.id_materia = $${summaryParams.length}`;
    }

    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        summaryParams.push(Number(targetGrade));
        summaryQuery += ` AND g.id_grupo = $${summaryParams.length}`;
      } else {
        summaryParams.push(targetGrade.trim());
        summaryQuery += ` AND LOWER(TRIM(tg.nombre)) = LOWER(TRIM($${summaryParams.length}))`;
      }
    }

    summaryQuery += `
        )
      LEFT JOIN actividad_evidencia_dba aedba ON aedba.id_evidencia_dba = edba.id_evidencia_dba
        AND EXISTS (
          SELECT 1 
          FROM actividad_materia am
          JOIN competencias c ON c.id_competencia = am.id_competencia
          JOIN grupos g ON g.id_grupo = c.id_grupo
          JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
          WHERE am.id_actividadmateria = aedba.id_actividadmateria
            AND c.id_colegio = cvc.id_colegio
            AND ($2::int IS NULL OR c.id_periodo = $2::int)
            AND ($3::int IS NULL OR c.id_anio = $3::int)
    `;

    if (id_materia && id_materia !== "TODOS") {
      summaryParams.push(Number(id_materia));
      summaryQuery += ` AND c.id_materia = $${summaryParams.length}`;
    }

    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        summaryParams.push(Number(targetGrade));
        summaryQuery += ` AND g.id_grupo = $${summaryParams.length}`;
      } else {
        summaryParams.push(targetGrade.trim());
        summaryQuery += ` AND LOWER(TRIM(tg.nombre)) = LOWER(TRIM($${summaryParams.length}))`;
      }
    }

    summaryQuery += `
        )
      WHERE cvc.id_colegio = $1
    `;

    if (id_materia && id_materia !== "TODOS") {
      summaryParams.push(Number(id_materia));
      summaryQuery += ` AND LOWER(TRIM(cvc.area)) = (SELECT LOWER(TRIM(nombre)) FROM materias WHERE id_materia = $${summaryParams.length})`;
    }

    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        summaryParams.push(Number(targetGrade));
        summaryQuery += ` AND LOWER(TRIM(cvc.grado)) = (SELECT LOWER(TRIM(tg.nombre)) FROM grupos g JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado WHERE g.id_grupo = $${summaryParams.length})`;
      } else {
        summaryParams.push(targetGrade.trim());
        summaryQuery += ` AND LOWER(TRIM(cvc.grado)) = LOWER(TRIM($${summaryParams.length}))`;
      }
    }

    summaryQuery += `
      GROUP BY cvc.area, cvc.grado, cvc.version_curricular
      HAVING COUNT(DISTINCT CASE 
        WHEN $2::int IS NULL AND $3::int IS NULL THEN edba.id_evidencia_dba
        WHEN ea_plan.id_evidencia_dba IS NOT NULL OR aedba.id_evidencia_dba IS NOT NULL THEN edba.id_evidencia_dba
      END) > 0
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
    const detailsParams: any[] = [schoolId, periodParam, yearParam];

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
          (SELECT EXISTS (
             SELECT 1 
             FROM evidencia_aprendizaje ea
             JOIN competencias c ON c.id_competencia = ea.id_competencia
             JOIN grupos g ON g.id_grupo = c.id_grupo
             JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
             WHERE ea.id_evidencia_dba = edba.id_evidencia_dba
               AND c.id_colegio = cvc.id_colegio
               AND ($2::int IS NULL OR c.id_periodo = $2::int)
               AND ($3::int IS NULL OR c.id_anio = $3::int)
               AND c.id_materia = (SELECT id_materia FROM materias WHERE nombre = cvc.area LIMIT 1)
               AND tg.nombre = cvc.grado
          )), false
        ) AS es_planeada,
        COALESCE(
          (SELECT json_agg(
             json_build_object(
               'actividad_nombre', sub.actividad_nombre,
               'actividad_porcentaje', sub.actividad_porcentaje,
               'grupo_nombre', sub.grupo_nombre,
               'docente_nombre', sub.docente_nombre,
               'periodo_nombre', sub.periodo_nombre
             )
           )
           FROM (
             SELECT DISTINCT
               am.id_actividadmateria,
               am.nombre AS actividad_nombre,
               am.porcentaje AS actividad_porcentaje,
               ne.nombre || ' - ' || tg.nombre || COALESCE(' (' || s.nombre || ')', '') AS grupo_nombre,
               u.nombre || ' ' || u.apellido AS docente_nombre,
               p.nombre AS periodo_nombre
             FROM actividad_evidencia_dba aedba
             JOIN actividad_materia am ON am.id_actividadmateria = aedba.id_actividadmateria
             JOIN competencias c ON c.id_competencia = am.id_competencia
             LEFT JOIN periodo_academico p ON p.id_periodo = am.id_periodo
             LEFT JOIN detalle_grados dg ON dg.id_detallegrado = am.id_detallegrado
             LEFT JOIN grupos g ON g.id_grupo = dg.id_grupo
             LEFT JOIN secciones s ON s.id_seccion = g.id_seccion
             LEFT JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
             LEFT JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
             LEFT JOIN docente doc ON doc.id_docente = dg.id_docente
             LEFT JOIN usuario u ON u.id_usuario = doc.id_usuario
             WHERE aedba.id_evidencia_dba = edba.id_evidencia_dba
               AND am.id_colegio = cvc.id_colegio
               AND ($2::int IS NULL OR am.id_periodo = $2::int)
               AND ($3::int IS NULL OR c.id_anio = $3::int)
           ) sub
          ), '[]'::json
        ) AS evaluaciones
      FROM colegio_version_curricular cvc
      JOIN dba d ON d.area = cvc.area AND d.grado = cvc.grado AND d.version_curricular = cvc.version_curricular AND d.estado = 'ACTIVO'
      JOIN evidencias_dba edba ON edba.id_dba = d.id_dba AND edba.estado = 'ACTIVO'
      WHERE cvc.id_colegio = $1
        AND (
          $2::int IS NULL 
          OR EXISTS (
            SELECT 1 
            FROM evidencia_aprendizaje ea
            JOIN competencias c ON c.id_competencia = ea.id_competencia
            JOIN grupos g ON g.id_grupo = c.id_grupo
            JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
            WHERE ea.id_evidencia_dba = edba.id_evidencia_dba
              AND c.id_colegio = cvc.id_colegio
              AND c.id_periodo = $2::int
              AND ($3::int IS NULL OR c.id_anio = $3::int)
              AND c.id_materia = (SELECT id_materia FROM materias WHERE nombre = cvc.area LIMIT 1)
              AND tg.nombre = cvc.grado
          )
          OR EXISTS (
            SELECT 1 
            FROM actividad_evidencia_dba aedba
            JOIN actividad_materia am ON am.id_actividadmateria = aedba.id_actividadmateria
            JOIN competencias c ON c.id_competencia = am.id_competencia
            JOIN grupos g ON g.id_grupo = c.id_grupo
            JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
            WHERE aedba.id_evidencia_dba = edba.id_evidencia_dba
              AND am.id_colegio = cvc.id_colegio
              AND am.id_periodo = $2::int
              AND ($3::int IS NULL OR c.id_anio = $3::int)
              AND c.id_materia = (SELECT id_materia FROM materias WHERE nombre = cvc.area LIMIT 1)
              AND tg.nombre = cvc.grado
          )
        )
    `;

    if (id_materia && id_materia !== "TODOS") {
      detailsParams.push(Number(id_materia));
      detailsQuery += ` AND LOWER(TRIM(cvc.area)) = (SELECT LOWER(TRIM(nombre)) FROM materias WHERE id_materia = $${detailsParams.length})`;
    }

    if (targetGrade && targetGrade !== "TODOS") {
      if (!isNaN(Number(targetGrade))) {
        detailsParams.push(Number(targetGrade));
        detailsQuery += ` AND LOWER(TRIM(cvc.grado)) = (SELECT LOWER(TRIM(tg.nombre)) FROM grupos g JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado WHERE g.id_grupo = $${detailsParams.length})`;
      } else {
        detailsParams.push(targetGrade.trim());
        detailsQuery += ` AND LOWER(TRIM(cvc.grado)) = LOWER(TRIM($${detailsParams.length}))`;
      }
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

// ============================================================================
// 3. CATÁLOGO OFICIAL DE DBA Y EVIDENCIAS CON ESTADO DE PLANEACIÓN
// ============================================================================
export const obtenerCatalogoDbaDirectivo = async (req: Request, res: Response): Promise<void> => {
  const schoolId = parseSchoolId(req.params.schoolId);
  const { id_anio, yearId } = req.query;
  const targetYear = (id_anio || yearId) as string;
  const yearParam = (targetYear && targetYear !== "TODOS") ? Number(targetYear) : null;

  if (!schoolId) {
    res.status(400).json({ error: "El ID de colegio es obligatorio" });
    return;
  }

  const authReq = req as any;
  const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
  if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== schoolId) {
    res.status(403).json({ error: "No tiene permiso para ver los reportes DBA de este colegio." });
    return;
  }

  try {
    const query = `
      SELECT 
        d.id_dba,
        d.numero_dba,
        d.enunciado AS dba_enunciado,
        d.area,
        d.grado,
        d.version_curricular,
        COALESCE(
          (SELECT json_agg(
             json_build_object(
               'id_evidencia_dba', edba.id_evidencia_dba,
               'descripcion', edba.descripcion,
               'orden', edba.orden,
               'planeaciones', COALESCE(
                 (SELECT json_agg(
                    json_build_object(
                      'id_competencia', c.id_competencia,
                      'competencia_descripcion', c.descripcion,
                      'competencia_nombre', c.nombre,
                      'id_periodo', p.id_periodo,
                      'periodo_nombre', p.nombre,
                      'id_materia', m.id_materia,
                      'materia_nombre', m.nombre,
                      'id_grupo', g.id_grupo,
                      'grupo_nombre', ne.nombre || ' - ' || tg.nombre || ' (' || s.nombre || ')'
                    )
                  )
                  FROM evidencia_aprendizaje ea
                  JOIN competencias c ON c.id_competencia = ea.id_competencia
                  JOIN periodo_academico p ON p.id_periodo = c.id_periodo
                  JOIN materias m ON m.id_materia = c.id_materia
                  JOIN grupos g ON g.id_grupo = c.id_grupo
                  JOIN nivel_escolar ne ON ne.id_nivel = g.id_nivel
                  JOIN tipo_grado tg ON tg.id_tipo_grado = g.id_tipo_grado
                  JOIN secciones s ON s.id_seccion = g.id_seccion
                  WHERE ea.id_evidencia_dba = edba.id_evidencia_dba
                    AND c.id_colegio = $1
                    AND ($2::int IS NULL OR c.id_anio = $2::int)
                 ), '[]'::json
               )
             ) ORDER BY edba.orden ASC, edba.id_evidencia_dba ASC
           )
           FROM evidencias_dba edba
           WHERE edba.id_dba = d.id_dba AND edba.estado = 'ACTIVO'
          ), '[]'::json
        ) AS evidencias
      FROM colegio_version_curricular cvc
      JOIN dba d ON d.area = cvc.area AND d.grado = cvc.grado AND d.version_curricular = cvc.version_curricular AND d.estado = 'ACTIVO'
      WHERE cvc.id_colegio = $1
      ORDER BY cvc.area ASC,
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
        END ASC, d.numero_dba ASC
    `;

    const result = await pool.query(query, [schoolId, yearParam]);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error al obtener catálogo de DBA para directivo:", error);
    res.status(500).json({ error: "Error en el servidor al consultar catálogo DBA" });
  }
};

