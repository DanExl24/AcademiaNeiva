import { sql } from 'kysely';
import { db } from '../config/kysely';
import { CreateTrasladoInput, ApproveTrasladoInput, FilterTrasladoInput } from '../dtos/traslado.dto';

export class TrasladoService {
  /**
   * Crear una solicitud de traslado
   */
  static async crearSolicitud(input: CreateTrasladoInput, idUsuarioCreador: number, rolCreador: string): Promise<any> {
    return await db.transaction().execute(async (trx) => {
      const { tipo, id_usuario, id_colegio_origen, id_colegio_destino, id_matricula, motivo } = input;

      // 1. Verificar existencia de usuario
      const userRow = await trx
        .selectFrom('usuario')
        .select(['id_usuario', 'nombre', 'apellido', 'email'])
        .where('id_usuario', '=', id_usuario)
        .executeTakeFirst();
      if (!userRow) throw new Error('El usuario especificado no existe.');

      // 2. Verificar existencia de colegios
      const origenRow = await trx
        .selectFrom('colegio')
        .select(['id_colegio', 'nombre'])
        .where('id_colegio', '=', id_colegio_origen)
        .executeTakeFirst();
      if (!origenRow) throw new Error('La institución de origen no existe.');

      const destinoRow = await trx
        .selectFrom('colegio')
        .select(['id_colegio', 'nombre'])
        .where('id_colegio', '=', id_colegio_destino)
        .executeTakeFirst();
      if (!destinoRow) throw new Error('La institución de destino no existe.');

      // 3. Verificar vinculación activa en origen (y detectar si es directivo)
      const linkOrigenData = await trx
        .selectFrom('usuario_colegio as uc')
        .innerJoin('rol as r', 'r.id_rol', 'uc.id_rol')
        .select(['uc.id_usuario_colegio', 'r.nombre as rol_nombre'])
        .where('uc.id_usuario', '=', id_usuario)
        .where('uc.id_colegio', '=', id_colegio_origen)
        .where('uc.estado', '=', 'ACTIVO')
        .executeTakeFirst();
      if (!linkOrigenData) throw new Error('El usuario no posee una vinculación activa con la institución de origen.');

      // 3.1 Solo el Admin General puede solicitar traslados de directivos
      const esDirectivo = linkOrigenData.rol_nombre === 'directivo';
      if (esDirectivo && !rolCreador.includes('admin_general')) {
        throw new Error('Solo el Administrador General puede gestionar traslados de directivos institucionales.');
      }

      // 4. Verificar que no exista ya vinculación activa en destino
      const linkDestino = await trx
        .selectFrom('usuario_colegio')
        .select('id_usuario_colegio')
        .where('id_usuario', '=', id_usuario)
        .where('id_colegio', '=', id_colegio_destino)
        .where('estado', '=', 'ACTIVO')
        .executeTakeFirst();
      if (linkDestino) throw new Error('El usuario ya posee una vinculación activa con la institución de destino.');

      // 5. Verificar que no exista solicitud pendiente entre estos colegios para el usuario
      const pending = await trx
        .selectFrom('solicitud_traslado')
        .select('id_solicitud')
        .where('id_usuario', '=', id_usuario)
        .where('id_colegio_origen', '=', id_colegio_origen)
        .where('id_colegio_destino', '=', id_colegio_destino)
        .where('estado', 'in', ['SOLICITADA', 'EN_APROBACION'])
        .executeTakeFirst();
      if (pending) throw new Error('Ya existe una solicitud de traslado pendiente para este usuario.');

      // 5.1 Verificar pertenencia de la matrícula al año lectivo seleccionado si aplica
      if (id_matricula) {
        const matCheck = await trx
          .selectFrom('matricula')
          .select(['id_matricula', 'id_anio'])
          .where('id_matricula', '=', id_matricula)
          .executeTakeFirst();
        if (!matCheck) throw new Error('La matrícula especificada no existe.');
        if (input.yearId && matCheck.id_anio !== Number(input.yearId)) {
          throw new Error('La matrícula del estudiante no pertenece al año lectivo seleccionado.');
        }
      }

      // 6. Insertar solicitud de traslado usando Kysely
      const tipoFinal = esDirectivo ? 'TRASLADO_USUARIO' : tipo;
      const solicitud = await trx
        .insertInto('solicitud_traslado')
        .values({
          tipo: tipoFinal as any,
          id_usuario,
          id_colegio_origen,
          id_colegio_destino,
          id_matricula: id_matricula || null,
          estado: 'EN_APROBACION' as any,
          motivo,
          creado_por: idUsuarioCreador,
          fecha_creacion: sql`NOW()`
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 7. Auto-aprobar el paso de quien crea la solicitud
      let rolAprobacion = 'CREADOR';
      let accionComentario = `Solicitud creada por ${rolCreador}`;

      const esPadreCreador = await this.esPadreOResponsable(idUsuarioCreador, id_usuario, id_matricula || null, trx);

      if (idUsuarioCreador === id_usuario) {
        rolAprobacion = 'USUARIO';
        accionComentario = 'Auto-aprobación del usuario afectado al crear la solicitud';
      } else if (esPadreCreador) {
        rolAprobacion = 'USUARIO';
        accionComentario = 'Auto-aprobación del Padre/Acudiente legal al crear la solicitud de traslado';
      } else if (rolCreador.includes('admin_general')) {
        rolAprobacion = 'ADMIN_GENERAL';
      } else {
        const dirRow = await trx
          .selectFrom('directivo')
          .select('id_colegio')
          .where('id_usuario', '=', idUsuarioCreador)
          .executeTakeFirst();
        if (dirRow) {
          if (dirRow.id_colegio === id_colegio_origen) rolAprobacion = 'DIRECTIVO_ORIGEN';
          else if (dirRow.id_colegio === id_colegio_destino) rolAprobacion = 'DIRECTIVO_DESTINO';
        }
      }

      await trx
        .insertInto('traslado_aprobacion')
        .values({
          id_solicitud: solicitud.id_solicitud,
          id_usuario: idUsuarioCreador,
          rol: rolAprobacion as any,
          accion: 'APROBAR' as any,
          comentario: accionComentario,
          fecha: sql`NOW()`
        })
        .execute();

      return await this.evaluarYEjecutarSiCompleto(solicitud.id_solicitud, trx);
    });
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
    return await db.transaction().execute(async (trx) => {
      const solicitud = await trx
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
      const esTarget = idUsuarioAprobador === solicitud.id_usuario;
      const esPadre = await this.esPadreOResponsable(idUsuarioAprobador, solicitud.id_usuario, solicitud.id_matricula || null, trx);
      const esDirectivo = rolesAprobador.includes('directivo');
      const esAdmin = rolesAprobador.includes('admin_general');

      if (esAdmin) {
        rolAprobacion = 'ADMIN_GENERAL';
      } else if (esPadre || rolesAprobador.includes('padre') || (esTarget && !esDirectivo)) {
        if (solicitud.tipo === 'TRASLADO_MATRICULA') {
          if (esPadre || rolesAprobador.includes('padre')) {
            rolAprobacion = 'USUARIO';
          } else if (esTarget) {
            const tienePadre = await this.tienePadreVinculado(solicitud.id_usuario, solicitud.id_matricula || null, trx);
            if (!tienePadre) {
              rolAprobacion = 'USUARIO';
            } else {
              throw new Error('El traslado de matrícula debe ser aprobado por el Padre de Familia / Acudiente legal registrado.');
            }
          } else {
            throw new Error('No posees autorización para actuar sobre esta solicitud de traslado.');
          }
        } else {
          if (esTarget || esPadre) {
            rolAprobacion = 'USUARIO';
          } else {
            throw new Error('No posees autorización para actuar sobre esta solicitud de traslado.');
          }
        }
      } else if (esDirectivo && colegioIdAprobador === solicitud.id_colegio_origen) {
        rolAprobacion = 'DIRECTIVO_ORIGEN';
      } else if (esDirectivo && colegioIdAprobador === solicitud.id_colegio_destino) {
        rolAprobacion = 'DIRECTIVO_DESTINO';
      } else {
        throw new Error('No posees autorización para actuar sobre esta solicitud de traslado.');
      }

      // Validar si el rol o usuario ya emitieron voto previo en esta solicitud
      const votoExistenteRol = await trx
        .selectFrom('traslado_aprobacion')
        .select('id_aprobacion')
        .where('id_solicitud', '=', idSolicitud)
        .where('rol', '=', rolAprobacion as any)
        .executeTakeFirst();

      if (votoExistenteRol) {
        throw new Error(`El rol '${rolAprobacion}' ya ha registrado su decisión para esta solicitud.`);
      }

      const votoExistenteUsuario = await trx
        .selectFrom('traslado_aprobacion')
        .select('id_aprobacion')
        .where('id_solicitud', '=', idSolicitud)
        .where('id_usuario', '=', idUsuarioAprobador)
        .executeTakeFirst();

      if (votoExistenteUsuario) {
        throw new Error('Ya has registrado tu decisión sobre esta solicitud de traslado.');
      }

      await trx
        .insertInto('traslado_aprobacion')
        .values({
          id_solicitud: idSolicitud,
          id_usuario: idUsuarioAprobador,
          rol: rolAprobacion as any,
          accion: input.accion as any,
          comentario: input.comentario || null,
          fecha: sql`NOW()`
        })
        .execute();

      if (input.accion === 'RECHAZAR' || input.accion === 'CANCELAR') {
        const nuevoEstado = input.accion === 'RECHAZAR' ? 'RECHAZADA' : 'CANCELADA';
        await trx
          .updateTable('solicitud_traslado')
          .set({
            estado: nuevoEstado as any,
            fecha_finalizacion: sql`NOW()`
          })
          .where('id_solicitud', '=', idSolicitud)
          .execute();

        return await this.getSolicitudDetalle(idSolicitud);
      }

      return await this.evaluarYEjecutarSiCompleto(idSolicitud, trx);
    });
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

    return await db.transaction().execute(async (trx) => {
      const solicitud = await trx
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

      await trx
        .insertInto('traslado_aprobacion')
        .values({
          id_solicitud: idSolicitud,
          id_usuario: idAdmin,
          rol: 'ADMIN_GENERAL' as any,
          accion: accion as any,
          comentario: comentarioAdmin,
          fecha: sql`NOW()`
        })
        .execute();

      await trx
        .updateTable('solicitud_traslado')
        .set({
          estado: nuevoEstado as any,
          fecha_finalizacion: sql`NOW()`
        })
        .where('id_solicitud', '=', idSolicitud)
        .execute();

      return await this.getSolicitudDetalle(idSolicitud);
    });
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
    yearId?: number;
  }): Promise<any[]> {
    let query = db
      .selectFrom('solicitud_traslado as st')
      .innerJoin('usuario as u', 'u.id_usuario', 'st.id_usuario')
      .innerJoin('colegio as co', 'co.id_colegio', 'st.id_colegio_origen')
      .innerJoin('colegio as cd', 'cd.id_colegio', 'st.id_colegio_destino')
      .innerJoin('usuario as uc', 'uc.id_usuario', 'st.creado_por')
      .leftJoin('matricula as m', 'm.id_matricula', 'st.id_matricula')
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

    if (filter?.yearId) {
      query = query.where((eb) =>
        eb.or([
          eb('m.id_anio', '=', filter.yearId!),
          eb.and([
            eb('st.id_matricula', 'is', null),
            eb(
              sql<number>`EXTRACT(YEAR FROM st.fecha_creacion)`,
              '=',
              sql<number>`(SELECT anio FROM anio_lectivo WHERE id_anio = ${filter.yearId})`
            )
          ])
        ])
      );
    }

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
   * Verifica si una solicitud posee las aprobaciones requeridas y la ejecuta en transacción.
   */
  private static async evaluarYEjecutarSiCompleto(idSolicitud: number, trxPassed?: any): Promise<any> {
    const runner = trxPassed || db;

    const solicitud = await runner
      .selectFrom('solicitud_traslado')
      .selectAll()
      .where('id_solicitud', '=', idSolicitud)
      .executeTakeFirst();

    if (!solicitud) return null;

    const aprobaciones = await runner
      .selectFrom('traslado_aprobacion')
      .select(['rol', 'accion'])
      .where('id_solicitud', '=', idSolicitud)
      .where('accion', '=', 'APROBAR')
      .execute();

    const rolesAprobados = new Set(aprobaciones.map((r: any) => r.rol));

    // Detectar si el usuario trasladado es un directivo en la institución origen
    const vinculacion = await runner
      .selectFrom('usuario_colegio as uc')
      .innerJoin('rol as r', 'r.id_rol', 'uc.id_rol')
      .select(['r.nombre as rol_nombre'])
      .where('uc.id_usuario', '=', solicitud.id_usuario)
      .where('uc.id_colegio', '=', solicitud.id_colegio_origen)
      .executeTakeFirst();
    const esDirectivo = vinculacion?.rol_nombre === 'directivo';

    if (esDirectivo) {
      // Traslado de DIRECTIVO: requiere los 3 roles explícitamente
      const completo =
        rolesAprobados.has('ADMIN_GENERAL') &&
        rolesAprobados.has('DIRECTIVO_ORIGEN') &&
        rolesAprobados.has('DIRECTIVO_DESTINO');
      if (completo) {
        return await this.ejecutarTrasladoTransaccional(idSolicitud, trxPassed);
      }
    } else {
      // Traslado de USUARIO / MATRICULA: flujo estándar tripartita
      const tieneOrigen = rolesAprobados.has('DIRECTIVO_ORIGEN') || rolesAprobados.has('ADMIN_GENERAL');
      const tieneDestino = rolesAprobados.has('DIRECTIVO_DESTINO') || rolesAprobados.has('ADMIN_GENERAL');
      const tieneUsuario = rolesAprobados.has('USUARIO') || rolesAprobados.has('ADMIN_GENERAL');

      if (tieneOrigen && tieneDestino && tieneUsuario) {
        return await this.ejecutarTrasladoTransaccional(idSolicitud, trxPassed);
      }
    }

    return await this.getSolicitudDetalle(idSolicitud);
  }

  /**
   * Ejecución final del traslado dentro de una transacción atómica PostgreSQL con Kysely
   */
  private static async ejecutarTrasladoTransaccional(idSolicitud: number, trxPassed?: any): Promise<any> {
    const executeLogic = async (trx: any) => {
      const solicitud = await trx
        .selectFrom('solicitud_traslado')
        .selectAll()
        .where('id_solicitud', '=', idSolicitud)
        .forUpdate()
        .executeTakeFirst();

      if (!solicitud || solicitud.estado === 'EJECUTADA') {
        return await this.getSolicitudDetalle(idSolicitud);
      }

      // 1. Obtener el rol del usuario en la institución origen
      const linkOrigenRow = await trx
        .selectFrom('usuario_colegio')
        .select('id_rol')
        .where('id_usuario', '=', solicitud.id_usuario)
        .where('id_colegio', '=', solicitud.id_colegio_origen)
        .where('estado', '=', 'ACTIVO')
        .executeTakeFirst();

      const idRol = linkOrigenRow?.id_rol ?? 1;

      // 2. Inactivar vinculación con Colegio Origen
      await trx
        .updateTable('usuario_colegio')
        .set({
          estado: 'INACTIVO',
          fecha_fin: sql`NOW()`
        })
        .where('id_usuario', '=', solicitud.id_usuario)
        .where('id_colegio', '=', solicitud.id_colegio_origen)
        .where('estado', '=', 'ACTIVO')
        .execute();

      // 3. Crear/Activar vinculación con Colegio Destino
      await trx
        .insertInto('usuario_colegio')
        .values({
          id_usuario: solicitud.id_usuario,
          id_colegio: solicitud.id_colegio_destino,
          id_rol: idRol,
          estado: 'ACTIVO',
          fecha_inicio: sql`NOW()`
        })
        .onConflict((oc: any) =>
          oc.columns(['id_usuario', 'id_colegio', 'id_rol']).doUpdateSet({
            estado: 'ACTIVO',
            fecha_inicio: sql`NOW()`,
            fecha_fin: null
          })
        )
        .execute();

      // 3.1 Si el usuario posee rol de docente, asegurar/reactivar perfil en la tabla docente del colegio destino
      await trx
        .insertInto('docente')
        .columns(['id_usuario', 'id_colegio', 'nombre', 'apellido', 'estado'])
        .expression((eb: any) =>
          eb
            .selectFrom('usuario')
            .select([
              'id_usuario',
              eb.val(solicitud.id_colegio_destino).as('id_colegio'),
              'nombre',
              sql<string>`COALESCE(apellido, '')`.as('apellido'),
              eb.val('ACTIVO').as('estado')
            ])
            .where('id_usuario', '=', solicitud.id_usuario)
        )
        .onConflict((oc: any) =>
          oc.columns(['id_usuario', 'id_colegio']).doUpdateSet({
            estado: 'ACTIVO'
          })
        )
        .execute();

      // 4. Actualizar el colegio activo del usuario
      await trx
        .updateTable('usuario')
        .set({ id_colegio: solicitud.id_colegio_destino })
        .where('id_usuario', '=', solicitud.id_usuario)
        .execute();

      // 5. Si es traslado de estudiante con matrícula
      if (solicitud.tipo === 'TRASLADO_MATRICULA' && solicitud.id_matricula) {
        // 5.1 Marcar matrícula en origen como TRASLADADA con tipo TRASLADO
        await trx
          .updateTable('matricula')
          .set({
            estado: 'TRASLADADA' as any,
            tipo: 'TRASLADO' as any,
            es_traslado: true
          })
          .where('id_matricula', '=', solicitud.id_matricula)
          .execute();

        // 5.2 Actualizar colegio activo del estudiante y asegurar su estado ACTIVO en la institución de destino
        await trx
          .updateTable('estudiante')
          .set({
            id_colegio: solicitud.id_colegio_destino,
            estado: 'ACTIVO' as any,
            motivo_estado: null
          })
          .where('id_usuario', '=', solicitud.id_usuario)
          .execute();

        // 5.3 Generar/Activar la matrícula por traslado en el colegio destino
        const origMat = await trx
          .selectFrom('matricula')
          .selectAll()
          .where('id_matricula', '=', solicitud.id_matricula)
          .executeTakeFirst();

        const estRow = await trx
          .selectFrom('estudiante')
          .select('id_estudiante')
          .where('id_usuario', '=', solicitud.id_usuario)
          .executeTakeFirst();

        if (origMat && estRow) {
          const origenColegio = await trx
            .selectFrom('colegio')
            .select('nombre')
            .where('id_colegio', '=', solicitud.id_colegio_origen)
            .executeTakeFirst();

          const obsTraslado = `Matrícula ingresada por traslado interinstitucional desde ${origenColegio?.nombre || 'colegio origen'}`;

          const destMatExistente = await trx
            .selectFrom('matricula')
            .select('id_matricula')
            .where('id_estudiante', '=', estRow.id_estudiante)
            .where('id_colegio', '=', solicitud.id_colegio_destino)
            .where('id_anio', '=', origMat.id_anio)
            .executeTakeFirst();

          if (destMatExistente) {
            await trx
              .updateTable('matricula')
              .set({
                estado: 'TRASLADADA' as any,
                tipo: 'TRASLADO' as any,
                es_traslado: true,
                observaciones: obsTraslado,
                fecha_aprobacion: sql`NOW()`
              })
              .where('id_matricula', '=', destMatExistente.id_matricula)
              .execute();
          } else {
            await trx
              .insertInto('matricula')
              .values({
                id_colegio: solicitud.id_colegio_destino,
                id_estudiante: estRow.id_estudiante,
                id_anio: origMat.id_anio,
                id_usuario_responsable: origMat.id_usuario_responsable,
                correo_padre: origMat.correo_padre,
                id_nivel: origMat.id_nivel,
                estado: 'TRASLADADA' as any,
                tipo: 'TRASLADO' as any,
                es_traslado: true,
                observaciones: obsTraslado,
                fecha_aprobacion: sql`NOW()`,
                fecha_creacion: sql`NOW()`
              })
              .execute();
          }
        }
      }

      // 6. Marcar solicitud como EJECUTADA
      await trx
        .updateTable('solicitud_traslado')
        .set({
          estado: 'EJECUTADA' as any,
          fecha_finalizacion: sql`NOW()`
        })
        .where('id_solicitud', '=', idSolicitud)
        .execute();

      return await this.getSolicitudDetalle(idSolicitud);
    };

    if (trxPassed) {
      return await executeLogic(trxPassed);
    } else {
      return await db.transaction().execute(executeLogic);
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
      .leftJoin('matricula as m', 'm.id_matricula', 'st.id_matricula')
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

    if (filter?.yearId) {
      query = query.where((eb) =>
        eb.or([
          eb('m.id_anio', '=', filter.yearId!),
          eb.and([
            eb('st.id_matricula', 'is', null),
            eb(
              sql<number>`EXTRACT(YEAR FROM st.fecha_creacion)`,
              '=',
              sql<number>`(SELECT anio FROM anio_lectivo WHERE id_anio = ${filter.yearId})`
            )
          ])
        ])
      );
    }

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

    let padreInfo: { id_usuario?: number; nombre?: string | null; apellido?: string | null; email?: string | null } | null = null;
    if (solicitud.tipo === 'TRASLADO_MATRICULA') {
      if (solicitud.id_matricula) {
        const mat = await db
          .selectFrom('matricula as m')
          .leftJoin('usuario as up', 'up.id_usuario', 'm.id_usuario_responsable')
          .select(['up.id_usuario', 'up.nombre', 'up.apellido', 'up.email', 'm.correo_padre'])
          .where('m.id_matricula', '=', solicitud.id_matricula)
          .executeTakeFirst();
        if (mat?.id_usuario) {
          padreInfo = {
            id_usuario: mat.id_usuario,
            nombre: mat.nombre,
            apellido: mat.apellido,
            email: mat.email || mat.correo_padre || null,
          };
        }
      }

      if (!padreInfo) {
        const est = await db
          .selectFrom('estudiante')
          .select('id_estudiante')
          .where('id_usuario', '=', solicitud.id_usuario)
          .executeTakeFirst();
        if (est) {
          const parentRow = await db
            .selectFrom('detalle_padrefamilia as dpf')
            .innerJoin('padre_familia as pf', 'pf.id_padrefamilia', 'dpf.id_padrefamilia')
            .innerJoin('usuario as up', 'up.id_usuario', 'pf.id_usuario')
            .select(['up.id_usuario', 'up.nombre', 'up.apellido', 'up.email'])
            .where('dpf.id_estudiante', '=', est.id_estudiante)
            .executeTakeFirst();
          if (parentRow) {
            padreInfo = parentRow;
          }
        }
      }
    }

    return { ...solicitud, aprobaciones, padre: padreInfo };
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

  /**
   * Obtener el personal activo de un colegio para traslados de tipo TRASLADO_USUARIO.
   * Excluye estudiantes, directivos y admin_general. Usado para directivos normales.
   */
  static async getPersonalColegio(idColegio: number): Promise<any[]> {
    return await db
      .selectFrom('usuario_colegio as uc')
      .innerJoin('usuario as u', 'u.id_usuario', 'uc.id_usuario')
      .innerJoin('rol as r', 'r.id_rol', 'uc.id_rol')
      .select([
        'u.id_usuario',
        'u.nombre',
        'u.apellido',
        'u.email',
        'u.documento',
        'r.nombre as rol_nombre',
      ])
      .where('uc.id_colegio', '=', idColegio)
      .where('uc.estado', '=', 'ACTIVO')
      .where('r.nombre', 'not in', ['directivo', 'estudiante', 'admin_general'])
      .orderBy('u.apellido', 'asc')
      .orderBy('u.nombre', 'asc')
      .execute();
  }

  /**
   * Obtener los directivos activos de un colegio.
   * Exclusivo para admin_general al gestionar traslados de directivos.
   */
  static async getDirectivosColegio(idColegio: number): Promise<any[]> {
    return await db
      .selectFrom('usuario_colegio as uc')
      .innerJoin('usuario as u', 'u.id_usuario', 'uc.id_usuario')
      .innerJoin('rol as r', 'r.id_rol', 'uc.id_rol')
      .select([
        'u.id_usuario',
        'u.nombre',
        'u.apellido',
        'u.email',
        'u.documento',
        'r.nombre as rol_nombre',
      ])
      .where('uc.id_colegio', '=', idColegio)
      .where('uc.estado', '=', 'ACTIVO')
      .where('r.nombre', '=', 'directivo')
      .orderBy('u.apellido', 'asc')
      .orderBy('u.nombre', 'asc')
      .execute();
  }

  /**
   * Verifica si un usuario es el Padre/Acudiente o responsable legal de un estudiante.
   */
  private static async esPadreOResponsable(
    idUsuarioPadre: number,
    idUsuarioEstudiante: number,
    idMatricula: number | null,
    trx?: any
  ): Promise<boolean> {
    const runner = trx || db;

    // 1. Verificar si es id_usuario_responsable en la matrícula
    if (idMatricula) {
      const mat = await runner
        .selectFrom('matricula')
        .select('id_usuario_responsable')
        .where('id_matricula', '=', idMatricula)
        .executeTakeFirst();
      if (mat && mat.id_usuario_responsable === idUsuarioPadre) {
        return true;
      }
    }

    // 2. Verificar vía estudiante -> detalle_padrefamilia -> padre_familia
    const est = await runner
      .selectFrom('estudiante')
      .select('id_estudiante')
      .where('id_usuario', '=', idUsuarioEstudiante)
      .executeTakeFirst();

    if (est) {
      const parentRow = await runner
        .selectFrom('detalle_padrefamilia as dpf')
        .innerJoin('padre_familia as pf', 'pf.id_padrefamilia', 'dpf.id_padrefamilia')
        .select('pf.id_usuario')
        .where('dpf.id_estudiante', '=', est.id_estudiante)
        .where('pf.id_usuario', '=', idUsuarioPadre)
        .executeTakeFirst();

      if (parentRow) {
        return true;
      }
    }

    return false;
  }

  /**
   * Verifica si el estudiante tiene al menos un Padre/Acudiente legal vinculado.
   */
  private static async tienePadreVinculado(
    idUsuarioEstudiante: number,
    idMatricula: number | null,
    trx?: any
  ): Promise<boolean> {
    const runner = trx || db;

    if (idMatricula) {
      const mat = await runner
        .selectFrom('matricula')
        .select(['id_usuario_responsable', 'correo_padre'])
        .where('id_matricula', '=', idMatricula)
        .executeTakeFirst();
      if (mat && (mat.id_usuario_responsable || mat.correo_padre)) {
        return true;
      }
    }

    const est = await runner
      .selectFrom('estudiante')
      .select('id_estudiante')
      .where('id_usuario', '=', idUsuarioEstudiante)
      .executeTakeFirst();

    if (est) {
      const parentRow = await runner
        .selectFrom('detalle_padrefamilia')
        .select('id_detallepadrefamilia')
        .where('id_estudiante', '=', est.id_estudiante)
        .executeTakeFirst();
      if (parentRow) return true;
    }

    return false;
  }
}



