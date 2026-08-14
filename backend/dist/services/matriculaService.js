"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatriculaService = void 0;
const kysely_1 = require("../config/kysely");
const kysely_2 = require("kysely");
const notificationService_1 = require("./notificationService");
const emailVerificationService_1 = require("./emailVerificationService");
const bcrypt_1 = __importDefault(require("bcrypt"));
const documentValidation_1 = require("../utils/documentValidation");
const emailResolver_1 = require("../utils/emailResolver");
const documentSecurity_1 = require("../middleware/documentSecurity");
// Documentos siempre obligatorios
const ALWAYS_REQUIRED = ['documentoPadre', 'salud', 'foto', 'reciboPublico'];
const REQUIRED_FOR_LOWER_LEVELS = ['registroCivil', 'vacunas']; // NO aplica a SE/BA
const REQUIRED_NOT_INFANT = ['documentoIdentidad', 'certificadosEscolaridad']; // NO aplica a PI
class MatriculaService {
    /**
     * Genera y envía un código OTP de 6 dígitos para validar la existencia del correo electrónico.
     */
    static async sendEnrollmentEmailCode(email) {
        return await emailVerificationService_1.EmailVerificationService.sendCode({
            email,
            tipo: 'MATRICULA_NUEVA'
        });
    }
    /**
     * Verifica el código OTP de 6 dígitos ingresado por el usuario.
     */
    static async verifyEnrollmentEmailCode(email, code) {
        return await emailVerificationService_1.EmailVerificationService.verifyCode({
            email,
            codigo: code,
            tipo: 'MATRICULA_NUEVA'
        });
    }
    /**
     * MR01 – El padre envía el formulario de matrícula.
     * Solo se persiste la solicitud en la tabla 'matricula' (con id_estudiante = NULL).
     */
    static async createEnrollment(data, files) {
        const { level, hasDisability, isForeigner, parentEmail, id_colegio } = data;
        if (!parentEmail || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(parentEmail).trim())) {
            throw new Error("El correo electrónico del acudiente no es válido.");
        }
        const cleanEmail = String(parentEmail).trim().toLowerCase();
        // Validar que el correo electrónico fue verificado previamente mediante OTP de 6 dígitos
        const isEmailVerified = await emailVerificationService_1.EmailVerificationService.isVerified({
            email: cleanEmail,
            tipo: 'MATRICULA_NUEVA',
            maxAgeHours: 2
        });
        if (!isEmailVerified) {
            throw new Error("Debes verificar la existencia de tu correo electrónico con el código de 6 dígitos antes de enviar el formulario de matrícula.");
        }
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
        return await kysely_1.db.transaction().execute(async (trx) => {
            let idMatricula = 0;
            let tokenSeguimiento = '';
            let isExtraordinary = false;
            if (data.token) {
                const extraRes = await trx
                    .selectFrom("matricula")
                    .select(["id_matricula", "token_seguimiento", "id_colegio", "id_anio", "tipo"])
                    .where("token_seguimiento", "=", data.token)
                    .where("tipo", "=", "EXTRAORDINARIA")
                    .executeTakeFirst();
                if (extraRes) {
                    isExtraordinary = true;
                    idMatricula = extraRes.id_matricula;
                    tokenSeguimiento = extraRes.token_seguimiento || "";
                }
            }
            if (!isExtraordinary) {
                // Fetch active year for the school
                const yearRes = await trx
                    .selectFrom("anio_lectivo")
                    .select("id_anio")
                    .where("id_colegio", "=", Number(id_colegio))
                    .where("estado", "=", "ABIERTO")
                    .orderBy("id_anio", "desc")
                    .executeTakeFirst();
                if (!yearRes) {
                    throw new Error("El colegio seleccionado no tiene un año lectivo activo abierto.");
                }
                const activeYearId = yearRes.id_anio;
                // Validate enrollment configuration dates and state
                const configRes = await trx
                    .selectFrom("configuracion_inscripcion")
                    .select(["fecha_inicio", "fecha_cierre", "habilitada"])
                    .where("id_colegio", "=", Number(id_colegio))
                    .where("id_anio", "=", activeYearId)
                    .executeTakeFirst();
                if (!configRes) {
                    throw new Error("Las inscripciones para esta institución aún no están configuradas.");
                }
                if (!configRes.habilitada) {
                    throw new Error("Las inscripciones están deshabilitadas temporalmente por la institución.");
                }
                const now = new Date();
                const start = new Date(configRes.fecha_inicio);
                const end = new Date(configRes.fecha_cierre);
                if (now < start) {
                    throw new Error(`Las inscripciones aún no han comenzado. Abren el ${start.toLocaleDateString('es-CO')}.`);
                }
                if (now > end) {
                    throw new Error(`Las inscripciones ya cerraron. Finalizaron el ${end.toLocaleDateString('es-CO')}.`);
                }
                // Insertar nueva matrícula regular
                const matRes = await trx
                    .insertInto("matricula")
                    .values({
                    id_estudiante: null,
                    id_nivel: null,
                    id_grupo: Number(data.grade),
                    id_colegio: Number(id_colegio),
                    id_anio: activeYearId,
                    estado: 'PENDIENTE',
                    correo_padre: parentEmail,
                    tiene_discapacidad: hasDisability === 'true',
                    es_extranjero: isForeigner === 'true'
                })
                    .returning(["id_matricula", "token_seguimiento"])
                    .executeTakeFirstOrThrow();
                idMatricula = matRes.id_matricula;
                tokenSeguimiento = matRes.token_seguimiento || "";
            }
            else {
                // Actualizar la matrícula extraordinaria pre-creada con el grupo y datos del formulario
                await trx
                    .updateTable("matricula")
                    .set({
                    id_grupo: Number(data.grade),
                    tiene_discapacidad: hasDisability === 'true' || hasDisability === true,
                    es_extranjero: isForeigner === 'true' || isForeigner === true,
                    estado: 'PENDIENTE'
                })
                    .where("id_matricula", "=", idMatricula)
                    .execute();
            }
            // 2. Guardar documentos en tabla documento_matriculas
            for (const [key, fileArray] of Object.entries(files)) {
                const file = fileArray[0];
                const filename = file.originalname || file.filename || `${key}.pdf`;
                await trx
                    .insertInto("documento_matriculas")
                    .values({
                    id_matricula: idMatricula,
                    tipo_documento: key,
                    url: filename,
                    estado: 'PENDIENTE',
                    fecha: new Date(),
                    id_colegio: Number(id_colegio),
                    contenido: file.buffer || null,
                    mime_type: file.mimetype || null,
                    nombre_original: file.originalname || filename,
                    tamano_bytes: file.size || null
                })
                    .execute();
            }
            // Enviar correo de confirmación de forma asíncrona
            if (parentEmail) {
                notificationService_1.NotificationService.sendEnrollmentSubmittedEmail(parentEmail, 'Padre de Familia', 'Aspirante', tokenSeguimiento).catch(err => {
                    console.error('Error enviando correo de confirmación de matrícula:', err);
                });
            }
            return { idMatricula, token_seguimiento: tokenSeguimiento };
        });
    }
    /** MR02 – Ver matrículas filtradas por estado y año lectivo (Kysely Type-Safe Query) */
    static async getFiltered(idColegio, estado, yearId) {
        let query = kysely_1.db
            .selectFrom('matricula as m')
            .leftJoin('estudiante as e', 'm.id_estudiante', 'e.id_estudiante')
            .leftJoin('usuario as u', 'e.id_usuario', 'u.id_usuario')
            .leftJoin('nivel_escolar as n', 'm.id_nivel', 'n.id_nivel')
            .leftJoin('grupos as g', 'm.id_grupo', 'g.id_grupo')
            .leftJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
            .leftJoin('secciones as s', 'g.id_seccion', 's.id_seccion')
            .leftJoin('solicitud_traslado as st', (join) => join.on((eb) => eb.or([
            eb('st.id_matricula', '=', eb.ref('m.id_matricula')),
            eb.and([
                eb('st.id_usuario', '=', eb.ref('e.id_usuario')),
                eb('st.tipo', '=', eb.val('TRASLADO_MATRICULA'))
            ])
        ])))
            .leftJoin('colegio as co_orig', 'co_orig.id_colegio', 'st.id_colegio_origen')
            .leftJoin('colegio as co_dest', 'co_dest.id_colegio', 'st.id_colegio_destino')
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
            'u.documento as student_documento',
            'e.motivo_estado as student_motivo_estado',
            'n.nombre as nivel_nombre',
            'st.id_solicitud as id_solicitud_traslado',
            'st.id_colegio_origen',
            'st.id_colegio_destino',
            'co_orig.nombre as colegio_origen_nombre',
            'co_dest.nombre as colegio_destino_nombre',
            (0, kysely_2.sql) `CASE 
          WHEN m.id_colegio = st.id_colegio_destino THEN 'ENTRANTE'
          WHEN m.id_colegio = st.id_colegio_origen THEN 'SALIENTE'
          WHEN m.es_traslado IS TRUE OR m.tipo = 'TRASLADO' THEN 'ENTRANTE'
          ELSE NULL
        END`.as('sentido_traslado'),
            (0, kysely_2.sql) `CONCAT(tg.nombre, ' - ', s.nombre)`.as('grado_nombre'),
            (0, kysely_2.sql) `(SELECT COUNT(*) FROM documento_matriculas WHERE id_matricula = m.id_matricula AND estado = 'PENDIENTE') > 0`.as('has_pending_docs')
        ])
            .where('m.id_colegio', '=', idColegio);
        if (yearId) {
            query = query.where('m.id_anio', '=', yearId);
        }
        if (estado === 'TRASLADADA') {
            query = query.where((eb) => eb.or([
                eb('m.estado', '=', 'TRASLADADA'),
                eb('m.tipo', '=', 'TRASLADO'),
                eb('m.es_traslado', '=', true)
            ]));
        }
        else if (estado !== 'ALL') {
            query = query.where('m.estado', '=', estado);
        }
        return await query.orderBy('m.id_matricula', 'desc').execute();
    }
    /** MR02 – Ver todas las matrículas pendientes por año lectivo */
    static async getAllPending(idColegio, yearId) {
        let query = kysely_1.db
            .selectFrom('matricula')
            .selectAll()
            .where('id_colegio', '=', idColegio)
            .where('estado', '=', 'PENDIENTE');
        if (yearId) {
            query = query.where('id_anio', '=', yearId);
        }
        return await query.orderBy('id_matricula', 'desc').execute();
    }
    /** MR02 – Detalles de una matrícula */
    static async getDetails(idMatricula) {
        const mat = await kysely_1.db
            .selectFrom('matricula as m')
            .innerJoin('grupos as g', 'm.id_grupo', 'g.id_grupo')
            .leftJoin('colegio as col', 'col.id_colegio', 'm.id_colegio')
            .leftJoin('nivel_escolar as ne', 'g.id_nivel', 'ne.id_nivel')
            .leftJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
            .leftJoin('secciones as s', 'g.id_seccion', 's.id_seccion')
            .leftJoin('jornada as j', 'g.id_jornada', 'j.id_jornada')
            .leftJoin('estudiante as e', 'e.id_estudiante', 'm.id_estudiante')
            .leftJoin('usuario as u_est', 'e.id_usuario', 'u_est.id_usuario')
            .leftJoin((eb) => eb
            .selectFrom('detalle_padrefamilia')
            .select(['id_estudiante', 'id_padrefamilia'])
            .distinctOn('id_estudiante')
            .as('dp'), (join) => join.onRef('dp.id_estudiante', '=', 'm.id_estudiante'))
            .leftJoin('padre_familia as pf', 'pf.id_padrefamilia', 'dp.id_padrefamilia')
            .leftJoin('usuario as u_par', 'pf.id_usuario', 'u_par.id_usuario')
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
            'm.tiene_discapacidad',
            'm.es_extranjero',
            'm.motivo_cancelacion',
            'm.detalles_cancelacion',
            'm.fecha_creacion',
            'm.fecha_aprobacion',
            'm.es_traslado',
            'm.id_ticket',
            'ne.nombre as grado_nivel',
            'tg.nombre as tipo_grado',
            's.nombre as seccion',
            'g.id_jornada',
            'j.nombre as jornada',
            'e.nombre as student_firstname',
            'e.apellido as student_lastname',
            'e.codigo as student_code',
            'u_est.documento as student_document',
            'u_est.id_tipodocumento as student_id_tipodocumento',
            'e.motivo_estado as student_motivo_estado',
            'pf.nombre as parent_firstname',
            'pf.apellido as parent_lastname',
            'u_par.documento as parent_document',
            'u_par.id_tipodocumento as parent_id_tipodocumento',
            'col.escudo_url',
            'col.nombre as school_name',
            (0, kysely_2.sql) `(g.cupos_totales - (SELECT COUNT(*) FROM matricula WHERE id_grupo = g.id_grupo AND estado IN ('ACTIVA', 'TRASLADADA')))::int`.as('cupos_restantes')
        ])
            .where('m.id_matricula', '=', idMatricula)
            .executeTakeFirst();
        if (!mat)
            throw new Error('Matrícula no encontrada');
        // Buscar otras secciones del mismo grado/jornada/colegio
        const sections = await kysely_1.db
            .selectFrom('grupos as g')
            .innerJoin('secciones as s', 'g.id_seccion', 's.id_seccion')
            .innerJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
            .innerJoin('nivel_escolar as ne', 'g.id_nivel', 'ne.id_nivel')
            .select([
            'g.id_grupo as id_grado',
            's.nombre as seccion',
            (0, kysely_2.sql) `(g.cupos_totales - (SELECT COUNT(*) FROM matricula WHERE id_grupo = g.id_grupo AND estado IN ('ACTIVA', 'TRASLADADA')))::int`.as('cupos_restantes')
        ])
            .where('g.id_colegio', '=', mat.id_colegio)
            .where('ne.nombre', '=', mat.grado_nivel || '')
            .where('tg.nombre', '=', mat.tipo_grado || '')
            .where('g.id_jornada', '=', mat.id_jornada || 0)
            .execute();
        const rawDocs = await kysely_1.db
            .selectFrom('documento_matriculas as d')
            .leftJoin('matricula as m', 'd.id_matricula', 'm.id_matricula')
            .select([
            'd.id_documento',
            'd.id_matricula',
            'd.id_colegio',
            'd.tipo_documento',
            'd.url',
            'd.estado',
            'd.fecha',
            'd.version',
            'd.fecha_expedicion',
            'd.estado_renovacion',
            'd.mime_type',
            'd.nombre_original',
            'd.tamano_bytes',
            (0, kysely_2.sql) `(
          SELECT prev.url FROM documento_matriculas prev 
          JOIN matricula prev_m ON prev.id_matricula = prev_m.id_matricula
          WHERE m.id_estudiante IS NOT NULL 
            AND prev_m.id_estudiante = m.id_estudiante 
            AND LOWER(REPLACE(prev.tipo_documento, ' ', '')) = LOWER(REPLACE(d.tipo_documento, ' ', ''))
            AND prev.id_matricula != d.id_matricula
          ORDER BY prev.version DESC, prev.id_documento DESC LIMIT 1
        )`.as('url_anterior'),
            (0, kysely_2.sql) `(
          SELECT prev.version FROM documento_matriculas prev 
          JOIN matricula prev_m ON prev.id_matricula = prev_m.id_matricula
          WHERE m.id_estudiante IS NOT NULL 
            AND prev_m.id_estudiante = m.id_estudiante 
            AND LOWER(REPLACE(prev.tipo_documento, ' ', '')) = LOWER(REPLACE(d.tipo_documento, ' ', ''))
            AND prev.id_matricula != d.id_matricula
          ORDER BY prev.version DESC, prev.id_documento DESC LIMIT 1
        )`.as('version_anterior')
        ])
            .where('d.id_matricula', '=', idMatricula)
            .orderBy('d.tipo_documento', 'asc')
            .orderBy('d.version', 'desc')
            .orderBy('d.id_documento', 'desc')
            .execute();
        // Agrupar documentos por tipo_documento: la versión superior es la activa, las anteriores van a versiones_anteriores
        const docsGroupedMap = new Map();
        for (const docRow of rawDocs) {
            const docWithToken = {
                ...docRow,
                token_acceso: (0, documentSecurity_1.generateDocumentAccessToken)(docRow.id_documento)
            };
            const key = docRow.tipo_documento;
            if (!docsGroupedMap.has(key)) {
                docsGroupedMap.set(key, {
                    ...docWithToken,
                    versiones_anteriores: []
                });
            }
            else {
                const parentDoc = docsGroupedMap.get(key);
                parentDoc.versiones_anteriores.push(docWithToken);
            }
        }
        const docsWithHistory = Array.from(docsGroupedMap.values());
        // Detectar si el correo del padre ya corresponde a un usuario existente (docente/directivo)
        let existingParentUser = null;
        if (mat.correo_padre) {
            const existingUserRes = await kysely_1.db
                .selectFrom('usuario as u')
                .innerJoin('usuario_rol as ur', 'u.id_usuario', 'ur.id_usuario')
                .innerJoin('rol as r', 'ur.id_rol', 'r.id_rol')
                .select([
                'u.id_usuario',
                'u.nombre',
                'u.apellido',
                'u.email',
                (0, kysely_2.sql) `array_agg(r.nombre ORDER BY r.nombre)`.as('roles')
            ])
                .where('u.email', '=', mat.correo_padre)
                .groupBy(['u.id_usuario', 'u.nombre', 'u.apellido', 'u.email'])
                .executeTakeFirst();
            if (existingUserRes) {
                const eu = existingUserRes;
                const roles = eu.roles || [];
                const isStaff = roles.includes('docente') || roles.includes('directivo') || roles.includes('admin');
                if (isStaff) {
                    let displayRole = 'docente';
                    if (roles.includes('directivo'))
                        displayRole = 'directivo';
                    else if (roles.includes('admin'))
                        displayRole = 'admin';
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
        let renovacion = {
            is_renovacion: false,
            parent_name: null,
            candidates: [],
            student: null,
            error_message: null
        };
        if ((mat.estado === 'PENDIENTE' || mat.estado === 'CORREGIDA' || mat.estado === 'CORRECCION' || mat.estado === 'RECHAZADA') && !mat.id_estudiante && mat.correo_padre) {
            const parentUserRes = await kysely_1.db
                .selectFrom('usuario as u')
                .innerJoin('usuario_rol as ur', 'u.id_usuario', 'ur.id_usuario')
                .innerJoin('rol as r', 'ur.id_rol', 'r.id_rol')
                .select(['u.id_usuario', 'u.nombre', 'u.apellido'])
                .where('u.email', '=', mat.correo_padre)
                .where('r.nombre', '=', 'padre')
                .limit(1)
                .executeTakeFirst();
            if (parentUserRes) {
                const idUsuarioPadre = parentUserRes.id_usuario;
                const parentFullName = `${parentUserRes.nombre} ${parentUserRes.apellido}`.trim();
                const parentRes = await kysely_1.db
                    .selectFrom('padre_familia')
                    .select('id_padrefamilia')
                    .where('id_usuario', '=', idUsuarioPadre)
                    .limit(1)
                    .executeTakeFirst();
                if (parentRes) {
                    const idPadre = parentRes.id_padrefamilia;
                    const childrenRes = await kysely_1.db
                        .selectFrom('estudiante as e')
                        .innerJoin('detalle_padrefamilia as dp', 'e.id_estudiante', 'dp.id_estudiante')
                        .leftJoin('usuario as u', 'e.id_usuario', 'u.id_usuario')
                        .leftJoin('matricula as m', (join) => join.onRef('m.id_estudiante', '=', 'e.id_estudiante')
                        .onRef('m.id_colegio', '=', 'e.id_colegio')
                        .on('m.estado', 'in', ['ACTIVA', 'TRASLADADA']))
                        .leftJoin('grupos as g', 'm.id_grupo', 'g.id_grupo')
                        .leftJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
                        .leftJoin('nivel_escolar as ne', 'g.id_nivel', 'ne.id_nivel')
                        .select([
                        'e.id_estudiante',
                        'e.nombre',
                        'e.apellido',
                        'u.documento',
                        'u.id_tipodocumento',
                        'e.estado',
                        'e.codigo',
                        'tg.nombre as grado_nombre',
                        'ne.nombre as nivel_nombre',
                        'u.email as student_email'
                    ])
                        .where('dp.id_padrefamilia', '=', idPadre)
                        .where('e.id_colegio', '=', mat.id_colegio)
                        .orderBy('e.apellido', 'asc')
                        .orderBy('e.nombre', 'asc')
                        .execute();
                    if (childrenRes.length > 0) {
                        const currentYearRes = await kysely_1.db
                            .selectFrom('anio_lectivo')
                            .select('calendario')
                            .where('id_anio', '=', mat.id_anio)
                            .limit(1)
                            .executeTakeFirst();
                        if (currentYearRes) {
                            const currentYearStr = currentYearRes.calendario;
                            const prevYearStr = String(Number(currentYearStr) - 1);
                            const prevYearRes = await kysely_1.db
                                .selectFrom('anio_lectivo')
                                .select('id_anio')
                                .where('id_colegio', '=', mat.id_colegio)
                                .where('calendario', '=', prevYearStr)
                                .limit(1)
                                .executeTakeFirst();
                            const prevYearId = prevYearRes ? prevYearRes.id_anio : null;
                            const candidates = [];
                            for (const child of childrenRes) {
                                let prevEnrollmentStatus = null;
                                if (prevYearId) {
                                    const prevEnrollmentRes = await kysely_1.db
                                        .selectFrom('matricula')
                                        .select('estado')
                                        .where('id_estudiante', '=', child.id_estudiante)
                                        .where('id_anio', '=', prevYearId)
                                        .where('estado', 'in', ['ACTIVA', 'TRASLADADA'])
                                        .limit(1)
                                        .executeTakeFirst();
                                    if (prevEnrollmentRes) {
                                        prevEnrollmentStatus = prevEnrollmentRes.estado;
                                    }
                                }
                                let candidateError = null;
                                if (child.estado === 'EXPULSADO') {
                                    candidateError = 'Estudiante en estado EXPULSADO — no puede renovar.';
                                }
                                else if (child.estado === 'GRADUADO') {
                                    candidateError = 'Estudiante graduado — no puede matricularse nuevamente.';
                                }
                                else if (child.estado === 'SANCIONADO') {
                                    candidateError = 'Estudiante sancionado — la sanción debe levantarse antes de renovar.';
                                }
                                else if (prevEnrollmentStatus === 'TRASLADADA') {
                                    candidateError = 'Estudiante en estado de TRASLADO — no puede renovar en la institución de origen.';
                                }
                                const currentEnrollmentRes = await kysely_1.db
                                    .selectFrom('matricula')
                                    .select('id_matricula')
                                    .where('id_estudiante', '=', child.id_estudiante)
                                    .where('id_anio', '=', mat.id_anio)
                                    .where('estado', 'in', ['ACTIVA', 'TRASLADADA'])
                                    .limit(1)
                                    .executeTakeFirst();
                                if (currentEnrollmentRes) {
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
                                // Solo pre-asignar renovacion.student si la matrícula ya tenía explícitamente un id_estudiante asignado (ej: Reingreso / Ticket)
                                if (mat.id_estudiante) {
                                    renovacion.student = candidates.find(c => c.id_estudiante === mat.id_estudiante) || null;
                                }
                                else {
                                    renovacion.student = null;
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
            const expRes = await kysely_1.db
                .selectFrom('sancion as s')
                .innerJoin('tipo_sancion as ts', 's.id_tipo_sancion', 'ts.id_tipo_sancion')
                .innerJoin('directivo as d', 's.id_directivo', 'd.id')
                .innerJoin('usuario as u', 'd.id_usuario', 'u.id_usuario')
                .select([
                's.id_sancion',
                's.motivo',
                's.fecha_inicio',
                's.fecha_fin',
                's.estado',
                's.observaciones',
                'ts.nombre as tipo_nombre',
                'ts.descripcion as tipo_descripcion',
                (0, kysely_2.sql) `u.nombre || ' ' || u.apellido`.as('directivo_nombre')
            ])
                .where('s.id_estudiante', '=', mat.id_estudiante)
                .where('ts.nombre', '=', 'EXPULSION')
                .orderBy('s.id_sancion', 'desc')
                .limit(1)
                .executeTakeFirst();
            if (expRes) {
                expulsionInfo = expRes;
            }
        }
        // Consulta de trazabilidad de traslado de matrícula
        let trasladoInfo = null;
        if (mat.estado === 'TRASLADADA' || mat.es_traslado || mat.tipo === 'TRASLADO') {
            const trasRes = await kysely_1.db
                .selectFrom('solicitud_traslado as st')
                .leftJoin('colegio as co', 'co.id_colegio', 'st.id_colegio_origen')
                .leftJoin('colegio as cd', 'cd.id_colegio', 'st.id_colegio_destino')
                .select([
                'st.id_solicitud',
                'st.estado as estado_traslado',
                'st.tipo as tipo_traslado',
                'st.fecha_creacion',
                'st.fecha_finalizacion',
                'st.motivo',
                'st.id_colegio_origen',
                'st.id_colegio_destino',
                'co.nombre as colegio_origen_nombre',
                'cd.nombre as colegio_destino_nombre'
            ])
                .where((eb) => eb.or([
                eb('st.id_matricula', '=', idMatricula),
                eb.and([
                    eb('st.id_usuario', '=', eb.selectFrom('estudiante').select('id_usuario').where('id_estudiante', '=', mat.id_estudiante || 0)),
                    eb('st.tipo', '=', eb.val('TRASLADO_MATRICULA'))
                ])
            ]))
                .orderBy('st.id_solicitud', 'desc')
                .limit(1)
                .executeTakeFirst();
            if (trasRes) {
                trasladoInfo = trasRes;
            }
        }
        return {
            ...mat,
            availableSections: sections || [],
            documentos: docsWithHistory || [],
            existing_parent_user: existingParentUser,
            renovacion,
            expulsion: expulsionInfo,
            traslado_info: trasladoInfo
        };
    }
    static async assignGrade(idMatricula, idGrado) {
        await kysely_1.db
            .updateTable('matricula')
            .set({ id_grupo: idGrado })
            .where('id_matricula', '=', idMatricula)
            .execute();
        return { success: true };
    }
    /** MR02 – Actualizar estado de un documento */
    static async updateDocumentStatus(idDocumento, estado) {
        const res = await kysely_1.db
            .updateTable('documento_matriculas')
            .set({ estado: estado })
            .where('id_documento', '=', idDocumento)
            .returningAll()
            .executeTakeFirst();
        return res;
    }
    /** MR02 – Notificar al padre sobre documentos rechazados */
    static async notifyInconsistencies(idMatricula) {
        const details = await this.getDetails(idMatricula);
        const rejectedDocs = details.documentos.filter((d) => d.estado === 'RECHAZADO');
        if (rejectedDocs.length === 0)
            return { success: false, message: 'No hay documentos rechazados para notificar' };
        const reason = `Los siguientes documentos presentan inconsistencias: ${rejectedDocs.map((d) => d.tipo_documento).join(', ')}. Por favor revísalos y vuelve a subirlos.`;
        await kysely_1.db
            .updateTable('matricula')
            .set({ estado: 'CORRECCION' })
            .where('id_matricula', '=', idMatricula)
            .execute();
        if (details.correo_padre) {
            await notificationService_1.NotificationService.sendRejectionEmail(details.correo_padre, 'Padre de Familia', reason, details.token_seguimiento);
        }
        return { success: true };
    }
    /** MR03 – Obtener detalles por token (Seguro para el padre) */
    static async getByToken(token) {
        const mat = await kysely_1.db
            .selectFrom('matricula as m')
            .leftJoin('grupos as g', 'm.id_grupo', 'g.id_grupo')
            .leftJoin('nivel_escolar as ne', 'g.id_nivel', 'ne.id_nivel')
            .leftJoin('tipo_grado as tg', 'g.id_tipo_grado', 'tg.id_tipo_grado')
            .leftJoin('jornada as j', 'g.id_jornada', 'j.id_jornada')
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
            'm.tiene_discapacidad',
            'm.es_extranjero',
            'm.motivo_cancelacion',
            'm.detalles_cancelacion',
            'm.fecha_creacion',
            'm.fecha_aprobacion',
            'm.es_traslado',
            'm.id_ticket',
            'ne.nombre as grado_nivel',
            'tg.nombre as tipo_grado',
            'j.nombre as jornada'
        ])
            .where('m.token_seguimiento', '=', token)
            .executeTakeFirst();
        if (!mat)
            throw new Error('Solicitud no encontrada');
        const docs = await kysely_1.db
            .selectFrom('documento_matriculas')
            .select([
            'id_documento',
            'id_matricula',
            'id_colegio',
            'tipo_documento',
            'url',
            'estado',
            'fecha',
            'version',
            'fecha_expedicion',
            'estado_renovacion',
            'mime_type',
            'nombre_original',
            'tamano_bytes'
        ])
            .where('id_matricula', '=', mat.id_matricula)
            .orderBy('id_documento', 'asc')
            .execute();
        const docsWithToken = docs.map(d => ({
            ...d,
            token_acceso: (0, documentSecurity_1.generateDocumentAccessToken)(d.id_documento)
        }));
        return {
            ...mat,
            documentos: docsWithToken
        };
    }
    /** MR03 – El padre corrige los documentos por token */
    static async updateDocumentsByToken(token, files) {
        const res = await kysely_1.db
            .selectFrom('matricula')
            .select('id_matricula')
            .where('token_seguimiento', '=', token)
            .executeTakeFirst();
        if (!res)
            throw new Error('Token inválido');
        return this.updateDocuments(res.id_matricula, files);
    }
    /** MR03 – El padre corrige los documentos */
    static async updateDocuments(idMatricula, files) {
        return await kysely_1.db.transaction().execute(async (trx) => {
            for (const [key, fileArray] of Object.entries(files)) {
                const file = fileArray[0];
                const filename = file.originalname || file.filename || `${key}.pdf`;
                const currentDocRes = await trx
                    .selectFrom('documento_matriculas')
                    .select(['id_colegio', (0, kysely_2.sql) `COALESCE(MAX(version), 0)`.as('max_version')])
                    .where('id_matricula', '=', idMatricula)
                    .where('tipo_documento', '=', key)
                    .groupBy('id_colegio')
                    .executeTakeFirst();
                let schoolId = 1;
                let nextVersion = 1;
                if (currentDocRes) {
                    schoolId = currentDocRes.id_colegio;
                    nextVersion = Number(currentDocRes.max_version) + 1;
                }
                else {
                    const matRes = await trx
                        .selectFrom('matricula')
                        .select('id_colegio')
                        .where('id_matricula', '=', idMatricula)
                        .executeTakeFirst();
                    if (matRes) {
                        schoolId = matRes.id_colegio;
                    }
                }
                await trx
                    .insertInto('documento_matriculas')
                    .values({
                    id_matricula: idMatricula,
                    tipo_documento: key,
                    url: filename,
                    estado: 'PENDIENTE',
                    fecha: new Date(),
                    id_colegio: schoolId,
                    version: nextVersion,
                    contenido: file.buffer || null,
                    mime_type: file.mimetype || null,
                    nombre_original: file.originalname || filename,
                    tamano_bytes: file.size || null
                })
                    .execute();
            }
            await trx
                .updateTable('matricula')
                .set({ estado: 'CORREGIDA' })
                .where('id_matricula', '=', idMatricula)
                .execute();
            return { success: true };
        });
    }
    /** MR04 – Finalizar registro: crea estudiante y padre, actualiza matricula */
    static async finalizeEnrollment(idMatricula, data) {
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
        if ((0, documentValidation_1.normalizeDocument)(data.student.documento) === (0, documentValidation_1.normalizeDocument)(data.parent.documento)) {
            throw new Error(`El número de documento de identidad (${data.student.documento}) no está permitido: el estudiante y el acudiente no pueden tener el mismo documento de identidad.`);
        }
        return await kysely_1.db.transaction().execute(async (trx) => {
            const mat = await trx
                .selectFrom('matricula')
                .selectAll()
                .where('id_matricula', '=', idMatricula)
                .executeTakeFirst();
            if (!mat)
                throw new Error('Matrícula no encontrada');
            const finalGradeId = data.id_grado || mat.id_grupo;
            const { id_colegio, correo_padre } = mat;
            // --- VALIDACIÓN TRANSACTIONAL DE CUPOS CON BLOQUEO DE FILA (RN-MAT-011) ---
            if (finalGradeId) {
                const groupCapRes = await trx
                    .selectFrom('grupos as g')
                    .select([
                    'g.cupos_totales',
                    (0, kysely_2.sql) `(SELECT COUNT(*) FROM matricula WHERE id_grupo = g.id_grupo AND estado IN ('ACTIVA', 'TRASLADADA') AND id_matricula != ${idMatricula})::int`.as('ocupados')
                ])
                    .where('g.id_grupo', '=', finalGradeId)
                    .forUpdate()
                    .executeTakeFirst();
                if (groupCapRes) {
                    const totalCupos = groupCapRes.cupos_totales ?? 35;
                    const ocupados = Number(groupCapRes.ocupados);
                    if (ocupados >= totalCupos) {
                        throw new Error(`El salón seleccionado no posee cupos disponibles (Cupos totales: ${totalCupos}, Inscritos activos: ${ocupados}). Por favor selecciona otro grupo.`);
                    }
                }
            }
            // --- CREACIÓN O ACTUALIZACIÓN DEL ESTUDIANTE ---
            let idEstudiante = mat.id_estudiante || (data.id_estudiante ? Number(data.id_estudiante) : null);
            let studentCode;
            // Validar unicidad global del documento del estudiante en la plataforma
            await (0, documentValidation_1.validateDocumentUniqueness)(trx, data.student.documento, "estudiante", { excludeEstudianteId: idEstudiante });
            if (idEstudiante) {
                const estRes = await trx
                    .selectFrom('estudiante')
                    .select(['id_usuario', 'codigo', 'estado'])
                    .where('id_estudiante', '=', idEstudiante)
                    .executeTakeFirst();
                if (!estRes)
                    throw new Error('Estudiante pre-asociado no encontrado');
                if (estRes.estado === 'GRADUADO') {
                    throw new Error('El estudiante ya se encuentra graduado y no puede matricularse nuevamente');
                }
                studentCode = estRes.codigo;
                const idUsuarioEstudiante = estRes.id_usuario;
                if (idUsuarioEstudiante) {
                    await trx
                        .updateTable('usuario')
                        .set({
                        activo: true,
                        nombre: data.student.nombre,
                        apellido: data.student.apellido,
                        id_tipodocumento: Number(data.student.id_tipodocumento),
                        documento: data.student.documento
                    })
                        .where('id_usuario', '=', idUsuarioEstudiante)
                        .execute();
                }
                await trx
                    .updateTable('estudiante')
                    .set({
                    estado: 'ACTIVO',
                    nombre: data.student.nombre,
                    apellido: data.student.apellido
                })
                    .where('id_estudiante', '=', idEstudiante)
                    .execute();
            }
            else {
                studentCode = 'MAT-' + Date.now();
                const hashedStudentPass = await bcrypt_1.default.hash(studentCode, 10);
                const studentEmail = (data.student?.email && String(data.student.email).trim()) ? String(data.student.email).trim().toLowerCase() : null;
                const studentUserRes = await trx
                    .insertInto('usuario')
                    .values({
                    email: studentEmail,
                    password: hashedStudentPass,
                    nombre: data.student.nombre,
                    apellido: data.student.apellido,
                    id_tipodocumento: Number(data.student.id_tipodocumento),
                    documento: data.student.documento,
                    telefono: null
                })
                    .returning('id_usuario')
                    .executeTakeFirstOrThrow();
                const idUsuarioEstudiante = studentUserRes.id_usuario;
                const rolEstudiante = await trx
                    .selectFrom('rol')
                    .select('id_rol')
                    .where('nombre', '=', 'estudiante')
                    .executeTakeFirst();
                if (rolEstudiante) {
                    const idRolEst = rolEstudiante.id_rol;
                    await trx
                        .insertInto('usuario_rol')
                        .values({ id_usuario: idUsuarioEstudiante, id_rol: idRolEst })
                        .execute();
                    await trx
                        .insertInto('usuario_colegio')
                        .values({
                        id_usuario: idUsuarioEstudiante,
                        id_colegio: id_colegio,
                        id_rol: idRolEst,
                        estado: 'ACTIVO',
                        fecha_inicio: new Date()
                    })
                        .onConflict((oc) => oc.doNothing())
                        .execute();
                }
                const studentRes = await trx
                    .insertInto('estudiante')
                    .values({
                    nombre: data.student.nombre,
                    apellido: data.student.apellido,
                    codigo: studentCode,
                    id_colegio: id_colegio,
                    id_usuario: idUsuarioEstudiante,
                    estado: 'ACTIVO'
                })
                    .returning('id_estudiante')
                    .executeTakeFirstOrThrow();
                idEstudiante = studentRes.id_estudiante;
            }
            // --- CREACIÓN / VINCULACIÓN DEL PADRE DE FAMILIA ---
            let idPadre;
            let idUsuarioPadre = null;
            let personalParentEmail = null;
            const existingParentByDoc = await trx
                .selectFrom('padre_familia as pf')
                .innerJoin('usuario as u', 'pf.id_usuario', 'u.id_usuario')
                .select(['pf.id_padrefamilia', 'pf.id_usuario', 'pf.nombre', 'pf.apellido', 'u.email as parent_email'])
                .where('u.documento', '=', data.parent.documento)
                .executeTakeFirst();
            if (existingParentByDoc) {
                idPadre = existingParentByDoc.id_padrefamilia;
                idUsuarioPadre = existingParentByDoc.id_usuario;
                personalParentEmail = existingParentByDoc.parent_email;
                if (idUsuarioPadre) {
                    await trx
                        .updateTable('usuario')
                        .set({
                        nombre: data.parent.nombre,
                        apellido: data.parent.apellido,
                        id_tipodocumento: Number(data.parent.id_tipodocumento),
                        documento: data.parent.documento,
                        telefono: data.parent.telefono || null
                    })
                        .where('id_usuario', '=', idUsuarioPadre)
                        .execute();
                }
                await trx
                    .updateTable('padre_familia')
                    .set({
                    nombre: data.parent.nombre,
                    apellido: data.parent.apellido
                })
                    .where('id_padrefamilia', '=', idPadre)
                    .execute();
            }
            else {
                const existingUserRes = await trx
                    .selectFrom('usuario')
                    .select(['id_usuario', 'documento', 'email', 'nombre', 'apellido'])
                    .where((eb) => eb.or([
                    eb.and([
                        eb('documento', 'is not', null),
                        (0, kysely_2.sql) `TRIM(documento) = TRIM(${data.parent.documento})`
                    ]),
                    (0, kysely_2.sql) `LOWER(email) = LOWER(${correo_padre || ''})`
                ]))
                    .limit(1)
                    .executeTakeFirst();
                if (existingUserRes) {
                    idUsuarioPadre = existingUserRes.id_usuario;
                    personalParentEmail = existingUserRes.email;
                    await trx
                        .updateTable('usuario')
                        .set({
                        id_tipodocumento: Number(data.parent.id_tipodocumento),
                        documento: data.parent.documento,
                        telefono: data.parent.telefono || null
                    })
                        .where('id_usuario', '=', idUsuarioPadre)
                        .execute();
                }
                else {
                    await (0, documentValidation_1.validateDocumentUniqueness)(trx, data.parent.documento, "acudiente");
                    const hashedPadrePass = await bcrypt_1.default.hash('padre123', 10);
                    const parentUserRes = await trx
                        .insertInto('usuario')
                        .values({
                        email: correo_padre,
                        password: hashedPadrePass,
                        nombre: data.parent.nombre,
                        apellido: data.parent.apellido,
                        id_tipodocumento: Number(data.parent.id_tipodocumento),
                        documento: data.parent.documento,
                        telefono: data.parent.telefono || null
                    })
                        .returning('id_usuario')
                        .executeTakeFirstOrThrow();
                    idUsuarioPadre = parentUserRes.id_usuario;
                    personalParentEmail = correo_padre;
                }
                const parentRes = await trx
                    .insertInto('padre_familia')
                    .values({
                    nombre: data.parent.nombre,
                    apellido: data.parent.apellido,
                    id_colegio: id_colegio,
                    id_usuario: idUsuarioPadre
                })
                    .returning('id_padrefamilia')
                    .executeTakeFirstOrThrow();
                idPadre = parentRes.id_padrefamilia;
            }
            if (idUsuarioPadre) {
                const rolPadre = await trx
                    .selectFrom('rol')
                    .select('id_rol')
                    .where('nombre', '=', 'padre')
                    .executeTakeFirst();
                if (rolPadre) {
                    const idRolPadre = rolPadre.id_rol;
                    await trx
                        .insertInto('usuario_rol')
                        .values({ id_usuario: idUsuarioPadre, id_rol: idRolPadre })
                        .onConflict((oc) => oc.doNothing())
                        .execute();
                    await trx
                        .insertInto('usuario_colegio')
                        .values({
                        id_usuario: idUsuarioPadre,
                        id_colegio: id_colegio,
                        id_rol: idRolPadre,
                        estado: 'ACTIVO',
                        fecha_inicio: new Date()
                    })
                        .onConflict((oc) => oc.doNothing())
                        .execute();
                    if (correo_padre) {
                        await (0, emailResolver_1.upsertInstitutionalEmail)(idUsuarioPadre, id_colegio, correo_padre, personalParentEmail, trx);
                    }
                }
            }
            // 3. Vincular Estudiante y Padre (si no están vinculados)
            const linkRes = await trx
                .selectFrom('detalle_padrefamilia')
                .select('id_detallepadrefamilia')
                .where('id_padrefamilia', '=', idPadre)
                .where('id_estudiante', '=', idEstudiante)
                .executeTakeFirst();
            if (!linkRes) {
                await trx
                    .insertInto('detalle_padrefamilia')
                    .values({
                    id_padrefamilia: idPadre,
                    id_estudiante: idEstudiante,
                    id_colegio: id_colegio
                })
                    .execute();
            }
            // 4. Cancelar matrículas previas en estado activo/pendiente para el mismo estudiante en este año lectivo
            await trx
                .updateTable('matricula')
                .set({
                estado: 'CANCELADA',
                motivo_cancelacion: 'Reemplazada por reingreso / nueva matrícula finalizada'
            })
                .where('id_estudiante', '=', idEstudiante)
                .where('id_anio', '=', mat.id_anio)
                .where('id_colegio', '=', id_colegio)
                .where('id_matricula', '!=', idMatricula)
                .where('estado', 'in', ['ACTIVA', 'PENDIENTE', 'CORREGIDA', 'CORRECCION'])
                .execute();
            // 5. Actualizar Matrícula actual a ACTIVA o TRASLADADA
            const finalEstado = mat.es_traslado ? 'TRASLADADA' : 'ACTIVA';
            await trx
                .updateTable('matricula')
                .set({
                id_estudiante: idEstudiante,
                id_grupo: finalGradeId,
                estado: finalEstado,
                fecha_aprobacion: new Date()
            })
                .where('id_matricula', '=', idMatricula)
                .execute();
            if (mat.id_ticket) {
                await trx
                    .updateTable('tickets_soporte')
                    .set({ estado: 'RESUELTO' })
                    .where('id_ticket', '=', mat.id_ticket)
                    .execute();
            }
            if (idEstudiante) {
                await trx
                    .updateTable('estudiante')
                    .set({ estado: 'ACTIVO', motivo_estado: null })
                    .where('id_estudiante', '=', idEstudiante)
                    .execute();
            }
            // Supervision Logging if admin_general
            const isRenovacion = !!data.id_estudiante;
            const isReingreso = mat.tipo === 'REINGRESO';
            const isExtraordinaria = mat.tipo === 'EXTRAORDINARIA';
            let actionLabel = 'Aprobación de Matrícula';
            let reasonLabel = 'Matrícula de ingreso regular finalizada';
            if (isReingreso) {
                actionLabel = 'Aprobación de Reingreso';
                reasonLabel = 'Reingreso de estudiante retirado finalizado';
            }
            else if (isRenovacion) {
                actionLabel = 'Renovación de Matrícula';
                reasonLabel = 'Renovación de estudiante existente';
            }
            else if (isExtraordinaria) {
                actionLabel = 'Aprobación de Matrícula Extraordinaria';
                reasonLabel = 'Matrícula extraordinaria finalizada';
            }
            const auditRes = await trx
                .selectFrom('auditoria_supervision')
                .select('id_auditoria')
                .where('id_colegio', '=', id_colegio)
                .where('estado_supervision', '=', 'ACTIVA')
                .limit(1)
                .executeTakeFirst();
            if (auditRes) {
                await trx
                    .insertInto('auditoria_acciones_realizadas')
                    .values({
                    id_auditoria: auditRes.id_auditoria,
                    modulo: 'MATRICULAS',
                    tipo_accion: 'MODIFICACION',
                    accion: actionLabel,
                    recurso_afectado: `Matricula ID: ${idMatricula}`,
                    valor_antiguo: null,
                    valor_nuevo: JSON.stringify({ idEstudiante, finalGradeId }),
                    motivo_cambio: reasonLabel
                })
                    .execute();
            }
            if (correo_padre) {
                notificationService_1.NotificationService.sendApprovalEmail(correo_padre, data.parent.nombre, `${data.student.nombre} ${data.student.apellido}`, studentCode);
            }
            return { success: true, idEstudiante, idPadre };
        });
    }
    static async toggleTransferStatus(idMatricula, esTraslado) {
        await kysely_1.db
            .updateTable('matricula')
            .set({ es_traslado: esTraslado })
            .where('id_matricula', '=', idMatricula)
            .execute();
        return { success: true };
    }
    static async cancelEnrollment(idMatricula, data) {
        return await kysely_1.db.transaction().execute(async (trx) => {
            const mat = await trx
                .selectFrom('matricula')
                .select(['id_estudiante', 'correo_padre', 'estado', 'id_ticket'])
                .where('id_matricula', '=', idMatricula)
                .executeTakeFirst();
            if (!mat)
                throw new Error('Matrícula no encontrada');
            if (mat.estado === 'CANCELADA' || mat.estado === 'CULMINADA') {
                throw new Error('La matrícula ya se encuentra cancelada o culminada');
            }
            const targetStudentState = data.estado_estudiante === 'EXPULSADO' ? 'EXPULSADO' : 'RETIRADO';
            await trx
                .updateTable('matricula')
                .set({
                estado: 'CANCELADA',
                motivo_cancelacion: data.motivo,
                detalles_cancelacion: data.detalles || null
            })
                .where('id_matricula', '=', idMatricula)
                .execute();
            if (mat.id_ticket) {
                await trx
                    .updateTable('tickets_soporte')
                    .set({ estado: 'RESUELTO' })
                    .where('id_ticket', '=', mat.id_ticket)
                    .execute();
            }
            if (mat.id_estudiante) {
                await trx
                    .updateTable('estudiante')
                    .set({
                    estado: targetStudentState,
                    motivo_estado: data.motivo
                })
                    .where('id_estudiante', '=', mat.id_estudiante)
                    .execute();
            }
            if (mat.correo_padre) {
                await notificationService_1.NotificationService.sendCancellationEmail(mat.correo_padre, 'Padre de Familia', data.motivo, data.detalles || data.motivo);
            }
            return { success: true };
        });
    }
}
exports.MatriculaService = MatriculaService;
