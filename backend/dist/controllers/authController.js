"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const db_1 = require("../config/db");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class AuthController {
    static async login(req, res) {
        const { email, password, schoolId } = req.body;
        try {
            const userRes = await db_1.pool.query("SELECT * FROM usuario WHERE correo = $1 AND id_colegio = $2", [email, schoolId]);
            if (userRes.rows.length === 0) {
                return res.status(401).json({ message: "Credenciales inválidas o colegio incorrecto" });
            }
            const user = userRes.rows[0];
            const validPass = await bcrypt_1.default.compare(password, user.password);
            if (!validPass) {
                return res.status(401).json({ message: "Contraseña incorrecta" });
            }
            // Obtener roles
            const rolesRes = await db_1.pool.query(`SELECT r.nombre 
         FROM usuario_rol ur
         JOIN rol r ON ur.id_rol = r.id_rol
         WHERE ur.id_usuario = $1`, [user.id_usuario]);
            const roles = rolesRes.rows.map(r => r.nombre.toLowerCase());
            // Obtener IDs de entidades relacionadas
            const entities = {};
            if (roles.includes('docente')) {
                const dRes = await db_1.pool.query("SELECT id_docente FROM docente WHERE id_usuario = $1", [user.id_usuario]);
                if (dRes.rows.length > 0)
                    entities.docenteId = dRes.rows[0].id_docente;
            }
            if (roles.includes('padre_familia')) {
                const pRes = await db_1.pool.query("SELECT id_padrefamilia FROM padre_familia WHERE id_usuario = $1", [user.id_usuario]);
                if (pRes.rows.length > 0)
                    entities.padreId = pRes.rows[0].id_padrefamilia;
            }
            if (roles.includes('estudiante')) {
                const eRes = await db_1.pool.query("SELECT id_estudiante, id_grado FROM estudiante WHERE id_usuario = $1", [user.id_usuario]);
                if (eRes.rows.length > 0) {
                    entities.studentId = eRes.rows[0].id_estudiante;
                    entities.gradoId = eRes.rows[0].id_grado;
                }
            }
            if (roles.includes('directivo')) {
                const dirRes = await db_1.pool.query("SELECT id FROM directivo WHERE id_usuario = $1", [user.id_usuario]);
                if (dirRes.rows.length > 0)
                    entities.directivoId = dirRes.rows[0].id;
            }
            const token = jsonwebtoken_1.default.sign({ id: user.id_usuario, email: user.correo, roles, schoolId: user.id_colegio, ...entities }, process.env.JWT_SECRET || "secret_key", { expiresIn: "8h" });
            res.json({
                token,
                user: {
                    id: user.id_usuario,
                    email: user.correo,
                    roles,
                    schoolId: user.id_colegio,
                    ...entities
                }
            });
        }
        catch (error) {
            console.error("Login error:", error);
            res.status(500).json({ message: "Error en el servidor" });
        }
    }
}
exports.AuthController = AuthController;
