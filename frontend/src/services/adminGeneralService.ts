import api from './api'

export const adminGeneralService = {
  // Dashboard
  async getDashboardStats(): Promise<any> {
    const res = await api.get('/admin/dashboard/stats')
    return res.data
  },

  // Colegios
  async getColegios(params?: any): Promise<any> {
    const res = await api.get('/admin/colegios', { params })
    return res.data
  },

  async getColegio(id: number | string): Promise<any> {
    const res = await api.get(`/admin/colegios/${id}`)
    return res.data
  },

  async createColegio(payload: any): Promise<any> {
    const res = await api.post('/admin/colegios', payload)
    return res.data
  },

  async updateColegio(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/admin/colegios/${id}`, payload)
    return res.data
  },

  async updateColegioEstado(id: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/admin/colegios/${id}/estado`, payload)
    return res.data
  },

  async deleteColegio(id: number | string): Promise<any> {
    const res = await api.delete(`/admin/colegios/${id}`)
    return res.data
  },

  // Usuarios
  async getUsuarios(params?: any): Promise<any> {
    const res = await api.get('/admin/usuarios', { params })
    return res.data
  },

  async getUsuario(id: number | string): Promise<any> {
    const res = await api.get(`/admin/usuarios/${id}`)
    return res.data
  },

  async createUsuario(payload: any): Promise<any> {
    const res = await api.post('/admin/usuarios', payload)
    return res.data
  },

  async validarTicketUsuario(id: number | string, payload: { codigo_ticket: string }): Promise<any> {
    const res = await api.post(`/admin/usuarios/${id}/validar-ticket`, payload)
    return res.data
  },

  async updateUsuarioCredencialesConTicket(id: number | string, payload: any): Promise<any> {
    const res = await api.put(`/admin/usuarios/${id}/credenciales-con-ticket`, payload)
    return res.data
  },


  async updateUsuarioEstado(id: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/admin/usuarios/${id}/estado`, payload)
    return res.data
  },

  async restablecerPassword(id: number | string): Promise<any> {
    const res = await api.post(`/admin/usuarios/${id}/restablecer-password`, {})
    return res.data
  },

  async cerrarSesionUsuario(id: number | string): Promise<any> {
    const res = await api.post(`/admin/usuarios/${id}/cerrar-sesion`, {})
    return res.data
  },

  async updateUsuarioRol(id: number | string, payload: any): Promise<any> {
    const res = await api.patch(`/admin/usuarios/${id}/roles`, payload)
    return res.data
  },

  async eliminarUsuarioConTicket(id: number | string, payload: { codigo_ticket: string; motivo?: string }): Promise<any> {
    const res = await api.patch(`/admin/usuarios/${id}/eliminar`, payload)
    return res.data
  },


  // Auditorias
  async getAuditorias(params?: any): Promise<any> {
    const res = await api.get('/admin/auditorias', { params })
    return res.data
  },

  // Configuracion Global
  async getConfiguracion(): Promise<any> {
    const res = await api.get('/admin/configuracion')
    return res.data
  },

  async updateConfiguracion(payload: any): Promise<any> {
    const res = await api.put('/admin/configuracion', payload)
    return res.data
  },

  // Notificaciones
  async getNotificaciones(params?: any): Promise<any> {
    const res = await api.get('/admin/notificaciones', { params })
    return res.data
  }
}

export default adminGeneralService
