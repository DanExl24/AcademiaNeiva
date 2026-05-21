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

      // 1. Insertar en tabla matricula original (id_estudiante es NULL)
      const matRes = await client.query(
        `INSERT INTO matricula 
           (id_estudiante, id_nivel, id_grupo, id_colegio, "id_año", estado, correo_padre, tiene_discapacidad, es_extranjero)
         VALUES (NULL, NULL, $1, $2, 1, 'PENDIENTE', $3, $4, $5)
         RETURNING id_matricula`,
        [data.grade, id_colegio, parentEmail, hasDisability === 'true', isForeigner === 'true']
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
              (g.cupos_totales - (SELECT COUNT(*) FROM matricula WHERE id_grupo = g.id_grupo AND estado IN ('ACTIVA', 'TRASLADADA'))) as cupos_restantes
       FROM matricula m
       JOIN grupos g ON m.id_grupo = g.id_grupo
       LEFT JOIN nivel_escolar ne ON g.id_nivel = ne.id_nivel
       LEFT JOIN tipo_grado tg ON g.id_tipo_grado = tg.id_tipo_grado
       LEFT JOIN secciones s ON g.id_seccion = s.id_seccion
       LEFT JOIN jornada j ON g.id_jornada = j.id_jornada
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

    return {
      ...mat,
      availableSections: sections.rows || [],
      documentos: docs.rows || []
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

      // --- CREACIÓN DEL ESTUDIANTE ---
      const studentCode = 'MAT-' + Date.now();
      
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
        `INSERT INTO estudiante (nombre, apellido, documento, codigo, id_tipodocumento, id_nivel, id_colegio, id_usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id_estudiante`,
        [data.student.nombre, data.student.apellido, data.student.documento, studentCode, data.student.id_tipodocumento, id_nivel, id_colegio, idUsuarioEstudiante]
      );
      const idEstudiante = studentRes.rows[0].id_estudiante;

      // --- CREACIÓN DEL PADRE DE FAMILIA ---
      let idUsuarioPadre;
      const existingParentUser = await client.query('SELECT id_usuario FROM usuario WHERE email = $1', [correo_padre]);
      if (existingParentUser.rows.length > 0) {
          idUsuarioPadre = existingParentUser.rows[0].id_usuario;
      } else {
          // Usuario padre
          const hashedPadrePass = await bcrypt.hash('padre123', 10);
          const parentUserRes = await client.query(
             `INSERT INTO usuario (email, password, nombre, apellido, id_colegio) VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario`,
             [correo_padre, hashedPadrePass, data.parent.nombre, data.parent.apellido, id_colegio]
          );
          idUsuarioPadre = parentUserRes.rows[0].id_usuario;
          
          // Rol padre
          const rolPadre = await client.query("SELECT id_rol FROM rol WHERE nombre = 'padre'");
          if(rolPadre.rows.length > 0) {
              await client.query("INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, $2)", [idUsuarioPadre, rolPadre.rows[0].id_rol]);
          }
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

      // 3. Vincular Estudiante y Padre
      await client.query(
        "INSERT INTO detalle_padrefamilia (id_padrefamilia, id_estudiante, id_colegio) VALUES ($1, $2, $3)",
        [idPadre, idEstudiante, id_colegio]
      );

      // 4. Actualizar Matrícula
      const finalEstado = mat.rows[0].es_traslado ? 'TRASLADADA' : 'ACTIVA';
      await client.query(
        "UPDATE matricula SET id_estudiante = $1, id_grupo = $3, estado = $4 WHERE id_matricula = $2",
        [idEstudiante, idMatricula, finalGradeId, finalEstado]
      );

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
