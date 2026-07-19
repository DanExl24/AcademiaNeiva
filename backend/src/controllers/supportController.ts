import { Request, Response } from 'express';
import { pool } from '../config/db';

// Helper: Decodificar Base36 de precisión arbitraria
function parseBase36(str: string): bigint {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = 0n;
  for (const char of str.toUpperCase()) {
    const val = BigInt(alphabet.indexOf(char));
    if (val < 0n) throw new Error("Carácter inválido en Base36");
    result = result * 36n + val;
  }
  return result;
}

// Helper: Codificar Código de Ticket Base36 Ofuscado
function encodeTicketCode(idTicket: number, idColegio: number | null, documento: string | null): string {
  const yearStr = String(new Date().getFullYear()); // 4 dígitos
  const schoolStr = String(idColegio || 0).slice(0, 3).padStart(3, '0'); // 3 dígitos
  
  // Limpiar documento para que sea solo numérico (10 dígitos)
  let cleanDoc = String(documento || '0').replace(/\D/g, '');
  if (!cleanDoc || cleanDoc === '0') {
    // Si es visitante sin documento, generamos un valor de relleno basado en el timestamp
    cleanDoc = String(Date.now()).slice(-10);
  }
  const docStr = cleanDoc.slice(0, 10).padStart(10, '0'); // 10 dígitos
  const ticketStr = String(idTicket).slice(0, 5).padStart(5, '0'); // 5 dígitos

  // Concatenación: 4 + 3 + 10 + 5 = 22 dígitos numéricos
  const numericString = yearStr + schoolStr + docStr + ticketStr;
  
  // Codificar en Base36 y pasar a mayúsculas
  const base36Code = BigInt(numericString).toString(36).toUpperCase();
  return `TKT-${base36Code}`;
}

export const createTicket = async (req: Request, res: Response) => {
  const { nombre_remitente, correo_remitente, telefono, tipo_incidencia, asunto, descripcion, id_colegio, estado } = req.body;
  const user = (req as any).user; // Si está autenticado

  try {
    let finalUserId: number | null = null;
    let finalSchoolId: number | null = id_colegio ? Number(id_colegio) : null;
    let finalSenderName = nombre_remitente;
    let finalSenderEmail = correo_remitente;
    let ticketStatus = 'ABIERTO';
    let userDocument: string | null = null;

    if (user) {
      // Usuario autenticado: resolvemos información desde la BD
      finalUserId = Number(user.id);
      
      const userRes = await pool.query(
        'SELECT nombre, apellido, email, id_colegio, rol FROM usuario WHERE id_usuario = $1',
        [finalUserId]
      );

      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        finalSchoolId = u.id_colegio ? Number(u.id_colegio) : finalSchoolId;
        finalSenderName = `${u.nombre} ${u.apellido}`;
        finalSenderEmail = u.email;

        // Intentar obtener el documento del usuario según su rol
        const userRole = (user.role || u.rol || '').toUpperCase();
        if (userRole === 'DOCENTE') {
          const docRes = await pool.query('SELECT documento FROM docente WHERE id_usuario = $1', [finalUserId]);
          if (docRes.rows.length > 0) userDocument = docRes.rows[0].documento;
        } else if (userRole === 'PADRE') {
          const docRes = await pool.query('SELECT documento FROM padre_familia WHERE id_usuario = $1', [finalUserId]);
          if (docRes.rows.length > 0) userDocument = docRes.rows[0].documento;
        } else if (userRole === 'ESTUDIANTE') {
          const docRes = await pool.query('SELECT documento FROM estudiante WHERE id_usuario = $1', [finalUserId]);
          if (docRes.rows.length > 0) userDocument = docRes.rows[0].documento;
        }

        // Si es Directivo y envía la petición de escalado, el estado inicial será ESCALADO
        if (estado === 'ESCALADO' && (userRole === 'DIRECTIVO' || userRole === 'ADMIN_GENERAL')) {
          ticketStatus = 'ESCALADO';
        }
      }
    }

    if (!finalSenderName || !finalSenderEmail || !tipo_incidencia || !asunto || !descripcion) {
      return res.status(400).json({ error: 'Nombre, correo, tipo de incidencia, asunto y descripción son requeridos.' });
    }

    // Insertamos el ticket
    const insertRes = await pool.query(
      `INSERT INTO tickets_soporte 
       (id_usuario, nombre_remitente, correo_remitente, telefono, tipo_incidencia, asunto, descripcion, id_colegio, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id_ticket`,
      [finalUserId, finalSenderName, finalSenderEmail, telefono || null, tipo_incidencia, asunto, descripcion, finalSchoolId, ticketStatus]
    );

    const idTicket = insertRes.rows[0].id_ticket;
    
    // Generar el código Base36 ofuscado
    const ticketCode = encodeTicketCode(idTicket, finalSchoolId, userDocument || telefono || null);
    
    // Persistir el código ofuscado
    await pool.query(
      'UPDATE tickets_soporte SET codigo_ticket = $1 WHERE id_ticket = $2',
      [ticketCode, idTicket]
    );

    return res.status(201).json({
      message: 'Ticket de soporte creado exitosamente.',
      ticketCode,
      id_ticket: idTicket
    });
  } catch (error: any) {
    console.error('Error creating support ticket:', error);
    return res.status(500).json({ error: 'Error al registrar el ticket de soporte.' });
  }
};

export const getTickets = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { escalados } = req.query; // flag 'true' | 'false'

  if (!user) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const userRole = (user.role || '').toUpperCase();
    let query = 'SELECT t.*, c.nombre as colegio_nombre FROM tickets_soporte t LEFT JOIN colegio c ON t.id_colegio = c.id_colegio';
    const params: any[] = [];

    if (userRole === 'DIRECTIVO') {
      const userRes = await pool.query('SELECT id_colegio FROM usuario WHERE id_usuario = $1', [user.id]);
      const schoolId = userRes.rows[0]?.id_colegio;
      if (!schoolId) {
        return res.status(403).json({ error: 'El directivo no está asociado a ningún colegio.' });
      }
      
      if (escalados === 'true') {
        // Directivo ve los escalados de su colegio
        query += " WHERE t.id_colegio = $1 AND t.estado = 'ESCALADO'";
      } else {
        // Directivo ve los de su colegio (excluyendo tickets escalados)
        query += " WHERE t.id_colegio = $1 AND t.estado != 'ESCALADO'";
      }
      params.push(schoolId);
    } else if (userRole === 'ADMIN_GENERAL') {
      // Admin General SOLO ve los tickets que están en estado ESCALADO
      query += " WHERE t.estado = 'ESCALADO'";
    } else {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    query += ' ORDER BY t.fecha_creacion DESC';
    const result = await pool.query(query, params);

    return res.json({ tickets: result.rows });
  } catch (error: any) {
    console.error('Error fetching support tickets:', error);
    return res.status(500).json({ error: 'Error al consultar tickets de soporte.' });
  }
};

export const updateTicketStatus = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { estado } = req.body;

  if (!user) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'ESCALADO'].includes(estado)) {
    return res.status(400).json({ error: 'Estado de ticket inválido.' });
  }

  try {
    const userRole = (user.role || '').toUpperCase();
    const ticketRes = await pool.query('SELECT id_colegio FROM tickets_soporte WHERE id_ticket = $1', [id]);
    
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    if (userRole === 'DIRECTIVO') {
      const userRes = await pool.query('SELECT id_colegio FROM usuario WHERE id_usuario = $1', [user.id]);
      const schoolId = userRes.rows[0]?.id_colegio;
      if (Number(schoolId) !== Number(ticketRes.rows[0].id_colegio)) {
        return res.status(403).json({ error: 'Acceso denegado a este ticket de soporte.' });
      }
    } else if (userRole !== 'ADMIN_GENERAL') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    await pool.query(
      'UPDATE tickets_soporte SET estado = $1 WHERE id_ticket = $2',
      [estado, id]
    );

    return res.json({ message: 'Estado del ticket actualizado exitosamente.' });
  } catch (error: any) {
    console.error('Error updating support ticket status:', error);
    return res.status(500).json({ error: 'Error al actualizar el estado del ticket.' });
  }
};

export const escalateTicket = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;

  if (!user) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const userRole = (user.role || '').toUpperCase();
    if (userRole !== 'DIRECTIVO' && userRole !== 'ADMIN_GENERAL') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const ticketRes = await pool.query('SELECT id_colegio FROM tickets_soporte WHERE id_ticket = $1', [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    if (userRole === 'DIRECTIVO') {
      const userRes = await pool.query('SELECT id_colegio FROM usuario WHERE id_usuario = $1', [user.id]);
      const schoolId = userRes.rows[0]?.id_colegio;
      if (Number(schoolId) !== Number(ticketRes.rows[0].id_colegio)) {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }
    }

    await pool.query(
      "UPDATE tickets_soporte SET estado = 'ESCALADO' WHERE id_ticket = $1",
      [id]
    );

    return res.json({ message: 'Ticket de soporte escalado exitosamente al Administrador General.' });
  } catch (error: any) {
    console.error('Error escalating support ticket:', error);
    return res.status(500).json({ error: 'Error al escalar el ticket de soporte.' });
  }
};

// GET: Consultar seguimiento de ticket por código
export const getTicketByCode = async (req: Request, res: Response) => {
  const code = String(req.params.code || '');

  try {
    const ticketRes = await pool.query(
      `SELECT t.*, c.nombre as colegio_nombre 
       FROM tickets_soporte t 
       LEFT JOIN colegio c ON t.id_colegio = c.id_colegio 
       WHERE t.codigo_ticket = $1`,
      [code.trim().toUpperCase()]
    );

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket de soporte no encontrado. Valida el código.' });
    }

    const ticket = ticketRes.rows[0];
    
    // Parsear observaciones
    let obsList = [];
    try {
      obsList = JSON.parse(ticket.observaciones || '[]');
    } catch {
      obsList = [];
    }

    return res.json({
      ticket: {
        ...ticket,
        observaciones: obsList
      }
    });
  } catch (error) {
    console.error('Error tracking ticket by code:', error);
    return res.status(500).json({ error: 'Error al consultar el seguimiento del ticket.' });
  }
};

// POST: Registrar observación de directivo / admin general
export const addTicketObservation = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;
  const { observacion } = req.body;

  if (!user) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!observacion || !observacion.trim()) {
    return res.status(400).json({ error: 'La observación no puede estar vacía.' });
  }

  try {
    const userRole = (user.role || '').toUpperCase();
    if (userRole !== 'DIRECTIVO' && userRole !== 'ADMIN_GENERAL') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const ticketRes = await pool.query('SELECT observaciones, id_colegio FROM tickets_soporte WHERE id_ticket = $1', [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    if (userRole === 'DIRECTIVO') {
      const userRes = await pool.query('SELECT id_colegio FROM usuario WHERE id_usuario = $1', [user.id]);
      const schoolId = userRes.rows[0]?.id_colegio;
      if (Number(schoolId) !== Number(ticketRes.rows[0].id_colegio)) {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }
    }

    // Definir autor
    const autor = userRole === 'ADMIN_GENERAL' ? 'Administrador General' : 'Coordinación / Rectoría';
    
    // Parsear observaciones anteriores
    let currentObs = [];
    try {
      currentObs = JSON.parse(ticketRes.rows[0].observaciones || '[]');
    } catch {
      currentObs = [];
    }

    // Concatenar nueva observación
    const newObs = {
      fecha: new Date().toISOString(),
      autor,
      texto: observacion.trim()
    };
    currentObs.push(newObs);

    // Guardar en la BD
    await pool.query(
      'UPDATE tickets_soporte SET observaciones = $1 WHERE id_ticket = $2',
      [JSON.stringify(currentObs), id]
    );

    return res.json({ 
      message: 'Observación agregada exitosamente.',
      observaciones: currentObs
    });
  } catch (error) {
    console.error('Error adding ticket observation:', error);
    return res.status(500).json({ error: 'Error al registrar la observación del ticket.' });
  }
};
