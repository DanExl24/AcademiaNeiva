import { Response } from "express";
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

    const dbaId = Number(id);
    if (!dbaId) {
      res.status(400).json({ error: "ID de DBA inválido" });
      return;
    }

    // Obtener información del DBA
    const dba = await db
      .selectFrom("dba")
      .selectAll()
      .where("id_dba", "=", dbaId)
      .executeTakeFirst();

    if (!dba) {
      res.status(404).json({ error: "DBA no encontrado" });
      return;
    }

    // RN-DBA-008: Si se va a inactivar, verificar si ya fue asignado a algún colegio
    if (estado === "INACTIVO") {
      const activeCheck = await db
        .selectFrom("colegio_version_curricular")
        .select("id")
        .where("area", "=", dba.area)
        .where("grado", "=", dba.grado)
        .where("version_curricular", "=", dba.version_curricular)
        .executeTakeFirst();

      if (activeCheck) {
        res.status(400).json({ 
          error: "No se puede inactivar este DBA porque la versión curricular del área/grado está asignada a uno o más colegios" 
        });
        return;
      }
    }

    const updated = await db
      .updateTable("dba")
      .set({
        estado,
        updated_at: sql`NOW()`
      })
      .where("id_dba", "=", dbaId)
      .returningAll()
      .executeTakeFirstOrThrow();

    res.json(updated);
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

    const dbaId = Number(id);
    if (!dbaId) {
      res.status(400).json({ error: "ID de DBA inválido" });
      return;
    }

    // RN-DBA-003: Verificar que el DBA exista y esté activo
    const dbaCheck = await db
      .selectFrom("dba")
      .select("estado")
      .where("id_dba", "=", dbaId)
      .executeTakeFirst();

    if (!dbaCheck) {
      res.status(404).json({ error: "DBA no encontrado" });
      return;
    }
    if (dbaCheck.estado !== "ACTIVO") {
      res.status(400).json({ error: "No se pueden agregar evidencias a un DBA inactivo" });
      return;
    }

    const newEvidencia = await db
      .insertInto("evidencias_dba")
      .values({
        id_dba: dbaId,
        descripcion,
        orden: Number(orden) || 1,
        estado: "ACTIVO"
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    res.status(201).json(newEvidencia);
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

    const evidenciaId = Number(id);
    if (!evidenciaId) {
      res.status(400).json({ error: "ID de evidencia inválido" });
      return;
    }

    const check = await db
      .selectFrom("evidencias_dba")
      .select("id_evidencia_dba")
      .where("id_evidencia_dba", "=", evidenciaId)
      .executeTakeFirst();

    if (!check) {
      res.status(404).json({ error: "Evidencia de aprendizaje no encontrada" });
      return;
    }

    const updated = await db
      .updateTable("evidencias_dba")
      .set({
        descripcion,
        orden: Number(orden) || 1
      })
      .where("id_evidencia_dba", "=", evidenciaId)
      .returningAll()
      .executeTakeFirstOrThrow();

    res.json(updated);
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

    const evidenciaId = Number(id);
    if (!evidenciaId) {
      res.status(400).json({ error: "ID de evidencia inválido" });
      return;
    }

    const check = await db
      .selectFrom("evidencias_dba")
      .select("id_evidencia_dba")
      .where("id_evidencia_dba", "=", evidenciaId)
      .executeTakeFirst();

    if (!check) {
      res.status(404).json({ error: "Evidencia de aprendizaje no encontrada" });
      return;
    }

    const updated = await db
      .updateTable("evidencias_dba")
      .set({ estado })
      .where("id_evidencia_dba", "=", evidenciaId)
      .returningAll()
      .executeTakeFirstOrThrow();

    res.json(updated);
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
    const rows = await db
      .selectFrom("dba")
      .select("version_curricular")
      .distinct()
      .orderBy("version_curricular", "desc")
      .execute();
    const versiones = rows.map((row) => row.version_curricular);
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
    const rows = await db
      .selectFrom("dba")
      .select("area")
      .distinct()
      .orderBy("area", "asc")
      .execute();
    const areas = rows.map((row) => row.area);
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
      const activeSchools = await db
        .selectFrom("colegio")
        .select("id_colegio")
        .where("estado", "=", "ACTIVO")
        .execute();
      schoolIds = activeSchools.map((r) => r.id_colegio);
    } else {
      const colCheck = await db
        .selectFrom("colegio")
        .select("id_colegio")
        .where("id_colegio", "=", Number(id_colegio))
        .executeTakeFirst();

      if (!colCheck) {
        res.status(404).json({ error: "Colegio no encontrado" });
        return;
      }
      schoolIds = [colCheck.id_colegio];
    }

    // 2. Resolver áreas
    let areasToAssign: string[] = [];
    if (area === "TODAS" || area === "todas") {
      const areaRows = await db
        .selectFrom("dba")
        .select("area")
        .distinct()
        .where("version_curricular", "=", version_curricular)
        .where("estado", "=", "ACTIVO")
        .orderBy("area", "asc")
        .execute();

      if (areaRows.length === 0) {
        res.status(400).json({ error: "No existen DBA activos en el catálogo para esta versión curricular" });
        return;
      }
      areasToAssign = areaRows.map((r) => r.area);
    } else {
      areasToAssign = [area];
    }

    // 3. Resolver grados y realizar asignaciones
    const insertedRows: any[] = [];

    for (const currentArea of areasToAssign) {
      let gradesToAssign: string[] = [];

      if (grado === "TODOS") {
        const dbaCheck = await db
          .selectFrom("dba")
          .select("grado")
          .distinct()
          .where("area", "=", currentArea)
          .where("version_curricular", "=", version_curricular)
          .where("estado", "=", "ACTIVO")
          .execute();

        if (dbaCheck.length === 0) continue;
        gradesToAssign = dbaCheck.map((r) => r.grado);
      } else {
        const dbaCheck = await db
          .selectFrom("dba")
          .select("id_dba")
          .where("area", "=", currentArea)
          .where("grado", "=", grado)
          .where("version_curricular", "=", version_curricular)
          .where("estado", "=", "ACTIVO")
          .executeTakeFirst();

        if (!dbaCheck) continue;
        gradesToAssign = [grado];
      }

      for (const sId of schoolIds) {
        for (const g of gradesToAssign) {
          const result = await db
            .insertInto("colegio_version_curricular")
            .values({
              id_colegio: sId,
              area: currentArea,
              grado: g,
              version_curricular,
              fecha_asignacion: sql`NOW()`
            })
            .onConflict((oc) =>
              oc.columns(["id_colegio", "area", "grado"]).doUpdateSet({
                version_curricular,
                fecha_asignacion: sql`NOW()`
              })
            )
            .returningAll()
            .executeTakeFirstOrThrow();

          insertedRows.push(result);
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
    const schoolId = Number(colegioId);

    if (!schoolId) {
      res.status(400).json({ error: "ID de colegio inválido" });
      return;
    }

    const rows = await db
      .selectFrom("colegio_version_curricular as cvc")
      .innerJoin("colegio as c", "c.id_colegio", "cvc.id_colegio")
      .select([
        "cvc.id",
        "cvc.id_colegio",
        "cvc.area",
        "cvc.grado",
        "cvc.version_curricular",
        "cvc.fecha_asignacion",
        "c.nombre as nombre_colegio"
      ])
      .where("cvc.id_colegio", "=", schoolId)
      .orderBy("cvc.area", "asc")
      .orderBy(
        sql`CASE cvc.grado
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
         END`,
        "asc"
      )
      .execute();

    res.json(rows);
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
    const [statsDba, statsEvidencias, statsAreas, statsVersiones, statsActivos] = await Promise.all([
      db.selectFrom("dba").select(sql<number>`COUNT(*)::int`.as("total")).executeTakeFirst(),
      db.selectFrom("evidencias_dba").select(sql<number>`COUNT(*)::int`.as("total")).executeTakeFirst(),
      db.selectFrom("dba").select(sql<number>`COUNT(DISTINCT area)::int`.as("total")).executeTakeFirst(),
      db.selectFrom("dba").select(sql<number>`COUNT(DISTINCT version_curricular)::int`.as("total")).executeTakeFirst(),
      db.selectFrom("dba").select(sql<number>`COUNT(*)::int`.as("total")).where("estado", "=", "ACTIVO").executeTakeFirst(),
    ]);

    res.json({
      totalDba: statsDba?.total ?? 0,
      totalEvidencias: statsEvidencias?.total ?? 0,
      totalAreas: statsAreas?.total ?? 0,
      totalVersiones: statsVersiones?.total ?? 0,
      totalActivos: statsActivos?.total ?? 0
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
      console.log(`Sobrescribiendo: Eliminando DBAs anteriores para el área "${area}" versión "${version_curricular}"`);
      await db
        .deleteFrom("dba")
        .where(sql`UPPER(TRIM(area))`, "=", area.trim().toUpperCase())
        .where("version_curricular", "=", version_curricular)
        .execute();
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

    if (!fs.existsSync(scriptPath)) {
      console.error(`Script de importación no encontrado: ${scriptPath}`);
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      res.status(500).json({
        error: "El script de importación de DBA no se encuentra en el servidor",
        details: scriptPath
      });
      return;
    }

    const pythonBin = process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");

    console.log(`Iniciando importación por Python (${pythonBin}): script=${scriptPath}, pdf=${file.path}, area=${area}, version=${version_curricular}, start_page=${startPageVal}`);

    // Spawn python child process
    const python = spawn(pythonBin, [
      scriptPath,
      "--pdf", file.path,
      "--area", area,
      "--version", version_curricular,
      "--start-page", String(startPageVal)
    ], {
      env: {
        ...process.env,
        DB_HOST: process.env.DB_HOST || "localhost",
        DB_PORT: process.env.DB_PORT || "5432",
        DB_NAME: process.env.DB_NAME || "AcademiaNeiva",
        DB_USER: process.env.DB_USER || "postgres",
        DB_PASSWORD: process.env.DB_PASSWORD || "postgres",
      }
    });

    let stdoutData = "";
    let stderrData = "";

    python.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    python.on("error", (err) => {
      console.error("Error ejecutando el intérprete de Python:", err);
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (_) {}
      if (!res.headersSent) {
        res.status(500).json({
          error: "Error al iniciar el proceso de Python en el servidor",
          details: err.message
        });
      }
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
    const dba = await db
      .selectFrom("dba")
      .select(["id_dba", "numero_dba"])
      .where("id_dba", "=", dbaId)
      .executeTakeFirst();

    if (!dba) {
      res.status(404).json({ error: "DBA no encontrado" });
      return;
    }

    // Proceder a eliminar (la base de datos se encargará de cascada para evidencias y nulos)
    await db
      .deleteFrom("dba")
      .where("id_dba", "=", dbaId)
      .execute();

    res.json({ message: `DBA #${dba.numero_dba} eliminado exitosamente.` });
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
    const rows = await db
      .selectFrom("dba")
      .select(["area", "version_curricular"])
      .distinct()
      .orderBy("area", "asc")
      .orderBy("version_curricular", "asc")
      .execute();

    res.json(rows);
  } catch (error: any) {
    console.error("Error al listar combinaciones de dba:", error);
    res.status(500).json({ error: "Error al listar las materias y versiones existentes" });
  }
};
