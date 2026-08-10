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

/**
 * GET /api/traslados/personal/:schoolId
 * Retorna el personal vinculado activo del colegio, excluyendo directivos y estudiantes.
 * Usado para el selector de TRASLADO_USUARIO.
 */
export const getPersonalColegio = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const schoolId = parseInt(String(req.params.schoolId), 10);
    if (isNaN(schoolId)) {
      res.status(400).json({ error: 'ID de colegio inválido' });
      return;
    }

    const personal = await TrasladoService.getPersonalColegio(schoolId);
    res.json(personal);
  } catch (error: any) {
    console.error('Error en getPersonalColegio:', error);
    res.status(500).json({ error: 'Error al consultar el personal del colegio' });
  }
};

/**
 * GET /api/traslados/admin/global
 * Retorna TODOS los traslados del sistema con filtros avanzados.
 * Exclusivo para admin_general.
 */
export const getAdminTrasladosGlobal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!req.user.roles.includes('admin_general')) {
      res.status(403).json({ error: 'Acceso restringido al Administrador General.' });
      return;
    }

    const filter = {
      estado: req.query.estado as string | undefined,
      tipo: req.query.tipo as string | undefined,
      id_colegio_origen: req.query.id_colegio_origen ? Number(req.query.id_colegio_origen) : undefined,
      id_colegio_destino: req.query.id_colegio_destino ? Number(req.query.id_colegio_destino) : undefined,
      fecha_desde: req.query.fecha_desde as string | undefined,
      fecha_hasta: req.query.fecha_hasta as string | undefined,
    };

    const solicitudes = await TrasladoService.getAllSolicitudesGlobal(filter);
    res.json(solicitudes);
  } catch (error: any) {
    console.error('Error en getAdminTrasladosGlobal:', error);
    res.status(500).json({ error: 'Error al consultar traslados globales' });
  }
};

/**
 * GET /api/traslados/admin/estadisticas
 * Retorna métricas globales de traslados (contadores por estado y tipo).
 * Exclusivo para admin_general.
 */
export const getAdminEstadisticas = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!req.user.roles.includes('admin_general')) {
      res.status(403).json({ error: 'Acceso restringido al Administrador General.' });
      return;
    }

    const estadisticas = await TrasladoService.getEstadisticasGlobales();
    res.json(estadisticas);
  } catch (error: any) {
    console.error('Error en getAdminEstadisticas:', error);
    res.status(500).json({ error: 'Error al consultar estadísticas de traslados' });
  }
};

/**
 * POST /api/traslados/:id/intervencion
 * Permite al admin_general intervenir excepcionalmente en una solicitud
 * (CANCELAR o RECHAZAR con motivo obligatorio).
 * No reemplaza las aprobaciones institucionales normales del flujo.
 */
export const intervenirTraslado = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!req.user.roles.includes('admin_general')) {
      res.status(403).json({ error: 'Solo el Administrador General puede realizar intervenciones administrativas.' });
      return;
    }

    const idSolicitud = parseInt(String(req.params.id), 10);
    if (isNaN(idSolicitud)) {
      res.status(400).json({ error: 'ID de solicitud inválido' });
      return;
    }

    const { accion, motivo } = req.body;

    if (!accion || !['CANCELAR', 'RECHAZAR'].includes(accion)) {
      res.status(400).json({ error: "La acción debe ser 'CANCELAR' o 'RECHAZAR'." });
      return;
    }

    if (!motivo || String(motivo).trim().length < 10) {
      res.status(400).json({ error: 'El motivo de intervención es obligatorio y debe tener al menos 10 caracteres.' });
      return;
    }

    const result = await TrasladoService.registrarIntervencionAdmin(
      idSolicitud,
      accion as 'CANCELAR' | 'RECHAZAR',
      String(motivo),
      req.user.id
    );

    res.json(result);
  } catch (error: any) {
    console.error('Error en intervenirTraslado:', error);
    res.status(400).json({ error: error.message || 'Error al registrar la intervención administrativa' });
  }
};
