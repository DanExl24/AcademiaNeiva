"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatriculaService = void 0;
const db_1 = require("../config/db");
const notificationService_1 = require("./notificationService");
const bcrypt_1 = __importDefault(require("bcrypt"));
// Documentos siempre obligatorios
const ALWAYS_REQUIRED = ['documentoPadre', 'salud', 'foto', 'reciboPublico'];
const REQUIRED_FOR_LOWER_LEVELS = ['registroCivil', 'vacunas']; // NO aplica a SE/BA
const REQUIRED_NOT_INFANT = ['documentoIdentidad', 'certificadosEscolaridad']; // NO aplica a PI
class MatriculaService {
    /**
     * MR01 – El padre envía el formulario de matrícula.
     * Solo se persiste la solicitud en la tabla 'matricula' (con id_estudiante = NULL).
     */
    static async createEnrollment(data, files) {
        const { level, hasDisability, isForeigner, parentEmail, id_colegio } = data;
        // --- Validación de documentos ---
        const isHigher = level === 'SECUNDARIA' || level === 'MEDIA';
        const isPre = level === 'PREESCOLAR';
        const required = [...ALWAYS_REQUIRED];
        if (!isHigher)
            required.push(...REQUIRED_FOR_LOWER_LEVELS);
        if (!isPre)
            required.push(...REQUIRED_NOT_INFANT);
        if (isForeigner === 'true')
            required.push('visa');
        if (hasDisability === 'true')
            required.push('certificadoDiscapacidad');
        for (const doc of required) {
            if (!files[doc] || files[doc].length === 0) {
                throw new Error(`Documento requerido faltante: ${doc}`);
            }
        }
        const client = await db_1.pool.connect();
        try {
            await client.query('BEGIN');
            // 1. Insertar en tabla matricula original (id_estudiante es NULL)
            const matRes = await client.query(`INSERT INTO matricula 
           (id_estudiante, id_nivel, id_grado, id_colegio, "id_año", estado, correo_padre, tiene_discapacidad, es_extranjero)
         VALUES (NULL, NULL, $1, $2, 1, 'PENDIENTE', $3, $4, $5)
         RETURNING id_matricula`, [data.grade, id_colegio, parentEmail, hasDisability === 'true', isForeigner === 'true']);
            const idMatricula = matRes.rows[0].id_matricula;
            // 2. Guardar documentos en tabla documento_matriculas
            for (const [key, fileArray] of Object.entries(files)) {
                const file = fileArray[0];
                await client.query(`INSERT INTO documento_matriculas (id_matricula, tipo_documento, url, estado, fecha, id_colegio)
           VALUES ($1, $2, $3, 'PENDIENTE', NOW(), $4)`, [idMatricula, key, file.filename, id_colegio]);
            }
            await client.query('COMMIT');
            return { idMatricula };
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
    /** MR02 – Ver matrículas filtradas por estado */
    static async getFiltered(idColegio, estado) {
        let query = `
      SELECT m.*, 
             (SELECT COUNT(*) FROM documento_matriculas WHERE id_matricula = m.id_matricula AND estado = 'PENDIENTE') > 0 as has_pending_docs
      FROM matricula m
      WHERE m.id_colegio = $1
    `;
        const params = [idColegio];
        if (estado !== 'ALL') {
            query += ` AND m.estado = $2`;
            params.push(estado);
        }
        query += ` ORDER BY m.id_matricula DESC`;
        const res = await db_1.pool.query(query, params);
        return res.rows;
    }
    /** MR02 – Ver todas las matrículas pendientes */
    static async getAllPending(idColegio) {
        const res = await db_1.pool.query(`SELECT * FROM matricula
       WHERE id_colegio = $1 AND estado = 'PENDIENTE'
       ORDER BY id_matricula DESC`, [idColegio]);
        return res.rows;
    }
    /** MR02 – Detalles de una matrícula */
    static async getDetails(idMatricula) {
        const matRes = await db_1.pool.query(`SELECT m.*, g.nivel as grado_nivel, g.tipo_grado, g.seccion, g.id_jornada, j.nombre as jornada,
              (g.cupos_totales - (SELECT COUNT(*) FROM matricula WHERE id_grado = g.id_grado AND estado = 'ACTIVA')) as cupos_restantes
       FROM matricula m
       JOIN grados g ON m.id_grado = g.id_grado
       LEFT JOIN jornada j ON g.id_jornada = j.id_jornada
       WHERE m.id_matricula = $1`, [idMatricula]);
        if (matRes.rows.length === 0)
            throw new Error('Matrícula no encontrada');
        const mat = matRes.rows[0];
        console.log('Searching sections for:', {
            id_colegio: mat.id_colegio,
            nivel: mat.grado_nivel,
            tipo_grado: mat.tipo_grado,
            id_jornada: mat.id_jornada
        });
        // Buscar otras secciones del mismo grado/jornada/colegio
        const sections = await db_1.pool.query(`SELECT id_grado, seccion, 
              (cupos_totales - (SELECT COUNT(*) FROM matricula WHERE id_grado = g.id_grado AND estado = 'ACTIVA')) as cupos_restantes
       FROM grados g
       WHERE id_colegio = $1 AND nivel = $2 AND tipo_grado = $3 AND id_jornada = $4`, [mat.id_colegio, mat.grado_nivel, mat.tipo_grado, mat.id_jornada]);
        console.log('Found sections count:', sections.rows.length);
        const docs = await db_1.pool.query(`SELECT * FROM documento_matriculas WHERE id_matricula = $1`, [idMatricula]);
        return {
            ...mat,
            availableSections: sections.rows || [],
            documentos: docs.rows || []
        };
    }
    static async assignGrade(idMatricula, idGrado) {
        // Solo para guardar el "borrador" si fuera necesario, 
        // pero el usuario dice que no se agregue instantáneamente.
        // Sin embargo, para que el sistema lo recuerde si refresca, 
        // lo guardaremos pero sin activar la matrícula.
        await db_1.pool.query(`UPDATE matricula SET id_grado = $1 WHERE id_matricula = $2`, [idGrado, idMatricula]);
        return { success: true };
    }
    /** MR02 – Actualizar estado de un documento */
    static async updateDocumentStatus(idDocumento, estado) {
        const res = await db_1.pool.query(`UPDATE documento_matriculas SET estado = $1 WHERE id_documento = $2 RETURNING *`, [estado, idDocumento]);
        return res.rows[0];
    }
    /** MR02 – Notificar al padre sobre documentos rechazados */
    static async notifyInconsistencies(idMatricula) {
        const details = await this.getDetails(idMatricula);
        const rejectedDocs = details.documentos.filter((d) => d.estado === 'RECHAZADO');
        if (rejectedDocs.length === 0)
            return { success: false, message: 'No hay documentos rechazados para notificar' };
        const reason = `Los siguientes documentos presentan inconsistencias: ${rejectedDocs.map((d) => d.tipo_documento).join(', ')}. Por favor revísalos y vuelve a subirlos.`;
        await db_1.pool.query("UPDATE matricula SET estado = 'PENDIENTE' WHERE id_matricula = $1", [idMatricula]);
        await notificationService_1.NotificationService.sendRejectionEmail(details.correo_padre, 'Padre de Familia', reason, details.token_seguimiento);
        return { success: true };
    }
    /** MR03 – Obtener detalles por token (Seguro para el padre) */
    static async getByToken(token) {
        const mat = await db_1.pool.query(`SELECT m.*, g.nivel as grado_nivel, g.tipo_grado, j.nombre as jornada
       FROM matricula m
       JOIN grados g ON m.id_grado = g.id_grado
       LEFT JOIN jornada j ON g.id_jornada = j.id_jornada
       WHERE m.token_seguimiento = $1`, [token]);
        if (mat.rows.length === 0)
            throw new Error('Solicitud no encontrada');
        const docs = await db_1.pool.query(`SELECT * FROM documento_matriculas WHERE id_matricula = $1`, [mat.rows[0].id_matricula]);
        return {
            ...mat.rows[0],
            documentos: docs.rows
        };
    }
    /** MR03 – El padre corrige los documentos */
    static async updateDocumentsByToken(token, files) {
        // Buscar el ID a partir del token primero
        const res = await db_1.pool.query('SELECT id_matricula FROM matricula WHERE token_seguimiento = $1', [token]);
        if (res.rows.length === 0)
            throw new Error('Token inválido');
        const idMatricula = res.rows[0].id_matricula;
        return this.updateDocuments(idMatricula, files);
    }
    /** MR03 – El padre corrige los documentos */
    static async updateDocuments(idMatricula, files) {
        const client = await db_1.pool.connect();
        try {
            await client.query('BEGIN');
            for (const [key, fileArray] of Object.entries(files)) {
                const file = fileArray[0];
                // Actualizar el documento existente y resetear estado a PENDIENTE
                await client.query(`UPDATE documento_matriculas 
           SET url = $1, estado = 'PENDIENTE', fecha = NOW()
           WHERE id_matricula = $2 AND tipo_documento = $3`, [file.filename, idMatricula, key]);
            }
            await client.query("UPDATE matricula SET estado = 'PENDIENTE' WHERE id_matricula = $1", [idMatricula]);
            await client.query('COMMIT');
            return { success: true };
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
    /** MR04 – Finalizar registro: crea estudiante y padre, actualiza matricula */
    static async finalizeEnrollment(idMatricula, data) {
        const client = await db_1.pool.connect();
        try {
            await client.query('BEGIN');
            const mat = await client.query('SELECT * FROM matricula WHERE id_matricula = $1', [idMatricula]);
            if (mat.rows.length === 0)
                throw new Error('Matrícula no encontrada');
            // Si se envió un id_grado diferente en el registro final, lo actualizamos
            const finalGradeId = data.id_grado || mat.rows[0].id_grado;
            const { id_colegio, correo_padre } = mat.rows[0];
            // 1. Crear o usar Usuario Padre existente
            let idUsuarioPadre;
            const existingUser = await client.query('SELECT id_usuario FROM usuario WHERE correo = $1', [correo_padre]);
            if (existingUser.rows.length > 0) {
                idUsuarioPadre = existingUser.rows[0].id_usuario;
            }
            else {
                const hashedPassPadre = await bcrypt_1.default.hash('padre123', 10);
                const userRes = await client.query(`INSERT INTO usuario (correo, password, id_colegio) VALUES ($1, $2, $3) RETURNING id_usuario`, [correo_padre, hashedPassPadre, id_colegio]);
                idUsuarioPadre = userRes.rows[0].id_usuario;
                await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, 3)`, // 3 = PADRE_FAMILIA
                [idUsuarioPadre]);
            }
            // Buscar si ya existe el padre en padre_familia
            const existingParent = await client.query('SELECT id_padrefamilia FROM padre_familia WHERE id_usuario = $1', [idUsuarioPadre]);
            let idPadre;
            if (existingParent.rows.length > 0) {
                idPadre = existingParent.rows[0].id_padrefamilia;
                // Opcional: Actualizar datos del padre si vienen nuevos
                await client.query(`UPDATE padre_familia SET nombre = $1, apellido = $2, documeno = $3, id_tipodocumento = $4 
           WHERE id_padrefamilia = $5`, [data.parent.nombre, data.parent.apellido, data.parent.documento, data.parent.id_tipodocumento, idPadre]);
            }
            else {
                const parentRes = await client.query(`INSERT INTO padre_familia (nombre, apellido, documeno, id_tipodocumento, id_colegio, id_usuario)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id_padrefamilia`, [data.parent.nombre, data.parent.apellido, data.parent.documento, data.parent.id_tipodocumento, id_colegio, idUsuarioPadre]);
                idPadre = parentRes.rows[0].id_padrefamilia;
            }
            // 2. Crear Usuario Estudiante y Estudiante
            const correoEstudiante = `${data.student.documento || Date.now()}@estudiante.edu.co`;
            const hashedPassEstudiante = await bcrypt_1.default.hash('estudiante123', 10);
            const studentUserRes = await client.query(`INSERT INTO usuario (correo, password, id_colegio) VALUES ($1, $2, $3) RETURNING id_usuario`, [correoEstudiante, hashedPassEstudiante, id_colegio]);
            const idUsuarioEstudiante = studentUserRes.rows[0].id_usuario;
            await client.query(`INSERT INTO usuario_rol (id_usuario, id_rol) VALUES ($1, 4)`, // 4 = ESTUDIANTE
            [idUsuarioEstudiante]);
            // Generar código estudiantil solicitado: ACM-{documento}-{patron_coherente}
            const randomPattern = Math.floor(1000 + Math.random() * 9000); // 4 dígitos coherentes
            const studentCode = `ACM-${data.student.documento}-${randomPattern}`;
            const studentRes = await client.query(`INSERT INTO estudiante (nombre, apellido, documento, codigo, id_tipodocumento, id_grado, id_colegio, id_usuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id_estudiante`, [data.student.nombre, data.student.apellido, data.student.documento, studentCode, data.student.id_tipodocumento, finalGradeId, id_colegio, idUsuarioEstudiante]);
            const idEstudiante = studentRes.rows[0].id_estudiante;
            // 3. Vincular
            await client.query("INSERT INTO detalle_padrefamilia (id_padrefamilia, id_estudiante, id_colegio) VALUES ($1, $2, $3)", [idPadre, idEstudiante, id_colegio]);
            // 4. Actualizar Matrícula
            await client.query("UPDATE matricula SET id_estudiante = $1, id_grado = $3, estado = 'ACTIVA' WHERE id_matricula = $2", [idEstudiante, idMatricula, finalGradeId]);
            await client.query('COMMIT');
            // 5. Notificar al padre (ahora incluye el código estudiantil)
            notificationService_1.NotificationService.sendApprovalEmail(correo_padre, data.parent.nombre, `${data.student.nombre} ${data.student.apellido}`, studentCode);
            return { success: true, idEstudiante, idPadre, studentCode };
        }
        catch (e) {
            await client.query('ROLLBACK');
            throw e;
        }
        finally {
            client.release();
        }
    }
}
exports.MatriculaService = MatriculaService;
