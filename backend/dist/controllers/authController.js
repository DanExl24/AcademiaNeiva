"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = void 0;
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
       WHERE u.email = $1 AND u.activo = TRUE
       GROUP BY u.id_usuario`, [email]);
        if (userRes.rows.length === 0) {
            res.status(401).json({ error: "Credenciales incorrectas" });
            return;
        }
        const user = userRes.rows[0];
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
