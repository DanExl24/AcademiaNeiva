import { pool } from "../config/db";
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

      // Fetch active year for the school
      const yearRes = await client.query(
        `SELECT "id_año" FROM "año_lectivo" WHERE id_colegio = $1 AND estado = 'ABIERTO' LIMIT 1`,
        [id_colegio]
      );
      if (yearRes.rows.length === 0) {
        throw new Error("El colegio seleccionado no tiene un año lectivo activo abierto.");
      }
      const activeYearId = yearRes.rows[0].id_año;

      // Check if approved matriculas exist for this year
      const approvedRes = await client.query(
        `SELECT COUNT(*)::int AS count 
         FROM matricula 
         WHERE id_colegio = $1 AND "id_año" = $2 AND estado IN ('ACTIVA', 'TRASLADADA')`,
        [id_colegio, activeYearId]
      );
      if (approvedRes.rows[0].count > 0) {
        throw new Error("Las inscripciones para este año académico ya han finalizado.");
      }

      // Validate enrollment configuration dates and state
      const configRes = await client.query(
        `SELECT fecha_inicio, fecha_cierre, habilitada 
         FROM configuracion_inscripcion 
         WHERE id_colegio = $1 AND id_año = $2`,
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

      // 1. Insertar en tabla matricula original (id_estudiante es NULL)
      const matRes = await client.query(
        `INSERT INTO matricula 
           (id_estudiante, id_nivel, id_grupo, id_colegio, "id_año", estado, correo_padre, tiene_discapacidad, es_extranjero)
         VALUES (NULL, NULL, $1, $2, $3, 'PENDIENTE', $4, $5, $6)
         RETURNING id_matricula`,
        [data.grade, id_colegio, activeYearId, parentEmail, hasDisability === 'true', isForeigner === 'true']
      );
      const idMatricula = matRes.rows[0].id_matricula;


      // 2. Guardar documentos en tabla documento_matriculas
      for (const [key, fileArray] of Object.entries(files)) {
        const file = (fileArray as any[])[0];
        await client.query(
          `INSERT INTO documento_matriculas (id_matricula, tipo_documento, url, estado, fecha, id_colegio)
           VALUES ($1, $2, $3, 'PENDIENTE', NOW(), $4)`,
          [idMatricula, key, file.filename, id_colegio]
        );
      }

      await client.query('COMMIT');
      return { idMatricula };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** MR02 – Ver matrículas filtradas por estado */
  static async getFiltered(idColegio: number, estado: string) {
    let query = `
      SELECT m.*, 
             (SELECT COUNT(*) FROM documento_matriculas WHERE id_matricula = m.id_matricula AND estado = 'PENDIENTE') > 0 as has_pending_docs
      FROM matricula m
      WHERE m.id_colegio = $1
    `;
    const params: any[] = [idColegio];

    if (estado !== 'ALL') {
      query += ` AND m.estado = $2`;
      params.push(estado);
    }

    query += ` ORDER BY m.id_matricula DESC`;
    const res = await pool.query(query, params);
    return res.rows;
  }

  /** MR02 – Ver todas las matrículas pendientes */
  static async getAllPending(idColegio: number) {
    const res = await pool.query(
      `SELECT * FROM matricula
       WHERE id_colegio = $1 AND estado = 'PENDIENTE'
       ORDER BY id_matricula DESC`,
      [idColegio]
    );
    return res.rows;
  }

  /** MR02 – Detalles de una matrícula */
  static async getDetails(idMatricula: number) {
    const matRes = await pool.query(
      `SELECT m.*, ne.nombre as grado_nivel, tg.nombre as tipo_grado, s.nombre as seccion, g.id_jornada, j.nombre as jornada,
              e.nombre as student_firstname, e.apellido as student_lastname, e.codigo as student_code, e.documento as student_document, e.id_tipodocumento as student_id_tipodocumento,
              pf.nombre as parent_firstname, pf.apellido as parent_lastname, pf.documeno as parent_document, pf.id_tipodocumento as parent_id_tipodocumento,
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
      `SELECT * FROM documento_matriculas WHERE id_matricula = $1`, [idMatricula]
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

    // Renovación check
    let renovacion = {
      is_renovacion: false,
      student: null as any,
      error_message: null as string | null
    };

    if ((mat.estado === 'PENDIENTE' || mat.estado === 'CORRECCION' || mat.estado === 'RECHAZADA') && !mat.id_estudiante && mat.correo_padre) {
      const parentUserRes = await pool.query(
        `SELECT u.id_usuario FROM usuario u 
         JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
         JOIN rol r ON ur.id_rol = r.id_rol
         WHERE u.email = $1 AND r.nombre = 'padre' LIMIT 1`,
        [mat.correo_padre]
      );
      if (parentUserRes.rows.length > 0) {
        const idUsuarioPadre = parentUserRes.rows[0].id_usuario;
        
        const parentRes = await pool.query(
          `SELECT id_padrefamilia FROM padre_familia WHERE id_usuario = $1 LIMIT 1`,
          [idUsuarioPadre]
        );
        if (parentRes.rows.length > 0) {
          const idPadre = parentRes.rows[0].id_padrefamilia;
          
          const childrenRes = await pool.query(
            `SELECT e.*, u.email as student_email 
             FROM estudiante e
             JOIN detalle_padrefamilia dp ON e.id_estudiante = dp.id_estudiante
             LEFT JOIN usuario u ON e.id_usuario = u.id_usuario
             WHERE dp.id_padrefamilia = $1 AND e.id_colegio = $2`,
            [idPadre, mat.id_colegio]
          );
          
          if (childrenRes.rows.length > 0) {
            const currentYearRes = await pool.query(
              `SELECT calendario FROM "año_lectivo" WHERE "id_año" = $1 LIMIT 1`,
              [mat.id_año]
            );
            if (currentYearRes.rows.length > 0) {
              const currentYearStr = currentYearRes.rows[0].calendario;
              const prevYearStr = String(Number(currentYearStr) - 1);
              
              const prevYearRes = await pool.query(
                `SELECT "id_año" FROM "año_lectivo" WHERE id_colegio = $1 AND calendario = $2 LIMIT 1`,
                [mat.id_colegio, prevYearStr]
              );
              
              if (prevYearRes.rows.length > 0) {
                const prevYearId = prevYearRes.rows[0].id_año;
                
                for (const child of childrenRes.rows) {
                  const prevEnrollmentRes = await pool.query(
                    `SELECT id_matricula, estado FROM matricula 
                     WHERE id_estudiante = $1 AND "id_año" = $2 AND estado IN ('ACTIVA', 'TRASLADADA') LIMIT 1`,
                    [child.id_estudiante, prevYearId]
                  );
                  
                  if (prevEnrollmentRes.rows.length > 0) {
                    const prevEnrollment = prevEnrollmentRes.rows[0];
                    renovacion.is_renovacion = true;
                    renovacion.student = child;
                    
                    const status = child.estado;
                    if (status === 'EXPULSADO') {
                      renovacion.error_message = 'El estudiante se encuentra en estado EXPULSADO y no puede realizar renovación.';
                    } else if (status === 'SANCIONADO') {
                      renovacion.error_message = 'El estudiante se encuentra en estado SUSPENDIDO/SANCIONADO. No se puede renovar la matrícula hasta que la sanción sea levantada.';
                    } else if (prevEnrollment.estado === 'TRASLADADA') {
                      renovacion.error_message = 'El estudiante se encuentra en estado de TRASLADO y no puede renovar matrícula en la institución de origen.';
                    } else if (status !== 'ACTIVO') {
                      renovacion.error_message = `El estudiante se encuentra en estado ${status} (No activo).`;
                    }
                    
                    if (!renovacion.error_message) {
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return {
      ...mat,
      availableSections: sections.rows || [],
      documentos: docs.rows || [],
      existing_parent_user: existingParentUser,
      renovacion
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
    
    // Set to RECHAZADA so the UI shows it as "En Corrección" by parent
    await pool.query("UPDATE matricula SET estado = 'RECHAZADA' WHERE id_matricula = $1", [idMatricula]);

    await NotificationService.sendRejectionEmail(details.correo_padre, 'Padre de Familia', reason, details.token_seguimiento);
    return { success: true };
  }

  /** MR03 – Obtener detalles por token (Seguro para el padre) */
  static async getByToken(token: string) {
    const mat = await pool.query(
      `SELECT m.*, ne.nombre as grado_nivel, tg.nombre as tipo_grado, j.nombre as jornada
       FROM matricula m
       JOIN grupos g ON m.id_grupo = g.id_grupo
       LEFT JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       LEFT JOIN jornada j ON g.id_jornada = j.id_jornada
       WHERE m.token_seguimiento = $1`, [token]
    );
    if (mat.rows.length === 0) throw new Error('Solicitud no encontrada');
    
    const docs = await pool.query(
      `SELECT * FROM documento_matriculas WHERE id_matricula = $1`, [mat.rows[0].id_matricula]
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
        // Actualizar el documento existente y resetear estado a PENDIENTE
        await client.query(
          `UPDATE documento_matriculas 
           SET url = $1, estado = 'PENDIENTE', fecha = NOW()
           WHERE id_matricula = $2 AND tipo_documento = $3`,
          [file.filename, idMatricula, key]
        );
      }

      // Set to CORRECCION so the Admin can filter these quickly
      await client.query("UPDATE matricula SET estado = 'CORRECCION' WHERE id_matricula = $1", [idMatricula]);
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const mat = await client.query('SELECT * FROM matricula WHERE id_matricula = $1', [idMatricula]);
      if (mat.rows.length === 0) throw new Error('Matrícula no encontrada');
      
      const finalGradeId = data.id_grado || mat.rows[0].id_grupo;
      const { id_colegio, correo_padre, id_nivel } = mat.rows[0];

      // --- CREACIÓN O ACTUALIZACIÓN DEL ESTUDIANTE ---
      let idEstudiante = mat.rows[0].id_estudiante || (data.id_estudiante ? Number(data.id_estudiante) : null);
      let studentCode;

      if (idEstudiante) {
        // Estudiante existente
        const estRes = await client.query(
          `SELECT id_usuario, codigo FROM estudiante WHERE id_estudiante = $1`,
          [idEstudiante]
        );
        if (estRes.rows.length === 0) throw new Error('Estudiante pre-asociado no encontrado');
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

      // --- CREACIÓN DEL PADRE DE FAMILIA ---
      let idUsuarioPadre;
      
      // PRIORIDAD 1: El frontend ya detectó un usuario existente (docente/directivo)
      if (data.existing_parent_user_id) {
          idUsuarioPadre = data.existing_parent_user_id;
          console.log('Using pre-detected existing user (staff parent):', idUsuarioPadre);
      } else {
          // PRIORIDAD 2: Buscar por documento en la tabla docente
          const existingDocente = await client.query(
              'SELECT id_usuario FROM docente WHERE documento = $1',
              [data.parent.documento]
          );

          if (existingDocente.rows.length > 0) {
              idUsuarioPadre = existingDocente.rows[0].id_usuario;
              console.log('Match found by document (Docente):', idUsuarioPadre);
          } else {
              // PRIORIDAD 3: Buscar por email
              const existingParentUser = await client.query('SELECT id_usuario FROM usuario WHERE email = $1', [correo_padre]);
              if (existingParentUser.rows.length > 0) {
                  idUsuarioPadre = existingParentUser.rows[0].id_usuario;
                  console.log('Match found by email:', idUsuarioPadre);
              } else {
                  // NUEVA CUENTA: No existe, crear usuario padre
                  const hashedPadrePass = await bcrypt.hash('padre123', 10);
                  const parentUserRes = await client.query(
                     `INSERT INTO usuario (email, password, nombre, apellido, id_colegio) VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario`,
                     [correo_padre, hashedPadrePass, data.parent.nombre, data.parent.apellido, id_colegio]
                  );
                  idUsuarioPadre = parentUserRes.rows[0].id_usuario;
              }
          }
      }

      // Asegurar que el usuario tenga el ROL PADRE (Importante: ahora aplica a todos: nuevos y existentes)
      const rolPadre = await client.query("SELECT id_rol FROM rol WHERE nombre = 'padre'");
      if(rolPadre.rows.length > 0) {
          await client.query(
              `INSERT INTO usuario_rol (id_usuario, id_rol) 
               VALUES ($1, $2) 
               ON CONFLICT (id_usuario, id_rol) DO NOTHING`, 
               [idUsuarioPadre, rolPadre.rows[0].id_rol]
          );
      }

      // Registro Padre
      const existingParent = await client.query('SELECT id_padrefamilia FROM padre_familia WHERE documeno = $1', [data.parent.documento]);
      let idPadre;
      if (existingParent.rows.length > 0) {
         idPadre = existingParent.rows[0].id_padrefamilia;
         // Actualizar si es necesario
         await client.query(
            `UPDATE padre_familia SET nombre = $1, apellido = $2, id_tipodocumento = $3 WHERE id_padrefamilia = $4`,
            [data.parent.nombre, data.parent.apellido, data.parent.id_tipodocumento, idPadre]
         );
      } else {
         const parentRes = await client.query(
            `INSERT INTO padre_familia (nombre, apellido, documeno, id_tipodocumento, id_colegio, id_usuario)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_padrefamilia`,
            [data.parent.nombre, data.parent.apellido, data.parent.documento, data.parent.id_tipodocumento, id_colegio, idUsuarioPadre]
         );
         idPadre = parentRes.rows[0].id_padrefamilia;
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

      // 4. Actualizar Matrícula
      const finalEstado = mat.rows[0].es_traslado ? 'TRASLADADA' : 'ACTIVA';
      await client.query(
        "UPDATE matricula SET id_estudiante = $1, id_grupo = $3, estado = $4, fecha_aprobacion = NOW() WHERE id_matricula = $2",
        [idEstudiante, idMatricula, finalGradeId, finalEstado]
      );

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

  static async cancelEnrollment(idMatricula: number, data: { motivo: string, detalles: string }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const matRes = await client.query('SELECT correo_padre, estado FROM matricula WHERE id_matricula = $1', [idMatricula]);
      if (matRes.rows.length === 0) throw new Error('Matrícula no encontrada');
      const mat = matRes.rows[0];
      
      if (mat.estado !== 'ACTIVA' && mat.estado !== 'TRASLADADA') {
        throw new Error('Solo se pueden cancelar matrículas que estén aprobadas o trasladadas');
      }

      await client.query(
        `UPDATE matricula 
         SET estado = 'CANCELADA', motivo_cancelacion = $1, detalles_cancelacion = $2
         WHERE id_matricula = $3`,
        [data.motivo, data.detalles, idMatricula]
      );

      await client.query('COMMIT');

      // Notificar al padre
      await NotificationService.sendCancellationEmail(mat.correo_padre, 'Padre de Familia', data.motivo, data.detalles);

      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
