"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDirectivo = exports.requireAdminGeneral = exports.verifyToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
/**
 * Middleware que verifica el token JWT y extrae la información del usuario.
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token de autenticación requerido' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            roles: decoded.roles || [decoded.role],
            schoolId: decoded.schoolId || null,
        };
        next();
    }
    catch (error) {
        res.status(401).json({ error: 'Token inválido o expirado' });
    }
};
exports.verifyToken = verifyToken;
/**
 * Middleware que verifica que el usuario tenga el rol de Admin General.
 * Debe usarse DESPUÉS de verifyToken.
 */
const requireAdminGeneral = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }
    if (!req.user.roles.includes('admin_general')) {
        res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador General.' });
        return;
    }
    next();
};
exports.requireAdminGeneral = requireAdminGeneral;
/**
 * Middleware que verifica que el usuario sea un directivo del colegio indicado.
 * Debe usarse DESPUÉS de verifyToken.
 */
const requireDirectivo = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }
    if (!req.user.roles.includes('directivo') &&
        !req.user.roles.includes('rector') &&
        !req.user.roles.includes('admin_general')) {
        res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Directivo o Administrador General.' });
        return;
    }
    next();
};
exports.requireDirectivo = requireDirectivo;
