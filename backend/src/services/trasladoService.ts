import { sql } from 'kysely';
import { db } from '../config/kysely';
import { CreateTrasladoInput, ApproveTrasladoInput, FilterTrasladoInput } from '../dtos/traslado.dto';
import { NotificationService } from './notificationService';

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
      let motivoFinal = motivo.trim();
      if (input.jornada_sugerida && input.jornada_sugerida !== 'INDIFERENTE') {
        motivoFinal = `[Jornada Sugerida: ${input.jornada_sugerida}] ${motivoFinal}`;
      }

      const solicitud = await trx
        .insertInto('solicitud_traslado')
        .values({
          tipo: tipoFinal as any,
          id_usuario,
          id_colegio_origen,
          id_colegio_destino,
          id_matricula: id_matricula || null,
          estado: 'EN_APROBACION' as any,
          motivo: motivoFinal,
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

      const idGrupoDestinoPersistir = (input.accion === 'APROBAR' && (rolAprobacion === 'DIRECTIVO_DESTINO' || rolAprobacion === 'ADMIN_GENERAL'))
        ? (input.id_grupo_destino || null)
        : null;

      await trx
        .insertInto('traslado_aprobacion')
        .values({
          id_solicitud: idSolicitud,
          id_usuario: idUsuarioAprobador,
          rol: rolAprobacion as any,
          accion: input.accion as any,
          comentario: input.comentario || null,
          id_grupo_destino: idGrupoDestinoPersistir,
          fecha: sql`NOW()`
        })
        .execute();

      if (idGrupoDestinoPersistir) {
        await trx
          .updateTable('solicitud_traslado')
          .set({ id_grupo_destino: idGrupoDestinoPersistir })
          .where('id_solicitud', '=', idSolicitud)
          .execute();
      }

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

      // Validar cupos en institución destino si es aprobación de directivo destino / admin
      if (input.accion === 'APROBAR' && (rolAprobacion === 'DIRECTIVO_DESTINO' || rolAprobacion === 'ADMIN_GENERAL') && solicitud.tipo === 'TRASLADO_MATRICULA') {
        const disp = await this.getDisponibilidadCuposTraslado(idSolicitud, solicitud.id_colegio_destino);
        if (!disp.hay_cupos && disp.grupos.length > 0) {
          throw new Error(`No hay cupos disponibles en el colegio receptor para el grado '${disp.grado_nombre}'. Por favor rechace la solicitud o habilite cupos en la sede.`);
        }
      }

      return await this.evaluarYEjecutarSiCompleto(idSolicitud, trx, input.id_grupo_destino);
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
        'st.id_grupo_destino',
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
          eb('st.id_matricula', 'is', null)
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
   * Consultar disponibilidad de cupos por grado y secciones activas en el colegio destino
   */
  static async getDisponibilidadCuposTraslado(idSolicitud: number, idColegioDestino?: number): Promise<any> {
    const solicitud = await db
      .selectFrom('solicitud_traslado as st')
      .selectAll()
      .where('st.id_solicitud', '=', idSolicitud)
      .executeTakeFirst();

    if (!solicitud) throw new Error('Solicitud de traslado no encontrada');

    const destSchoolId = idColegioDestino || solicitud.id_colegio_destino;

    let idTipoGrado: number | null = null;
    let gradoNombre: string = 'Grado no especificado';
    let nivelNombre: string = 'Nivel no especificado';

    if (solicitud.id_matricula) {
      const origMat = await db
        .selectFrom('matricula as m')
        .leftJoin('grupos as g', 'm.id_grupo', 'g.id_grupo')
        .leftJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
        .leftJoin('nivel_escolar as ne', (join) =>
          join.onRef('ne.id_nivel', '=', sql<number>`COALESCE(m.id_nivel, g.id_nivel, tg.id_nivel)`)
        )
        .select([
          'm.id_matricula',
          'm.id_nivel',
          'm.id_grupo',
          'g.id_tipo_grado',
          'tg.nombre as grado_nombre',
          'ne.nombre as nivel_nombre'
        ])
        .where('m.id_matricula', '=', solicitud.id_matricula)
        .executeTakeFirst();

      if (origMat) {
        idTipoGrado = origMat.id_tipo_grado || null;
        gradoNombre = origMat.grado_nombre || gradoNombre;
        nivelNombre = origMat.nivel_nombre || nivelNombre;
      }
    }

    if ((gradoNombre === 'Grado no especificado' || !idTipoGrado) && solicitud.id_usuario) {
      const est = await db
        .selectFrom('estudiante as e')
        .select('e.id_estudiante')
        .where('e.id_usuario', '=', solicitud.id_usuario)
        .executeTakeFirst();

      if (est) {
        const origMat = await db
          .selectFrom('matricula as m')
          .leftJoin('grupos as g', 'm.id_grupo', 'g.id_grupo')
          .leftJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
          .leftJoin('nivel_escolar as ne', (join) =>
            join.onRef('ne.id_nivel', '=', sql<number>`COALESCE(m.id_nivel, g.id_nivel, tg.id_nivel)`)
          )
          .select([
            'm.id_matricula',
            'm.id_nivel',
            'm.id_grupo',
            'g.id_tipo_grado',
            'tg.nombre as grado_nombre',
            'ne.nombre as nivel_nombre'
          ])
          .where('m.id_estudiante', '=', est.id_estudiante)
          .where('m.id_colegio', '=', solicitud.id_colegio_origen)
          .orderBy('m.id_matricula', 'desc')
          .executeTakeFirst();

        if (origMat) {
          idTipoGrado = origMat.id_tipo_grado || null;
          gradoNombre = origMat.grado_nombre || gradoNombre;
          nivelNombre = origMat.nivel_nombre || nivelNombre;
        }
      }
    }

    const baseGruposQuery = () => db
      .selectFrom('grupos as g')
      .leftJoin('secciones as s', 'g.id_seccion', 's.id_seccion')
      .leftJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
      .leftJoin('jornada as j', 'g.id_jornada', 'j.id_jornada')
      .leftJoin('nivel_escolar as ne', 'g.id_nivel', 'ne.id_nivel')
      .select([
        'g.id_grupo',
        'g.id_tipo_grado',
        sql<string>`COALESCE(tg.nombre, 'Grado General')`.as('grado_nombre'),
        sql<string>`COALESCE(s.nombre, 'A')`.as('seccion_nombre'),
        sql<string>`COALESCE(j.nombre::text, 'Ordinaria')`.as('jornada_nombre'),
        sql<string>`COALESCE(ne.nombre, 'Sin Nivel')`.as('nivel_nombre'),
        sql<number>`COALESCE(g.cupos_totales, 35)`.as('cupos_totales'),
        sql<number>`(COALESCE(g.cupos_totales, 35) - (SELECT COUNT(*) FROM matricula WHERE id_grupo = g.id_grupo AND estado IN ('ACTIVA', 'TRASLADADA')))::int`.as('cupos_disponibles')
      ])
      .where('g.id_colegio', '=', destSchoolId);

    const todosGruposRaw = await baseGruposQuery()
      .orderBy('tg.id_tipo_grado', 'asc')
      .orderBy('s.nombre', 'asc')
      .execute();

    const todosLosGrupos = todosGruposRaw.map((g: any) => ({
      id_grupo: g.id_grupo,
      id_tipo_grado: g.id_tipo_grado,
      grado_nombre: g.grado_nombre,
      seccion: g.seccion_nombre,
      jornada: g.jornada_nombre,
      nivel: g.nivel_nombre,
      nombre_completo: `${g.grado_nombre} - ${g.seccion_nombre} (${g.jornada_nombre})`,
      cupos_disponibles: Math.max(0, Number(g.cupos_disponibles) || 0),
      cupos_totales: Number(g.cupos_totales) || 35
    }));

    let grupos: any[] = [];

    if (gradoNombre && gradoNombre !== 'Grado no especificado') {
      grupos = todosLosGrupos.filter(
        g => g.grado_nombre.trim().toLowerCase() === gradoNombre.trim().toLowerCase()
      );
    }

    if (grupos.length === 0 && idTipoGrado) {
      grupos = todosLosGrupos.filter(g => g.id_tipo_grado === idTipoGrado);
    }

    if (grupos.length === 0) {
      grupos = todosLosGrupos;
    }

    const cuposTotalesGrado = grupos.reduce((acc: number, curr: any) => {
      const disp = Math.max(0, Number(curr.cupos_disponibles) || 0);
      return acc + disp;
    }, 0);

    return {
      id_solicitud: idSolicitud,
      id_colegio_destino: destSchoolId,
      grado_nombre: gradoNombre,
      nivel_nombre: nivelNombre,
      cupos_totales_grado: cuposTotalesGrado,
      hay_cupos: cuposTotalesGrado > 0 || todosLosGrupos.length === 0,
      grupos,
      todos_los_grupos: todosLosGrupos
    };
  }

  /**
   * Verifica si una solicitud posee las aprobaciones requeridas y la ejecuta en transacción.
   */
  private static async evaluarYEjecutarSiCompleto(idSolicitud: number, trxPassed?: any, idGrupoDestino?: number | null): Promise<any> {
    const runner = trxPassed || db;

    const solicitud = await runner
      .selectFrom('solicitud_traslado')
      .selectAll()
      .where('id_solicitud', '=', idSolicitud)
      .executeTakeFirst();

    if (!solicitud) return null;

    let grupoDestinoFinal = idGrupoDestino || solicitud.id_grupo_destino || null;
    if (!grupoDestinoFinal) {
      const votoConGrupo = await runner
        .selectFrom('traslado_aprobacion')
        .select('id_grupo_destino')
        .where('id_solicitud', '=', idSolicitud)
        .where('id_grupo_destino', 'is not', null)
        .executeTakeFirst();
      if (votoConGrupo?.id_grupo_destino) {
        grupoDestinoFinal = votoConGrupo.id_grupo_destino;
      }
    }

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
        return await this.ejecutarTrasladoTransaccional(idSolicitud, trxPassed, grupoDestinoFinal);
      }
    } else {
      // Traslado de USUARIO / MATRICULA: flujo estándar tripartita
      const tieneOrigen = rolesAprobados.has('DIRECTIVO_ORIGEN') || rolesAprobados.has('ADMIN_GENERAL');
      const tieneDestino = rolesAprobados.has('DIRECTIVO_DESTINO') || rolesAprobados.has('ADMIN_GENERAL');
      const tieneUsuario = rolesAprobados.has('USUARIO') || rolesAprobados.has('ADMIN_GENERAL');

      if (tieneOrigen && tieneDestino && tieneUsuario) {
        return await this.ejecutarTrasladoTransaccional(idSolicitud, trxPassed, grupoDestinoFinal);
      }
    }

    return await this.getSolicitudDetalle(idSolicitud);
  }

  /**
   * Ejecución final del traslado dentro de una transacción atómica PostgreSQL con Kysely
   */
  private static async ejecutarTrasladoTransaccional(idSolicitud: number, trxPassed?: any, idGrupoDestino?: number | null): Promise<any> {
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

      let idRol: number = linkOrigenRow?.id_rol || 0;
      if (!idRol) {
        const usrRol = await trx
          .selectFrom('usuario_rol')
          .select('id_rol')
          .where('id_usuario', '=', solicitud.id_usuario)
          .executeTakeFirst();
        idRol = usrRol?.id_rol || 4; // Por defecto estudiante (4)
      }

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
        // 5.1 Marcar matrícula en origen como TRASLADADA con tipo TRASLADO, preservando su id_grupo e id_nivel intactos
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

          const destColegio = await trx
            .selectFrom('colegio')
            .select('nombre')
            .where('id_colegio', '=', solicitud.id_colegio_destino)
            .executeTakeFirst();

          const obsTraslado = `Matrícula ingresada por traslado interinstitucional desde ${origenColegio?.nombre || 'colegio origen'}`;

          // Obtener el año lectivo (calendario) de la matrícula en la institución origen
          const origAnioRow = await trx
            .selectFrom('anio_lectivo')
            .select('calendario')
            .where('id_anio', '=', origMat.id_anio)
            .executeTakeFirst();

          const calendarioStr = origAnioRow?.calendario || String(new Date().getFullYear());

          // Buscar el id_anio equivalente en la institución destino
          let destAnioRow = await trx
            .selectFrom('anio_lectivo')
            .select('id_anio')
            .where('id_colegio', '=', solicitud.id_colegio_destino)
            .where('calendario', '=', calendarioStr)
            .executeTakeFirst();

          if (!destAnioRow) {
            destAnioRow = await trx
              .selectFrom('anio_lectivo')
              .select('id_anio')
              .where('id_colegio', '=', solicitud.id_colegio_destino)
              .where('estado', '=', 'ABIERTO')
              .orderBy('id_anio', 'desc')
              .executeTakeFirst();
          }

          const destIdAnio = destAnioRow?.id_anio || origMat.id_anio;

          // Resolver grupo y nivel de destino
          let finalGrupoId = idGrupoDestino || solicitud.id_grupo_destino || null;
          if (!finalGrupoId) {
            const votoConGrupo = await trx
              .selectFrom('traslado_aprobacion')
              .select('id_grupo_destino')
              .where('id_solicitud', '=', idSolicitud)
              .where('id_grupo_destino', 'is not', null)
              .executeTakeFirst();
            if (votoConGrupo?.id_grupo_destino) {
              finalGrupoId = votoConGrupo.id_grupo_destino;
            }
          }

          let finalNivelId: number | null = null;
          let gradoNombreStr = 'Grado Ordinario';
          let grupoNombreStr: string | null = null;

          if (finalGrupoId) {
            const gInfo = await trx
              .selectFrom('grupos as g')
              .innerJoin('secciones as s', 'g.id_seccion', 's.id_seccion')
              .innerJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
              .leftJoin('jornada as j', 'g.id_jornada', 'j.id_jornada')
              .select([
                'g.id_grupo',
                'g.id_nivel',
                'tg.nombre as grado_nombre',
                's.nombre as seccion_nombre',
                'j.nombre as jornada_nombre'
              ])
              .where('g.id_grupo', '=', finalGrupoId)
              .where('g.id_colegio', '=', solicitud.id_colegio_destino)
              .executeTakeFirst();

            if (gInfo) {
              finalNivelId = gInfo.id_nivel;
              gradoNombreStr = gInfo.grado_nombre;
              grupoNombreStr = `${gInfo.grado_nombre} - ${gInfo.seccion_nombre} (${gInfo.jornada_nombre || 'Jornada Ordinaria'})`;
            }
          }

          if (!finalNivelId) {
            // Resolver nivel escolar equivalente perteneciente a Colegio B
            const origGradoInfo = await trx
              .selectFrom('matricula as m')
              .leftJoin('grupos as g', 'g.id_grupo', 'm.id_grupo')
              .leftJoin('tipo_grado as tg', 'tg.id_tipo_grado', 'g.id_tipo_grado')
              .select(['tg.nombre as grado_nombre'])
              .where('m.id_matricula', '=', solicitud.id_matricula)
              .executeTakeFirst();

            if (origGradoInfo?.grado_nombre) {
              const destGrado = await trx
                .selectFrom('tipo_grado as tg')
                .innerJoin('nivel_escolar as ne', 'ne.id_nivel', 'tg.id_nivel')
                .select(['tg.id_nivel', 'tg.nombre as grado_nombre'])
                .where('ne.id_colegio', '=', solicitud.id_colegio_destino)
                .where('tg.nombre', '=', origGradoInfo.grado_nombre)
                .executeTakeFirst();

              if (destGrado) {
                finalNivelId = destGrado.id_nivel;
                gradoNombreStr = destGrado.grado_nombre;
              }
            }

            if (!finalNivelId) {
              const defaultNivel = await trx
                .selectFrom('nivel_escolar')
                .select('id_nivel')
                .where('id_colegio', '=', solicitud.id_colegio_destino)
                .orderBy('id_nivel', 'asc')
                .executeTakeFirst();
              finalNivelId = defaultNivel?.id_nivel || null;
            }
          }

          const destMatExistente = await trx
            .selectFrom('matricula')
            .select('id_matricula')
            .where('id_estudiante', '=', estRow.id_estudiante)
            .where('id_colegio', '=', solicitud.id_colegio_destino)
            .where('id_anio', '=', destIdAnio)
            .executeTakeFirst();

          if (destMatExistente) {
            await trx
              .updateTable('matricula')
              .set({
                estado: 'ACTIVA' as any,
                tipo: 'TRASLADO' as any,
                es_traslado: true,
                id_anio: destIdAnio,
                id_grupo: finalGrupoId,
                id_nivel: finalNivelId,
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
                id_anio: destIdAnio,
                id_grupo: finalGrupoId,
                id_nivel: finalNivelId,
                id_usuario_responsable: origMat.id_usuario_responsable,
                correo_padre: origMat.correo_padre,
                estado: 'ACTIVA' as any,
                tipo: 'TRASLADO' as any,
                es_traslado: true,
                observaciones: obsTraslado,
                fecha_aprobacion: sql`NOW()`,
                fecha_creacion: sql`NOW()`
              })
              .execute();
          }

          // 5.4 Gestión de Vinculación Multi-Institucional del Padre de Familia / Acudiente
          const idRolPadreRes = await trx
            .selectFrom('rol')
            .select('id_rol')
            .where('nombre', '=', 'padre')
            .executeTakeFirst();
          const idRolPadre = idRolPadreRes?.id_rol || 3;

          // Buscar todos los acudientes vinculados al estudiante trasladado
          const padresVinculados = await trx
            .selectFrom('detalle_padrefamilia as dpf')
            .innerJoin('padre_familia as pf', 'pf.id_padrefamilia', 'dpf.id_padrefamilia')
            .select([
              'dpf.id_detallepadrefamilia',
              'dpf.id_padrefamilia',
              'pf.id_usuario as id_usuario_padre'
            ])
            .where('dpf.id_estudiante', '=', estRow.id_estudiante)
            .execute();

          for (const padre of padresVinculados) {
            // A. Actualizar la relación en detalle_padrefamilia al colegio destino
            await trx
              .updateTable('detalle_padrefamilia')
              .set({ id_colegio: solicitud.id_colegio_destino })
              .where('id_detallepadrefamilia', '=', padre.id_detallepadrefamilia)
              .execute();

            if (padre.id_usuario_padre) {
              // B. Crear / Activar vinculación del Padre con el Colegio Destino en usuario_colegio
              await trx
                .insertInto('usuario_colegio')
                .values({
                  id_usuario: padre.id_usuario_padre,
                  id_colegio: solicitud.id_colegio_destino,
                  id_rol: idRolPadre,
                  estado: 'ACTIVO',
                  fecha_inicio: sql`NOW()`,
                  fecha_fin: null
                })
                .onConflict((oc: any) =>
                  oc.columns(['id_usuario', 'id_colegio', 'id_rol']).doUpdateSet({
                    estado: 'ACTIVO',
                    fecha_inicio: sql`NOW()`,
                    fecha_fin: null
                  })
                )
                .execute();

              // C. Evaluar si el padre tiene OTROS hijos con matrícula ACTIVA en el Colegio Origen
              const otrosHijosActivos = await trx
                .selectFrom('detalle_padrefamilia as dpf')
                .innerJoin('estudiante as e', 'e.id_estudiante', 'dpf.id_estudiante')
                .innerJoin('matricula as m', 'm.id_estudiante', 'e.id_estudiante')
                .select('m.id_matricula')
                .where('dpf.id_padrefamilia', '=', padre.id_padrefamilia)
                .where('m.id_colegio', '=', solicitud.id_colegio_origen)
                .where('m.id_estudiante', '!=', estRow.id_estudiante)
                .where('m.estado', 'in', ['ACTIVA', 'APROBADA'])
                .execute();

              // D. Si NO le quedan otros hijos activos en Colegio Origen, inactivar ÚNICAMENTE su rol 'padre' en Colegio Origen
              if (otrosHijosActivos.length === 0) {
                await trx
                  .updateTable('usuario_colegio')
                  .set({
                    estado: 'INACTIVO',
                    fecha_fin: sql`NOW()`
                  })
                  .where('id_usuario', '=', padre.id_usuario_padre)
                  .where('id_colegio', '=', solicitud.id_colegio_origen)
                  .where('id_rol', '=', idRolPadre)
                  .execute();
              }
            }
          }

          // Disparar correo de notificación al acudiente
          if (origMat.correo_padre) {
            const usuarioEst = await trx
              .selectFrom('usuario')
              .select(['nombre', 'apellido'])
              .where('id_usuario', '=', solicitud.id_usuario)
              .executeTakeFirst();

            const studentFullName = `${usuarioEst?.nombre || 'Estudiante'} ${usuarioEst?.apellido || ''}`.trim();

            NotificationService.sendInterInstitutionalTransferApprovedEmail(
              origMat.correo_padre,
              'Padre de Familia / Acudiente',
              studentFullName,
              origenColegio?.nombre || 'Plantel Origen',
              destColegio?.nombre || 'Plantel Destino',
              gradoNombreStr,
              grupoNombreStr
            ).catch((err: any) => console.error('Error enviando correo de confirmación de traslado:', err));
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
      .leftJoin('anio_lectivo as al_m', 'al_m.id_anio', 'm.id_anio')
      .select([
        'st.id_solicitud',
        'st.tipo',
        'st.id_usuario',
        'st.id_colegio_origen',
        'st.id_colegio_destino',
        'st.id_matricula',
        'st.id_grupo_destino',
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
      const yearRow = await db
        .selectFrom('anio_lectivo')
        .select('calendario')
        .where('id_anio', '=', filter.yearId)
        .executeTakeFirst();

      const yearCalendario = yearRow?.calendario;

      if (yearCalendario) {
        query = query.where((eb) =>
          eb.or([
            eb('al_m.calendario', '=', yearCalendario),
            eb('st.id_matricula', 'is', null),
            sql<boolean>`EXTRACT(YEAR FROM st.fecha_creacion)::text = ${yearCalendario}`
          ])
        );
      } else {
        query = query.where((eb) =>
          eb.or([
            eb('m.id_anio', '=', filter.yearId!),
            eb('st.id_matricula', 'is', null)
          ])
        );
      }
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
        'st.id_grupo_destino',
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
      .leftJoin('grupos as g', 'g.id_grupo', 'ta.id_grupo_destino')
      .leftJoin('secciones as s', 'g.id_seccion', 's.id_seccion')
      .leftJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
      .leftJoin('jornada as j', 'g.id_jornada', 'j.id_jornada')
      .select([
        'ta.id_aprobacion',
        'ta.id_solicitud',
        'ta.id_usuario',
        'ta.rol',
        'ta.accion',
        'ta.comentario',
        'ta.fecha',
        'ta.id_grupo_destino',
        'u.nombre as usuario_nombre',
        'u.apellido as usuario_apellido',
        'u.email as usuario_email',
        'tg.nombre as grupo_destino_grado',
        's.nombre as grupo_destino_seccion',
        'j.nombre as grupo_destino_jornada'
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

    let datosOrigen: {
      grado?: string | null;
      seccion?: string | null;
      jornada?: string | null;
      nivel?: string | null;
    } | null = null;

    if (solicitud.tipo === 'TRASLADO_MATRICULA') {
      if (solicitud.id_matricula) {
        const origMat = await db
          .selectFrom('matricula as m')
          .leftJoin('grupos as g', 'g.id_grupo', 'm.id_grupo')
          .leftJoin('tipo_grado as tg', 'tg.id_tipo_grado', 'g.id_tipo_grado')
          .leftJoin('jornada as j', 'j.id_jornada', 'g.id_jornada')
          .leftJoin('nivel_escolar as n', (join) =>
            join.onRef('n.id_nivel', '=', sql<number>`COALESCE(m.id_nivel, g.id_nivel, tg.id_nivel)`)
          )
          .select([
            'tg.nombre as grado',
            sql<string | null>`NULL`.as('seccion'),
            'j.nombre as jornada',
            'n.nombre as nivel'
          ])
          .where('m.id_matricula', '=', solicitud.id_matricula)
          .executeTakeFirst();

        if (origMat && (origMat.grado || origMat.jornada)) {
          datosOrigen = {
            grado: origMat.grado || null,
            seccion: origMat.seccion || null,
            jornada: origMat.jornada || null,
            nivel: origMat.nivel || null
          };
        }
      }

      if (!datosOrigen && solicitud.id_usuario) {
        const est = await db
          .selectFrom('estudiante as e')
          .select('e.id_estudiante')
          .where('e.id_usuario', '=', solicitud.id_usuario)
          .executeTakeFirst();

        if (est) {
          const origMat = await db
            .selectFrom('matricula as m')
            .leftJoin('grupos as g', 'g.id_grupo', 'm.id_grupo')
            .leftJoin('tipo_grado as tg', 'tg.id_tipo_grado', 'g.id_tipo_grado')
            .leftJoin('jornada as j', 'j.id_jornada', 'g.id_jornada')
            .leftJoin('nivel_escolar as n', (join) =>
              join.onRef('n.id_nivel', '=', sql<number>`COALESCE(m.id_nivel, g.id_nivel, tg.id_nivel)`)
            )
            .select([
              sql<string | null>`tg.nombre`.as('grado'),
              sql<string | null>`NULL`.as('seccion'),
              sql<string | null>`j.nombre`.as('jornada'),
              sql<string | null>`n.nombre`.as('nivel')
            ])
            .where('m.id_estudiante', '=', est.id_estudiante)
            .where('m.id_colegio', '=', solicitud.id_colegio_origen)
            .orderBy('m.id_matricula', 'desc')
            .executeTakeFirst();

          if (origMat && (origMat.grado || origMat.jornada)) {
            datosOrigen = {
              grado: origMat.grado || null,
              seccion: origMat.seccion || null,
              jornada: origMat.jornada || null,
              nivel: origMat.nivel || null
            };
          }
        }
      }
    }

    let datosDestino: {
      id_grupo?: number | null;
      grupo_nombre?: string | null;
      grado?: string | null;
      seccion?: string | null;
      jornada?: string | null;
    } | null = null;

    let idGrupoDest = solicitud.id_grupo_destino;
    if (!idGrupoDest) {
      const apConGrupo = aprobaciones.find((a: any) => a.id_grupo_destino);
      if (apConGrupo) {
        idGrupoDest = apConGrupo.id_grupo_destino;
      }
    }

    if (idGrupoDest) {
      const gDest = await db
        .selectFrom('grupos as g')
        .innerJoin('secciones as s', 'g.id_seccion', 's.id_seccion')
        .innerJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
        .leftJoin('jornada as j', 'g.id_jornada', 'j.id_jornada')
        .select([
          'g.id_grupo',
          'tg.nombre as grado',
          's.nombre as seccion',
          'j.nombre as jornada'
        ])
        .where('g.id_grupo', '=', idGrupoDest)
        .executeTakeFirst();

      if (gDest) {
        datosDestino = {
          id_grupo: gDest.id_grupo,
          grado: gDest.grado,
          seccion: gDest.seccion,
          jornada: gDest.jornada || 'Ordinaria',
          grupo_nombre: `${gDest.grado} - ${gDest.seccion} (${gDest.jornada || 'Jornada Ordinaria'})`
        };
      }
    }

    return { ...solicitud, id_grupo_destino: idGrupoDest || null, aprobaciones, padre: padreInfo, datos_origen: datosOrigen, datos_destino: datosDestino };
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

  /**
   * Obtener todos los datos académicos históricos del estudiante hasta el momento de su traslado.
   */
  static async getDatosAcademicosTraslado(targetId: number): Promise<any> {
    // 1. Resolver estudiante y datos de la solicitud / matrícula
    let solicitud: any = await db
      .selectFrom('solicitud_traslado as st')
      .innerJoin('usuario as u', 'u.id_usuario', 'st.id_usuario')
      .innerJoin('colegio as co', 'co.id_colegio', 'st.id_colegio_origen')
      .innerJoin('colegio as cd', 'cd.id_colegio', 'st.id_colegio_destino')
      .select([
        'st.id_solicitud',
        'st.id_usuario',
        'st.id_matricula',
        'st.fecha_creacion',
        'st.fecha_finalizacion',
        'st.motivo',
        'st.estado',
        'u.nombre as estudiante_nombre',
        'u.apellido as estudiante_apellido',
        'u.documento as estudiante_documento',
        'u.email as estudiante_email',
        'co.nombre as colegio_origen_nombre',
        'cd.nombre as colegio_destino_nombre'
      ])
      .where((eb) =>
        eb.or([
          eb('st.id_solicitud', '=', targetId),
          eb('st.id_matricula', '=', targetId),
          eb('st.id_usuario', '=', targetId)
        ])
      )
      .orderBy('st.id_solicitud', 'desc')
      .executeTakeFirst();

    let studentRow: any = null;

    if (solicitud) {
      studentRow = await db
        .selectFrom('estudiante as e')
        .select(['e.id_estudiante', 'e.codigo', 'e.id_colegio'])
        .where('e.id_usuario', '=', solicitud.id_usuario)
        .executeTakeFirst();
    } else {
      // Intentar buscar por id_matricula
      const matRow = await db
        .selectFrom('matricula as m')
        .innerJoin('estudiante as e', 'e.id_estudiante', 'm.id_estudiante')
        .innerJoin('usuario as u', 'u.id_usuario', 'e.id_usuario')
        .innerJoin('colegio as c', 'c.id_colegio', 'm.id_colegio')
        .select([
          'm.id_matricula',
          'm.id_estudiante',
          'm.fecha_creacion',
          'e.id_usuario',
          'e.codigo',
          'u.nombre as estudiante_nombre',
          'u.apellido as estudiante_apellido',
          'u.documento as estudiante_documento',
          'u.email as estudiante_email',
          'c.nombre as colegio_origen_nombre'
        ])
        .where('m.id_matricula', '=', targetId)
        .executeTakeFirst();

      if (matRow) {
        studentRow = { id_estudiante: matRow.id_estudiante, codigo: matRow.codigo };
        solicitud = {
          id_solicitud: 0,
          id_usuario: matRow.id_usuario,
          id_matricula: matRow.id_matricula,
          fecha_creacion: matRow.fecha_creacion,
          fecha_finalizacion: matRow.fecha_creacion,
          motivo: 'Registro de Matrícula',
          estado: 'EJECUTADA',
          estudiante_nombre: matRow.estudiante_nombre,
          estudiante_apellido: matRow.estudiante_apellido,
          estudiante_documento: matRow.estudiante_documento,
          estudiante_email: matRow.estudiante_email,
          colegio_origen_nombre: matRow.colegio_origen_nombre,
          colegio_destino_nombre: matRow.colegio_origen_nombre
        };
      } else {
        // Intentar buscar por id_estudiante
        studentRow = await db
          .selectFrom('estudiante as e')
          .innerJoin('usuario as u', 'u.id_usuario', 'e.id_usuario')
          .innerJoin('colegio as c', 'c.id_colegio', 'e.id_colegio')
          .select([
            'e.id_estudiante',
            'e.codigo',
            'e.id_usuario',
            'u.nombre as estudiante_nombre',
            'u.apellido as estudiante_apellido',
            'u.documento as estudiante_documento',
            'u.email as estudiante_email',
            'c.nombre as colegio_origen_nombre'
          ])
          .where('e.id_estudiante', '=', targetId)
          .executeTakeFirst();

        if (studentRow) {
          solicitud = {
            id_solicitud: 0,
            id_usuario: studentRow.id_usuario,
            id_matricula: 0,
            fecha_creacion: new Date(),
            fecha_finalizacion: new Date(),
            motivo: 'Registro Académico del Estudiante',
            estado: 'EJECUTADA',
            estudiante_nombre: studentRow.estudiante_nombre,
            estudiante_apellido: studentRow.estudiante_apellido,
            estudiante_documento: studentRow.estudiante_documento,
            estudiante_email: studentRow.estudiante_email,
            colegio_origen_nombre: studentRow.colegio_origen_nombre,
            colegio_destino_nombre: studentRow.colegio_origen_nombre
          };
        }
      }
    }

    if (!solicitud || !studentRow) {
      return null;
    }

    const studentId = Number(studentRow.id_estudiante);

    // 2. Consultar notas detalladas por materia y periodo
    const gradesRows = await db
      .selectFrom('notas_actividad as na')
      .innerJoin('actividad_materia as am', 'am.id_actividadmateria', 'na.id_actividadmateria')
      .innerJoin('detalle_grados as dg', 'dg.id_detallegrado', 'am.id_detallegrado')
      .innerJoin('materias as mat', 'mat.id_materia', 'dg.id_materia')
      .innerJoin('periodo_academico as pa', 'pa.id_periodo', 'am.id_periodo')
      .leftJoin('docente as d', 'd.id_docente', 'dg.id_docente')
      .leftJoin('usuario as ud', 'ud.id_usuario', 'd.id_usuario')
      .select([
        'mat.id_materia',
        'mat.nombre as materia_nombre',
        'am.id_periodo',
        'pa.nombre as periodo_nombre',
        'am.nombre as actividad_nombre',
        'am.porcentaje as actividad_porcentaje',
        'na.nota',
        sql<string>`COALESCE(ud.nombre || ' ' || ud.apellido, 'Sin Asignar')`.as('docente_nombre')
      ])
      .where('na.id_estudiante', '=', studentId)
      .orderBy('mat.nombre', 'asc')
      .orderBy('am.id_periodo', 'asc')
      .execute();

    // Agrupar calificaciones por materia
    const materiasMap: Record<string, any> = {};
    for (const r of gradesRows) {
      const key = r.materia_nombre;
      if (!materiasMap[key]) {
        materiasMap[key] = {
          materia_nombre: r.materia_nombre,
          docente_nombre: r.docente_nombre,
          periodos: {}
        };
      }

      const pKey = r.periodo_nombre;
      if (!materiasMap[key].periodos[pKey]) {
        materiasMap[key].periodos[pKey] = {
          periodo_nombre: pKey,
          actividades: [],
          suma_ponderada: 0,
          suma_porcentaje: 0
        };
      }

      const notaVal = parseFloat(String(r.nota || 0));
      const pctVal = parseFloat(String(r.actividad_porcentaje || 0));

      materiasMap[key].periodos[pKey].actividades.push({
        actividad: r.actividad_nombre,
        porcentaje: pctVal,
        nota: notaVal
      });

      materiasMap[key].periodos[pKey].suma_ponderada += notaVal * (pctVal / 100.0);
      materiasMap[key].periodos[pKey].suma_porcentaje += pctVal;
    }

    const materiasList = Object.values(materiasMap).map((m: any) => {
      const periodosList = Object.values(m.periodos).map((p: any) => {
        const promedio = parseFloat(p.suma_ponderada.toFixed(2));
        let desempeno = 'Bajo';
        if (promedio >= 4.6) desempeno = 'Superior';
        else if (promedio >= 4.0) desempeno = 'Alto';
        else if (promedio >= 3.0) desempeno = 'Básico';

        return {
          periodo_nombre: p.periodo_nombre,
          actividades: p.actividades,
          promedio,
          desempeno
        };
      });

      const promediosPeriodos = periodosList.map(p => p.promedio);
      const promedioGeneral = promediosPeriodos.length > 0
        ? parseFloat((promediosPeriodos.reduce((a: number, b: number) => a + b, 0) / promediosPeriodos.length).toFixed(2))
        : 0;

      return {
        materia_nombre: m.materia_nombre,
        docente_nombre: m.docente_nombre,
        periodos: periodosList,
        promedio_general: promedioGeneral
      };
    });

    // 3. Consultar asistencia del estudiante
    const attendanceRes = await db
      .selectFrom('registro_asistencia as ra')
      .select([
        sql<number>`COUNT(*)`.as('total_registros'),
        sql<number>`COUNT(*) FILTER (WHERE ra.estado = 'PRESENTE')`.as('asistencias'),
        sql<number>`COUNT(*) FILTER (WHERE ra.estado IN ('AUSENTE', 'TARDE'))`.as('inasistencias'),
        sql<number>`COUNT(*) FILTER (WHERE ra.estado = 'JUSTIFICADA')`.as('excusas')
      ])
      .where('ra.id_estudiante', '=', studentId)
      .executeTakeFirst();

    // 4. Consultar observaciones de convivencia
    const obsRows = await db
      .selectFrom('observacion_estudiante as oe')
      .innerJoin('detalle_grados as dg', 'dg.id_detallegrado', 'oe.id_detallegrado')
      .leftJoin('docente as d', 'd.id_docente', 'dg.id_docente')
      .leftJoin('usuario as ud', 'ud.id_usuario', 'd.id_usuario')
      .select([
        'oe.id_observacion',
        'oe.tipo as tipo_observacion',
        sql<string>`COALESCE(oe.recomendaciones, 'Sin detalles')`.as('observacion'),
        sql<string>`NOW()::text`.as('fecha'),
        sql<string>`COALESCE(ud.nombre || ' ' || ud.apellido, 'Docente')`.as('docente_nombre')
      ])
      .where('oe.id_estudiante', '=', studentId)
      .execute();

    return {
      solicitud,
      estudiante: {
        id_estudiante: studentId,
        nombre: `${solicitud.estudiante_nombre} ${solicitud.estudiante_apellido}`,
        documento: solicitud.estudiante_documento,
        codigo: studentRow.codigo || 'Sin código',
        email: solicitud.estudiante_email,
        colegio_origen: solicitud.colegio_origen_nombre,
        colegio_destino: solicitud.colegio_destino_nombre,
        fecha_traslado: solicitud.fecha_finalizacion || solicitud.fecha_creacion,
        motivo: solicitud.motivo
      },
      materias: materiasList,
      asistencia: {
        total: Number(attendanceRes?.total_registros || 0),
        asistencias: Number(attendanceRes?.asistencias || 0),
        inasistencias: Number(attendanceRes?.inasistencias || 0),
        excusas: Number(attendanceRes?.excusas || 0),
        porcentaje_asistencia: Number(attendanceRes?.total_registros || 0) > 0
          ? parseFloat(((Number(attendanceRes?.asistencias || 0) / Number(attendanceRes?.total_registros)) * 100).toFixed(1))
          : 100
      },
      observaciones: obsRows
    };
  }
}



