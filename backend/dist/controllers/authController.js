"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchoolIdentity = exports.studentLogin = exports.login = void 0;
const db_1 = require("../config/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        // 1. Buscar usuario por email e incluir sus roles
        const userRes = await db_1.pool.query(`SELECT u.*, array_agg(r.nombre) as roles
       FROM usuario u
       JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
       JOIN rol r ON ur.id_rol = r.id_rol
       WHERE u.email = $1
       GROUP BY u.id_usuario`, [email]);
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
        // 2. Verificar contraseña
        const validPassword = await bcrypt_1.default.compare(password, user.password);
        if (!validPassword) {
            res.status(401).json({ error: "Credenciales incorrectas" });
            return;
        }
        // 3. Generar JWT
        const token = jsonwebtoken_1.default.sign({
            id: user.id_usuario,
            email: user.email,
            role: user.roles[0], // Tomamos el primer rol como principal
            roles: user.roles,
            schoolId: user.id_colegio
        }, JWT_SECRET, { expiresIn: "8h" });
        // 4. Responder con datos del usuario (sin password)
        const { password: _, ...userWithoutPassword } = user;
        res.json({
            user: {
                id: userWithoutPassword.id_usuario,
                name: userWithoutPassword.nombre,
                email: userWithoutPassword.email,
                role: userWithoutPassword.roles[0],
                roles: userWithoutPassword.roles,
                schoolId: userWithoutPassword.id_colegio
            },
            token
        });
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
        const token = jsonwebtoken_1.default.sign({
            id: user.id_usuario,
            email: user.email,
            role: "estudiante",
            roles: user.roles,
            schoolId: user.id_colegio
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
