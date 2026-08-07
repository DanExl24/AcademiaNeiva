import { pool } from "../config/db";
import { db } from "../config/kysely";
import { sql } from "kysely";
import { NotificationService } from "./notificationService";
import bcrypt from "bcrypt";

// Documentos siempre obligatorios
const ALWAYS_REQUIRED = ['documentoPadre', 'salud', 'foto', 'reciboPublico'];
const REQUIRED_FOR_LOWER_LEVELS = ['registroCivil', 'vacunas'];   // NO aplica a SE/BA
const REQUIRED_NOT_INFANT = ['documentoIdentidad', 'certificadosEscolaridad']; // NO aplica a PI

export class MatriculaService {

  /**
   * MR01 – El padre envía el formulario de matrícula.
   * Solo se persiste la solicitud en la tabla 'matricula' (con id_estudiante = NULL).
   */
  static async createEnrollment(data: any, files: any) {
    const { level, hasDisability, isForeigner, parentEmail, id_colegio } = data;

    if (!parentEmail || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(parentEmail).trim())) {
      throw new Error("El correo electrónico del acudiente no es válido.");
    }

    // --- Validación de documentos ---
    const isHigher = level === 'SECUNDARIA' || level === 'MEDIA';
    const isPre    = level === 'PREESCOLAR';

    const required: string[] = [...ALWAYS_REQUIRED];
    if (!isHigher) required.push(...REQUIRED_FOR_LOWER_LEVELS);
    if (!isPre)    required.push(...REQUIRED_NOT_INFANT);
    if (isForeigner  === 'true') required.push('visa');
    if (hasDisability === 'true') required.push('certificadoDiscapacidad');

    for (const doc of required) {
      if (!files[doc] || (files[doc] as any[]).length === 0) {
        throw new Error(`Documento requerido faltante: ${doc}`);
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let idMatricula: number = 0;
      let tokenSeguimiento: string = '';
      let isExtraordinary = false;

      if (data.token) {
        const extraRes = await client.query(
          `SELECT id_matricula, token_seguimiento, id_colegio, id_anio, tipo 
           FROM matricula WHERE token_seguimiento = $1 AND tipo = 'EXTRAORDINARIA'`,
          [data.token]
        );
        if (extraRes.rows.length > 0) {
          isExtraordinary = true;
          idMatricula = extraRes.rows[0].id_matricula;
          tokenSeguimiento = extraRes.rows[0].token_seguimiento;
        }
      }

      if (!isExtraordinary) {
        // Fetch active year for the school
        const yearRes = await client.query(
          `SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 AND estado = 'ABIERTO' ORDER BY id_anio DESC LIMIT 1`,
          [id_colegio]
        );
        if (yearRes.rows.length === 0) {
          throw new Error("El colegio seleccionado no tiene un año lectivo activo abierto.");
        }
        const activeYearId = yearRes.rows[0].id_anio;

        // Validate enrollment configuration dates and state
        const configRes = await client.query(
          `SELECT fecha_inicio, fecha_cierre, habilitada 
           FROM configuracion_inscripcion 
           WHERE id_colegio = $1 AND id_anio = $2`,
          [id_colegio, activeYearId]
        );

        if (configRes.rows.length === 0) {
          throw new Error("Las inscripciones para esta institución aún no están configuradas.");
        }

        const config = configRes.rows[0];
        if (!config.habilitada) {
          throw new Error("Las inscripciones están deshabilitadas temporalmente por la institución.");
        }

        const now = new Date();
        const start = new Date(config.fecha_inicio);
        const end = new Date(config.fecha_cierre);

        if (now < start) {
          throw new Error(`Las inscripciones aún no han comenzado. Abren el ${start.toLocaleDateString('es-CO')}.`);
        }
        if (now > end) {
          throw new Error(`Las inscripciones ya cerraron. Finalizaron el ${end.toLocaleDateString('es-CO')}.`);
        }

        // Note: No duplicate guard by correo_padre alone — a parent may enroll
        // multiple children in the same academic year. The directivo reviews
        // and approves/rejects each request individually.

        // Insertar nueva matrícula regular
        const matRes = await client.query(
          `INSERT INTO matricula 
             (id_estudiante, id_nivel, id_grupo, id_colegio, id_anio, estado, correo_padre, tiene_discapacidad, es_extranjero)
           VALUES (NULL, NULL, $1, $2, $3, 'PENDIENTE', $4, $5, $6)
           RETURNING id_matricula, token_seguimiento`,
          [data.grade, id_colegio, activeYearId, parentEmail, hasDisability === 'true', isForeigner === 'true']
        );
        idMatricula = matRes.rows[0].id_matricula;
        tokenSeguimiento = matRes.rows[0].token_seguimiento;
      } else {
        // Actualizar la matrícula extraordinaria pre-creada con el grupo y datos del formulario
        await client.query(
          `UPDATE matricula 
           SET id_grupo = $1, tiene_discapacidad = $2, es_extranjero = $3, estado = 'PENDIENTE'
           WHERE id_matricula = $4`,
          [data.grade, hasDisability === 'true' || hasDisability === true, isForeigner === 'true' || isForeigner === true, idMatricula]
        );
      }

      // 2. Guardar documentos en tabla documento_matriculas
      for (const [key, fileArray] of Object.entries(files)) {
        const file = (fileArray as any[])[0];
        const filename = file.originalname || file.filename || `${key}.pdf`;
        await client.query(
          `INSERT INTO documento_matriculas 
             (id_matricula, tipo_documento, url, estado, fecha, id_colegio, contenido, mime_type, nombre_original, tamano_bytes)
           VALUES ($1, $2, $3, 'PENDIENTE', NOW(), $4, $5, $6, $7, $8)`,
          [
            idMatricula, 
            key, 
            filename, 
            id_colegio, 
            file.buffer || null, 
            file.mimetype || null, 
            file.originalname || filename, 
            file.size || null
          ]
        );
      }

      await client.query('COMMIT');

      // Enviar correo de confirmación de forma asíncrona
      NotificationService.sendEnrollmentSubmittedEmail(parentEmail, 'Padre de Familia', 'Aspirante', tokenSeguimiento).catch(err => {
        console.error('Error enviando correo de confirmación de matrícula:', err);
      });

      return { idMatricula, token_seguimiento: tokenSeguimiento };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** MR02 – Ver matrículas filtradas por estado y año lectivo (Kysely Type-Safe Query) */
  static async getFiltered(idColegio: number, estado: string, yearId?: number) {
    let query = db
      .selectFrom('matricula as m')
      .leftJoin('estudiante as e', 'm.id_estudiante', 'e.id_estudiante')
      .leftJoin('nivel_escolar as n', 'm.id_nivel', 'n.id_nivel')
      .leftJoin('grupos as g', 'm.id_grupo', 'g.id_grupo')
      .leftJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
      .leftJoin('secciones as s', 'g.id_seccion', 's.id_seccion')
      .select([
        'm.id_matricula',
        'm.id_estudiante',
        'm.id_nivel',
        'm.id_grupo',
        'm.id_colegio',
        'm.id_anio',
        'm.estado',
        'm.tipo',
        'm.correo_padre',
        'm.token_seguimiento',
        'm.es_traslado',
        'm.fecha_creacion',
        'e.nombre as student_nombre',
        'e.apellido as student_apellido',
        'e.documento as student_documento',
        'e.motivo_estado as student_motivo_estado',
        'n.nombre as nivel_nombre',
        sql<string>`CONCAT(tg.nombre, ' - ', s.nombre)`.as('grado_nombre'),
        sql<boolean>`(SELECT COUNT(*) FROM documento_matriculas WHERE id_matricula = m.id_matricula AND estado = 'PENDIENTE') > 0`.as('has_pending_docs')
      ])
      .where('m.id_colegio', '=', idColegio);

    if (yearId) {
      query = query.where('m.id_anio', '=', yearId);
    }

    if (estado !== 'ALL') {
      query = query.where('m.estado', '=', estado as any);
    }

    return await query.orderBy('m.id_matricula', 'desc').execute();
  }

  /** MR02 – Ver todas las matrículas pendientes por año lectivo */
  static async getAllPending(idColegio: number, yearId?: number) {
    let query = `SELECT * FROM matricula WHERE id_colegio = $1 AND estado = 'PENDIENTE'`;
    const params: any[] = [idColegio];
    if (yearId) {
      params.push(yearId);
      query += ` AND id_anio = $${params.length}`;
    }
    query += ` ORDER BY id_matricula DESC`;
    const res = await pool.query(query, params);
    return res.rows;
  }

  /** MR02 – Detalles de una matrícula */
  static async getDetails(idMatricula: number) {
    const matRes = await pool.query(
      `SELECT m.*, ne.nombre as grado_nivel, tg.nombre as tipo_grado, s.nombre as seccion, g.id_jornada, j.nombre as jornada,
              e.nombre as student_firstname, e.apellido as student_lastname, e.codigo as student_code, e.documento as student_document, e.id_tipodocumento as student_id_tipodocumento, e.motivo_estado as student_motivo_estado,
              pf.nombre as parent_firstname, pf.apellido as parent_lastname, pf.documento as parent_document, pf.id_tipodocumento as parent_id_tipodocumento,
              col.escudo_url, col.nombre as school_name,
              (g.cupos_totales - (SELECT COUNT(*) FROM matricula WHERE id_grupo = g.id_grupo AND estado IN ('ACTIVA', 'TRASLADADA'))) as cupos_restantes
       FROM matricula m
       JOIN grupos g ON m.id_grupo = g.id_grupo
       LEFT JOIN colegio col ON col.id_colegio = m.id_colegio
       LEFT JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       LEFT JOIN secciones s ON g.id_seccion = s.id_seccion
       LEFT JOIN jornada j ON g.id_jornada = j.id_jornada
       LEFT JOIN estudiante e ON e.id_estudiante = m.id_estudiante
       LEFT JOIN detalle_padrefamilia dpf ON dpf.id_estudiante = e.id_estudiante
       LEFT JOIN padre_familia pf ON pf.id_padrefamilia = dpf.id_padrefamilia
       WHERE m.id_matricula = $1`, [idMatricula]
    );

    if (matRes.rows.length === 0) throw new Error('Matrícula no encontrada');
    const mat = matRes.rows[0];

    console.log('Searching sections for:', {
      id_colegio: mat.id_colegio,
      nivel: mat.grado_nivel,
      tipo_grado: mat.tipo_grado,
      id_jornada: mat.id_jornada
    });

    // Buscar otras secciones del mismo grado/jornada/colegio
    const sections = await pool.query(
      `SELECT g.id_grupo as id_grado, s.nombre as seccion, 
              (g.cupos_totales - (SELECT COUNT(*) FROM matricula WHERE id_grupo = g.id_grupo AND estado IN ('ACTIVA', 'TRASLADADA'))) as cupos_restantes
       FROM grupos g
       JOIN secciones s ON g.id_seccion = s.id_seccion
       JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       WHERE g.id_colegio = $1 AND ne.nombre = $2 AND tg.nombre = $3 AND g.id_jornada = $4`,
      [mat.id_colegio, mat.grado_nivel, mat.tipo_grado, mat.id_jornada]
    );
    console.log('Found sections count:', sections.rows.length);

    const docs = await pool.query(
      `SELECT d.id_documento, d.id_matricula, d.id_colegio, d.tipo_documento, d.url, d.estado, d.fecha, d.version, d.fecha_expedicion, d.estado_renovacion, d.mime_type, d.nombre_original, d.tamano_bytes, 
              (SELECT prev.url FROM documento_matriculas prev 
               JOIN matricula prev_m ON prev.id_matricula = prev_m.id_matricula
               WHERE m.id_estudiante IS NOT NULL 
                 AND prev_m.id_estudiante = m.id_estudiante 
                 AND LOWER(REPLACE(prev.tipo_documento, ' ', '')) = LOWER(REPLACE(d.tipo_documento, ' ', ''))
                 AND prev.id_matricula != d.id_matricula
               ORDER BY prev.version DESC, prev.id_documento DESC LIMIT 1) AS url_anterior,
              (SELECT prev.version FROM documento_matriculas prev 
               JOIN matricula prev_m ON prev.id_matricula = prev_m.id_matricula
               WHERE m.id_estudiante IS NOT NULL 
                 AND prev_m.id_estudiante = m.id_estudiante 
                 AND LOWER(REPLACE(prev.tipo_documento, ' ', '')) = LOWER(REPLACE(d.tipo_documento, ' ', ''))
                 AND prev.id_matricula != d.id_matricula
               ORDER BY prev.version DESC, prev.id_documento DESC LIMIT 1) AS version_anterior
       FROM documento_matriculas d
       LEFT JOIN matricula m ON d.id_matricula = m.id_matricula
       WHERE d.id_matricula = $1
       ORDER BY d.id_documento ASC`, [idMatricula]
    );

    // Detectar si el correo del padre ya corresponde a un usuario existente (docente/directivo)
    let existingParentUser = null;
    if (mat.correo_padre) {
      const existingUserRes = await pool.query(
        `SELECT u.id_usuario, u.nombre, u.apellido, u.email,
                ARRAY_AGG(r.nombre ORDER BY r.nombre) as roles
         FROM usuario u
         JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
         JOIN rol r ON ur.id_rol = r.id_rol
         WHERE u.email = $1
         GROUP BY u.id_usuario, u.nombre, u.apellido, u.email`,
        [mat.correo_padre]
      );

      if (existingUserRes.rows.length > 0) {
        const eu = existingUserRes.rows[0];
        const roles: string[] = eu.roles;
        // Solo mostrar alerta si es personal institucional (docente o directivo), no si ya es padre
        const isStaff = roles.includes('docente') || roles.includes('directivo') || roles.includes('admin');
        if (isStaff) {
          let displayRole = 'docente';
          if (roles.includes('directivo')) displayRole = 'directivo';
          else if (roles.includes('admin')) displayRole = 'admin';

          existingParentUser = {
            id_usuario: eu.id_usuario,
            nombre: eu.nombre,
            apellido: eu.apellido,
            email: eu.email,
            roles: roles,
            display_role: displayRole
          };
        }
      }
    }

    // Renovación check — detecta todos los hijos elegibles del padre
    let renovacion: {
      is_renovacion: boolean;
      parent_name: string | null;
      candidates: any[];
      // autoselected when only 1 candidate (backward compat)
      student: any | null;
      error_message: string | null;
    } = {
      is_renovacion: false,
      parent_name: null,
      candidates: [],
      student: null,
      error_message: null
    };

    if ((mat.estado === 'PENDIENTE' || mat.estado === 'CORREGIDA' || mat.estado === 'CORRECCION' || mat.estado === 'RECHAZADA') && !mat.id_estudiante && mat.correo_padre) {
      const parentUserRes = await pool.query(
        `SELECT u.id_usuario, u.nombre, u.apellido FROM usuario u 
         JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
         JOIN rol r ON ur.id_rol = r.id_rol
         WHERE u.email = $1 AND r.nombre = 'padre' LIMIT 1`,
        [mat.correo_padre]
      );
      if (parentUserRes.rows.length > 0) {
        const idUsuarioPadre = parentUserRes.rows[0].id_usuario;
        const parentFullName = `${parentUserRes.rows[0].nombre} ${parentUserRes.rows[0].apellido}`.trim();
        
        const parentRes = await pool.query(
          `SELECT id_padrefamilia FROM padre_familia WHERE id_usuario = $1 LIMIT 1`,
          [idUsuarioPadre]
        );
        if (parentRes.rows.length > 0) {
          const idPadre = parentRes.rows[0].id_padrefamilia;
          
          const childrenRes = await pool.query(
            `SELECT e.id_estudiante, e.nombre, e.apellido, e.documento, e.id_tipodocumento,
                    e.estado, e.codigo,
                    tg.nombre as grado_nombre, ne.nombre as nivel_nombre,
                    u.email as student_email 
             FROM estudiante e
             JOIN detalle_padrefamilia dp ON e.id_estudiante = dp.id_estudiante
             LEFT JOIN usuario u ON e.id_usuario = u.id_usuario
             LEFT JOIN matricula m ON m.id_estudiante = e.id_estudiante AND m.id_colegio = e.id_colegio AND m.estado IN ('ACTIVA','TRASLADADA')
             LEFT JOIN grupos g ON m.id_grupo = g.id_grupo
             LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
             LEFT JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
             WHERE dp.id_padrefamilia = $1 AND e.id_colegio = $2
             ORDER BY e.apellido, e.nombre`,
            [idPadre, mat.id_colegio]
          );
          
          if (childrenRes.rows.length > 0) {
            const currentYearRes = await pool.query(
              `SELECT calendario FROM anio_lectivo WHERE id_anio = $1 LIMIT 1`,
              [mat.id_anio]
            );
            if (currentYearRes.rows.length > 0) {
              const currentYearStr = currentYearRes.rows[0].calendario;
              const prevYearStr = String(Number(currentYearStr) - 1);
              
              const prevYearRes = await pool.query(
                `SELECT id_anio FROM anio_lectivo WHERE id_colegio = $1 AND calendario = $2 LIMIT 1`,
                [mat.id_colegio, prevYearStr]
              );
              
              const prevYearId = prevYearRes.rows.length > 0 ? prevYearRes.rows[0].id_anio : null;
              
              // Build candidate list for EVERY child, including those not from prev year
              const candidates: any[] = [];
              
              for (const child of childrenRes.rows) {
                let prevEnrollmentStatus: string | null = null;
                
                if (prevYearId) {
                  const prevEnrollmentRes = await pool.query(
                    `SELECT estado FROM matricula 
                     WHERE id_estudiante = $1 AND id_anio = $2 AND estado IN ('ACTIVA', 'TRASLADADA') LIMIT 1`,
                    [child.id_estudiante, prevYearId]
                  );
                  if (prevEnrollmentRes.rows.length > 0) {
                    prevEnrollmentStatus = prevEnrollmentRes.rows[0].estado;
                  }
                }

                // Determine eligibility and error reason
                let candidateError: string | null = null;
                if (child.estado === 'EXPULSADO') {
                  candidateError = 'Estudiante en estado EXPULSADO — no puede renovar.';
                } else if (child.estado === 'GRADUADO') {
                  candidateError = 'Estudiante graduado — no puede matricularse nuevamente.';
                } else if (child.estado === 'SANCIONADO') {
                  candidateError = 'Estudiante sancionado — la sanción debe levantarse antes de renovar.';
                } else if (prevEnrollmentStatus === 'TRASLADADA') {
                  candidateError = 'Estudiante en estado de TRASLADO — no puede renovar en la institución de origen.';
                }

                // Check for duplicate enrollment in current year
                const currentEnrollmentRes = await pool.query(
                  `SELECT id_matricula FROM matricula 
                   WHERE id_estudiante = $1 AND id_anio = $2 AND estado IN ('ACTIVA', 'TRASLADADA') LIMIT 1`,
                  [child.id_estudiante, mat.id_anio]
                );
                if (currentEnrollmentRes.rows.length > 0) {
                  candidateError = `Estudiante ya tiene matrícula activa para ${currentYearStr}.`;
                }

                candidates.push({
                  ...child,
                  prev_enrollment_status: prevEnrollmentStatus,
                  error_message: candidateError,
                  eligible: !candidateError
                });
              }

              if (candidates.length > 0) {
                renovacion.is_renovacion = true;
                renovacion.parent_name = parentFullName;
                renovacion.candidates = candidates;

                // Backward compatibility: autoselect if exactly 1 eligible candidate
                const eligibles = candidates.filter(c => c.eligible);
                if (eligibles.length === 1) {
                  renovacion.student = eligibles[0];
                } else if (eligibles.length === 0 && candidates.length === 1) {
                  // Only one candidate but blocked
                  renovacion.student = candidates[0];
                  renovacion.error_message = candidates[0].error_message;
                }
              }
            }
          }
        }
      }
    }

    // Fetch expulsion sanction details if cancelled by expulsion
    let expulsionInfo = null;
    if (mat.estado === 'CANCELADA' && mat.motivo_cancelacion === 'EXPULSION' && mat.id_estudiante) {
      const expRes = await pool.query(
        `SELECT s.id_sancion, s.motivo, s.fecha_inicio, s.fecha_fin, s.estado, s.observaciones,
                ts.nombre as tipo_nombre, ts.descripcion as tipo_descripcion,
                u.nombre || ' ' || u.apellido as directivo_nombre
         FROM public.sancion s
         JOIN public.tipo_sancion ts ON s.id_tipo_sancion = ts.id_tipo_sancion
         JOIN public.directivo d ON s.id_directivo = d.id
         JOIN public.usuario u ON d.id_usuario = u.id_usuario
         WHERE s.id_estudiante = $1 AND ts.nombre = 'EXPULSION'
         ORDER BY s.id_sancion DESC
         LIMIT 1`,
        [mat.id_estudiante]
      );
      if (expRes.rows.length > 0) {
        expulsionInfo = expRes.rows[0];
      }
    }

    return {
      ...mat,
      availableSections: sections.rows || [],
      documentos: docs.rows || [],
      existing_parent_user: existingParentUser,
      renovacion,
      expulsion: expulsionInfo
    };
  }

  static async assignGrade(idMatricula: number, idGrado: number) {
    // Solo para guardar el "borrador" si fuera necesario, 
    // pero el usuario dice que no se agregue instantáneamente.
    // Sin embargo, para que el sistema lo recuerde si refresca, 
    // lo guardaremos pero sin activar la matrícula.
    await pool.query(
      `UPDATE matricula SET id_grupo = $1 WHERE id_matricula = $2`,
      [idGrado, idMatricula]
    );
    return { success: true };
  }

  /** MR02 – Actualizar estado de un documento */
  static async updateDocumentStatus(idDocumento: number, estado: string) {
    const res = await pool.query(
      `UPDATE documento_matriculas SET estado = $1 WHERE id_documento = $2 RETURNING *`,
      [estado, idDocumento]
    );
    return res.rows[0];
  }

  /** MR02 – Notificar al padre sobre documentos rechazados */
  static async notifyInconsistencies(idMatricula: number) {
    const details = await this.getDetails(idMatricula);
    const rejectedDocs = details.documentos.filter((d: any) => d.estado === 'RECHAZADO');
    
    if (rejectedDocs.length === 0) return { success: false, message: 'No hay documentos rechazados para notificar' };

    const reason = `Los siguientes documentos presentan inconsistencias: ${rejectedDocs.map((d: any) => d.tipo_documento).join(', ')}. Por favor revísalos y vuelve a subirlos.`;
    
    // Set to CORRECCION according to RN-MAT-004 so the parent is notified to fix documents
    await pool.query("UPDATE matricula SET estado = 'CORRECCION' WHERE id_matricula = $1", [idMatricula]);

    await NotificationService.sendRejectionEmail(details.correo_padre, 'Padre de Familia', reason, details.token_seguimiento);
    return { success: true };
  }

  /** MR03 – Obtener detalles por token (Seguro para el padre) */
  static async getByToken(token: string) {
    const mat = await pool.query(
      `SELECT m.*, ne.nombre as grado_nivel, tg.nombre as tipo_grado, j.nombre as jornada
       FROM matricula m
       LEFT JOIN grupos g ON m.id_grupo = g.id_grupo
       LEFT JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       LEFT JOIN jornada j ON g.id_jornada = j.id_jornada
       WHERE m.token_seguimiento = $1`, [token]
    );
    if (mat.rows.length === 0) throw new Error('Solicitud no encontrada');
    
    const docs = await pool.query(
      `SELECT id_documento, id_matricula, id_colegio, tipo_documento, url, estado, fecha, version, fecha_expedicion, estado_renovacion, mime_type, nombre_original, tamano_bytes
       FROM documento_matriculas 
       WHERE id_matricula = $1 
       ORDER BY id_documento ASC`, [mat.rows[0].id_matricula]
    );
    return {
      ...mat.rows[0],
      documentos: docs.rows
    };
  }

  /** MR03 – El padre corrige los documentos */
  static async updateDocumentsByToken(token: string, files: any) {
    // Buscar el ID a partir del token primero
    const res = await pool.query('SELECT id_matricula FROM matricula WHERE token_seguimiento = $1', [token]);
    if (res.rows.length === 0) throw new Error('Token inválido');
    const idMatricula = res.rows[0].id_matricula;

    return this.updateDocuments(idMatricula, files);
  }

  /** MR03 – El padre corrige los documentos */
  static async updateDocuments(idMatricula: number, files: any) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [key, fileArray] of Object.entries(files)) {
        const file = (fileArray as any[])[0];
        const filename = file.originalname || file.filename || `${key}.pdf`;
        // Actualizar el documento existente y resetear estado a PENDIENTE
        await client.query(
          `UPDATE documento_matriculas 
           SET url = $1, estado = 'PENDIENTE', fecha = NOW(),
               contenido = $2, mime_type = $3, nombre_original = $4, tamano_bytes = $5
           WHERE id_matricula = $6 AND tipo_documento = $7`,
          [
            filename,
            file.buffer || null,
            file.mimetype || null,
            file.originalname || filename,
            file.size || null,
            idMatricula,
            key
          ]
        );
      }

      // Actualizar la matrícula a estado CORREGIDA para que la directiva identifique claramente que se enviaron las correcciones solicitadas
      await client.query("UPDATE matricula SET estado = 'CORREGIDA' WHERE id_matricula = $1", [idMatricula]);

      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** MR04 – Finalizar registro: crea estudiante y padre, actualiza matricula */
  static async finalizeEnrollment(idMatricula: number, data: any) {
    // --- Backend Field Text Validations ---
    if (!data.student || !data.student.nombre || !/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,}$/.test(data.student.nombre.trim())) {
      throw new Error('Nombres de estudiante no válidos. Solo se permiten letras (mínimo 2).');
    }
    if (!data.student || !data.student.apellido || !/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,}$/.test(data.student.apellido.trim())) {
      throw new Error('Apellidos de estudiante no válidos. Solo se permiten letras (mínimo 2).');
    }
    if (!data.student || !data.student.documento || !/^[a-zA-Z0-9-]{4,}$/.test(data.student.documento.trim())) {
      throw new Error('Documento de estudiante no válido. Mínimo 4 caracteres alfanuméricos.');
    }

    if (!data.parent || !data.parent.nombre || !/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,}$/.test(data.parent.nombre.trim())) {
      throw new Error('Nombres de acudiente no válidos. Solo se permiten letras (mínimo 2).');
    }
    if (!data.parent || !data.parent.apellido || !/^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s]{2,}$/.test(data.parent.apellido.trim())) {
      throw new Error('Apellidos de acudiente no válidos. Solo se permiten letras (mínimo 2).');
    }
    if (!data.parent || !data.parent.documento || !/^[a-zA-Z0-9-]{4,}$/.test(data.parent.documento.trim())) {
      throw new Error('Documento de acudiente no válido. Mínimo 4 caracteres alfanuméricos.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const mat = await client.query('SELECT * FROM matricula WHERE id_matricula = $1', [idMatricula]);
      if (mat.rows.length === 0) throw new Error('Matrícula no encontrada');
      
      const finalGradeId = data.id_grado || mat.rows[0].id_grupo;
      const { id_colegio, correo_padre, id_nivel } = mat.rows[0];

      // --- VALIDACIÓN TRANSACTIONAL DE CUPOS CON BLOQUEO DE FILA (RN-MAT-011) ---
      if (finalGradeId) {
        const groupCapRes = await client.query(
          `SELECT g.cupos_totales,
                  (SELECT COUNT(*) FROM matricula WHERE id_grupo = g.id_grupo AND estado IN ('ACTIVA', 'TRASLADADA') AND id_matricula != $1) as ocupados
           FROM grupos g
           WHERE g.id_grupo = $2
           FOR UPDATE OF g`,
          [idMatricula, finalGradeId]
        );
        if (groupCapRes.rows.length > 0) {
          const totalCupos = groupCapRes.rows[0].cupos_totales ?? 35;
          const ocupados = Number(groupCapRes.rows[0].ocupados);
          if (ocupados >= totalCupos) {
            throw new Error(`El salón seleccionado no posee cupos disponibles (Cupos totales: ${totalCupos}, Inscritos activos: ${ocupados}). Por favor selecciona otro grupo.`);
          }
        }
      }

      // --- CREACIÓN O ACTUALIZACIÓN DEL ESTUDIANTE ---
      let idEstudiante = mat.rows[0].id_estudiante || (data.id_estudiante ? Number(data.id_estudiante) : null);
      let studentCode;

      if (idEstudiante) {
        // Estudiante existente
        const estRes = await client.query(
          `SELECT id_usuario, codigo, estado FROM estudiante WHERE id_estudiante = $1`,
          [idEstudiante]
        );
        if (estRes.rows.length === 0) throw new Error('Estudiante pre-asociado no encontrado');
        if (estRes.rows[0].estado === 'GRADUADO') {
          throw new Error('El estudiante ya se encuentra graduado y no puede matricularse nuevamente');
        }
        studentCode = estRes.rows[0].codigo;
        const idUsuarioEstudiante = estRes.rows[0].id_usuario;

        // Actualizar usuario del estudiante para asegurar que esté activo y con sus nombres actualizados
        await client.query(
          `UPDATE usuario SET activo = TRUE, nombre = $1, apellido = $2 WHERE id_usuario = $3`,
          [data.student.nombre, data.student.apellido, idUsuarioEstudiante]
        );

        // Actualizar estudiante (estado a ACTIVO, id_nivel, nombre, apellido, documento, id_tipodocumento)
        await client.query(
          `UPDATE estudiante 
           SET estado = 'ACTIVO', id_nivel = $1, nombre = $2, apellido = $3, documento = $4, id_tipodocumento = $5 
           WHERE id_estudiante = $6`,
          [id_nivel, data.student.nombre, data.student.apellido, data.student.documento, data.student.id_tipodocumento, idEstudiante]
        );
      } else {
        // Estudiante nuevo
        studentCode = 'MAT-' + Date.now();
        
        // Usuario estudiante
        const hashedStudentPass = await bcrypt.hash(studentCode, 10);
        const studentUserRes = await client.query(
           `INSERT INTO usuario (email, password, nombre, apellido, id_colegio) VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario`,
           [studentCode, hashedStudentPass, data.student.nombre, data.student.apellido, id_colegio]
        );
        const idUsuarioEstudiante = studentUserRes.rows[0].id_usuario;
        
        // Rol estudiante
        const rolEstudiante = await client.query("SELECT id_rol FROM rol WHERE nombre = 'estudiante'");
        if(rolEstudiante.rows.length > 0) {
            await client.query("INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)", [idUsuarioEstudiante, rolEstudiante.rows[0].id_rol]);
        }

        // Registro Estudiante
        const studentRes = await client.query(
          `INSERT INTO estudiante (nombre, apellido, documento, codigo, id_tipodocumento, id_nivel, id_colegio, id_usuario, estado)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVO')
           RETURNING id_estudiante`,
          [data.student.nombre, data.student.apellido, data.student.documento, studentCode, data.student.id_tipodocumento, id_nivel, id_colegio, idUsuarioEstudiante]
        );
        idEstudiante = studentRes.rows[0].id_estudiante;
      }

      // --- CREACIÓN / VINCULACIÓN DEL PADRE DE FAMILIA ---
      let idPadre: number;
      let idUsuarioPadre: number | null = null;

      // 1. Buscar si ya existe una ficha de padre registrada con el número de documento proporcionado
      const existingParentByDoc = await client.query(
        'SELECT id_padrefamilia, id_usuario, nombre, apellido FROM padre_familia WHERE documento = $1',
        [data.parent.documento]
      );

      if (existingParentByDoc.rows.length > 0) {
        // Encontrado por número de documento: Usar la ficha de padre existente (sin sobreescribir su documento)
        idPadre = existingParentByDoc.rows[0].id_padrefamilia;
        idUsuarioPadre = existingParentByDoc.rows[0].id_usuario;

        // Actualizar nombres/apellidos si cambiaron legítimamente
        await client.query(
          `UPDATE padre_familia SET nombre = $1, apellido = $2, id_tipodocumento = $3 WHERE id_padrefamilia = $4`,
          [data.parent.nombre, data.parent.apellido, data.parent.id_tipodocumento, idPadre]
        );
      } else {
        // 2. Si no existe por documento, verificar si el correo pertenece a un usuario en el sistema
        const existingUserByEmail = await client.query(
          'SELECT id_usuario FROM usuario WHERE email = $1',
          [correo_padre]
        );

        if (existingUserByEmail.rows.length > 0) {
          const matchedUserId = existingUserByEmail.rows[0].id_usuario;

          // Verificar si este usuario ya tiene una ficha de padre asociada con otro documento distinto
          const existingParentByUser = await client.query(
            'SELECT id_padrefamilia, documento, nombre, apellido FROM padre_familia WHERE id_usuario = $1',
            [matchedUserId]
          );

          if (existingParentByUser.rows.length > 0) {
            const registeredDoc = existingParentByUser.rows[0].documento;
            const parentName = `${existingParentByUser.rows[0].nombre} ${existingParentByUser.rows[0].apellido}`;
            throw new Error(
              `El correo '${correo_padre}' ya se encuentra registrado a nombre del acudiente '${parentName}' con documento (${registeredDoc}). No se puede modificar el documento a (${data.parent.documento}). Por favor verifica el documento ingresado o utiliza un correo distinto.`
            );
          }

          idUsuarioPadre = matchedUserId;
        } else {
          // 3. Crear nueva cuenta de usuario para el padre
          const hashedPadrePass = await bcrypt.hash('padre123', 10);
          const parentUserRes = await client.query(
            `INSERT INTO usuario (email, password, nombre, apellido, id_colegio) VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario`,
            [correo_padre, hashedPadrePass, data.parent.nombre, data.parent.apellido, id_colegio]
          );
          idUsuarioPadre = parentUserRes.rows[0].id_usuario;
        }

        // Crear la ficha de padre vinculada al usuario
        const parentRes = await client.query(
          `INSERT INTO padre_familia (nombre, apellido, documento, id_tipodocumento, id_colegio, id_usuario)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_padrefamilia`,
          [data.parent.nombre, data.parent.apellido, data.parent.documento, data.parent.id_tipodocumento, id_colegio, idUsuarioPadre]
        );
        idPadre = parentRes.rows[0].id_padrefamilia;
      }

      // Asegurar que el usuario tenga el ROL PADRE
      if (idUsuarioPadre) {
        const rolPadre = await client.query("SELECT id_rol FROM rol WHERE nombre = 'padre'");
        if (rolPadre.rows.length > 0) {
          await client.query(
            `INSERT INTO usuario_rol (id_usuario, id_rol) 
             VALUES ($1, $2) 
             ON CONFLICT (id_usuario, id_rol) DO NOTHING`, 
            [idUsuarioPadre, rolPadre.rows[0].id_rol]
          );
        }
      }

      // 3. Vincular Estudiante y Padre (si no están vinculados)
      const linkRes = await client.query(
        "SELECT 1 FROM detalle_padrefamilia WHERE id_padrefamilia = $1 AND id_estudiante = $2",
        [idPadre, idEstudiante]
      );
      if (linkRes.rows.length === 0) {
        await client.query(
          "INSERT INTO detalle_padrefamilia (id_padrefamilia, id_estudiante, id_colegio) VALUES ($1, $2, $3)",
          [idPadre, idEstudiante, id_colegio]
        );
      }

      // 4. Cancelar matrículas previas en estado activo/pendiente para el mismo estudiante en este año lectivo
      // (Previene la violación del índice único idx_matricula_estudiante_anio_colegio_activo)
      await client.query(
        `UPDATE matricula 
         SET estado = 'CANCELADA', motivo_cancelacion = 'Reemplazada por reingreso / nueva matrícula finalizada'
         WHERE id_estudiante = $1 AND id_anio = $2 AND id_colegio = $3 AND id_matricula != $4 AND estado IN ('ACTIVA', 'PENDIENTE', 'CORREGIDA', 'CORRECCION')`,
        [idEstudiante, mat.rows[0].id_anio, id_colegio, idMatricula]
      );

      // 5. Actualizar Matrícula actual a ACTIVA o TRASLADADA
      const finalEstado = mat.rows[0].es_traslado ? 'TRASLADADA' : 'ACTIVA';
      await client.query(
        "UPDATE matricula SET id_estudiante = $1, id_grupo = $3, estado = $4, fecha_aprobacion = NOW() WHERE id_matricula = $2",
        [idEstudiante, idMatricula, finalGradeId, finalEstado]
      );

      // Si la matrícula está vinculada a un ticket de soporte (ej. Reingreso), actualizar el ticket a RESUELTO
      if (mat.rows[0].id_ticket) {
        await client.query(
          `UPDATE tickets_soporte SET estado = 'RESUELTO' WHERE id_ticket = $1`,
          [mat.rows[0].id_ticket]
        );
      }

      // Asegurar que el estudiante quede en estado ACTIVO en el plantel
      if (idEstudiante) {
        await client.query(
          `UPDATE estudiante SET estado = 'ACTIVO', motivo_estado = NULL WHERE id_estudiante = $1`,
          [idEstudiante]
        );
      }

      // Supervision Logging if admin_general
      const isRenovacion = !!data.id_estudiante;
      const isReingreso = mat.rows[0].tipo === 'REINGRESO';
      const isExtraordinaria = mat.rows[0].tipo === 'EXTRAORDINARIA';
      let actionLabel = 'Aprobación de Matrícula';
      let reasonLabel = 'Matrícula de ingreso regular finalizada';
      if (isReingreso) {
        actionLabel = 'Aprobación de Reingreso';
        reasonLabel = 'Reingreso de estudiante retirado finalizado';
      } else if (isRenovacion) {
        actionLabel = 'Renovación de Matrícula';
        reasonLabel = 'Renovación de estudiante existente';
      } else if (isExtraordinaria) {
        actionLabel = 'Aprobación de Matrícula Extraordinaria';
        reasonLabel = 'Matrícula extraordinaria finalizada';
      }

      const auditRes = await client.query(
        `SELECT id_auditoria FROM auditoria_supervision 
         WHERE id_colegio = $1 AND estado_supervision = 'ACTIVA' LIMIT 1`,
        [id_colegio]
      );
      if (auditRes.rows.length > 0) {
        const activeAuditoriaId = auditRes.rows[0].id_auditoria;
        await client.query(
          `INSERT INTO auditoria_acciones_realizadas
           (id_auditoria, modulo, tipo_accion, accion, recurso_afectado, valor_antiguo, valor_nuevo, motivo_cambio)
           VALUES ($1, 'MATRICULAS', 'MODIFICACION', $2, $3, NULL, $4, $5)`,
          [
            activeAuditoriaId,
            actionLabel,
            `Matricula ID: ${idMatricula}`,
            JSON.stringify({ idEstudiante, finalGradeId }),
            reasonLabel
          ]
        );
      }

      await client.query('COMMIT');

      // 5. Notificar al padre
      NotificationService.sendApprovalEmail(correo_padre, data.parent.nombre, `${data.student.nombre} ${data.student.apellido}`, studentCode);

      return { success: true, idEstudiante, idPadre };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async toggleTransferStatus(idMatricula: number, esTraslado: boolean) {
    await pool.query(
      'UPDATE matricula SET es_traslado = $1 WHERE id_matricula = $2',
      [esTraslado, idMatricula]
    );
    return { success: true };
  }

  static async cancelEnrollment(idMatricula: number, data: { motivo: string, detalles?: string | null, estado_estudiante?: 'RETIRADO' | 'EXPULSADO' }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const matRes = await client.query('SELECT id_estudiante, correo_padre, estado, id_ticket FROM matricula WHERE id_matricula = $1', [idMatricula]);
      if (matRes.rows.length === 0) throw new Error('Matrícula no encontrada');
      const mat = matRes.rows[0];
      
      if (mat.estado === 'CANCELADA' || mat.estado === 'CULMINADA') {
        throw new Error('La matrícula ya se encuentra cancelada o culminada');
      }

      const targetStudentState = data.estado_estudiante === 'EXPULSADO' ? 'EXPULSADO' : 'RETIRADO';

      await client.query(
        `UPDATE matricula 
         SET estado = 'CANCELADA', motivo_cancelacion = $1, detalles_cancelacion = $2
         WHERE id_matricula = $3`,
        [data.motivo, data.detalles || null, idMatricula]
      );

      // Si la matrícula proviene de un ticket de reingreso, actualizar el ticket a RESUELTO
      if (mat.id_ticket) {
        await client.query(
          `UPDATE tickets_soporte SET estado = 'RESUELTO' WHERE id_ticket = $1`,
          [mat.id_ticket]
        );
      }

      // Si el estudiante ya está creado u oficializado, actualizar su estado en la tabla estudiante
      if (mat.id_estudiante) {
        await client.query(
          `UPDATE estudiante 
           SET estado = $1, motivo_estado = $2 
           WHERE id_estudiante = $3`,
          [targetStudentState, data.motivo, mat.id_estudiante]
        );
      }

      await client.query('COMMIT');

      // Notificar al padre
      await NotificationService.sendCancellationEmail(mat.correo_padre, 'Padre de Familia', data.motivo, data.detalles || data.motivo);

      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
