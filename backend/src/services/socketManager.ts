import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

/**
 * Servicio centralizado de WebSockets (Socket.io).
 * 
 * Gestiona las conexiones/desconexiones de usuarios autenticados
 * y emite actualizaciones de "sesiones activas" en tiempo real
 * a los administradores generales que estén observando el Dashboard.
 */
class SocketManager {
  private io: Server | null = null;

  /** Map de socketId → userId para rastrear sesiones únicas */
  private connectedUsers: Map<string, number> = new Map();

  /** Set de IDs de usuario únicos conectados */
  get activeUserCount(): number {
    const uniqueUsers = new Set(this.connectedUsers.values());
    return uniqueUsers.size;
  }

  /**
   * Inicializa Socket.io sobre el servidor HTTP existente.
   * Configura la autenticación JWT y los event handlers.
   */
  init(httpServer: HttpServer): Server {
    this.io = new Server(httpServer, {
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
    this.io.use((socket: Socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Token de autenticación requerido'));
      }
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        (socket as any).userId = decoded.id;
        (socket as any).userRoles = decoded.roles || [decoded.role];
        next();
      } catch {
        next(new Error('Token inválido o expirado'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId as number;
      const roles = (socket as any).userRoles as string[];

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
  private broadcastActiveCount(): void {
    if (!this.io) return;
    this.io.to('admin_general').emit('active_sessions_update', {
      conectados: this.activeUserCount
    });
  }

  /**
   * Devuelve la instancia de Socket.io (o null si no está inicializado).
   */
  getIO(): Server | null {
    return this.io;
  }
}

// Singleton exportado
export const socketManager = new SocketManager();
