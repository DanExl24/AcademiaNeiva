import { Response } from "express";
import { pool } from "../config/db";
import { db } from "../config/kysely";
import { sql } from "kysely";
import { AuthRequest } from "../middleware/authMiddleware";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

// ============================================================================
// 1. LISTAR DBA (PAGINADO CON FILTROS)
// ============================================================================
export const listarDBA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { area, grado, version, estado, busqueda } = req.query;
    const page = req.query.page ? Number(req.query.page) : null;
    const limit = req.query.limit ? Number(req.query.limit) : null;

    let baseQuery = db
      .selectFrom("dba as d")
      .leftJoin("evidencias_dba as e", "e.id_dba", "d.id_dba")
      .select([
        "d.id_dba",
        "d.area",
        "d.grado",
        "d.numero_dba",
        "d.enunciado",
        "d.version_curricular",
        "d.estado",
        sql<number>`COUNT(e.id_evidencia_dba)::int`.as("total_evidencias")
      ])
      .groupBy("d.id_dba");

    if (area && area !== "TODOS") {
      baseQuery = baseQuery.where("d.area", "=", area as string);
    }

    if (grado && grado !== "TODOS") {
      baseQuery = baseQuery.where("d.grado", "=", grado as string);
    }

    if (version && version !== "TODOS") {
      baseQuery = baseQuery.where("d.version_curricular", "=", version as string);
    }

    if (estado && estado !== "TODOS") {
      baseQuery = baseQuery.where("d.estado", "=", estado as any);
    }

    if (busqueda) {
      const searchPattern = `%${busqueda}%`;
      baseQuery = baseQuery.where((eb) => eb.or([
        eb("d.enunciado", "ilike", searchPattern),
        eb("d.area", "ilike", searchPattern),
        eb("d.grado", "ilike", searchPattern)
      ]));
    }

    const allRows = await baseQuery.orderBy("d.area", "asc").orderBy("d.numero_dba", "asc").execute();
    const totalCount = allRows.length;

    let pagedRows = allRows;
    if (page && limit) {
      const offset = (Number(page) - 1) * Number(limit);
      pagedRows = allRows.slice(offset, offset + Number(limit));
    }

    res.setHeader("x-total-count", String(totalCount));
    res.setHeader("Access-Control-Expose-Headers", "x-total-count");
    res.json(pagedRows);
  } catch (error: any) {
    console.error("Error al listar DBA:", error);
    res.status(500).json({ error: "Error al listar DBA" });
  }
};

// ============================================================================
// 2. DETALLE DBA CON EVIDENCIAS
// ============================================================================
export const detalleDBA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dbaId = Number(req.params.id);

    const dba = await db
      .selectFrom("dba")
      .selectAll()
      .where("id_dba", "=", dbaId)
      .executeTakeFirst();

    if (!dba) {
      res.status(404).json({ error: "DBA no encontrado" });
      return;
    }

    const evidencias = await db
      .selectFrom("evidencias_dba")
      .selectAll()
      .where("id_dba", "=", dbaId)
      .orderBy("orden", "asc")
      .orderBy("id_evidencia_dba", "asc")
      .execute();

    res.json({
      ...dba,
      evidencias
    });
  } catch (error: any) {
    console.error("Error al obtener detalle del DBA:", error);
    res.status(500).json({ error: "Error al obtener el detalle del DBA" });
  }
};

// ============================================================================
// 3. CREAR DBA (CON VALIDACIÓN DE DUPLICADO)
// ============================================================================
export const crearDBA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { area, grado, numero_dba, enunciado, version_curricular } = req.body;

    if (!area || !grado || !numero_dba || !enunciado || !version_curricular) {
      res.status(400).json({ error: "Todos los campos (área, grado, número, enunciado, versión) son obligatorios" });
      return;
    }

    const dupCheck = await db
      .selectFrom("dba")
      .select("id_dba")
      .where("area", "=", area)
      .where("grado", "=", grado)
      .where("numero_dba", "=", Number(numero_dba))
      .where("version_curricular", "=", version_curricular)
      .executeTakeFirst();

    if (dupCheck) {
      res.status(400).json({ error: `Ya existe el DBA #${numero_dba} para el grado ${grado} de ${area} en la versión ${version_curricular}` });
      return;
    }

    const newDba = await db
      .insertInto("dba")
      .values({
        area,
        grado,
        numero_dba: Number(numero_dba),
        enunciado,
        version_curricular,
        estado: 'ACTIVO'
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    res.status(201).json(newDba);
  } catch (error: any) {
    console.error("Error al crear DBA:", error);
    res.status(500).json({ error: "Error al crear el DBA" });
  }
};

// ============================================================================
// 4. ACTUALIZAR DBA
// ============================================================================
export const actualizarDBA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dbaId = Number(req.params.id);
    const { area, grado, numero_dba, enunciado, version_curricular } = req.body;

    if (!area || !grado || !numero_dba || !enunciado || !version_curricular) {
      res.status(400).json({ error: "Todos los campos son obligatorios" });
      return;
    }

    const dbaCheck = await db
      .selectFrom("dba")
      .select("id_dba")
      .where("id_dba", "=", dbaId)
      .executeTakeFirst();

    if (!dbaCheck) {
      res.status(404).json({ error: "DBA no encontrado" });
      return;
    }

    const dupCheck = await db
      .selectFrom("dba")
      .select("id_dba")
      .where("area", "=", area)
      .where("grado", "=", grado)
      .where("numero_dba", "=", Number(numero_dba))
      .where("version_curricular", "=", version_curricular)
      .where("id_dba", "!=", dbaId)
      .executeTakeFirst();

    if (dupCheck) {
      res.status(400).json({ error: `Ya existe otro DBA #${numero_dba} para el grado ${grado} de ${area} en la versión ${version_curricular}` });
      return;
    }

    const updated = await db
      .updateTable("dba")
      .set({
        area,
        grado,
        numero_dba: Number(numero_dba),
        enunciado,
        version_curricular
      })
      .where("id_dba", "=", dbaId)
      .returningAll()
      .executeTakeFirstOrThrow();

    res.json(updated);
  } catch (error: any) {
    console.error("Error al actualizar DBA:", error);
    res.status(500).json({ error: "Error al actualizar el DBA" });
  }
};

// ============================================================================
// 5. CAMBIAR ESTADO DBA (ACTIVO / INACTIVO)
// ============================================================================
export const cambiarEstadoDBA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (estado !== "ACTIVO" && estado !== "INACTIVO") {
      res.status(400).json({ error: "El estado debe ser ACTIVO o INACTIVO" });
      return;
    }

    // Obtener información del DBA
    const dbaRes = await pool.query(`SELECT * FROM dba WHERE id_dba = $1`, [id]);
    if (dbaRes.rows.length === 0) {
      res.status(404).json({ error: "DBA no encontrado" });
      return;
    }
    const dba = dbaRes.rows[0];

    // RN-DBA-008: Si se va a inactivar, verificar si ya fue asignado a algún colegio
    if (estado === "INACTIVO") {
      const activeCheck = await pool.query(
        `SELECT id FROM colegio_version_curricular 
         WHERE area = $1 AND grado = $2 AND version_curricular = $3 LIMIT 1`,
        [dba.area, dba.grado, dba.version_curricular]
      );

      if (activeCheck.rows.length > 0) {
        res.status(400).json({ 
          error: "No se puede inactivar este DBA porque la versión curricular del área/grado está asignada a uno o más colegios" 
        });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE dba SET estado = $1, updated_at = NOW() WHERE id_dba = $2 RETURNING *`,
      [estado, id]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error al cambiar estado del DBA:", error);
    res.status(500).json({ error: "Error al cambiar el estado del DBA" });
  }
};

// ============================================================================
// 6. CREAR EVIDENCIA DE APRENDIZAJE ASOCIADA
// ============================================================================
export const crearEvidencia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // id del dba
    const { descripcion, orden } = req.body;

    if (!descripcion) {
      res.status(400).json({ error: "La descripción es requerida" });
      return;
    }

    // RN-DBA-003: Verificar que el DBA exista y esté activo
    const dbaCheck = await pool.query(`SELECT estado FROM dba WHERE id_dba = $1`, [id]);
    if (dbaCheck.rows.length === 0) {
      res.status(404).json({ error: "DBA no encontrado" });
      return;
    }
    if (dbaCheck.rows[0].estado !== "ACTIVO") {
      res.status(400).json({ error: "No se pueden agregar evidencias a un DBA inactivo" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO evidencias_dba (id_dba, descripcion, orden, estado, created_at)
       VALUES ($1, $2, $3, 'ACTIVO', NOW())
       RETURNING *`,
      [id, descripcion, orden || 1]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error al crear evidencia:", error);
    res.status(500).json({ error: "Error al crear la evidencia" });
  }
};

// ============================================================================
// 7. ACTUALIZAR EVIDENCIA DE APRENDIZAJE
// ============================================================================
export const actualizarEvidencia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // id de la evidencia
    const { descripcion, orden } = req.body;

    if (!descripcion) {
      res.status(400).json({ error: "La descripción es requerida" });
      return;
    }

    const checkRes = await pool.query(`SELECT id_evidencia_dba FROM evidencias_dba WHERE id_evidencia_dba = $1`, [id]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ error: "Evidencia de aprendizaje no encontrada" });
      return;
    }

    const result = await pool.query(
      `UPDATE evidencias_dba 
       SET descripcion = $1, orden = $2
       WHERE id_evidencia_dba = $3
       RETURNING *`,
      [descripcion, orden || 1, id]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error al actualizar evidencia:", error);
    res.status(500).json({ error: "Error al actualizar la evidencia" });
  }
};

// ============================================================================
// 8. CAMBIAR ESTADO EVIDENCIA (ACTIVO / INACTIVO)
// ============================================================================
export const cambiarEstadoEvidencia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (estado !== "ACTIVO" && estado !== "INACTIVO") {
      res.status(400).json({ error: "El estado debe ser ACTIVO o INACTIVO" });
      return;
    }

    const checkRes = await pool.query(`SELECT id_evidencia_dba FROM evidencias_dba WHERE id_evidencia_dba = $1`, [id]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ error: "Evidencia de aprendizaje no encontrada" });
      return;
    }

    const result = await pool.query(
      `UPDATE evidencias_dba SET estado = $1 WHERE id_evidencia_dba = $2 RETURNING *`,
      [estado, id]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error al cambiar estado de evidencia:", error);
    res.status(500).json({ error: "Error al cambiar el estado de la evidencia" });
  }
};

// ============================================================================
// 9. LISTAR VERSIONES CURRICULARES ÚNICAS
// ============================================================================
export const listarVersiones = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT version_curricular FROM dba ORDER BY version_curricular DESC`
    );
    const versiones = result.rows.map(row => row.version_curricular);
    res.json(versiones);
  } catch (error: any) {
    console.error("Error al listar versiones de DBA:", error);
    res.status(500).json({ error: "Error al listar las versiones de los DBA" });
  }
};

// ============================================================================
// 10. LISTAR ÁREAS ÚNICAS
// ============================================================================
export const listarAreas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT area FROM dba ORDER BY area ASC`
    );
    const areas = result.rows.map(row => row.area);
    res.json(areas);
  } catch (error: any) {
    console.error("Error al listar áreas de DBA:", error);
    res.status(500).json({ error: "Error al listar las áreas de los DBA" });
  }
};

// ============================================================================
// 11. ASIGNAR VERSIÓN CURRICULAR A UN COLEGIO
// ============================================================================
export const asignarVersionColegio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id_colegio, area, grado, version_curricular } = req.body;

    if (!id_colegio || !area || !grado || !version_curricular) {
      res.status(400).json({ error: "Todos los campos son obligatorios" });
      return;
    }

    // 1. Resolver colegios
    let schoolIds: number[] = [];
    if (id_colegio === "TODOS" || id_colegio === "todos") {
      const activeSchools = await pool.query("SELECT id_colegio FROM colegio WHERE estado = 'ACTIVO'");
      schoolIds = activeSchools.rows.map(r => r.id_colegio);
    } else {
      const colCheck = await pool.query(`SELECT id_colegio FROM colegio WHERE id_colegio = $1`, [id_colegio]);
      if (colCheck.rows.length === 0) {
        res.status(404).json({ error: "Colegio no encontrado" });
        return;
      }
      schoolIds = [Number(id_colegio)];
    }

    // 2. Resolver áreas
    let areasToAssign: string[] = [];
    if (area === "TODAS" || area === "todas") {
      const areaRes = await pool.query(
        `SELECT DISTINCT area FROM dba WHERE version_curricular = $1 AND estado = 'ACTIVO' ORDER BY area`,
        [version_curricular]
      );
      if (areaRes.rows.length === 0) {
        res.status(400).json({ error: "No existen DBA activos en el catálogo para esta versión curricular" });
        return;
      }
      areasToAssign = areaRes.rows.map(r => r.area);
    } else {
      areasToAssign = [area];
    }

    // 3. Resolver grados y realizar asignaciones
    const insertedRows: any[] = [];

    for (const currentArea of areasToAssign) {
      let gradesToAssign: string[] = [];

      if (grado === "TODOS") {
        const dbaCheck = await pool.query(
          `SELECT DISTINCT grado FROM dba 
           WHERE area = $1 AND version_curricular = $2 AND estado = 'ACTIVO'`,
          [currentArea, version_curricular]
        );
        if (dbaCheck.rows.length === 0) continue;
        gradesToAssign = dbaCheck.rows.map(r => r.grado);
      } else {
        const dbaCheck = await pool.query(
          `SELECT 1 FROM dba 
           WHERE area = $1 AND grado = $2 AND version_curricular = $3 AND estado = 'ACTIVO' LIMIT 1`,
          [currentArea, grado, version_curricular]
        );
        if (dbaCheck.rows.length === 0) continue;
        gradesToAssign = [grado];
      }

      for (const sId of schoolIds) {
        for (const g of gradesToAssign) {
          const result = await pool.query(
            `INSERT INTO colegio_version_curricular (id_colegio, area, grado, version_curricular, fecha_asignacion)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (id_colegio, area, grado)
             DO UPDATE SET version_curricular = EXCLUDED.version_curricular, fecha_asignacion = NOW()
             RETURNING *`,
            [sId, currentArea, g, version_curricular]
          );
          insertedRows.push(result.rows[0]);
        }
      }
    }

    if (insertedRows.length === 0) {
      res.status(400).json({ error: "No se encontraron combinaciones válidas de área/grado/versión para asignar" });
      return;
    }

    res.json({ message: `Versión curricular asignada exitosamente (${insertedRows.length} registros)`, rows: insertedRows });
  } catch (error: any) {
    console.error("Error al asignar versión curricular a colegio:", error);
    res.status(500).json({ error: "Error al asignar versión curricular al colegio" });
  }
};

// ============================================================================
// 12. LISTAR ASIGNACIONES DE UN COLEGIO
// ============================================================================
export const listarAsignaciones = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { colegioId } = req.params;

    const result = await pool.query(
      `SELECT cvc.*, c.nombre as nombre_colegio 
       FROM colegio_version_curricular cvc
       JOIN colegio c ON c.id_colegio = cvc.id_colegio
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
         END ASC`,
      [colegioId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error("Error al listar asignaciones de colegio:", error);
    res.status(500).json({ error: "Error al listar las asignaciones del colegio" });
  }
};

// ============================================================================
// 13. ESTADÍSTICAS DEL CATÁLOGO DBA
// ============================================================================
export const estadisticasDBA = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const statsDba = await pool.query(`SELECT COUNT(*)::int as total FROM dba`);
    const statsEvidencias = await pool.query(`SELECT COUNT(*)::int as total FROM evidencias_dba`);
    const statsAreas = await pool.query(`SELECT COUNT(DISTINCT area)::int as total FROM dba`);
    const statsVersiones = await pool.query(`SELECT COUNT(DISTINCT version_curricular)::int as total FROM dba`);
    const statsActivos = await pool.query(`SELECT COUNT(*)::int as total FROM dba WHERE estado = 'ACTIVO'`);

    res.json({
      totalDba: statsDba.rows[0].total,
      totalEvidencias: statsEvidencias.rows[0].total,
      totalAreas: statsAreas.rows[0].total,
      totalVersiones: statsVersiones.rows[0].total,
      totalActivos: statsActivos.rows[0].total
    });
  } catch (error: any) {
    console.error("Error al obtener estadísticas de DBA:", error);
    res.status(500).json({ error: "Error al obtener estadísticas del catálogo" });
  }
};

// ============================================================================
// 14. IMPORTAR DBA DESDE PDF (CORRE EL SCRIPT PYTHON)
// ============================================================================
export const importarDBAPDF = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const { area, version_curricular, start_page } = req.body;

    if (!file) {
      res.status(400).json({ error: "Debe subir un archivo PDF" });
      return;
    }

    if (!area || !version_curricular) {
      // Clean up uploaded file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      res.status(400).json({ error: "El área y la versión curricular son obligatorios" });
      return;
    }

    const startPageVal = start_page ? Number(start_page) : 8;
    const overwriteVal = req.body.overwrite === 'true' || req.body.overwrite === true;

    if (overwriteVal) {
      console.log(`Sobreasecribiendo: Eliminando DBAs anteriores para el área "${area}" versión "${version_curricular}"`);
      await pool.query(
        "DELETE FROM dba WHERE UPPER(TRIM(area)) = UPPER(TRIM($1)) AND version_curricular = $2",
        [area, version_curricular]
      );
    }

    let scriptName = "importar_dba.py";
    const lowerOrigName = file.originalname.toLowerCase();
    const lowerArea = area.toLowerCase();
    if (lowerOrigName.includes("transicion-y-primaria") || 
        lowerOrigName.includes("transicion_y_primaria") ||
        (lowerArea.includes("ingl") && version_curricular === "2016" && startPageVal === 8)) {
      scriptName = "importar_dba_primaria_ingles.py";
    }

    const scriptPath = path.join(__dirname, `../../scripts/${scriptName}`);

    console.log(`Iniciando importación por Python: script=${scriptPath}, pdf=${file.path}, area=${area}, version=${version_curricular}, start_page=${startPageVal}`);

    // Spawn python child process
    const python = spawn("python", [
      scriptPath,
      "--pdf", file.path,
      "--area", area,
      "--version", version_curricular,
      "--start-page", String(startPageVal)
    ]);

    let stdoutData = "";
    let stderrData = "";

    python.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    python.on("close", (code) => {
      // Cleanup the uploaded temp file
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (err) {
        console.error("Error al borrar archivo PDF temporal:", err);
      }

      console.log("Python stdout:", stdoutData);
      if (stderrData) {
        console.error("Python stderr:", stderrData);
      }

      if (code !== 0) {
        res.status(500).json({
          error: "Error durante el procesamiento del PDF por el script de importación",
          details: stderrData || stdoutData
        });
        return;
      }

      // Intentar extraer el resumen del output
      let summary = stdoutData;
      const startMarker = "================ RESUMEN DE IMPORTACIÓN ================";
      const endMarker = "========================================================";
      const startIdx = stdoutData.indexOf(startMarker);
      const endIdx = stdoutData.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        summary = stdoutData.substring(startIdx, endIdx + endMarker.length);
      }

      res.json({
        message: "PDF importado con éxito",
        summary: summary.trim(),
        fullOutput: stdoutData
      });
    });

  } catch (error: any) {
    console.error("Error en importarDBAPDF:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {}
    }
    res.status(500).json({ error: "Error interno al importar el PDF" });
  }
};

// ============================================================================
// 15. ELIMINAR DBA
// ============================================================================
export const eliminarDBA = async (req: AuthRequest, res: Response): Promise<void> => {
  const dbaId = Number(req.params.id);
  if (!dbaId) {
    res.status(400).json({ error: "ID de DBA inválido" });
    return;
  }

  try {
    // Verificar si el DBA existe
    const dbaRes = await pool.query("SELECT id_dba, numero_dba FROM dba WHERE id_dba = $1", [dbaId]);
    if (dbaRes.rows.length === 0) {
      res.status(404).json({ error: "DBA no encontrado" });
      return;
    }

    // Proceder a eliminar (la base de datos se encargará de cascada para evidencias y nulos)
    await pool.query("DELETE FROM dba WHERE id_dba = $1", [dbaId]);

    res.json({ message: `DBA #${dbaRes.rows[0].numero_dba} eliminado exitosamente.` });
  } catch (error: any) {
    console.error("Error al eliminar DBA:", error);
    res.status(500).json({ error: "Error al eliminar el DBA de la base de datos" });
  }
};

// ============================================================================
// 16. LISTAR COMBINACIONES EXISTENTES (ÁREA Y VERSIÓN)
// ============================================================================
export const listarCombinacionesDba = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT area, version_curricular 
       FROM dba 
       ORDER BY area, version_curricular`
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error al listar combinaciones de dba:", error);
    res.status(500).json({ error: "Error al listar las materias y versiones existentes" });
  }
};
