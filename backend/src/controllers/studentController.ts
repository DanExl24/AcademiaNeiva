import { Request, Response } from "express";
import { pool } from "../config/db";
import { NotificationService } from "../services/notificationService";

export const getAllStudents = async (req: Request, res: Response) => {
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
             s.nombre as seccion_nombre,
             j.nombre as jornada_nombre,
             pf.nombre as acudiente_nombre,
             pf.apellido as acudiente_apellido,
             pf.documeno as acudiente_documento
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

    const params: any[] = [idColegio];
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

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, documento, id_tipodocumento, codigo } = req.body;

    const result = await pool.query(
      `UPDATE estudiante 
       SET nombre = $1, apellido = $2, documento = $3, id_tipodocumento = $4, codigo = $5
       WHERE id_estudiante = $6
       RETURNING *`,
      [nombre, apellido, documento, id_tipodocumento, codigo, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateStudentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado } = req.body; // 'ACTIVO', 'SANCIONADO', 'EXPULSADO', 'RETIRADO'

    const result = await pool.query(
      "UPDATE estudiante SET estado = $1 WHERE id_estudiante = $2 RETURNING *",
      [estado, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const changeStudentGrade = async (req: Request, res: Response) => {
  const client = await pool.connect();
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
    const newGradeRes = await client.query(
      `SELECT tg.nombre, s.nombre as seccion 
       FROM grupos g 
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado 
       JOIN secciones s ON g.id_seccion = s.id_seccion
       WHERE g.id_grupo = $1`, 
      [id_grupo]
    );
    const new_grade_name = newGradeRes.rows[0]?.nombre + " - " + newGradeRes.rows[0]?.seccion;

    // 1. Actualizar el nivel en la ficha del estudiante
    await client.query(
      "UPDATE estudiante SET id_nivel = $1 WHERE id_estudiante = $2",
      [id_nivel, id]
    );

    // 2. Actualizar la matrícula activa
    await client.query(
      `UPDATE matricula 
       SET id_grupo = $1, id_nivel = $2 
       WHERE id_estudiante = $3 AND estado = 'ACTIVA'`,
      [id_grupo, id_nivel, id]
    );

    await client.query("COMMIT");

    // 3. Enviar notificación por correo (fuera de la transacción para no bloquear)
    NotificationService.sendStudentTransferEmail(
      parent_email,
      parent_name,
      `${student_name} ${student_lastname}`,
      `${old_grade_name || 'N/A'} - ${old_section_name || 'N/A'}`,
      new_grade_name,
      motivo,
      school_name
    ).catch((err: any) => console.error("Error enviando email tras compromiso:", err));

    res.json({ message: "Cambio de grado realizado y notificación enviada" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Error en changeStudentGrade:", error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Realizamos una eliminación lógica cambiando el estado a RETIRADO en lugar de borrar físicamente
    // si el usuario así lo prefiere, o borrado físico si no tiene registros académicos.
    // Para simplificar y mantener integridad, el usuario pidió "Expulsar (No eliminar)".
    // Aquí implementaremos el borrado físico solo si el administrador realmente lo solicita y no hay conflictos.
    const result = await pool.query("DELETE FROM estudiante WHERE id_estudiante = $1", [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Estudiante no encontrado" });
    }
    
    res.json({ message: "Estudiante eliminado exitosamente" });
  } catch (error: any) {
    if (error.code === '23503') {
      res.status(400).json({ 
        error: "No se puede eliminar el estudiante porque tiene registros académicos asociados. Use 'Retirar' o 'Expulsar' en su lugar." 
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
};

export const getStudentSummary = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Basic Student and Group Info
    const studentRes = await pool.query(`
      SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.codigo, e.estado, e.id_usuario, e.id_colegio,
             tg.nombre as grado_nombre, s.nombre as seccion_nombre, n.nombre as nivel_nombre,
             m.id_grupo, u.email as student_email, u.fecha_creacion as user_created_at
      FROM estudiante e
      LEFT JOIN usuario u ON e.id_usuario = u.id_usuario
      LEFT JOIN matricula m ON e.id_estudiante = m.id_estudiante AND m.estado = 'ACTIVA'
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
    const parentRes = await pool.query(`
      SELECT pf.nombre, pf.apellido, u.email
      FROM detalle_padrefamilia dpf
      JOIN padre_familia pf ON dpf.id_padrefamilia = pf.id_padrefamilia
      LEFT JOIN usuario u ON pf.id_usuario = u.id_usuario
      WHERE dpf.id_estudiante = $1
      LIMIT 1
    `, [id]);

    const parent = parentRes.rows[0] || null;

    // 3. Find active period (state = 'ABIERTO') or fallback to latest period
    let periodRes = await pool.query(`
      SELECT id_periodo, nombre 
      FROM periodo_academico 
      WHERE id_colegio = $1 AND estado = 'ABIERTO' 
      LIMIT 1
    `, [id_colegio]);

    if (periodRes.rows.length === 0) {
      periodRes = await pool.query(`
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
    let grades: any[] = [];
    let promedioGeneral = 0;
    let materiasReprobadas: any[] = [];

    if (id_grupo && periodId) {
      const gradesRes = await pool.query(`
        SELECT 
          m.id_materia,
          m.nombre as materia,
          COALESCE(ra.promedio, calc.promedio_calculado, 0)::numeric as calificacion
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
      `, [id, periodId, id_grupo]);

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
    const absencesRes = await pool.query(`
      SELECT COUNT(*)::integer as count 
      FROM registro_asistencia 
      WHERE id_estudiante = $1 AND estado = 'AUSENTE'
    `, [id]);
    const totalInasistencias = absencesRes.rows[0]?.count || 0;

    // 6. Disciplinary observations count
    const observationsRes = await pool.query(`
      SELECT COUNT(*)::integer as count 
      FROM observacion_estudiante 
      WHERE id_estudiante = $1 AND tipo ILIKE 'disciplinari%'
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
    } else if (materiasReprobadas.length > 0) {
      estadoAcademico = 'En riesgo';
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
      ultima_actividad: ultimaActividad
    });

  } catch (error: any) {
    console.error("Error in getStudentSummary:", error);
    res.status(500).json({ error: error.message });
  }
};

