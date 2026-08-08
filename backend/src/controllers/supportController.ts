import { Request, Response } from 'express';
import { pool } from '../config/db';
import { NotificationService } from '../services/notificationService';

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
  const { nombre_remitente, correo_remitente, telefono, tipo_incidencia, asunto, descripcion, id_colegio, estado, id_estudiante } = req.body;
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
        userDocument = u.documento || null;

        const userRole = (user.role || u.rol || '').toUpperCase();

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
       (id_usuario, nombre_remitente, correo_remitente, telefono, tipo_incidencia, asunto, descripcion, id_colegio, estado, id_estudiante)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id_ticket`,
      [finalUserId, finalSenderName, finalSenderEmail, telefono || null, tipo_incidencia, asunto, descripcion, finalSchoolId, ticketStatus, id_estudiante ? Number(id_estudiante) : null]
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
    let query = `
      SELECT t.*, 
             c.nombre AS colegio_nombre,
             e.nombre AS estudiante_nombre,
             e.apellido AS estudiante_apellido,
             u_e.documento AS estudiante_documento,
             e.codigo AS estudiante_codigo,
             e.estado AS estudiante_estado
      FROM tickets_soporte t 
      LEFT JOIN colegio c ON t.id_colegio = c.id_colegio
      LEFT JOIN estudiante e ON t.id_estudiante = e.id_estudiante
      LEFT JOIN usuario u_e ON e.id_usuario = u_e.id_usuario
    `;
    const params: any[] = [];

    if (userRole === 'DIRECTIVO') {
      const userRes = await pool.query('SELECT id_colegio FROM usuario WHERE id_usuario = $1', [user.id]);
      const schoolId = user.schoolId || userRes.rows[0]?.id_colegio;
      if (!schoolId) {
        return res.status(403).json({ error: 'El directivo no está asociado a ningún colegio.' });
      }
      
      if (escalados === 'true') {
        // Directivo ve los escalados de su colegio
        query += " WHERE t.id_colegio = $1 AND t.fecha_escalado IS NOT NULL";
      } else {
        // Directivo ve los de su colegio (excluyendo tickets escalados)
        query += " WHERE t.id_colegio = $1 AND t.fecha_escalado IS NULL";
      }
      params.push(schoolId);
    } else if (userRole === 'ADMIN_GENERAL') {
      // Admin General SOLO ve los tickets que están escalados
      query += " WHERE t.fecha_escalado IS NOT NULL";
    } else if (userRole === 'DOCENTE' || userRole === 'PADRE') {
      // Docente o Padre ve únicamente los tickets creados por él (por ID o por correo)
      query += " WHERE (t.id_usuario = $1 OR (t.correo_remitente IS NOT NULL AND LOWER(t.correo_remitente) = LOWER($2)))";
      params.push(user.id, user.email || '');
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

  if (!['ABIERTO', 'EN_PROCESO', 'RESUELTO'].includes(estado)) {
    return res.status(400).json({ error: 'Estado de ticket inválido.' });
  }

  try {
    const userRole = (user.role || '').toUpperCase();
    const ticketRes = await pool.query('SELECT id_colegio, fecha_escalado, estado, observaciones FROM tickets_soporte WHERE id_ticket = $1', [id]);
    
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    const ticket = ticketRes.rows[0];

    // Regla: Si el ticket actual está en estado RESUELTO, no permitir cambios de estado.
    if (ticket.estado === 'RESUELTO') {
      return res.status(400).json({ error: 'El ticket ya está RESUELTO y no puede modificarse su estado.' });
    }

    // RN-002: No se puede cambiar a ABIERTO si el ticket estaba EN_PROCESO, si es de tipo REINGRESO, ya tiene observaciones o fue escalado.
    if (estado === 'ABIERTO') {
      if (ticket.estado === 'EN_PROCESO' || ticket.tipo_incidencia === 'REINGRESO') {
        return res.status(400).json({ error: 'Un ticket de reingreso o que se encuentra EN PROCESO no puede ser revertido al estado ABIERTO.' });
      }

      let obsCount = 0;
      try {
        const obsList = typeof ticket.observaciones === 'string'
          ? JSON.parse(ticket.observaciones || '[]')
          : (ticket.observaciones || []);
        obsCount = obsList.length;
      } catch {
        obsCount = 0;
      }
      if (obsCount > 0 || ticket.fecha_escalado) {
        return res.status(400).json({ error: 'No se puede regresar al estado ABIERTO porque el ticket ya posee observaciones o fue escalado.' });
      }
    }

    // RN-005 & RN-006: Solo el Administrador General puede modificar el estado de un ticket escalado.
    if (ticket.fecha_escalado && userRole === 'DIRECTIVO') {
      return res.status(403).json({ error: 'Solo el Administrador General puede modificar el estado de un ticket escalado.' });
    }

    if (userRole === 'DIRECTIVO') {
      const userRes = await pool.query('SELECT id_colegio FROM usuario WHERE id_usuario = $1', [user.id]);
      const schoolId = user.schoolId || userRes.rows[0]?.id_colegio;
      if (Number(schoolId) !== Number(ticket.id_colegio)) {
        return res.status(403).json({ error: 'Acceso denegado a este ticket de soporte.' });
      }
    } else if (userRole !== 'ADMIN_GENERAL') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const oldEstado = ticket.estado;

    // RN-009: Generar observación de auditoría de cambio de estado
    if (oldEstado !== estado) {
      const authorRes = await pool.query('SELECT nombre, apellido FROM usuario WHERE id_usuario = $1', [user.id]);
      const authorName = authorRes.rows.length > 0 
        ? `${authorRes.rows[0].nombre} ${authorRes.rows[0].apellido || ''}`.trim()
        : 'Personal de soporte';

      let currentObs = [];
      try {
        currentObs = typeof ticket.observaciones === 'string'
          ? JSON.parse(ticket.observaciones || '[]')
          : (ticket.observaciones || []);
      } catch {
        currentObs = [];
      }

      currentObs.push({
        id_usuario: Number(user.id),
        nombre_usuario: 'Sistema (Auditoría)',
        tipo: 'SISTEMA',
        mensaje: `El estado del ticket fue cambiado de ${oldEstado} a ${estado} por ${authorName}.`,
        fecha_creacion: new Date().toISOString()
      });

      await pool.query(
        'UPDATE tickets_soporte SET estado = $1, observaciones = $2 WHERE id_ticket = $3',
        [estado, JSON.stringify(currentObs), id]
      );
    } else {
      await pool.query(
        'UPDATE tickets_soporte SET estado = $1 WHERE id_ticket = $2',
        [estado, id]
      );
    }

    if (oldEstado !== 'EN_PROCESO' && estado === 'EN_PROCESO') {
      NotificationService.sendReingresoInProcessEmail(
        ticket.correo_remitente,
        ticket.nombre_remitente,
        ticket.codigo_ticket || `TKT-${ticket.id_ticket}`,
        ticket.estudiante_nombre ? `${ticket.estudiante_nombre} ${ticket.estudiante_apellido || ''}`.trim() : undefined
      ).catch((err: any) => console.error('Error enviando correo de ticket en proceso:', err));
    }

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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const ticketRes = await client.query(
        'SELECT estado, observaciones, id_colegio FROM tickets_soporte WHERE id_ticket = $1 FOR UPDATE', 
        [id]
      );
      
      if (ticketRes.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ error: 'Ticket no encontrado.' });
      }

      const ticket = ticketRes.rows[0];

      // Regla: Si el ticket actual está en estado RESUELTO, no permitir escalamiento.
      if (ticket.estado === 'RESUELTO') {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Un ticket RESUELTO no puede ser escalado.' });
      }

      if (userRole === 'DIRECTIVO') {
        const userRes = await client.query('SELECT id_colegio FROM usuario WHERE id_usuario = $1', [user.id]);
        const schoolId = user.schoolId || userRes.rows[0]?.id_colegio;
        if (Number(schoolId) !== Number(ticket.id_colegio)) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(403).json({ error: 'Acceso denegado.' });
        }
      }

      // RN-004: Si el estado actual es ABIERTO, pasa automáticamente a EN_PROCESO
      let nuevoEstado = ticket.estado;
      if (ticket.estado === 'ABIERTO') {
        nuevoEstado = 'EN_PROCESO';
      }

      // Obtener nombre del Directivo
      const authorRes = await client.query('SELECT nombre, apellido FROM usuario WHERE id_usuario = $1', [user.id]);
      const authorName = authorRes.rows.length > 0 
        ? `${authorRes.rows[0].nombre} ${authorRes.rows[0].apellido || ''}`.trim()
        : 'Directivo responsable';

      // Parsear observaciones anteriores
      let currentObs = [];
      try {
        currentObs = typeof ticket.observaciones === 'string'
          ? JSON.parse(ticket.observaciones || '[]')
          : (ticket.observaciones || []);
      } catch {
        currentObs = [];
      }

      // RN-009: Añadir la observación automática de auditoría
      const auditText = `El Directivo ${authorName} escaló esta solicitud al Administrador General.`;
      currentObs.push({
        id_usuario: Number(user.id),
        nombre_usuario: 'Sistema (Escalamiento)',
        tipo: 'SISTEMA',
        mensaje: auditText,
        fecha_creacion: new Date().toISOString()
      });

      // Actualizar el ticket con fecha_escalado
      await client.query(
        `UPDATE tickets_soporte 
         SET estado = $1, fecha_escalado = CURRENT_TIMESTAMP, observaciones = $2 
         WHERE id_ticket = $3`,
        [nuevoEstado, JSON.stringify(currentObs), id]
      );

      await client.query('COMMIT');
      client.release();

      return res.json({ message: 'Ticket de soporte escalado exitosamente al Administrador General.' });
    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      throw error;
    }
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
      `SELECT t.*, 
              c.nombre AS colegio_nombre,
              e.nombre AS estudiante_nombre,
              e.apellido AS estudiante_apellido,
              u_e.documento AS estudiante_documento,
              e.codigo AS estudiante_codigo,
              e.estado AS estudiante_estado
       FROM tickets_soporte t 
       LEFT JOIN colegio c ON t.id_colegio = c.id_colegio 
       LEFT JOIN estudiante e ON t.id_estudiante = e.id_estudiante
       LEFT JOIN usuario u_e ON e.id_usuario = u_e.id_usuario
       WHERE t.codigo_ticket = $1`,
      [code.trim().toUpperCase()]
    );

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket de soporte no encontrado. Valida el código.' });
    }

    const ticket = ticketRes.rows[0];
    
    // Obtener observaciones ya parseadas
    let obsList = [];
    try {
      obsList = typeof ticket.observaciones === 'string'
        ? JSON.parse(ticket.observaciones || '[]')
        : (ticket.observaciones || []);
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

// POST: Registrar observación de directivo / admin general / usuario remitente
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
    const isStaff = userRole === 'DIRECTIVO' || userRole === 'ADMIN_GENERAL';

    const ticketRes = await pool.query('SELECT * FROM tickets_soporte WHERE id_ticket = $1', [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }
    const ticket = ticketRes.rows[0];

    // Regla: Si el ticket actual está en estado RESUELTO, no permitir más observaciones.
    if (ticket.estado === 'RESUELTO') {
      return res.status(400).json({ error: 'El ticket ya está RESUELTO y no se permiten más observaciones.' });
    }

    // Parsear observaciones anteriores
    let currentObs = [];
    try {
      currentObs = typeof ticket.observaciones === 'string'
        ? JSON.parse(ticket.observaciones || '[]')
        : (ticket.observaciones || []);
    } catch {
      currentObs = [];
    }

    if (isStaff) {
      if (userRole === 'DIRECTIVO') {
        const userRes = await pool.query('SELECT id_colegio FROM usuario WHERE id_usuario = $1', [user.id]);
        const schoolId = user.schoolId || userRes.rows[0]?.id_colegio;
        if (Number(schoolId) !== Number(ticket.id_colegio)) {
          return res.status(403).json({ error: 'Acceso denegado.' });
        }
      }
    } else {
      // Regla para usuarios (Docente / Padre / Estudiante)
      const userRes = await pool.query('SELECT email, id_colegio FROM usuario WHERE id_usuario = $1', [user.id]);
      const userEmail = userRes.rows[0]?.email;
      const userSchoolId = userRes.rows[0]?.id_colegio;

      const isOwner = (ticket.id_usuario && Number(ticket.id_usuario) === Number(user.id)) ||
                      (ticket.correo_remitente && ticket.correo_remitente.toLowerCase() === (userEmail || '').toLowerCase()) ||
                      (userSchoolId && Number(userSchoolId) === Number(ticket.id_colegio));

      if (!isOwner) {
        return res.status(403).json({ error: 'Acceso denegado.' });
      }

      // Regla de Turnos (Ping-Pong): El usuario SOLO puede responder si la ÚLTIMA observación fue de Directivo/Admin
      if (currentObs.length === 0) {
        return res.status(400).json({ error: 'No puedes responder a este ticket hasta que el colegio o administrador haya registrado una observación.' });
      }

      const lastObs = currentObs[currentObs.length - 1];
      if (lastObs.tipo !== 'DIRECTIVO' && lastObs.tipo !== 'ADMIN_GENERAL') {
        return res.status(400).json({ error: 'Debes esperar a que el personal del colegio o el administrador responda tu mensaje anterior antes de enviar otro.' });
      }
    }

    // Obtener nombre completo del autor
    const authorRes = await pool.query('SELECT nombre, apellido FROM usuario WHERE id_usuario = $1', [user.id]);
    const authorName = authorRes.rows.length > 0 
      ? `${authorRes.rows[0].nombre} ${authorRes.rows[0].apellido || ''}`.trim()
      : 'Usuario';

    // Concatenar nueva observación estructurada
    const newObs = {
      id_usuario: Number(user.id),
      nombre_usuario: authorName,
      tipo: userRole,
      mensaje: observacion.trim(),
      fecha_creacion: new Date().toISOString()
    };
    currentObs.push(newObs);

    // RN-003: Cambiar estado a EN_PROCESO si estaba ABIERTO y fue respondido por staff
    let nuevoEstado = ticket.estado;
    if (isStaff && ticket.estado === 'ABIERTO') {
      nuevoEstado = 'EN_PROCESO';
    }

    // Guardar en la BD tanto observaciones como el nuevo estado
    await pool.query(
      'UPDATE tickets_soporte SET observaciones = $1, estado = $2 WHERE id_ticket = $3',
      [JSON.stringify(currentObs), nuevoEstado, id]
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

// POST: Registrar observación de visitante (docente/padre) con reglas de ping-pong
export const addVisitorObservation = async (req: Request, res: Response) => {
  const codeStr = String(req.params.code || '');
  const { observacion } = req.body;

  if (!observacion || !observacion.trim()) {
    return res.status(400).json({ error: 'La observación no puede estar vacía.' });
  }

  try {
    const ticketRes = await pool.query(
      'SELECT id_ticket, estado, observaciones, nombre_remitente FROM tickets_soporte WHERE codigo_ticket = $1', 
      [codeStr.trim().toUpperCase()]
    );

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado.' });
    }

    const ticket = ticketRes.rows[0];

    // Regla: Si el ticket actual está en estado RESUELTO, no permitir observaciones.
    if (ticket.estado === 'RESUELTO') {
      return res.status(400).json({ error: 'El ticket ya está RESUELTO y no se permiten más observaciones.' });
    }

    // Parsear observaciones anteriores
    let currentObs = [];
    try {
      currentObs = typeof ticket.observaciones === 'string'
        ? JSON.parse(ticket.observaciones || '[]')
        : (ticket.observaciones || []);
    } catch {
      currentObs = [];
    }

    // Regla de Turnos: El visitante SOLO puede responder si hay una observación del Directivo/Admin
    if (currentObs.length === 0) {
      return res.status(400).json({ error: 'No puedes responder a este ticket hasta que el colegio o administrador haya registrado una observación.' });
    }

    const lastObs = currentObs[currentObs.length - 1];
    if (lastObs.tipo !== 'DIRECTIVO' && lastObs.tipo !== 'ADMIN_GENERAL') {
      return res.status(400).json({ error: 'Debes esperar a que el personal del colegio o el administrador responda tu mensaje anterior antes de enviar otro.' });
    }

    // Concatenar observación del visitante
    const newObs = {
      id_usuario: null,
      nombre_usuario: `${ticket.nombre_remitente} (Remitente)`,
      tipo: 'REMITENTE',
      mensaje: observacion.trim(),
      fecha_creacion: new Date().toISOString()
    };
    currentObs.push(newObs);

    // RN-003: Cambiar estado a EN_PROCESO si estaba ABIERTO
    let nuevoEstado = ticket.estado;
    if (ticket.estado === 'ABIERTO') {
      nuevoEstado = 'EN_PROCESO';
    }

    // Guardar en la BD tanto observaciones como el nuevo estado
    await pool.query(
      'UPDATE tickets_soporte SET observaciones = $1, estado = $2 WHERE id_ticket = $3',
      [JSON.stringify(currentObs), nuevoEstado, ticket.id_ticket]
    );

    return res.json({
      message: 'Respuesta registrada exitosamente.',
      observaciones: currentObs
    });
  } catch (error) {
    console.error('Error adding visitor observation:', error);
    return res.status(500).json({ error: 'Error al registrar tu respuesta.' });
  }
};
