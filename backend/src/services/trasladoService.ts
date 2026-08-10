import { sql } from 'kysely';
import { db } from '../config/kysely';
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
      const userRow = await db
        .selectFrom('usuario')
        .select(['id_usuario', 'nombre', 'apellido', 'email'])
        .where('id_usuario', '=', id_usuario)
        .executeTakeFirst();
      if (!userRow) throw new Error('El usuario especificado no existe.');

      // 2. Verificar existencia de colegios
      const origenRow = await db
        .selectFrom('colegio')
        .select(['id_colegio', 'nombre'])
        .where('id_colegio', '=', id_colegio_origen)
        .executeTakeFirst();
      if (!origenRow) throw new Error('La institución de origen no existe.');

      const destinoRow = await db
        .selectFrom('colegio')
        .select(['id_colegio', 'nombre'])
        .where('id_colegio', '=', id_colegio_destino)
        .executeTakeFirst();
      if (!destinoRow) throw new Error('La institución de destino no existe.');

      // 3. Verificar vinculación activa en origen
      const linkOrigen = await db
        .selectFrom('usuario_colegio')
        .select('id_usuario_colegio')
        .where('id_usuario', '=', id_usuario)
        .where('id_colegio', '=', id_colegio_origen)
        .where('estado', '=', 'ACTIVO')
        .executeTakeFirst();
      if (!linkOrigen) throw new Error('El usuario no posee una vinculación activa con la institución de origen.');

      // 4. Verificar que no exista ya vinculación activa en destino
      const linkDestino = await db
        .selectFrom('usuario_colegio')
        .select('id_usuario_colegio')
        .where('id_usuario', '=', id_usuario)
        .where('id_colegio', '=', id_colegio_destino)
        .where('estado', '=', 'ACTIVO')
        .executeTakeFirst();
      if (linkDestino) throw new Error('El usuario ya posee una vinculación activa con la institución de destino.');

      // 5. Verificar que no exista solicitud pendiente entre estos colegios para el usuario
      const pending = await db
        .selectFrom('solicitud_traslado')
        .select('id_solicitud')
        .where('id_usuario', '=', id_usuario)
        .where('id_colegio_origen', '=', id_colegio_origen)
        .where('id_colegio_destino', '=', id_colegio_destino)
        .where('estado', 'in', ['SOLICITADA', 'EN_APROBACION'])
        .executeTakeFirst();
      if (pending) throw new Error('Ya existe una solicitud de traslado pendiente para este usuario.');

      // 6. Insertar solicitud de traslado (transacción raw necesaria para el ON CONFLICT / RETURNING)
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
        const dirRow = await db
          .selectFrom('directivo')
          .select('id_colegio')
          .where('id_usuario', '=', idUsuarioCreador)
          .executeTakeFirst();
        if (dirRow) {
          if (dirRow.id_colegio === id_colegio_origen) rolAprobacion = 'DIRECTIVO_ORIGEN';
          else if (dirRow.id_colegio === id_colegio_destino) rolAprobacion = 'DIRECTIVO_DESTINO';
        }
      }

      await client.query(
        `INSERT INTO traslado_aprobacion (id_solicitud, id_usuario, rol, accion, comentario)
         VALUES ($1, $2, $3, 'APROBAR', $4)`,
        [solicitud.id_solicitud, idUsuarioCreador, rolAprobacion, accionComentario]
      );

      await client.query('COMMIT');
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

      const solicitud = await db
        .selectFrom('solicitud_traslado')
        .selectAll()
        .where('id_solicitud', '=', idSolicitud)
        .executeTakeFirst();

      if (!solicitud) throw new Error('La solicitud de traslado no existe.');
      if (['APROBADA', 'RECHAZADA', 'CANCELADA', 'EJECUTADA'].includes(solicitud.estado)) {
        throw new Error(`La solicitud ya se encuentra en estado final (${solicitud.estado}).`);
      }

      // Determinar rol de aprobación
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

      await client.query(
        `INSERT INTO traslado_aprobacion (id_solicitud, id_usuario, rol, accion, comentario)
         VALUES ($1, $2, $3, $4, $5)`,
        [idSolicitud, idUsuarioAprobador, rolAprobacion, input.accion, input.comentario || null]
      );

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
      return await this.evaluarYEjecutarSiCompleto(idSolicitud);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Intervención administrativa del Admin General (solo situaciones excepcionales)
   */
  static async registrarIntervencionAdmin(
    idSolicitud: number,
    accion: 'CANCELAR' | 'RECHAZAR',
    motivo: string,
    idAdmin: number
  ): Promise<any> {
    if (!motivo || motivo.trim().length < 10) {
      throw new Error('El motivo de la intervención administrativa es obligatorio y debe tener al menos 10 caracteres.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const solicitud = await db
        .selectFrom('solicitud_traslado')
        .selectAll()
        .where('id_solicitud', '=', idSolicitud)
        .executeTakeFirst();

      if (!solicitud) throw new Error('La solicitud de traslado no existe.');
      if (['RECHAZADA', 'CANCELADA', 'EJECUTADA'].includes(solicitud.estado)) {
        throw new Error(`La solicitud ya se encuentra en estado final (${solicitud.estado}) y no puede ser intervenida.`);
      }

      const nuevoEstado = accion === 'CANCELAR' ? 'CANCELADA' : 'RECHAZADA';
      const comentarioAdmin = `[INTERVENCIÓN ADMINISTRATIVA] ${motivo.trim()}`;

      await client.query(
        `INSERT INTO traslado_aprobacion (id_solicitud, id_usuario, rol, accion, comentario)
         VALUES ($1, $2, 'ADMIN_GENERAL', $3, $4)`,
        [idSolicitud, idAdmin, accion, comentarioAdmin]
      );

      await client.query(
        `UPDATE solicitud_traslado SET estado = $1, fecha_finalizacion = NOW() WHERE id_solicitud = $2`,
        [nuevoEstado, idSolicitud]
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
   * Obtener TODOS los traslados del sistema con filtros avanzados (exclusivo Admin General)
   */
  static async getAllSolicitudesGlobal(filter?: {
    estado?: string;
    tipo?: string;
    id_colegio_origen?: number;
    id_colegio_destino?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Promise<any[]> {
    let query = db
      .selectFrom('solicitud_traslado as st')
      .innerJoin('usuario as u', 'u.id_usuario', 'st.id_usuario')
      .innerJoin('colegio as co', 'co.id_colegio', 'st.id_colegio_origen')
      .innerJoin('colegio as cd', 'cd.id_colegio', 'st.id_colegio_destino')
      .innerJoin('usuario as uc', 'uc.id_usuario', 'st.creado_por')
      .select([
        'st.id_solicitud',
        'st.tipo',
        'st.id_usuario',
        'st.id_colegio_origen',
        'st.id_colegio_destino',
        'st.id_matricula',
        'st.estado',
        'st.motivo',
        'st.creado_por',
        'st.fecha_creacion',
        'st.fecha_finalizacion',
        'u.nombre as usuario_nombre',
        'u.apellido as usuario_apellido',
        'u.email as usuario_email',
        'u.documento as usuario_documento',
        'co.nombre as colegio_origen_nombre',
        'cd.nombre as colegio_destino_nombre',
        'uc.nombre as creador_nombre',
        'uc.apellido as creador_apellido',
      ])
      .orderBy('st.fecha_creacion', 'desc');

    if (filter?.estado) {
      query = query.where('st.estado', '=', filter.estado as any);
    }
    if (filter?.tipo) {
      query = query.where('st.tipo', '=', filter.tipo as any);
    }
    if (filter?.id_colegio_origen) {
      query = query.where('st.id_colegio_origen', '=', filter.id_colegio_origen);
    }
    if (filter?.id_colegio_destino) {
      query = query.where('st.id_colegio_destino', '=', filter.id_colegio_destino);
    }
    if (filter?.fecha_desde) {
      query = query.where(
        'st.fecha_creacion',
        '>=',
        sql<Date>`${filter.fecha_desde}::date`
      );
    }
    if (filter?.fecha_hasta) {
      query = query.where(
        'st.fecha_creacion',
        '<=',
        sql<Date>`(${filter.fecha_hasta}::date + INTERVAL '1 day')`
      );
    }

    return await query.execute();
  }

  /**
   * Obtener métricas estadísticas globales de traslados (exclusivo Admin General)
   */
  static async getEstadisticasGlobales(): Promise<any> {
    const row = await db
      .selectFrom('solicitud_traslado')
      .select([
        sql<string>`COUNT(*) FILTER (WHERE estado IN ('SOLICITADA', 'EN_APROBACION'))`.as('pendientes'),
        sql<string>`COUNT(*) FILTER (WHERE estado = 'EN_APROBACION')`.as('en_proceso'),
        sql<string>`COUNT(*) FILTER (WHERE estado IN ('APROBADA', 'EJECUTADA'))`.as('completados'),
        sql<string>`COUNT(*) FILTER (WHERE estado = 'RECHAZADA')`.as('rechazados'),
        sql<string>`COUNT(*) FILTER (WHERE estado = 'CANCELADA')`.as('cancelados'),
        sql<string>`COUNT(*) FILTER (WHERE tipo = 'TRASLADO_MATRICULA')`.as('traslados_matricula'),
        sql<string>`COUNT(*) FILTER (WHERE tipo = 'TRASLADO_USUARIO')`.as('traslados_usuario'),
        sql<string>`COUNT(*)`.as('total'),
      ])
      .executeTakeFirstOrThrow();

    return row;
  }

  /**
   * Verifica si una solicitud posee las aprobaciones requeridas y la ejecuta en transacción
   */
  private static async evaluarYEjecutarSiCompleto(idSolicitud: number): Promise<any> {
    const solicitud = await db
      .selectFrom('solicitud_traslado')
      .selectAll()
      .where('id_solicitud', '=', idSolicitud)
      .executeTakeFirst();

    if (!solicitud) return null;

    const aprobaciones = await db
      .selectFrom('traslado_aprobacion')
      .select(['rol', 'accion'])
      .where('id_solicitud', '=', idSolicitud)
      .where('accion', '=', 'APROBAR')
      .execute();

    const rolesAprobados = new Set(aprobaciones.map(r => r.rol));

    const tieneOrigen = rolesAprobados.has('DIRECTIVO_ORIGEN') || rolesAprobados.has('ADMIN_GENERAL');
    const tieneDestino = rolesAprobados.has('DIRECTIVO_DESTINO') || rolesAprobados.has('ADMIN_GENERAL');
    const tieneUsuario = rolesAprobados.has('USUARIO') || rolesAprobados.has('ADMIN_GENERAL');

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

      // FOR UPDATE requiere SQL raw (Kysely no tiene soporte directo de row lock en select)
      const solRes = await client.query(
        'SELECT * FROM solicitud_traslado WHERE id_solicitud = $1 FOR UPDATE',
        [idSolicitud]
      );
      const solicitud = solRes.rows[0];

      if (solicitud.estado === 'EJECUTADA') {
        await client.query('COMMIT');
        return await this.getSolicitudDetalle(idSolicitud);
      }

      // 1. Obtener el rol del usuario en la institución origen
      const linkOrigenRow = await db
        .selectFrom('usuario_colegio')
        .select('id_rol')
        .where('id_usuario', '=', solicitud.id_usuario)
        .where('id_colegio', '=', solicitud.id_colegio_origen)
        .where('estado', '=', 'ACTIVO')
        .executeTakeFirst();

      const idRol = linkOrigenRow?.id_rol ?? 1;

      // 2. Inactivar vinculación con Colegio Origen
      await client.query(
        `UPDATE usuario_colegio 
         SET estado = 'INACTIVO', fecha_fin = NOW() 
         WHERE id_usuario = $1 AND id_colegio = $2 AND estado = 'ACTIVO'`,
        [solicitud.id_usuario, solicitud.id_colegio_origen]
      );

      // 3. Crear/Activar vinculación con Colegio Destino
      await client.query(
        `INSERT INTO usuario_colegio (id_usuario, id_colegio, id_rol, estado, fecha_inicio)
         VALUES ($1, $2, $3, 'ACTIVO', NOW())
         ON CONFLICT (id_usuario, id_colegio, id_rol) 
         DO UPDATE SET estado = 'ACTIVO', fecha_inicio = NOW(), fecha_fin = NULL`,
        [solicitud.id_usuario, solicitud.id_colegio_destino, idRol]
      );

      // 4. Actualizar el colegio activo del usuario
      await client.query(
        `UPDATE usuario SET id_colegio = $1 WHERE id_usuario = $2`,
        [solicitud.id_colegio_destino, solicitud.id_usuario]
      );

      // 5. Si es traslado de estudiante con matrícula
      if (solicitud.tipo === 'TRASLADO_MATRICULA' && solicitud.id_matricula) {
        await client.query(
          `UPDATE matricula SET estado = 'TRASLADADA' WHERE id_matricula = $1`,
          [solicitud.id_matricula]
        );
        await client.query(
          `UPDATE estudiante SET id_colegio = $1 WHERE id_usuario = $2`,
          [solicitud.id_colegio_destino, solicitud.id_usuario]
        );
      }

      // 6. Marcar solicitud como EJECUTADA
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
    let query = db
      .selectFrom('solicitud_traslado as st')
      .innerJoin('usuario as u', 'u.id_usuario', 'st.id_usuario')
      .innerJoin('colegio as co', 'co.id_colegio', 'st.id_colegio_origen')
      .innerJoin('colegio as cd', 'cd.id_colegio', 'st.id_colegio_destino')
      .innerJoin('usuario as uc', 'uc.id_usuario', 'st.creado_por')
      .select([
        'st.id_solicitud',
        'st.tipo',
        'st.id_usuario',
        'st.id_colegio_origen',
        'st.id_colegio_destino',
        'st.id_matricula',
        'st.estado',
        'st.motivo',
        'st.creado_por',
        'st.fecha_creacion',
        'st.fecha_finalizacion',
        'u.nombre as usuario_nombre',
        'u.apellido as usuario_apellido',
        'u.email as usuario_email',
        'u.documento as usuario_documento',
        'co.nombre as colegio_origen_nombre',
        'cd.nombre as colegio_destino_nombre',
        'uc.nombre as creador_nombre',
        'uc.apellido as creador_apellido',
      ])
      .where((eb) =>
        eb.or([
          eb('st.id_colegio_origen', '=', idColegio),
          eb('st.id_colegio_destino', '=', idColegio),
        ])
      )
      .orderBy('st.fecha_creacion', 'desc');

    if (filter?.estado) {
      query = query.where('st.estado', '=', filter.estado as any);
    }
    if (filter?.tipo) {
      query = query.where('st.tipo', '=', filter.tipo as any);
    }

    return await query.execute();
  }

  /**
   * Obtener el detalle completo con la cronología de aprobaciones
   */
  static async getSolicitudDetalle(idSolicitud: number): Promise<any> {
    const solicitud = await db
      .selectFrom('solicitud_traslado as st')
      .innerJoin('usuario as u', 'u.id_usuario', 'st.id_usuario')
      .innerJoin('colegio as co', 'co.id_colegio', 'st.id_colegio_origen')
      .innerJoin('colegio as cd', 'cd.id_colegio', 'st.id_colegio_destino')
      .innerJoin('usuario as uc', 'uc.id_usuario', 'st.creado_por')
      .select([
        'st.id_solicitud',
        'st.tipo',
        'st.id_usuario',
        'st.id_colegio_origen',
        'st.id_colegio_destino',
        'st.id_matricula',
        'st.estado',
        'st.motivo',
        'st.creado_por',
        'st.fecha_creacion',
        'st.fecha_finalizacion',
        'u.nombre as usuario_nombre',
        'u.apellido as usuario_apellido',
        'u.email as usuario_email',
        'u.documento as usuario_documento',
        'co.nombre as colegio_origen_nombre',
        'cd.nombre as colegio_destino_nombre',
        'uc.nombre as creador_nombre',
        'uc.apellido as creador_apellido',
      ])
      .where('st.id_solicitud', '=', idSolicitud)
      .executeTakeFirst();

    if (!solicitud) return null;

    const aprobaciones = await db
      .selectFrom('traslado_aprobacion as ta')
      .innerJoin('usuario as u', 'u.id_usuario', 'ta.id_usuario')
      .select([
        'ta.id_aprobacion',
        'ta.id_solicitud',
        'ta.id_usuario',
        'ta.rol',
        'ta.accion',
        'ta.comentario',
        'ta.fecha',
        'u.nombre as usuario_nombre',
        'u.apellido as usuario_apellido',
        'u.email as usuario_email',
      ])
      .where('ta.id_solicitud', '=', idSolicitud)
      .orderBy('ta.fecha', 'asc')
      .execute();

    return { ...solicitud, aprobaciones };
  }

  /**
   * Obtener las instituciones vinculadas a un usuario
   */
  static async getVinculacionesUsuario(idUsuario: number): Promise<any[]> {
    return await db
      .selectFrom('usuario_colegio as uc')
      .innerJoin('colegio as c', 'c.id_colegio', 'uc.id_colegio')
      .innerJoin('rol as r', 'r.id_rol', 'uc.id_rol')
      .select([
        'uc.id_usuario_colegio',
        'uc.id_usuario',
        'uc.id_colegio',
        'uc.id_rol',
        'uc.estado',
        'uc.fecha_inicio',
        'uc.fecha_fin',
        'c.nombre as colegio_nombre',
        'r.nombre as rol_nombre',
      ])
      .where('uc.id_usuario', '=', idUsuario)
      .orderBy('uc.fecha_inicio', 'desc')
      .execute();
  }
}
