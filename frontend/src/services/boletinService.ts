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

  async getStudentTransferPartialReport(studentId: number | string): Promise<any> {
    const res = await api.get(`/boletines/transfer-partial-report/${studentId}`)
    return res.data
  }
}

export default boletinService
