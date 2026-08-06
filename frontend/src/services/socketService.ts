import { io, Socket } from 'socket.io-client'

const getSocketUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return envUrl.replace(/\/api\/?$/, '').replace(/\/$/, '')
  return ''
}

const SOCKET_URL = getSocketUrl()

let socket: Socket | null = null

/**
 * Servicio singleton de WebSockets para el frontend.
 * 
 * Conecta al servidor usando el JWT del usuario autenticado
 * y permite suscribirse a eventos en tiempo real (ej. sesiones activas).
 */
export const socketService = {
  /**
   * Conecta al servidor de WebSockets con el token JWT proporcionado.
   * Si ya existe una conexión, la desconecta primero.
   */
  connect(token: string): Socket {
    if (socket?.connected) {
      socket.disconnect()
    }

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000
    })

    socket.on('connect', () => {
      console.log('[WS] Conectado al servidor:', socket?.id)
    })

    socket.on('connect_error', (err) => {
      console.warn('[WS] Error de conexión:', err.message)
    })

    socket.on('disconnect', (reason) => {
      console.log('[WS] Desconectado:', reason)
    })

    return socket
  },

  /**
   * Desconecta el socket actual.
   */
  disconnect(): void {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  },

  /**
   * Devuelve la instancia del socket actual (puede ser null).
   */
  getSocket(): Socket | null {
    return socket
  },

  /**
   * Registra un listener para un evento específico del socket.
   * Devuelve una función de cleanup para eliminar el listener.
   */
  on(event: string, callback: (...args: any[]) => void): () => void {
    socket?.on(event, callback)
    return () => {
      socket?.off(event, callback)
    }
  },

  /**
   * Comprueba si el socket está conectado actualmente.
   */
  isConnected(): boolean {
    return socket?.connected ?? false
  }
}
