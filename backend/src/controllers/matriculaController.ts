import { Request, Response } from "express";
import { MatriculaService } from "../services/matriculaService";
import { pool } from "../config/db";
import path from "path";
import fs from "fs";

export const submitEnrollment = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const files = req.files;

    console.log('=== SUBMIT ENROLLMENT ===');
    console.log('Body:', JSON.stringify(data));
    console.log('Files keys:', files ? Object.keys(files) : 'NONE');

    const result = await MatriculaService.createEnrollment(data, files);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('=== ERROR en submitEnrollment ===');
    console.error('Mensaje:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
};

export const getPendingMatriculas = async (req: Request, res: Response) => {
  try {
    const { idColegio } = req.params;
    const { yearId } = req.query;

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (!isSupervision && authReq.user?.schoolId && authReq.user.schoolId !== Number(idColegio)) {
      res.status(403).json({ error: "No tiene permiso para consultar las matrículas de este colegio." });
      return;
    }

    const matriculas = await MatriculaService.getAllPending(Number(idColegio), yearId ? Number(yearId) : undefined);
    res.json(matriculas);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMatriculaDetails = async (req: Request, res: Response) => {
  try {
    const idStr = String(req.params.id || "");
    if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idStr)) {
      const details = await MatriculaService.getByToken(idStr);
      res.json(details);
      return;
    }

    const details = await MatriculaService.getDetails(Number(idStr));

    const authReq = req as any;
    const isSupervision = authReq.user && authReq.user.roles.includes("admin_general");
    if (authReq.user && !isSupervision && authReq.user.schoolId && details && details.id_colegio !== authReq.user.schoolId) {
      res.status(403).json({ error: "No tiene permiso para acceder al expediente de esta matrícula." });
      return;
    }

    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const validateDocument = async (req: Request, res: Response) => {
  try {
    const { idDocumento } = req.params;
    const { estado } = req.body; // 'VALIDADO' o 'RECHAZADO'
    const updated = await MatriculaService.updateDocumentStatus(Number(idDocumento), estado);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const assignGrade = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { idGrado } = req.body;
    const result = await MatriculaService.assignGrade(Number(id), Number(idGrado));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const notifyInconsistencies = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await MatriculaService.notifyInconsistencies(Number(id));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const finalizeEnrollment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const result = await MatriculaService.finalizeEnrollment(Number(id), data);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const cancelEnrollment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body; // { motivo, detalles }
    const result = await MatriculaService.cancelEnrollment(Number(id), data);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleTransfer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { es_traslado } = req.body;
    const result = await MatriculaService.toggleTransferStatus(Number(id), Boolean(es_traslado));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const downloadDocumentFile = async (req: Request, res: Response) => {
  try {
    const { idDocumento } = req.params;
    const queryRes = await pool.query(
      `SELECT id_documento, contenido, mime_type, nombre_original, url 
       FROM documento_matriculas 
       WHERE id_documento = $1`,
      [idDocumento]
    );

    if (queryRes.rows.length === 0) {
      res.status(404).json({ error: "Documento no encontrado" });
      return;
    }

    const doc = queryRes.rows[0];

    // If file binary bytea exists in DB
    if (doc.contenido && Buffer.isBuffer(doc.contenido)) {
      const filename = doc.nombre_original || doc.url || `documento-${idDocumento}`;
      let contentType = doc.mime_type;

      if (!contentType) {
        const ext = path.extname(filename).toLowerCase();
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.svg') contentType = 'image/svg+xml';
        else contentType = 'application/octet-stream';
      }

      res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(doc.contenido);
      return;
    }

    // Fallback for legacy files stored on local disk
    if (doc.url && doc.url !== 'PENDIENTE') {
      const diskFilename = path.basename(doc.url);
      const filePath = path.join(process.cwd(), 'uploads', diskFilename);

      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
        return;
      }
    }

    res.status(404).json({ error: "El archivo adjunto no existe o está pendiente de carga" });
  } catch (error: any) {
    console.error("Error al descargar documento:", error);
    res.status(500).json({ error: "Error en el servidor al obtener el archivo" });
  }
};

export const sendEnrollmentEmailCode = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = await MatriculaService.sendEnrollmentEmailCode(email);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const verifyEnrollmentEmailCode = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    const result = await MatriculaService.verifyEnrollmentEmailCode(email, code);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};


