import api from './api'

export const boletinService = {
  async getStudentBoletin(studentId: number | string, periodId: number | string): Promise<any> {
    const res = await api.get(`/boletines/student/${studentId}/${periodId}`)
    return res.data
  },

  async getGroupBoletin(groupId: number | string, periodId: number | string): Promise<any> {
    const res = await api.get(`/boletines/grade/${groupId}/${periodId}`)
    return res.data
  },

  async getStudentTransferPartialReport(studentId: number | string, yearId?: number | string | null): Promise<any> {
    const params = yearId ? { id_anio: yearId } : {}
    const res = await api.get(`/boletines/transfer-partial-report/${studentId}`, { params })
    return res.data
  }
}

export default boletinService
