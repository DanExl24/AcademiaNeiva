import { Request, Response } from "express";
import { MatriculaService } from "../services/matriculaService";

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
    const matriculas = await MatriculaService.getAllPending(Number(idColegio));
    res.json(matriculas);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMatriculaDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const details = await MatriculaService.getDetails(Number(id));
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

