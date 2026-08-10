import { pool } from '../config/db';
import { CreateTrasladoInput, ApproveTrasladoInput, FilterTrasladoInput } from '../dtos/traslado.dto';

export class TrasladoService {
  /**
   * Crear una solicitud de traslado
   */
  static async crearSolicitud(input: CreateTrasladoInput, idUsuarioCreador: number, rolCreador: string): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { tipo, id_usuario, id_colegio_origen, id_colegio_destino, id_matricula, motivo } = input;

      // 1. Verificar existencia de usuario
      const userRes = await client.query('SELECT id_usuario, nombre, apellido, email FROM usuario WHERE id_usuario = $1', [id_usuario]);
      if (userRes.rows.length === 0) {
        throw new Error('El usuario especificado no existe.');
      }

      // 2. Verificar existencia de colegios
      const origenRes = await client.query('SELECT id_colegio, nombre FROM colegio WHERE id_colegio = $1', [id_colegio_origen]);
      if (origenRes.rows.length === 0) {
        throw new Error('La institución de origen no existe.');
      }

      const destinoRes = await client.query('SELECT id_colegio, nombre FROM colegio WHERE id_colegio = $1', [id_colegio_destino]);
      if (destinoRes.rows.length === 0) {
        throw new Error('La institución de destino no existe.');
      }

      // 3. Verificar que el usuario tenga vinculación previa en origen
      const linkOrigenRes = await client.query(
        `SELECT * FROM usuario_colegio WHERE id_usuario = $1 AND id_colegio = $2 AND estado = 'ACTIVO'`,
        [id_usuario, id_colegio_origen]
      );
      if (linkOrigenRes.rows.length === 0) {
        throw new Error('El usuario no posee una vinculación activa con la institución de origen.');
      }

      // 4. Verificar que no tenga ya vinculación activa en destino
      const linkDestinoRes = await client.query(
        `SELECT * FROM usuario_colegio WHERE id_usuario = $1 AND id_colegio = $2 AND estado = 'ACTIVO'`,
        [id_usuario, id_colegio_destino]
      );
      if (linkDestinoRes.rows.length > 0) {
        throw new Error('El usuario ya posee una vinculación activa con la institución de destino.');
      }

      // 5. Verificar que no exista otra solicitud pendiente para el mismo usuario entre estos colegios
      const pendingRes = await client.query(
        `SELECT id_solicitud FROM solicitud_traslado 
         WHERE id_usuario = $1 AND id_colegio_origen = $2 AND id_colegio_destino = $3 
         AND estado IN ('SOLICITADA', 'EN_APROBACION')`,
        [id_usuario, id_colegio_origen, id_colegio_destino]
      );
      if (pendingRes.rows.length > 0) {
        throw new Error('Ya existe una solicitud de traslado pendiente para este usuario.');
      }

      // 6. Insertar solicitud de traslado
      const insertSolRes = await client.query(
        `INSERT INTO solicitud_traslado 
         (tipo, id_usuario, id_colegio_origen, id_colegio_destino, id_matricula, estado, motivo, creado_por)
         VALUES ($1, $2, $3, $4, $5, 'EN_APROBACION', $6, $7)
         RETURNING *`,
        [tipo, id_usuario, id_colegio_origen, id_colegio_destino, id_matricula || null, motivo, idUsuarioCreador]
      );

      const solicitud = insertSolRes.rows[0];

      // 7. Auto-aprobar el paso de quien crea la solicitud
      let rolAprobacion = 'CREADOR';
      let accionComentario = `Solicitud creada por ${rolCreador}`;

      if (idUsuarioCreador === id_usuario) {
        rolAprobacion = 'USUARIO';
        accionComentario = 'Auto-aprobación del usuario afectado al crear la solicitud';
      } else if (rolCreador.includes('admin_general')) {
        rolAprobacion = 'ADMIN_GENERAL';
      } else {
        // Verificar si el creador es directivo de origen o destino
        const dirRes = await client.query('SELECT id_colegio FROM directivo WHERE id_usuario = $1', [idUsuarioCreador]);
        if (dirRes.rows.length > 0) {
          const colDir = dirRes.rows[0].id_colegio;
          if (colDir === id_colegio_origen) {
            rolAprobacion = 'DIRECTIVO_ORIGEN';
          } else if (colDir === id_colegio_destino) {
            rolAprobacion = 'DIRECTIVO_DESTINO';
          }
        }
      }

      await client.query(
        `INSERT INTO traslado_aprobacion (id_solicitud, id_usuario, rol, accion, comentario)
         VALUES ($1, $2, $3, 'APROBAR', $4)`,
        [solicitud.id_solicitud, idUsuarioCreador, rolAprobacion, accionComentario]
      );

      await client.query('COMMIT');

      // 8. Evaluar si con la auto-aprobación ya se pueden ejecutar acciones
      return await this.evaluarYEjecutarSiCompleto(solicitud.id_solicitud);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Registrar una decisión (Aprobar / Rechazar / Cancelar) sobre una solicitud
   */
  static async registrarAprobacion(
    idSolicitud: number,
    input: ApproveTrasladoInput,
    idUsuarioAprobador: number,
    rolesAprobador: string[],
    colegioIdAprobador: number | null
  ): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Obtener la solicitud
      const solRes = await client.query('SELECT * FROM solicitud_traslado WHERE id_solicitud = $1', [idSolicitud]);
      if (solRes.rows.length === 0) {
        throw new Error('La solicitud de traslado no existe.');
      }

      const solicitud = solRes.rows[0];

      if (['APROBADA', 'RECHAZADA', 'CANCELADA', 'EJECUTADA'].includes(solicitud.estado)) {
        throw new Error(`La solicitud ya se encuentra en estado final (${solicitud.estado}).`);
      }

      // 2. Determinar el rol de aprobación
      let rolAprobacion = '';
      if (rolesAprobador.includes('admin_general')) {
        rolAprobacion = 'ADMIN_GENERAL';
      } else if (idUsuarioAprobador === solicitud.id_usuario) {
        rolAprobacion = 'USUARIO';
      } else if (colegioIdAprobador === solicitud.id_colegio_origen) {
        rolAprobacion = 'DIRECTIVO_ORIGEN';
      } else if (colegioIdAprobador === solicitud.id_colegio_destino) {
        rolAprobacion = 'DIRECTIVO_DESTINO';
      } else {
        throw new Error('No posees autorización para actuar sobre esta solicitud de traslado.');
      }

      // 3. Registrar la aprobación/rechazo
      await client.query(
        `INSERT INTO traslado_aprobacion (id_solicitud, id_usuario, rol, accion, comentario)
         VALUES ($1, $2, $3, $4, $5)`,
        [idSolicitud, idUsuarioAprobador, rolAprobacion, input.accion, input.comentario || null]
      );

      // 4. Si la acción es RECHAZAR o CANCELAR -> Finalizar inmediatamente
      if (input.accion === 'RECHAZAR' || input.accion === 'CANCELAR') {
        const nuevoEstado = input.accion === 'RECHAZAR' ? 'RECHAZADA' : 'CANCELADA';
        await client.query(
          `UPDATE solicitud_traslado SET estado = $1, fecha_finalizacion = NOW() WHERE id_solicitud = $2`,
          [nuevoEstado, idSolicitud]
        );
        await client.query('COMMIT');
        return await this.getSolicitudDetalle(idSolicitud);
      }

      await client.query('COMMIT');

      // 5. Evaluar si se han completado todas las aprobaciones requeridas
      return await this.evaluarYEjecutarSiCompleto(idSolicitud);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verifica si una solicitud posee las aprobaciones requeridas y la ejecuta en transacción
   */
  private static async evaluarYEjecutarSiCompleto(idSolicitud: number): Promise<any> {
    const solRes = await pool.query('SELECT * FROM solicitud_traslado WHERE id_solicitud = $1', [idSolicitud]);
    if (solRes.rows.length === 0) return null;

    const solicitud = solRes.rows[0];

    // Obtener todas las aprobaciones de esta solicitud
    const apRes = await pool.query(
      `SELECT rol, accion FROM traslado_aprobacion WHERE id_solicitud = $1 AND accion = 'APROBAR'`,
      [idSolicitud]
    );

    const rolesAprobados = new Set(apRes.rows.map(r => r.rol));

    const tieneOrigen = rolesAprobados.has('DIRECTIVO_ORIGEN') || rolesAprobados.has('ADMIN_GENERAL');
    const tieneDestino = rolesAprobados.has('DIRECTIVO_DESTINO') || rolesAprobados.has('ADMIN_GENERAL');
    const tieneUsuario = rolesAprobados.has('USUARIO') || rolesAprobados.has('ADMIN_GENERAL');

    // Si posee las 3 aprobaciones o fue aprobado por Admin General -> Ejecutar Traslado
    if ((tieneOrigen && tieneDestino && tieneUsuario) || rolesAprobados.has('ADMIN_GENERAL')) {
      return await this.ejecutarTrasladoTransaccional(idSolicitud);
    }

    return await this.getSolicitudDetalle(idSolicitud);
  }

  /**
   * Ejecución final del traslado dentro de una transacción atómica PostgreSQL
   */
  private static async ejecutarTrasladoTransaccional(idSolicitud: number): Promise<any> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const solRes = await client.query('SELECT * FROM solicitud_traslado WHERE id_solicitud = $1 FOR UPDATE', [idSolicitud]);
      const solicitud = solRes.rows[0];

      if (solicitud.estado === 'EJECUTADA') {
        await client.query('COMMIT');
        return await this.getSolicitudDetalle(idSolicitud);
      }

      // 1. Obtener el rol del usuario en la institución origen
      const linkOrigenRes = await client.query(
        `SELECT id_rol FROM usuario_colegio WHERE id_usuario = $1 AND id_colegio = $2 AND estado = 'ACTIVO' LIMIT 1`,
        [solicitud.id_usuario, solicitud.id_colegio_origen]
      );
      
      const idRol = linkOrigenRes.rows.length > 0 ? linkOrigenRes.rows[0].id_rol : 1; // Default a rol

      // 2. Inactivar la vinculación con el Colegio Origen
      await client.query(
        `UPDATE usuario_colegio 
         SET estado = 'INACTIVO', fecha_fin = NOW() 
         WHERE id_usuario = $1 AND id_colegio = $2 AND estado = 'ACTIVO'`,
        [solicitud.id_usuario, solicitud.id_colegio_origen]
      );

      // 3. Crear/Activar la vinculación con el Colegio Destino
      await client.query(
        `INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio)
         VALUES ($1, $2, $3, 'ACTIVO', NOW())
         ON CONFLICT (id_usuario, id_colegio, id_rol) 
         DO UPDATE SET estado = 'ACTIVO', fecha_inicio = NOW(), fecha_fin = NULL`,
        [solicitud.id_usuario, solicitud.id_colegio_destino, idRol]
      );

      // 4. Actualizar el colegio activo del usuario en la tabla usuario
      await client.query(
        `UPDATE usuario SET id_colegio = $1 WHERE id_usuario = $2`,
        [solicitud.id_colegio_destino, solicitud.id_usuario]
      );

      // 5. Si es un traslado de estudiante con matrícula asignada
      if (solicitud.tipo === 'TRASLADO_MATRICULA' && solicitud.id_matricula) {
        await client.query(
          `UPDATE matricula SET estado = 'TRASLADADA' WHERE id_matricula = $1`,
          [solicitud.id_matricula]
        );

        // Actualizar el colegio del estudiante
        await client.query(
          `UPDATE estudiante SET id_colegio = $1 WHERE id_usuario = $2`,
          [solicitud.id_colegio_destino, solicitud.id_usuario]
        );
      }

      // 6. Marcar la solicitud como EJECUTADA
      await client.query(
        `UPDATE solicitud_traslado SET estado = 'EJECUTADA', fecha_finalizacion = NOW() WHERE id_solicitud = $1`,
        [idSolicitud]
      );

      await client.query('COMMIT');
      return await this.getSolicitudDetalle(idSolicitud);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener solicitudes de traslado filtradas por colegio y rol de acceso
   */
  static async getSolicitudesPorColegio(idColegio: number, filter?: FilterTrasladoInput): Promise<any[]> {
    let query = `
      SELECT st.*, 
             u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, u.email AS usuario_email, u.documento AS usuario_documento,
             co.nombre AS colegio_origen_nombre,
             cd.nombre AS colegio_destino_nombre,
             uc.nombre AS creador_nombre, uc.apellido AS creador_apellido
      FROM solicitud_traslado st
      JOIN usuario u ON st.id_usuario = u.id_usuario
      JOIN colegio co ON st.id_colegio_origen = co.id_colegio
      JOIN colegio cd ON st.id_colegio_destino = cd.id_colegio
      JOIN usuario uc ON st.creado_por = uc.id_usuario
      WHERE (st.id_colegio_origen = $1 OR st.id_colegio_destino = $1)
    `;

    const params: any[] = [idColegio];

    if (filter?.estado) {
      params.push(filter.estado);
      query += ` AND st.estado = $${params.length}`;
    }

    if (filter?.tipo) {
      params.push(filter.tipo);
      query += ` AND st.tipo = $${params.length}`;
    }

    query += ` ORDER BY st.fecha_creacion DESC`;

    const res = await pool.query(query, params);
    return res.rows;
  }

  /**
   * Obtener el detalle completo con la cronología de aprobaciones
   */
  static async getSolicitudDetalle(idSolicitud: number): Promise<any> {
    const solRes = await pool.query(
      `SELECT st.*, 
              u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, u.email AS usuario_email, u.documento AS usuario_documento,
              co.nombre AS colegio_origen_nombre,
              cd.nombre AS colegio_destino_nombre,
              uc.nombre AS creador_nombre, uc.apellido AS creador_apellido
       FROM solicitud_traslado st
       JOIN usuario u ON st.id_usuario = u.id_usuario
       JOIN colegio co ON st.id_colegio_origen = co.id_colegio
       JOIN colegio cd ON st.id_colegio_destino = cd.id_colegio
       JOIN usuario uc ON st.creado_por = uc.id_usuario
       WHERE st.id_solicitud = $1`,
      [idSolicitud]
    );

    if (solRes.rows.length === 0) return null;

    const solicitud = solRes.rows[0];

    const apRes = await pool.query(
      `SELECT ta.*, u.nombre AS usuario_nombre, u.apellido AS usuario_apellido, u.email AS usuario_email
       FROM traslado_aprobacion ta
       JOIN usuario u ON ta.id_usuario = u.id_usuario
       WHERE ta.id_solicitud = $1
       ORDER BY ta.fecha ASC`,
      [idSolicitud]
    );

    solicitud.aprobaciones = apRes.rows;
    return solicitud;
  }

  /**
   * Obtener las instituciones vinculadas a un usuario
   */
  static async getVinculacionesUsuario(idUsuario: number): Promise<any[]> {
    const res = await pool.query(
      `SELECT uc.*, c.nombre AS colegio_nombre, c.escudo_url, r.nombre AS rol_nombre
       FROM usuario_colegio uc
       JOIN colegio c ON uc.id_colegio = c.id_colegio
       JOIN rol r ON uc.id_rol = r.id_rol
       WHERE uc.id_usuario = $1
       ORDER BY uc.fecha_inicio DESC`,
      [idUsuario]
    );
    return res.rows;
  }
}
