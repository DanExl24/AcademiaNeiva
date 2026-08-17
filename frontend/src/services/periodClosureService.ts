import api from './api'

export const periodClosureService = {
  async getClosureDetails(schoolId: number | string, periodId: number | string): Promise<any> {
    const res = await api.get(`/academic-admin/settings/closure-details/${schoolId}/${periodId}`)
    return res.data
  },

  async closePeriod(periodId: number | string, schoolId: number | string, force = false): Promise<any> {
    const res = await api.post(`/academic-admin/settings/periods/${periodId}/close`, {
      schoolId,
      force
    })
    return res.data
  },

  async reopenPeriod(periodId: number | string, schoolId: number | string): Promise<any> {
    const res = await api.post(`/academic-admin/settings/periods/${periodId}/reopen`, {
      schoolId
    })
    return res.data
  },

  async reopenSubject(periodId: number | string, detalleGradoId: number | string, schoolId: number | string): Promise<any> {
    const res = await api.post(`/academic-admin/settings/periods/${periodId}/reopen-subject/${detalleGradoId}`, {
      schoolId
    })
    return res.data
  }
}

export default periodClosureService
