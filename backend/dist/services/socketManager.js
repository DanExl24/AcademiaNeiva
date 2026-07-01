"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketManager = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
/**
 * Servicio centralizado de WebSockets (Socket.io).
 *
 * Gestiona las conexiones/desconexiones de usuarios autenticados
 * y emite actualizaciones de "sesiones activas" en tiempo real
 * a los administradores generales que estén observando el Dashboard.
 */
class SocketManager {
    constructor() {
        this.io = null;
        /** Map de socketId → userId para rastrear sesiones únicas */
        this.connectedUsers = new Map();
    }
    /** Set de IDs de usuario únicos conectados */
    get activeUserCount() {
        const uniqueUsers = new Set(this.connectedUsers.values());
        return uniqueUsers.size;
    }
    /**
     * Inicializa Socket.io sobre el servidor HTTP existente.
     * Configura la autenticación JWT y los event handlers.
     */
    init(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.ALLOWED_ORIGINS
                    ? process.env.ALLOWED_ORIGINS.split(',')
                    : ['http://localhost:5173'],
                credentials: true
            },
            // Namespace raíz
            path: '/socket.io'
        });
        // Middleware de autenticación: cada conexión debe incluir un JWT válido
        this.io.use((socket, next) => {
            const token = socket.handshake.auth?.token;
            if (!token) {
                return next(new Error('Token de autenticación requerido'));
            }
            try {
                const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                socket.userId = decoded.id;
                socket.userRoles = decoded.roles || [decoded.role];
                next();
            }
            catch {
                next(new Error('Token inválido o expirado'));
            }
        });
        this.io.on('connection', (socket) => {
            const userId = socket.userId;
            const roles = socket.userRoles;
            // Registrar usuario conectado
            this.connectedUsers.set(socket.id, userId);
            // Si el usuario es admin_general, unirlo a la sala de administradores
            if (roles.includes('admin_general')) {
                socket.join('admin_general');
            }
            // Emitir actualización a los admins generales
            this.broadcastActiveCount();
            console.log(`[WS] Usuario ${userId} conectado (socket: ${socket.id}). Activos: ${this.activeUserCount}`);
            // Desconexión
            socket.on('disconnect', () => {
                this.connectedUsers.delete(socket.id);
                this.broadcastActiveCount();
                console.log(`[WS] Usuario ${userId} desconectado (socket: ${socket.id}). Activos: ${this.activeUserCount}`);
            });
        });
        console.log('[WS] Socket.io inicializado correctamente.');
        return this.io;
    }
    /**
     * Emite la cantidad actualizada de sesiones activas
     * a todos los administradores generales conectados.
     */
    broadcastActiveCount() {
        if (!this.io)
            return;
        this.io.to('admin_general').emit('active_sessions_update', {
            conectados: this.activeUserCount
        });
    }
    /**
     * Devuelve la instancia de Socket.io (o null si no está inicializado).
     */
    getIO() {
        return this.io;
    }
}
// Singleton exportado
exports.socketManager = new SocketManager();
