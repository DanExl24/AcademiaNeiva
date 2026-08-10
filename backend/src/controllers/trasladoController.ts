import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { TrasladoService } from '../services/trasladoService';

export const createTraslado = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const result = await TrasladoService.crearSolicitud(
      req.body,
      req.user.id,
      req.user.role
    );

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error en createTraslado:', error);
    res.status(400).json({ error: error.message || 'Error al crear la solicitud de traslado' });
  }
};

export const approveTraslado = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const idSolicitud = parseInt(String(req.params.id), 10);
    if (isNaN(idSolicitud)) {
      res.status(400).json({ error: 'ID de solicitud inválido' });
      return;
    }

    const result = await TrasladoService.registrarAprobacion(
      idSolicitud,
      req.body,
      req.user.id,
      req.user.roles,
      req.user.schoolId
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error en approveTraslado:', error);
    res.status(400).json({ error: error.message || 'Error al procesar la aprobación del traslado' });
  }
};

export const getTraslados = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const schoolId = req.user.schoolId;
    if (!schoolId && !req.user.roles.includes('admin_general')) {
      res.status(400).json({ error: 'Se requiere una institución asociada' });
      return;
    }

    const filter = {
      estado: req.query.estado as any,
      tipo: req.query.tipo as any,
      id_colegio: schoolId || undefined
    };

    const solicitudes = await TrasladoService.getSolicitudesPorColegio(schoolId || Number(req.query.id_colegio), filter);
    res.json(solicitudes);
  } catch (error: any) {
    console.error('Error en getTraslados:', error);
    res.status(500).json({ error: 'Error al consultar las solicitudes de traslado' });
  }
};

export const getTrasladoById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const idSolicitud = parseInt(String(req.params.id), 10);
    if (isNaN(idSolicitud)) {
      res.status(400).json({ error: 'ID de solicitud inválido' });
      return;
    }

    const detalle = await TrasladoService.getSolicitudDetalle(idSolicitud);
    if (!detalle) {
      res.status(404).json({ error: 'Solicitud de traslado no encontrada' });
      return;
    }

    res.json(detalle);
  } catch (error: any) {
    console.error('Error en getTrasladoById:', error);
    res.status(500).json({ error: 'Error al obtener el detalle del traslado' });
  }
};

export const getMyVinculaciones = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const vinculaciones = await TrasladoService.getVinculacionesUsuario(req.user.id);
    res.json(vinculaciones);
  } catch (error: any) {
    console.error('Error en getMyVinculaciones:', error);
    res.status(500).json({ error: 'Error al consultar las vinculaciones del usuario' });
  }
};
