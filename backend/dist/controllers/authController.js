"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySession = exports.getSchoolIdentity = exports.studentLogin = exports.login = void 0;
const db_1 = require("../config/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
const login = async (req, res) => {
    const { email, password } = req.body;
    if (typeof email !== "string" || !email.trim()) {
        res.status(400).json({ error: "El correo o código es obligatorio" });
        return;
    }
    const credential = email.trim();
    try {
        if (credential.includes("@")) {
            // --- LOGIN GENERAL (Email: directivo, docente, padre, admin_general) ---
            const userRes = await db_1.pool.query(`SELECT u.*, array_agg(r.nombre) as roles
         FROM usuario u
         JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
         JOIN rol r ON ur.id_rol = r.id_rol
         WHERE u.email = $1
         GROUP BY u.id_usuario`, [credential]);
            if (userRes.rows.length === 0) {
                res.status(401).json({ error: "Credenciales incorrectas" });
                return;
            }
            const user = userRes.rows[0];
            // Verificar estado del usuario
            if (user.estado === 'BANEADO') {
                res.status(403).json({ error: "Tu cuenta ha sido baneada. Contacta al administrador." });
                return;
            }
            if (user.estado === 'SUSPENDIDO') {
                res.status(403).json({ error: "Tu cuenta se encuentra suspendida." });
                return;
            }
            if (user.estado === 'ELIMINADO') {
                res.status(401).json({ error: "Credenciales incorrectas" });
                return;
            }
            // Verificar estado del colegio (si el usuario pertenece a uno)
            if (user.id_colegio) {
                const colegioRes = await db_1.pool.query('SELECT estado FROM colegio WHERE id_colegio = $1', [user.id_colegio]);
                if (colegioRes.rows.length > 0) {
                    const estadoColegio = colegioRes.rows[0].estado;
                    if (estadoColegio === 'PENDIENTE') {
                        res.status(403).json({ error: "El colegio asociado aún no ha sido aprobado." });
                        return;
                    }
                    if (estadoColegio === 'SUSPENDIDO') {
                        res.status(403).json({ error: "El colegio asociado se encuentra suspendido." });
                        return;
                    }
                    if (estadoColegio === 'RECHAZADO' || estadoColegio === 'ELIMINADO') {
                        res.status(403).json({ error: "El colegio asociado no tiene acceso al sistema." });
                        return;
                    }
                }
            }
            // Verificar contraseña
            const validPassword = await bcrypt_1.default.compare(password, user.password);
            if (!validPassword) {
                res.status(401).json({ error: "Credenciales incorrectas" });
                return;
            }
            // Query schoolIds for parent
            let schoolIds = [];
            if (user.roles.includes("padre")) {
                const parentInfoRes = await db_1.pool.query(`SELECT id_padrefamilia FROM padre_familia WHERE id_usuario = $1`, [user.id_usuario]);
                if (parentInfoRes.rows.length > 0) {
                    const idPadre = parentInfoRes.rows[0].id_padrefamilia;
                    const schoolsRes = await db_1.pool.query(`SELECT DISTINCT id_colegio FROM detalle_padrefamilia WHERE id_padrefamilia = $1`, [idPadre]);
                    schoolIds = schoolsRes.rows.map(r => Number(r.id_colegio));
                }
            }
            // Generar JWT
            const jti = crypto_1.default.randomUUID();
            const token = jsonwebtoken_1.default.sign({
                id: user.id_usuario,
                email: user.email,
                role: user.roles[0],
                roles: user.roles,
                schoolId: user.id_colegio,
                schoolIds: schoolIds.length > 0 ? schoolIds : undefined,
                jti
            }, JWT_SECRET, { expiresIn: "8h" });
            const { password: _, ...userWithoutPassword } = user;
            res.json({
                user: {
                    id: userWithoutPassword.id_usuario,
                    name: userWithoutPassword.nombre,
                    email: userWithoutPassword.email,
                    role: userWithoutPassword.roles[0],
                    roles: userWithoutPassword.roles,
                    schoolId: userWithoutPassword.id_colegio,
                    schoolIds: schoolIds.length > 0 ? schoolIds : undefined
                },
                token
            });
        }
        else {
            // --- LOGIN ESTUDIANTE (Código: e.g. EST-1-12) ---
            const studentRes = await db_1.pool.query(`SELECT e.id_usuario, e.estado AS estado_estudiante, u.email, u.nombre, u.password, u.id_colegio, u.estado, array_agg(r.nombre) as roles
         FROM estudiante e
         JOIN usuario u ON e.id_usuario = u.id_usuario
         JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
         JOIN rol r ON ur.id_rol = r.id_rol
         WHERE e.codigo = $1
         GROUP BY e.id_usuario, e.estado, u.email, u.nombre, u.password, u.id_colegio, u.estado`, [credential]);
            if (studentRes.rows.length === 0) {
                res.status(401).json({ error: "Código o contraseña incorrectos" });
                return;
            }
            const user = studentRes.rows[0];
            // Verificar estado del estudiante (expulsado no puede ingresar)
            if (user.estado_estudiante === 'EXPULSADO') {
                res.status(403).json({ error: "Tu cuenta ha sido suspendida por expulsión. No tienes acceso al sistema." });
                return;
            }
            // Verificar estado del usuario
            if (user.estado !== 'ACTIVO') {
                res.status(403).json({ error: "Tu cuenta no se encuentra activa. Contacta al administrador." });
                return;
            }
            // Verificar contraseña
            const validPassword = await bcrypt_1.default.compare(password, user.password);
            if (!validPassword) {
                res.status(401).json({ error: "Código o contraseña incorrectos" });
                return;
            }
            // Generar JWT
            const jti = crypto_1.default.randomUUID();
            const token = jsonwebtoken_1.default.sign({
                id: user.id_usuario,
                email: user.email,
                role: "estudiante",
                roles: user.roles,
                schoolId: user.id_colegio,
                jti
            }, JWT_SECRET, { expiresIn: "8h" });
            res.json({
                user: {
                    id: user.id_usuario,
                    name: user.nombre,
                    email: user.email,
                    role: "estudiante",
                    roles: user.roles,
                    schoolId: user.id_colegio
                },
                token
            });
        }
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.login = login;
const studentLogin = async (req, res) => {
    const { codigo, password } = req.body;
    try {
        // 1. Buscar el estudiante por su código (incluye estado del estudiante)
        const studentRes = await db_1.pool.query(`SELECT e.id_usuario, e.estado AS estado_estudiante, u.email, u.nombre, u.password, u.id_colegio, u.estado, array_agg(r.nombre) as roles
       FROM estudiante e
       JOIN usuario u ON e.id_usuario = u.id_usuario
       JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
       JOIN rol r ON ur.id_rol = r.id_rol
       WHERE e.codigo = $1
       GROUP BY e.id_usuario, e.estado, u.email, u.nombre, u.password, u.id_colegio, u.estado`, [codigo]);
        if (studentRes.rows.length === 0) {
            res.status(401).json({ error: "Código o contraseña incorrectos" });
            return;
        }
        const user = studentRes.rows[0];
        // Verificar estado del estudiante (expulsado no puede ingresar)
        if (user.estado_estudiante === 'EXPULSADO') {
            res.status(403).json({ error: "Tu cuenta ha sido suspendida por expulsión. No tienes acceso al sistema." });
            return;
        }
        // Verificar estado del usuario
        if (user.estado !== 'ACTIVO') {
            res.status(403).json({ error: "Tu cuenta no se encuentra activa. Contacta al administrador." });
            return;
        }
        // 2. Verificar contraseña
        const validPassword = await bcrypt_1.default.compare(password, user.password);
        if (!validPassword) {
            res.status(401).json({ error: "Código o contraseña incorrectos" });
            return;
        }
        // 3. Generar JWT
        const jti = crypto_1.default.randomUUID();
        const token = jsonwebtoken_1.default.sign({
            id: user.id_usuario,
            email: user.email,
            role: "estudiante",
            roles: user.roles,
            schoolId: user.id_colegio,
            jti
        }, JWT_SECRET, { expiresIn: "8h" });
        // 4. Responder
        res.json({
            user: {
                id: user.id_usuario,
                name: user.nombre,
                email: user.email,
                role: "estudiante",
                roles: user.roles,
                schoolId: user.id_colegio
            },
            token
        });
    }
    catch (error) {
        console.error("Student Login error:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.studentLogin = studentLogin;
const getSchoolIdentity = async (req, res) => {
    const schoolId = Number(req.params.schoolId);
    if (!schoolId) {
        res.status(400).json({ error: "Colegio inválido" });
        return;
    }
    try {
        const schoolRes = await db_1.pool.query(`SELECT id_colegio, nombre, escudo_url, color_primario, color_secundario 
       FROM colegio 
       WHERE id_colegio = $1`, [schoolId]);
        if (schoolRes.rows.length === 0) {
            res.status(404).json({ error: "Colegio no encontrado" });
            return;
        }
        const school = schoolRes.rows[0];
        const DEFAULT_PRIMARY = "#4f46e5";
        const DEFAULT_SECONDARY = "#0f172a";
        res.json({
            id_colegio: school.id_colegio,
            nombre: school.nombre,
            escudo_url: school.escudo_url || null,
            color_primario: school.color_primario || DEFAULT_PRIMARY,
            color_secundario: school.color_secundario || DEFAULT_SECONDARY
        });
    }
    catch (error) {
        console.error("Error getting school identity:", error);
        res.status(500).json({ error: "Error en el servidor" });
    }
};
exports.getSchoolIdentity = getSchoolIdentity;
/**
 * GET /api/auth/verify
 * Verifica que el JWT sea válido y que el usuario siga activo.
 * Usado por el frontend en el router guard para evitar acceso con tokens expirados/invalidados.
 */
const verifySession = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ valid: false, error: 'Token requerido' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Verificar blacklist
        if (decoded.jti) {
            const blacklistRes = await db_1.pool.query('SELECT 1 FROM token_blacklist WHERE jti = $1', [decoded.jti]);
            if (blacklistRes.rows.length > 0) {
                res.status(401).json({ valid: false, error: 'Sesión invalidada' });
                return;
            }
        }
        // Verificar estado del usuario e invalidación global
        const userDbRes = await db_1.pool.query('SELECT estado, logged_out_at FROM usuario WHERE id_usuario = $1', [decoded.id]);
        if (userDbRes.rows.length === 0) {
            res.status(401).json({ valid: false, error: 'Usuario no encontrado' });
            return;
        }
        const dbUser = userDbRes.rows[0];
        if (dbUser.estado !== 'ACTIVO') {
            res.status(401).json({ valid: false, error: 'Cuenta inactiva o suspendida' });
            return;
        }
        if (dbUser.logged_out_at && decoded.iat) {
            const loggedOutTime = new Date(dbUser.logged_out_at).getTime();
            const tokenIssuedTime = decoded.iat * 1000;
            if (tokenIssuedTime < loggedOutTime) {
                res.status(401).json({ valid: false, error: 'Sesión expirada' });
                return;
            }
        }
        res.json({ valid: true, userId: decoded.id });
    }
    catch {
        res.status(401).json({ valid: false, error: 'Token inválido o expirado' });
    }
};
exports.verifySession = verifySession;
